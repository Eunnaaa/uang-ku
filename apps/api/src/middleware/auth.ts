import { Elysia } from 'elysia';

export interface AuthContext {
  userId: string;
  email?: string;
}

export const authMiddleware = new Elysia({ name: 'auth-middleware' })
  .derive({ as: 'scoped' }, async ({ headers, set }) => {
    const authHeader = headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Default to dev demo user if in development and no token is passed
      if (process.env.NODE_ENV === 'development') {
        return {
          user: {
            userId: '00000000-0000-0000-0000-000000000001',
            email: 'demo@uangku.id',
          },
        };
      }
      set.status = 401;
      throw new Error('UNAUTHORIZED');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // Verify token or decode payload
    try {
      // Basic JWT payload extraction for standard Supabase JWTs
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadStr = Buffer.from(parts[1], 'base64').toString('utf-8');
        const payload = JSON.parse(payloadStr);
        if (payload.sub) {
          return {
            user: {
              userId: payload.sub,
              email: payload.email,
            },
          };
        }
      }

      // Fallback for custom dev tokens
      return {
        user: {
          userId: token.length === 36 ? token : '00000000-0000-0000-0000-000000000001',
          email: 'user@uangku.id',
        },
      };
    } catch {
      set.status = 401;
      throw new Error('UNAUTHORIZED');
    }
  });
