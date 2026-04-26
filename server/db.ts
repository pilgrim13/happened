import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Pool, type PoolClient } from 'pg';

export type DatabaseHealth = {
  configured: boolean;
  ok: boolean;
  message: string;
};

let pool: Pool | null = null;

function getPool(databaseUrl: string | null) {
  if (!databaseUrl) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      max: 4,
    });
  }

  return pool;
}

export async function checkDatabase(databaseUrl: string | null): Promise<DatabaseHealth> {
  const database = getPool(databaseUrl);

  if (!database) {
    return {
      configured: false,
      ok: false,
      message: 'DATABASE_URL is not set; API is using the local JSON repository.',
    };
  }

  try {
    await database.query('select 1');
    return {
      configured: true,
      ok: true,
      message: 'Postgres connection is reachable.',
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      message: error instanceof Error ? error.message : 'Postgres health check failed.',
    };
  }
}

export function hasDatabase(databaseUrl: string | null) {
  return Boolean(getPool(databaseUrl));
}

export async function queryDatabase<T extends object = Record<string, unknown>>(databaseUrl: string | null, text: string, values?: unknown[]) {
  const database = getPool(databaseUrl);

  if (!database) {
    throw new Error('DATABASE_URL is not set.');
  }

  return database.query<T>(text, values);
}

export async function migrateDatabase(databaseUrl: string | null) {
  const database = getPool(databaseUrl);

  if (!database) {
    return {
      configured: false,
      applied: 0,
    };
  }

  await database.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const migrations = [
    '001_initial.sql',
    '002_post_actions.sql',
    '003_social_core.sql',
    '004_user_blocks.sql',
    '005_notification_reads.sql',
    '006_user_profile_fields.sql',
    '007_memory_post_media_urls.sql',
    '008_postgis.sql',
    '009_email_tokens.sql',
  ];
  let applied = 0;

  for (const migration of migrations) {
    const existing = await database.query('select id from schema_migrations where id = $1', [migration]);

    if (existing.rowCount) {
      continue;
    }

    const sql = await readFile(path.join(process.cwd(), 'server', 'migrations', migration), 'utf8');

    await database.query('begin');
    try {
      await database.query(sql);
      await database.query('insert into schema_migrations (id) values ($1)', [migration]);
      await database.query('commit');
      applied += 1;
    } catch (error) {
      await database.query('rollback');
      throw error;
    }
  }

  return {
    configured: true,
    applied,
  };
}

export async function withTransaction<T>(databaseUrl: string | null, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const database = getPool(databaseUrl);
  if (!database) {
    throw new Error('DATABASE_URL is not set.');
  }
  const client = await database.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    try {
      await client.query('rollback');
    } catch {
      /* ignore rollback failure */
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
}
