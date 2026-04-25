import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// TODO(S3 sprint): replace data-URL + local FS storage with presigned PUT to MinIO/S3.
//                  See server/storage.ts (createObjectStorage / mediaKey).
import type { ApiConfig } from './config';

type MediaConfig = ApiConfig['media'];

export type StoredMedia = {
  url: string;
  key: string;
  mimeType: string;
  size: number;
};

export type ReadMediaResult = {
  body: Buffer;
  mimeType: string;
  size: number;
};

export type MediaStorage = {
  saveDataUrl(dataUrl: string, fileName?: string): Promise<StoredMedia>;
  read(key: string): Promise<ReadMediaResult | null>;
  health(): Promise<{
    configured: boolean;
    ok: boolean;
    driver: string;
    publicBaseUrl: string | null;
    message: string;
  }>;
};

const mimeExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v',
};

function safeExtension(mimeType: string, fileName?: string) {
  const fromMime = mimeExtensions[mimeType];

  if (fromMime) {
    return fromMime;
  }

  const fromName = fileName?.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) {
    return fromName;
  }

  return 'bin';
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error('Media must be a data URL.');
  }

  const [, mimeType, base64] = match;
  return {
    mimeType,
    buffer: Buffer.from(base64, 'base64'),
  };
}

function safeKey(value: string) {
  if (!/^[a-zA-Z0-9_.-]+$/.test(value)) {
    return null;
  }

  return value;
}

function mediaTypeFromKey(key: string) {
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (key.endsWith('.png')) {
    return 'image/png';
  }
  if (key.endsWith('.webp')) {
    return 'image/webp';
  }
  if (key.endsWith('.gif')) {
    return 'image/gif';
  }
  if (key.endsWith('.mp4')) {
    return 'video/mp4';
  }
  if (key.endsWith('.mov')) {
    return 'video/quicktime';
  }
  if (key.endsWith('.webm')) {
    return 'video/webm';
  }
  if (key.endsWith('.m4v')) {
    return 'video/x-m4v';
  }
  return 'application/octet-stream';
}

function buildPublicUrl(key: string, publicBaseUrl: string | null) {
  const relativeUrl = `/uploads/${key}`;

  if (!publicBaseUrl) {
    return relativeUrl;
  }

  return `${publicBaseUrl.replace(/\/+$/, '')}${relativeUrl}`;
}

class LocalMediaStorage implements MediaStorage {
  private readonly uploadDir: string;

  constructor(private readonly config: MediaConfig) {
    this.uploadDir = path.isAbsolute(config.localDir) ? config.localDir : path.join(process.cwd(), config.localDir);
  }

  async saveDataUrl(dataUrl: string, fileName?: string) {
    const { mimeType, buffer } = parseDataUrl(dataUrl);

    if (buffer.byteLength > this.config.maxBytes) {
      throw new Error('Media file is larger than the local preview limit.');
    }

    await mkdir(this.uploadDir, { recursive: true });

    const key = `${randomUUID()}.${safeExtension(mimeType, fileName)}`;
    await writeFile(path.join(this.uploadDir, key), buffer);

    return {
      url: buildPublicUrl(key, this.config.publicBaseUrl),
      key,
      mimeType,
      size: buffer.byteLength,
    };
  }

  async read(key: string) {
    const fileName = safeKey(key);

    if (!fileName) {
      return null;
    }

    try {
      const filePath = path.join(this.uploadDir, fileName);
      const [body, info] = await Promise.all([readFile(filePath), stat(filePath)]);

      return {
        body,
        mimeType: mediaTypeFromKey(fileName),
        size: info.size,
      };
    } catch {
      return null;
    }
  }

  async health() {
    try {
      await mkdir(this.uploadDir, { recursive: true });
      return {
        configured: true,
        ok: true,
        driver: this.config.storageDriver,
        publicBaseUrl: this.config.publicBaseUrl,
        message: `Local media storage is writable at ${this.uploadDir}.`,
      };
    } catch (error) {
      return {
        configured: true,
        ok: false,
        driver: this.config.storageDriver,
        publicBaseUrl: this.config.publicBaseUrl,
        message: error instanceof Error ? error.message : 'Local media storage is not writable.',
      };
    }
  }
}

export function createMediaStorage(config: MediaConfig): MediaStorage {
  if (config.storageDriver === 'local') {
    return new LocalMediaStorage(config);
  }

  throw new Error(`Unsupported media storage driver: ${config.storageDriver}`);
}
