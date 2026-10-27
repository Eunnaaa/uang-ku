import { describe, it, expect, afterAll } from 'bun:test';
import app from '../../index';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

describe('Storage & Receipt Management (PRD Section 63)', () => {
  const sample1x1Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  let createdTestFilename: string | null = null;

  afterAll(async () => {
    if (createdTestFilename) {
      try {
        await unlink(join(__dirname, '../../../public/uploads/receipts', createdTestFilename));
      } catch {}
    }
  });

  it('POST /api/v1/storage/upload-receipt successfully uploads valid image', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/v1/storage/upload-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
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

    createdTestFilename = body.data.filename;

    // Now test retrieving the uploaded file via GET
    const filename = body.data.filename;
    const getRes = await app.handle(
      new Request(`http://localhost/api/v1/storage/receipts/${filename}`)
    );
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('content-type')).toBe('image/png');
    expect(getRes.headers.get('cache-control')).toContain('public');
  });

  it('POST /api/v1/storage/upload-receipt rejects disallowed mime types', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/v1/storage/upload-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
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
      new Request('http://localhost/api/v1/storage/receipts/non-existent-12345.jpg')
    );
    expect(res.status).toBe(404);
  });
});
