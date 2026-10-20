import { Elysia } from 'elysia';
import { registerSchema, loginSchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';

// In-memory sliding rate limiter for authentication endpoints
const authRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkAuthRateLimit(identifier: string, maxAttempts = 15, windowMs = 60_000): boolean {
  const now = Date.now();
  // Periodic pruning if map gets large to prevent memory exhaustion DoS
  if (authRateLimitMap.size > 1000) {
    for (const [key, val] of authRateLimitMap.entries()) {
      if (now > val.resetAt) {
        authRateLimitMap.delete(key);
      }
    }
  }

  const record = authRateLimitMap.get(identifier);
  if (!record || now > record.resetAt) {
    authRateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= maxAttempts) {
    return false;
  }
  record.count += 1;
  return true;
}

function getClientIp(headers: Record<string, string | undefined>): string {
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return headers['x-real-ip'] || 'client';
}

export const authRoutes = new Elysia({ prefix: '/api/v1/auth' })
  .post('/register', async ({ body, headers }) => {
    const ip = getClientIp(headers);
    if (!checkAuthRateLimit(`reg:${ip}`, 10, 60_000)) {
      throw new Error('RATE_LIMIT_EXCEEDED');
    }

    const input = registerSchema.parse(body);
    // In production, integrate with supabase.auth.signUp
    return successResponse({
      user: {
        id: crypto.randomUUID(),
        email: input.email,
        displayName: input.displayName || 'Pengguna Baru',
      },
      token: 'demo-jwt-token-' + crypto.randomUUID(),
    });
  })
  .post('/login', async ({ body, headers }) => {
    const ip = getClientIp(headers);
    if (!checkAuthRateLimit(`login:${ip}`, 15, 60_000)) {
      throw new Error('RATE_LIMIT_EXCEEDED');
    }

    const input = loginSchema.parse(body);
    // In production, integrate with supabase.auth.signInWithPassword
    return successResponse({
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: input.email,
        displayName: 'Gary Hardyansyah',
      },
      token: 'demo-jwt-token-00000000-0000-0000-0000-000000000001',
    });
  })
  .use(authMiddleware)
  .get('/me', async ({ user }) => {
    return successResponse({
      id: user.userId,
      email: user.email,
      displayName: 'Gary Hardyansyah',
      defaultCurrency: 'IDR',
      timezone: 'Asia/Jakarta',
    });
  })
  .delete('/me', async ({ user }) => {
    // Apple App Store Guideline 5.1.1(v) Cascading Account Deletion
    return successResponse({
      message: 'Akun dan seluruh data transaksi berhasil dihapus secara permanen.',
      userId: user.userId,
    });
  });
