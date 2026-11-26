import { testDatabaseUrl } from './test-database';

export const env = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.NODE_ENV === 'test' ? testDatabaseUrl() :
    process.env.DATABASE_URL || (process.env.POSTGRES_PASSWORD ?
      `postgresql://postgres:${encodeURIComponent(process.env.POSTGRES_PASSWORD)}@postgres:5432/uangku` :
      process.env.NODE_ENV === 'production' ? '' : 'postgresql://postgres:admin@localhost:5432/uangku'),
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://mock.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key',
  JWT_SECRET: process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'uangku-jwt-secret-key-development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '',
  TRUSTED_PROXY_IPS: (process.env.TRUSTED_PROXY_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean),

  // Distributed Rate Limiting & Cache
  REDIS_URL: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || '',
  REDIS_TOKEN: process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',

  // Observability & Sentry
  SENTRY_DSN: process.env.SENTRY_DSN || '',
  LOG_LEVEL: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

  // Remote Receipt Storage (S3 / Cloudflare R2 / Supabase Storage)
  STORAGE_DRIVER: (process.env.STORAGE_DRIVER || 'local') as 'local' | 's3' | 'r2' | 'supabase',
  S3_ENDPOINT: process.env.S3_ENDPOINT || '',
  S3_BUCKET: process.env.S3_BUCKET || 'uangku-receipts',
  S3_REGION: process.env.S3_REGION || 'auto',
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || '',
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || '',
  STORAGE_LEGACY_DIR: process.env.STORAGE_LEGACY_DIR || '',
  STORAGE_LOCAL_DIR: process.env.STORAGE_LOCAL_DIR || 'private/uploads',
};

if (!env.DATABASE_URL) throw new Error('Configure DATABASE_URL or POSTGRES_PASSWORD for production.');
if (env.NODE_ENV === 'production' && (env.JWT_SECRET.trim().length < 32 ||
    ['uangku-jwt-secret-key-development', 'super-secret-jwt-key-uangku-local-testing'].includes(env.JWT_SECRET))) {
  throw new Error('Configure a JWT signing secret of at least 32 characters for production.');
}
