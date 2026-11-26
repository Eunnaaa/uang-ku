import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from './config/env';

const client = postgres(env.DATABASE_URL, { max: 1 });
try {
  await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL('../drizzle/', import.meta.url)) });
} finally {
  await client.end();
}
