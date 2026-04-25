import { getConfig } from './config';
import { closeDatabase, migrateDatabase } from './db';

async function main() {
  const config = getConfig();
  const result = await migrateDatabase(config.databaseUrl);

  if (!result.configured) {
    console.log('DATABASE_URL is not set; no migrations were applied.');
    return;
  }

  console.log(`Database migrations complete. Applied: ${result.applied}`);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await closeDatabase();
  });
