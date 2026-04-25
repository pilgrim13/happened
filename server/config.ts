import 'dotenv/config';

import { getStorageConfig, type StorageConfig } from './storage';
import { getMailerConfig, type MailerConfig } from './mailer';

export type ApiConfig = {
  host: string;
  port: number;
  nodeEnv: string;
  databaseUrl: string | null;
  corsOrigin: boolean | string | string[];
  logRequests: boolean;
  media: {
    storageDriver: 'local';
    localDir: string;
    publicBaseUrl: string | null;
    maxBytes: number;
  };
  storage: StorageConfig | null;
  mailer: MailerConfig | null;
};

function parsePort(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCorsOrigin(value: string | undefined): ApiConfig['corsOrigin'] {
  if (!value || value === '*') {
    return true;
  }

  if (value.toLowerCase() === 'false') {
    return false;
  }

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length === 1 ? origins[0] : origins;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseMediaDriver(value: string | undefined): ApiConfig['media']['storageDriver'] {
  if (!value || value === 'local') {
    return 'local';
  }

  throw new Error(`Unsupported MEDIA_STORAGE_DRIVER "${value}". Only "local" is available in this build.`);
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    host: env.API_HOST ?? '127.0.0.1',
    port: parsePort(env.API_PORT, 4017),
    nodeEnv: env.NODE_ENV ?? 'development',
    databaseUrl: env.DATABASE_URL ?? null,
    corsOrigin: parseCorsOrigin(env.API_CORS_ORIGIN),
    logRequests: env.API_LOG_REQUESTS === '1',
    media: {
      storageDriver: parseMediaDriver(env.MEDIA_STORAGE_DRIVER),
      localDir: env.MEDIA_LOCAL_DIR ?? '.local/uploads',
      publicBaseUrl: env.MEDIA_PUBLIC_BASE_URL?.trim() || null,
      maxBytes: parsePositiveInteger(env.MEDIA_MAX_BYTES, 40 * 1024 * 1024),
    },
    storage: getStorageConfig(env),
    mailer: getMailerConfig(env),
  };
}
