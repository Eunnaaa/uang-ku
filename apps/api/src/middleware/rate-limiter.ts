import { Elysia } from 'elysia';
import { env } from '../config/env';
import { logger } from '../utils/logger';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory sliding window store with automatic expiration
const inMemoryStore = new Map<string, RateLimitRecord>();

let lastCleanup = Date.now();
function pruneExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup > 30_000 || inMemoryStore.size > 2000) {
    lastCleanup = now;
    for (const [key, val] of inMemoryStore.entries()) {
      if (now > val.resetAt) {
        inMemoryStore.delete(key);
      }
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Check rate limit using Redis (if configured) or in-memory sliding counter
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number = 60,
  windowMs: number = 60_000
): Promise<RateLimitResult> {
  const now = Date.now();

  // 1. Try Upstash / Redis REST API if configured
  if (env.REDIS_URL && env.REDIS_TOKEN) {
    try {
      const redisKey = `ratelimit:${key}`;
      const res = await fetch(`${env.REDIS_URL}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.REDIS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', redisKey],
          ['PEXPIRE', redisKey, windowMs, 'NX'],
          ['PTTL', redisKey],
        ]),
      });

      if (res.ok) {
        const json = await res.json();
        const currentCount = Number(json[0]?.result || 1);
        const pttl = Math.max(1, Number(json[2]?.result || windowMs));
        const resetInSeconds = Math.ceil(pttl / 1000);
        const remaining = Math.max(0, maxRequests - currentCount);

        return {
          allowed: currentCount <= maxRequests,
          limit: maxRequests,
          remaining,
          resetInSeconds,
        };
      }
    } catch (redisErr) {
      logger.warn('Redis rate limit check failed, falling back to local memory store', undefined, redisErr as Error);
    }
  }

  // 2. In-memory sliding window fallback
  pruneExpiredEntries();

  const record = inMemoryStore.get(key);
  if (!record || now > record.resetAt) {
    inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetInSeconds: Math.ceil(windowMs / 1000),
    };
  }

  record.count += 1;
  const resetInSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
  const remaining = Math.max(0, maxRequests - record.count);

  return {
    allowed: record.count <= maxRequests,
    limit: maxRequests,
    remaining,
    resetInSeconds,
  };
}

export function extractClientIp(headers: Record<string, string | undefined>): string {
  return (
    headers['cf-connecting-ip'] ||
    headers['x-forwarded-for']?.split(',')[0].trim() ||
    headers['x-real-ip'] ||
    '127.0.0.1'
  );
}

export function createRateLimiter(options: {
  maxRequests: number;
  windowMs: number;
  keyPrefix: string;
}) {
  return new Elysia({ name: `rate-limiter-${options.keyPrefix}` }).onRequest(
    async ({ request, set }) => {
      const headersRecord: Record<string, string | undefined> = {};
      request.headers.forEach((val, key) => {
        headersRecord[key] = val;
      });
      const ip = extractClientIp(headersRecord);
      const key = `${options.keyPrefix}:${ip}`;
      const result = await checkRateLimit(key, options.maxRequests, options.windowMs);

      set.headers['RateLimit-Limit'] = String(result.limit);
      set.headers['RateLimit-Remaining'] = String(result.remaining);
      set.headers['RateLimit-Reset'] = String(result.resetInSeconds);

      if (!result.allowed) {
        set.headers['Retry-After'] = String(result.resetInSeconds);
        set.status = 429;
        throw new Error('RATE_LIMIT_EXCEEDED');
      }
    }
  );
}
