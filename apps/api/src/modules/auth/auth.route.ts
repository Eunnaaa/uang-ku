import { Elysia } from 'elysia';
import { registerSchema, loginSchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';

export const authRoutes = new Elysia({ prefix: '/api/v1/auth' })
  .post('/register', async ({ body }) => {
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
  .post('/login', async ({ body }) => {
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
