import 'dotenv/config';
import { z } from 'zod';

import { getStorageConfig, type StorageConfig } from './storage';
import { getMailerConfig, type MailerConfig } from './mailer';

export type ApiConfig = {
  host: string;
  port: number;
  nodeEnv: string;
  isProd: boolean;
  databaseUrl: string | null;
  corsOrigin: boolean | string | string[];
  logRequests: boolean;
  logLevel: string;
  appPublicUrl: string;
  devTestPassword: string;
  rateLimit: {
    globalMax: number;
    authMax: number;
    timeWindowMs: number;
  };
  media: {
    storageDriver: 'local';
    localDir: string;
    publicBaseUrl: string | null;
    maxBytes: number;
    photoMaxBytes: number;
    videoMaxBytes: number;
  };
  storage: StorageConfig | null;
  mailer: MailerConfig | null;
};

const envSchema = z.object({
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().positive().default(4017),
  NODE_ENV: z.string().default('development'),
  API_CORS_ORIGIN: z.string().optional(),
  API_LOG_REQUESTS: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  APP_PUBLIC_URL: z.string().optional(),
  DEV_TEST_PASSWORD: z.string().optional(),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  MEDIA_STORAGE_DRIVER: z.string().default('local'),
  MEDIA_LOCAL_DIR: z.string().default('.local/uploads'),
  MEDIA_PUBLIC_BASE_URL: z.string().optional(),
  MEDIA_MAX_BYTES: z.coerce.number().int().positive().default(40 * 1024 * 1024),
  MEDIA_PHOTO_MAX_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024),
  MEDIA_VIDEO_MAX_BYTES: z.coerce.number().int().positive().default(100 * 1024 * 1024),
});

function parseCorsOrigin(value: string | undefined, isProd: boolean): ApiConfig['corsOrigin'] {
  if (!value || value === '*') {
    return isProd ? false : true;
  }
  if (value.toLowerCase() === 'false') return false;
  const origins = value.split(',').map((origin) => origin.trim()).filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}

function parseMediaDriver(value: string | undefined): ApiConfig['media']['storageDriver'] {
  if (!value || value === 'local') return 'local';
  throw new Error(`Unsupported MEDIA_STORAGE_DRIVER "${value}". Only "local" is available in this build.`);
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const e = parsed.data;
  const nodeEnv = e.NODE_ENV;
  const isProd = nodeEnv === 'production';

  return {
    host: e.API_HOST,
    port: e.API_PORT,
    nodeEnv,
    isProd,
    databaseUrl: e.DATABASE_URL ?? null,
    corsOrigin: parseCorsOrigin(e.API_CORS_ORIGIN, isProd),
    logRequests: e.API_LOG_REQUESTS === '1' || !isProd,
    logLevel: e.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
    appPublicUrl: e.APP_PUBLIC_URL ?? 'http://localhost:8081',
    devTestPassword: e.DEV_TEST_PASSWORD ?? 'happened-test-1',
    rateLimit: {
      globalMax: e.RATE_LIMIT_GLOBAL_MAX,
      authMax: e.RATE_LIMIT_AUTH_MAX,
      timeWindowMs: e.RATE_LIMIT_WINDOW_MS,
    },
    media: {
      storageDriver: parseMediaDriver(e.MEDIA_STORAGE_DRIVER),
      localDir: e.MEDIA_LOCAL_DIR,
      publicBaseUrl: e.MEDIA_PUBLIC_BASE_URL?.trim() || null,
      maxBytes: e.MEDIA_MAX_BYTES,
      photoMaxBytes: e.MEDIA_PHOTO_MAX_BYTES,
      videoMaxBytes: e.MEDIA_VIDEO_MAX_BYTES,
    },
    storage: getStorageConfig(env),
    mailer: getMailerConfig(env),
  };
}
