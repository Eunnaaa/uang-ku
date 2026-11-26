import { Elysia } from 'elysia';
import { registerSchema, loginSchema } from '@uangku/contracts';
import { authMiddleware, issueSession, liveSession } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { limitRequest, clientAddress } from '../../middleware/rate-limiter';
import { db, schema } from '../../db/client';
import { and, eq } from 'drizzle-orm';
import crypto from 'crypto';
import { storageService } from '../storage/storage.service';

export const authRoutes = new Elysia({ prefix: '/api/v1/auth' })
  .post('/register', async ({ body, request, server, set }) => {
    await limitRequest(`register:${clientAddress(server?.requestIP(request)?.address, request.headers)}`, 10, set.headers);

    const input = registerSchema.parse(body);
    const userId = crypto.randomUUID();
    const displayName = input.displayName || input.email.split('@')[0];
    const passwordHash = await Bun.password.hash(input.password, 'argon2id');

    const token = await db.transaction(async (tx) => {
      // 1. Create profile
      await tx.insert(schema.profiles).values({
        id: userId,
        displayName,
        email: input.email.toLowerCase(),
        passwordHash,
        defaultCurrency: 'IDR',
        timezone: 'Asia/Jakarta',
      });

      // 2. Auto-provision default cash account (PRD Section 9 & 53)
      await tx.insert(schema.accounts).values({
        id: userId,
        userId,
        name: 'Kas / Dompet',
        type: 'cash',
        currency: 'IDR',
        initialBalance: 0,
        isDefault: true,
        isArchived: false,
      });
      return issueSession(userId, tx);
    });

    return successResponse({
      user: {
        id: userId,
        email: input.email,
        displayName,
      },
      token,
    });
  })
  .post('/login', async ({ body, request, server, set }) => {
    await limitRequest(`login-ip:${clientAddress(server?.requestIP(request)?.address, request.headers)}`, 40, set.headers);
    const input = loginSchema.parse(body);
    const normalizedEmail = input.email.toLowerCase();
    await limitRequest(`login-account:${normalizedEmail}`, 15, set.headers);

    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.email, normalizedEmail));
    const hash = profile?.passwordHash;
    if (!hash) throw new Error('UNAUTHORIZED');
    if (/^[a-f0-9]{64}$/.test(hash)) {
      const candidate = crypto.createHash('sha256').update(`uangku_salt_${input.password}`).digest();
      if (!crypto.timingSafeEqual(candidate, Buffer.from(hash, 'hex'))) throw new Error('UNAUTHORIZED');
      await db.update(schema.profiles).set({ passwordHash: await Bun.password.hash(input.password, 'argon2id') })
        .where(and(eq(schema.profiles.id, profile.id), eq(schema.profiles.passwordHash, hash)));
    } else if (!await Bun.password.verify(input.password, hash)) {
      throw new Error('UNAUTHORIZED');
    }
    const token = await issueSession(profile.id);

    return successResponse({
      user: {
        id: profile.id,
        email: input.email,
        displayName: profile.displayName || normalizedEmail.split('@')[0],
      },
      token,
    });
  })
  .use(authMiddleware)
  .post('/logout', async ({ user }) => {
    await db.delete(schema.sessions).where(liveSession(user));
    return successResponse({ revoked: true });
  })
  .get('/me', async ({ user }) => {
    const [p] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, user.userId));
    if (!p) throw new Error('UNAUTHORIZED');

    return successResponse({
      id: user.userId,
      email: p.email,
      displayName: p.displayName,
      defaultCurrency: p.defaultCurrency,
      timezone: p.timezone,
    });
  })
  .delete('/me', async ({ user, body, set }) => {
    await limitRequest(`delete-account:${user.userId}`, 5, set.headers);
    // Apple App Store Guideline 5.1.1(v) Cascading Account Deletion
    await db.transaction(async (tx) => {
      const [profile] = await tx.select({ hash: schema.profiles.passwordHash }).from(schema.profiles)
        .where(eq(schema.profiles.id, user.userId)).for('update');
      if (!profile) return;
      const [session] = await tx.select({ id: schema.sessions.id }).from(schema.sessions).where(liveSession(user)).for('update');
      const { password } = loginSchema.pick({ password: true }).parse(body);
      if (!session || !profile.hash || !await Bun.password.verify(password, profile.hash)) throw new Error('UNAUTHORIZED');
      await tx.delete(schema.profiles).where(eq(schema.profiles.id, user.userId));
      await storageService.deleteReceipts(user.userId);
    });

    return successResponse({
      message: 'Akun dan seluruh data transaksi berhasil dihapus secara permanen.',
      userId: user.userId,
    });
  });
