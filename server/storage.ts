import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type StorageConfig = {
  endpoint: string;            // e.g. http://localhost:9000
  region: string;              // e.g. us-east-1
  bucket: string;              // e.g. happened-media-dev
  accessKey: string;
  secretKey: string;
  publicUrlBase: string | null; // e.g. http://localhost:9000/happened-media-dev
  forcePathStyle: boolean;     // MinIO requires true
};

export function getStorageConfig(env: NodeJS.ProcessEnv = process.env): StorageConfig | null {
  const endpoint = env.S3_ENDPOINT?.trim();
  const bucket = env.S3_BUCKET?.trim();
  const accessKey = env.S3_ACCESS_KEY?.trim();
  const secretKey = env.S3_SECRET_KEY?.trim();

  if (!endpoint || !bucket || !accessKey || !secretKey) {
    return null;
  }

  return {
    endpoint,
    region: env.S3_REGION?.trim() || 'us-east-1',
    bucket,
    accessKey,
    secretKey,
    publicUrlBase: env.S3_PUBLIC_URL_BASE?.trim() || null,
    forcePathStyle: (env.S3_FORCE_PATH_STYLE ?? '1') !== '0',
  };
}

export type ObjectStorage = {
  config: StorageConfig;
  createPresignedUploadUrl(args: { key: string; contentType: string; maxBytes?: number; expiresInSeconds?: number }): Promise<{ uploadUrl: string; publicUrl: string; expiresAt: string }>;
  deleteObject(key: string): Promise<void>;
  objectExists(key: string): Promise<boolean>;
  publicUrlFor(key: string): string;
};

export function createObjectStorage(config: StorageConfig): ObjectStorage {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  });

  function publicUrlFor(key: string) {
    if (config.publicUrlBase) {
      return `${config.publicUrlBase.replace(/\/+$/, '')}/${key}`;
    }
    // path-style fallback for MinIO
    return `${config.endpoint.replace(/\/+$/, '')}/${config.bucket}/${key}`;
  }

  return {
    config,
    publicUrlFor,
    async createPresignedUploadUrl({ key, contentType, maxBytes, expiresInSeconds = 600 }) {
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: maxBytes,
      });
      const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
      return {
        uploadUrl,
        publicUrl: publicUrlFor(key),
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      };
    },
    async deleteObject(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
    async objectExists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
        return true;
      } catch (error: unknown) {
        const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchKey') {
          return false;
        }
        throw error;
      }
    },
  };
}

// Key naming convention for media uploads.
// Returns `posts/{yyyy}/{mm}/{userId}/{postId}.{ext}` (sanitized).
export function mediaKey(userId: string, postId: string, ext: string, now: Date = new Date()): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safeUser = sanitizeSegment(userId);
  const safePost = sanitizeSegment(postId);
  const safeExt = (ext || 'bin').replace(/^\.+/, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
  return `posts/${yyyy}/${mm}/${safeUser}/${safePost}.${safeExt}`;
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 80) || 'anon';
}
