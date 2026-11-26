import { Elysia } from 'elysia';
import crypto from 'crypto';
import { env } from '../config/env';
import { and, eq, gt, lte, sql } from 'drizzle-orm';
import { db, schema } from '../db/client';
import type { Tx } from '../db/ledger';

export interface AuthContext {
  userId: string;
  sessionId: string;
}

/**
 * Creates an HMAC-SHA256 signed JWT
 */
const sessionSeconds = 3600;

export async function issueSession(owner: string, database: Tx | typeof db = db): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + sessionSeconds;
  await database.delete(schema.sessions).where(and(eq(schema.sessions.userId, owner), lte(schema.sessions.expiresAt, new Date())));
  const [session] = await database.insert(schema.sessions).values({ userId: owner, expiresAt: new Date(exp * 1000) }).returning();
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = {
    sub: owner, sid: session.id, iss: 'uangku:v3', iat: now, exp,
  };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Verify HS256 JWT signature and claims
 */
export function verifyHs256Jwt(
  token: string,
  secret: string = env.JWT_SECRET
): AuthContext | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature using HMAC-SHA256
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (signatureB64.length !== expectedSig.length ||
        !crypto.timingSafeEqual(Buffer.from(signatureB64, 'ascii'), Buffer.from(expectedSig, 'ascii'))) {
      return null;
    }

    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadStr);

    // Check expiration if exp claim is present
    if (payload.iss !== 'uangku:v3' || !Number.isFinite(payload.exp) || Date.now() / 1000 >= payload.exp) {
      return null;
    }

    if (![payload.sub, payload.sid].every(id => typeof id === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id))) {
      return null;
    }

    return {
      userId: payload.sub,
      sessionId: payload.sid,
    };
  } catch {
    return null;
  }
}

export function liveSession(user: AuthContext) {
  return and(eq(schema.sessions.id, user.sessionId), eq(schema.sessions.userId, user.userId), gt(schema.sessions.expiresAt, sql`now()`));
}

export const authMiddleware = new Elysia({ name: 'auth-middleware' })
  .derive({ as: 'scoped' }, async ({ headers, request, path }) => {
    const token = headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    const user = token && verifyHs256Jwt(token);
    if (!user) throw new Error('UNAUTHORIZED');
    const [session] = await db.select({ id: schema.sessions.id }).from(schema.sessions).where(liveSession(user));
    if (!session) {
      if (request.method !== 'DELETE' || path !== '/api/v1/auth/me') throw new Error('UNAUTHORIZED');
      // Only confirm an already absent profile after a lost deletion response.
      const [existing] = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.id, user.userId));
      if (existing) throw new Error('UNAUTHORIZED');
    }
    return { user };
  });
