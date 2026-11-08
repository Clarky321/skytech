import { DeleteObjectsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import { mediaUrl } from '@skytech/contracts';
import { APP_CONFIG, type AppConfig } from '../platform/config.js';

/** Thin wrapper over the S3-compatible bucket (MinIO locally, provider storage in production). */
@Injectable()
export class StorageService {
  private readonly client: S3Client;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.client = new S3Client({
      region: config.S3_REGION,
      endpoint: config.S3_ENDPOINT,
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Keys are unique per upload (media/<uuid>/…), so objects never change.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.config.S3_BUCKET,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }

  publicUrl(key: string): string {
    return mediaUrl(this.config.S3_PUBLIC_URL, key);
  }
}
