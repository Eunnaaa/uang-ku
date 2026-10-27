export const env = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/uangku',
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://mock.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key',
  JWT_SECRET: process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'uangku-jwt-secret-key-development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '',

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
  S3_PUBLIC_URL_PREFIX: process.env.S3_PUBLIC_URL_PREFIX || '',
  STORAGE_LOCAL_DIR: process.env.STORAGE_LOCAL_DIR || 'public/uploads',
};

// Security warning for production misconfiguration
if (env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'uangku-jwt-secret-key-development') {
    console.warn('⚠️ [SECURITY WARNING]: JWT_SECRET is using the default development secret in a production environment!');
  }
}
