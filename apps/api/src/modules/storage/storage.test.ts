import '../../db/test-guard';
import { describe, it, expect } from 'bun:test';
import app from '../../index';
import { issueSession } from '../../middleware/auth';
import { DEFAULT_USER_ID } from '../../db/seed';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '../../config/env';
import { db, schema } from '../../db/client';
const fixtureAuth = `Bearer ${await issueSession(DEFAULT_USER_ID)}`;

describe('Storage & Receipt Management (PRD Section 63)', () => {
  it('allows only the remaining receipt slot across concurrent requests and counts existing files', async () => {
    const owner = crypto.randomUUID();
    await db.insert(schema.profiles).values({ id: owner });
    const dir = join(env.STORAGE_LOCAL_DIR, 'receipts', owner);
    await mkdir(dir, { recursive: true });
    await Promise.all(Array.from({ length: 99 }, (_, i) => writeFile(join(dir, `receipt-${i}.png`), 'fixture')));
    const token = await issueSession(owner);
    const upload = () => app.handle(new Request('http://localhost/api/v1/storage/upload-receipt', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename:'test.png', mimeType:'image/png', base64Data:sample1x1Png }),
    }));
    const responses = await Promise.all([upload(), upload()]);
    expect(responses.map(r => r.status).sort()).toEqual([200,409]);
  });
  const sample1x1Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('POST /api/v1/storage/upload-receipt successfully uploads valid image', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/v1/storage/upload-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: fixtureAuth,
        },
        body: JSON.stringify({
          filename: 'kopi-kenangan.png',
          mimeType: 'image/png',
          base64Data: sample1x1Png,
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.fileUrl).toContain('/api/v1/storage/receipts/');
    expect(body.data.filename).toContain('kopi-kenangan.png');
    expect(body.data.mimeType).toBe('image/png');
    expect(body.data.sizeBytes).toBeGreaterThan(0);


    // Now test retrieving the uploaded file via GET
    const filename = body.data.filename;
    const getRes = await app.handle(
      new Request(`http://localhost/api/v1/storage/receipts/${filename}`, { headers: { Authorization: fixtureAuth } })
    );
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('content-type')).toBe('image/png');
    expect(getRes.headers.get('cache-control')).toBe('private, no-store');
  });

  it('POST /api/v1/storage/upload-receipt rejects disallowed mime types', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/v1/storage/upload-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: fixtureAuth,
        },
        body: JSON.stringify({
          filename: 'script.sh',
          mimeType: 'application/x-sh',
          base64Data: 'ZWNobyAiZXZpbCI=',
        }),
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/v1/storage/receipts/non-existent.jpg returns 404', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/v1/storage/receipts/non-existent-12345.jpg', { headers: { Authorization: fixtureAuth } })
    );
    expect(res.status).toBe(404);
  });
});
