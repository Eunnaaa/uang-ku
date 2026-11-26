import '../../db/test-guard';
import { expect, it, spyOn } from 'bun:test';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import app from '../../index';
import { db, schema } from '../../db/client';
import { storageService } from '../storage/storage.service';
import { clientAddress } from '../../middleware/rate-limiter';

const post = (path: string, body: object, token?: string) => app.handle(new Request(`http://localhost/api/v1/${path}`, {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json',
    'x-forwarded-for': '192.0.2.41', ...(token && { Authorization: `Bearer ${token}` }) },
}));

it('uses the socket peer unless the configured reverse proxy supplied one valid client IP', () => {
  const proxy = '192.0.2.5', client = '192.0.2.7';
  const headers = new Headers({ 'x-real-ip': client });
  expect(clientAddress(proxy, headers, [])).toBe(proxy);
  expect(clientAddress(proxy, headers, [proxy])).toBe(client);
  expect(clientAddress(proxy, new Headers(), [proxy])).toBe(proxy);
});

it('issues a token only after credential verification and upgrades a valid legacy hash', async () => {
  const creds = { email: `${crypto.randomUUID()}@example.test`, password: crypto.randomUUID() };
  expect((await post('auth/login', creds)).status).toBe(401);
  const [user] = await db.insert(schema.profiles).values({ id: crypto.randomUUID(), email: creds.email }).returning();
  expect((await post('auth/login', creds)).status).toBe(401);
  await db.update(schema.profiles).set({ passwordHash: createHash('sha256').update(`uangku_salt_${creds.password}`).digest('hex') })
    .where(eq(schema.profiles.id, user.id));
  expect((await post('auth/login', { ...creds, password: 'wrong' })).status).toBe(401);
  const login = await post('auth/login', creds);
  expect((await login.json()).data.user.id).toBe(user.id);
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, user.id));
  expect(profile.passwordHash).toStartWith('$argon2id$');
  expect(await Bun.password.verify(creds.password, profile.passwordHash!)).toBe(true);
  const outage = spyOn(db, 'select').mockImplementationOnce(() => { throw new Error('Test database unavailable'); });
  try {
    const res = await post('auth/login', creds);
    expect(res.status).toBe(500);
    expect((await res.json()).data).toBeUndefined();
  } finally { outage.mockRestore(); }
});

it('keeps receipts private and confirms deletion only after storage and PostgreSQL succeed', async () => {
  const password = crypto.randomUUID();
  const register = async () => (await (await post('auth/register', {
    email: `${crypto.randomUUID()}@example.test`, password,
  })).json()).data;
  const owner = await register(), other = await register();
  const file = (await (await post('storage/upload-receipt', {
    filename: 'struk.png', mimeType: 'image/png', base64Data: 'aW1hZ2U=',
  }, owner.token)).json()).data;
  const get = (token?: string) => app.handle(new Request(file.fileUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} }));
  expect((await get()).status).toBe(401);
  expect((await get(other.token)).status).toBe(404);
  const remove = (confirmation: string = password) => app.handle(new Request('http://localhost/api/v1/auth/me', {
    method: 'DELETE', headers: { Authorization: `Bearer ${owner.token}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ password: confirmation }),
  }));
  expect((await remove('not-confirmed')).status).toBe(401);
  const outage = spyOn(storageService, 'deleteReceipts').mockRejectedValueOnce(new Error('Test receipt store unavailable'));
  try {
    expect((await remove()).status).toBe(500);
    expect((await get(owner.token)).status).toBe(200);
  } finally { outage.mockRestore(); }
  expect((await remove()).status).toBe(200);
  expect(await storageService.getReceipt(owner.user.id, file.filename)).toBeNull();
  expect((await get(owner.token)).status).toBe(401);
  expect((await remove()).status).toBe(200);
});

it('revokes only the device that logs out', async () => {
  const creds = { email: `${crypto.randomUUID()}@example.test`, password: crypto.randomUUID() };
  const first = (await (await post('auth/register', creds)).json()).data.token;
  const second = (await (await post('auth/login', creds)).json()).data.token;
  expect((await post('auth/logout', {}, first)).status).toBe(200);
  const me = (token: string) => app.handle(new Request('http://localhost/api/v1/auth/me',
    { headers: { Authorization: `Bearer ${token}` } }));
  expect((await me(first)).status).toBe(401);
  expect((await me(second)).status).toBe(200);
});
