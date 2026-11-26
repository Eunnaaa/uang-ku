import { defineConfig } from 'drizzle-kit';
import { testDatabaseUrl } from './src/config/test-database';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.NODE_ENV === 'test' ? testDatabaseUrl() :
      process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/uangku',
  },
});
