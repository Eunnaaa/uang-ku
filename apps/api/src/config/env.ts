export const env = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/uangku',
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://mock.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key',
  JWT_SECRET: process.env.JWT_SECRET || 'uangku-jwt-secret-key-development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '',
};

// Security warning for production misconfiguration
if (env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'uangku-jwt-secret-key-development') {
    console.warn('⚠️ [SECURITY WARNING]: JWT_SECRET is using the default development secret in a production environment!');
  }
}
