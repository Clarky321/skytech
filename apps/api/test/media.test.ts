import type { AdminContentDetail, Media } from '@skytech/contracts';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetState, type Session, signedIn, type TestContext } from './helpers.js';

let ctx: TestContext;
let editor: Session;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(async () => {
  await resetState(ctx);
  editor = await signedIn(ctx, 'editor');
});

/** A real image generated in memory; `seed` makes each one unique (dedupe is by hash). */
async function png(width: number, height: number, seed = 0): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: seed % 255, g: 120, b: 200 } },
  })
    .png()
    .toBuffer();
}

const publicBase = () =>
  (process.env.S3_PUBLIC_URL ?? 'http://localhost:9000/skytech-media').replace(
    /skytech-media$/,
    'skytech-media-test',
  );

describe('upload', () => {
  it('stores WebP renditions in S3 and returns their geometry', async () => {
    const res = await editor.upload(await png(2000, 1000), 'screenshot.png').expect(201);
    const media = res.body as Media;
    expect(media.mime).toBe('image/png');
    expect(media.width).toBe(2000);
    expect(media.height).toBe(1000);
    expect(media.variants.map((v) => v.width)).toEqual([640, 1280, 1920]);
    expect(media.full.key).toBe(`media/${media.id}/full.webp`);

    const object = await fetch(`${publicBase()}/${media.variants[0]?.key ?? ''}`);
    expect(object.status).toBe(200);
    expect(object.headers.get('content-type')).toBe('image/webp');
    const meta = await sharp(Buffer.from(await object.arrayBuffer())).metadata();
    expect(meta.width).toBe(640);
  });

  it('does not upscale small images', async () => {
    const media = (await editor.upload(await png(500, 300, 1), 'small.png').expect(201))
      .body as Media;
    expect(media.full.width).toBe(500);
    expect(media.variants).toEqual([]);
  });

  it('strips EXIF/GPS metadata', async () => {
    const withExif = await sharp(await png(800, 600, 2))
      .jpeg()
      .withExif({ IFD0: { Make: 'SecretCamera', Copyright: 'leak' } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const media = (await editor.upload(withExif, 'photo.jpg').expect(201)).body as Media;
    const stored = Buffer.from(
      await (await fetch(`${publicBase()}/${media.full.key}`)).arrayBuffer(),
    );
    const meta = await sharp(stored).metadata();
    expect(meta.exif).toBeUndefined();
    expect(stored.includes(Buffer.from('SecretCamera'))).toBe(false);
  });

  it('deduplicates identical files', async () => {
    const file = await png(300, 300, 3);
    const first = (await editor.upload(file, 'a.png').expect(201)).body as Media;
    const second = (await editor.upload(file, 'b.png').expect(201)).body as Media;
    expect(second.id).toBe(first.id);
    expect((await editor.get('/api/admin/media').expect(200)).body.total).toBe(1);
  });

  it.each([
    [
      'SVG',
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      'logo.svg',
    ],
    ['HTML disguised as PNG', Buffer.from('<!doctype html><script>alert(1)</script>'), 'image.png'],
    ['PDF', Buffer.from('%PDF-1.7\n1 0 obj<<>>endobj\n'), 'doc.png'],
    ['plain text', Buffer.from('just text'), 'notes.jpg'],
  ])('rejects %s with 415 based on the file signature', async (_name, buffer, filename) => {
    const res = await editor.upload(buffer, filename).expect(415);
    expect(res.body.detail).toContain('JPEG, PNG, WebP и GIF');
  });

  it('rejects files over 10 MB with 413', async () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1, 0);
    await editor.upload(big, 'big.png').expect(413);
  });

  it('requires authentication', async () => {
    await ctx
      .http()
      .post('/api/admin/media')
      .set('Origin', 'http://localhost:3000')
      .attach('file', await png(10, 10, 4), 'x.png')
      .expect(401);
  });
});

describe('usage protection', () => {
  it('refuses to delete an image used by an article, allows deleting an unused one', async () => {
    const used = (await editor.upload(await png(400, 300, 5), 'used.png')).body as Media;
    const unused = (await editor.upload(await png(400, 300, 6), 'unused.png')).body as Media;

    const created = (
      await editor.post('/api/admin/content', { type: 'article', title: 'С картинкой' })
    ).body as AdminContentDetail;
    await editor
      .put(`/api/admin/content/${created.id}/draft`, {
        ...created.draft,
        body: {
          type: 'doc',
          content: [
            { type: 'image', attrs: { mediaId: used.id, alt: 'Схема', caption: 'Рис. 1' } },
          ],
        },
        version: created.version,
      })
      .expect(200);

    const res = await editor.delete(`/api/admin/media/${used.id}`).expect(409);
    expect(res.headers['x-problem-code']).toBe('media_in_use');
    await editor.delete(`/api/admin/media/${unused.id}`).expect(204);

    const preview = await editor.get(`/api/admin/content/${created.id}/preview`).expect(200);
    expect(preview.body.html).toContain(`media/${used.id}/full.webp`);
    expect(preview.body.html).toContain('width="400" height="300"');
    expect(preview.body.html).toContain('<figcaption>Рис. 1</figcaption>');
  });

  it('only editors and admins can delete media', async () => {
    const author = await signedIn(ctx, 'author');
    const media = (await author.upload(await png(100, 100, 7), 'x.png').expect(201)).body as Media;
    await author.delete(`/api/admin/media/${media.id}`).expect(403);
  });
});
