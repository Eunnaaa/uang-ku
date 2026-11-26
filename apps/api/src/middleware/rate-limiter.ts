import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { lt, sql } from 'drizzle-orm';
import { env } from '../config/env';
import { db, schema } from '../db/client';

const normalize = (ip: string) => ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4 ? ip.slice(7) : ip;

export function clientAddress(address: string | undefined, headers: Headers, trusted = env.TRUSTED_PROXY_IPS) {
  if (!address) return 'unknown-peer';
  const peer = normalize(address);
  const forwarded = headers.get('x-real-ip');
  return trusted.includes(peer) && forwarded && isIP(forwarded) ? normalize(forwarded) : peer;
}

export async function limitRequest(identity: string, limit: number, headers: Record<string, unknown>) {
  const key = createHmac('sha256', env.JWT_SECRET).update(identity).digest('hex');
  const t = schema.rateWindows;
  const expiry = sql`now() + interval '1 minute'`;
  const [row] = await db.insert(t).values({ key, hits: 1, expiresAt: expiry }).onConflictDoUpdate({
    target: t.key,
    set: { hits: sql`case when ${t.expiresAt} <= now() then 1 else least(${t.hits}+1, ${limit+1}) end`,
      expiresAt: sql`case when ${t.expiresAt} <= now() then ${expiry} else ${t.expiresAt} end` },
  }).returning();
  if (Math.random() < 0.02) await db.delete(t).where(lt(t.expiresAt, sql`now()`));
  const seconds = Math.max(1, Math.ceil((row.expiresAt.getTime()-Date.now())/1000));
  headers['RateLimit-Remaining'] = String(Math.max(0, limit-row.hits));
  headers['RateLimit-Limit'] = String(limit);
  headers['RateLimit-Reset'] = String(seconds);
  if (row.hits > limit) {
    headers['Retry-After'] = String(seconds);
    throw new Error('RATE_LIMIT_EXCEEDED');
  }
}
