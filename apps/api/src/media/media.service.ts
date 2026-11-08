import { createHash, randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  type Media,
  MEDIA_MAX_BYTES,
  type MediaRef,
  type MediaVariant,
  type Paginated,
} from '@skytech/contracts';
import { and, count, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/decorators.js';
import { media } from '../db/schema/index.js';
import { DB, type Db, type DbOrTx, PG_FOREIGN_KEY_VIOLATION, pgErrorCode } from '../platform/db.js';
import { conflict, notFound, ProblemException } from '../platform/problem.js';
import { createRenditions, detectImageMime } from './image-processing.js';
import { StorageService } from './storage.service.js';

type MediaRow = typeof media.$inferSelect;

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async upload(user: AuthUser, file: UploadedFile | undefined, ip: string | null): Promise<Media> {
    if (!file || file.size === 0) {
      throw new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, 'Файл не передан');
    }
    if (file.size > MEDIA_MAX_BYTES) {
      throw new ProblemException(HttpStatus.PAYLOAD_TOO_LARGE, 'Максимальный размер файла — 10 МБ');
    }
    const mime = await detectImageMime(file.buffer);
    if (!mime) {
      throw new ProblemException(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'Допустимы только изображения JPEG, PNG, WebP и GIF',
      );
    }

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.findBySha(sha256);
    if (existing) return this.toMedia(existing);

    let renditions;
    try {
      renditions = await createRenditions(file.buffer, mime);
    } catch {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Не удалось обработать изображение: файл повреждён или слишком большой',
      );
    }

    const id = randomUUID();
    const stored: MediaVariant[] = renditions.map((r) => ({
      key: `media/${id}/${r.name}.webp`,
      width: r.width,
      height: r.height,
    }));
    await Promise.all(
      renditions.map((r, i) => this.storage.put(stored[i]?.key ?? '', r.buffer, 'image/webp')),
    );

    const [full, ...variants] = stored;
    if (!full) throw new Error('no renditions produced');
    try {
      const row = await this.db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(media)
          .values({
            id,
            originalName: sanitizeFileName(file.originalname),
            mime,
            size: file.size,
            sha256,
            width: full.width,
            height: full.height,
            full,
            variants: variants.sort((a, b) => a.width - b.width),
            createdBy: user.id,
          })
          .returning();
        if (!inserted) throw new Error('media insert returned no row');
        await this.audit.record(tx, {
          actorUserId: user.id,
          action: 'media.upload',
          entityType: 'media',
          entityId: id,
          diff: { originalName: inserted.originalName, mime, size: file.size },
          ip,
        });
        return inserted;
      });
      return this.toMedia(row);
    } catch (error) {
      // A concurrent identical upload won the race: drop our objects, return theirs.
      await this.storage.deleteMany(stored.map((s) => s.key)).catch(() => undefined);
      const winner = await this.findBySha(sha256);
      if (winner) return this.toMedia(winner);
      throw error;
    }
  }

  async list(query: {
    page: number;
    pageSize: number;
    q?: string | undefined;
  }): Promise<Paginated<Media>> {
    const where: SQL | undefined = query.q
      ? or(
          ilike(media.originalName, `%${escapeLike(query.q)}%`),
          ilike(media.alt, `%${escapeLike(query.q)}%`),
        )
      : undefined;
    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(media)
        .where(where)
        .orderBy(desc(media.createdAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db.select({ value: count() }).from(media).where(where),
    ]);
    return {
      items: rows.map((r) => this.toMedia(r)),
      page: query.page,
      pageSize: query.pageSize,
      total: total?.value ?? 0,
    };
  }

  async get(id: string): Promise<Media> {
    const [row] = await this.db.select().from(media).where(eq(media.id, id));
    if (!row) throw notFound('Файл не найден');
    return this.toMedia(row);
  }

  async updateAlt(user: AuthUser, id: string, alt: string, ip: string | null): Promise<Media> {
    return this.db.transaction(async (tx) => {
      const [before] = await tx.select().from(media).where(eq(media.id, id)).for('update');
      if (!before) throw notFound('Файл не найден');
      const [row] = await tx.update(media).set({ alt }).where(eq(media.id, id)).returning();
      await this.audit.record(tx, {
        actorUserId: user.id,
        action: 'media.update',
        entityType: 'media',
        entityId: id,
        diff: { alt: { from: before.alt, to: alt } },
        ip,
      });
      return this.toMedia(row ?? before);
    });
  }

  /** Deletes a file that no revision references (enforced by the revision_media foreign key). */
  async delete(user: AuthUser, id: string, ip: string | null): Promise<void> {
    let keys: string[] = [];
    try {
      await this.db.transaction(async (tx) => {
        const [row] = await tx.delete(media).where(eq(media.id, id)).returning();
        if (!row) throw notFound('Файл не найден');
        keys = [row.full.key, ...row.variants.map((v) => v.key)];
        await this.audit.record(tx, {
          actorUserId: user.id,
          action: 'media.delete',
          entityType: 'media',
          entityId: id,
          diff: { originalName: row.originalName },
          ip,
        });
      });
    } catch (error) {
      if (pgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION) {
        throw conflict(
          'Файл используется в материалах и не может быть удалён',
          undefined,
          'media_in_use',
        );
      }
      throw error;
    }
    // After commit: remove objects. A failure leaves orphans in the bucket, never broken pages.
    await this.storage.deleteMany(keys).catch((error: unknown) => {
      this.logger.warn(`Failed to delete objects of media ${id}: ${String(error)}`);
    });
  }

  /** Returns ids from `ids` that do not exist (used to validate documents and covers). */
  async findMissing(ids: string[], tx: DbOrTx = this.db): Promise<string[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const rows = await tx.select({ id: media.id }).from(media).where(inArray(media.id, unique));
    const found = new Set(rows.map((r) => r.id));
    return unique.filter((id) => !found.has(id));
  }

  async getRefs(ids: string[], tx: DbOrTx = this.db): Promise<Map<string, MediaRef>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await tx.select().from(media).where(inArray(media.id, unique));
    return new Map(rows.map((r) => [r.id, this.toRef(r)]));
  }

  private async findBySha(sha256: string): Promise<MediaRow | undefined> {
    const [row] = await this.db
      .select()
      .from(media)
      .where(and(eq(media.sha256, sha256)));
    return row;
  }

  private toRef(row: MediaRow): MediaRef {
    const sources = [...row.variants, row.full].map((v) => ({
      url: this.storage.publicUrl(v.key),
      width: v.width,
    }));
    return {
      id: row.id,
      alt: row.alt,
      width: row.full.width,
      height: row.full.height,
      url: this.storage.publicUrl(row.full.key),
      sources,
    };
  }

  private toMedia(row: MediaRow): Media {
    return {
      id: row.id,
      originalName: row.originalName,
      mime: row.mime,
      size: row.size,
      width: row.width,
      height: row.height,
      alt: row.alt,
      full: row.full,
      variants: row.variants,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function sanitizeFileName(name: string): string {
  // Only used for display in the library; never used to build a storage path.
  const base = name.split(/[\\/]/).pop() ?? 'file';
  // eslint-disable-next-line no-control-regex -- strip control characters on purpose
  return base.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200) || 'file';
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
