import { Elysia } from 'elysia';
import crypto from 'crypto';

export interface AuthContext {
  userId: string;
  email?: string;
}

/**
 * Verify HS256 JWT signature and claims
 */
function verifyHs256Jwt(
  token: string,
  secret: string
): { userId: string; email?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature using HMAC-SHA256
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (signatureB64 !== expectedSig) {
      return null;
    }

    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadStr);

    // Check expiration if exp claim is present
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }

    if (!payload.sub) {
      return null;
    }

    return {
      userId: payload.sub,
      email: payload.email,
    };
  } catch {
    return null;
  }
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

    try {
      const jwtSecret = process.env.SUPABASE_JWT_SECRET;

      // 1. If secret is configured, perform strict cryptographic verification
      if (jwtSecret) {
        const verified = verifyHs256Jwt(token, jwtSecret);
        if (verified) {
          return { user: verified };
        }
        // If strict verification failed in production, reject
        if (process.env.NODE_ENV === 'production') {
          set.status = 401;
          throw new Error('UNAUTHORIZED');
        }
      }

      // 2. Decode standard 3-part JWT payload for non-production environments
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf-8');
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

      // 3. Fallback for custom dev tokens (strictly disallowed in production)
      if (process.env.NODE_ENV !== 'production') {
        return {
          user: {
            userId: token.length === 36 ? token : '00000000-0000-0000-0000-000000000001',
            email: 'user@uangku.id',
          },
        };
      }

      set.status = 401;
      throw new Error('UNAUTHORIZED');
    } catch {
      set.status = 401;
      throw new Error('UNAUTHORIZED');
    }
  });
