import { Elysia } from 'elysia';
import { MAX_RECEIPT_BASE64_LENGTH, MAX_RECEIPT_FILE_SIZE_BYTES, uploadReceiptPayloadSchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { storageService } from './storage.service';
import { db, schema } from '../../db/client';
import { eq } from 'drizzle-orm';
import { limitRequest } from '../../middleware/rate-limiter';

export const storageRoutes = new Elysia({ prefix: '/api/v1/storage' })
  .use(authMiddleware)
  .get('/receipts/:filename', async ({ params, set, user }) => {
    const file = await storageService.getReceipt(user.userId, params.filename);
    if (!file) {
      set.status = 404;
      return { error: { code: 'RESOURCE_NOT_FOUND', message: 'Bukti transaksi tidak ditemukan.' } };
    }

    return new Response(new Uint8Array(file.buffer), {
      headers: {
        'Content-Type': file.mimeType,
        'Cache-Control': 'private, no-store',
      },
    });
  })
  .post('/upload-receipt', async ({ body, user, request, set }) => {
    await limitRequest(`upload:${user.userId}`, 20, set.headers);
    const input = uploadReceiptPayloadSchema.parse(body);

    // Strip data URL header if present (e.g., "data:image/jpeg;base64,")
    const cleanBase64 = input.base64Data.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
    if (cleanBase64.length > MAX_RECEIPT_BASE64_LENGTH || Buffer.byteLength(cleanBase64, 'base64') > MAX_RECEIPT_FILE_SIZE_BYTES) {
      return Response.json({ error: { code: 'FILE_TOO_LARGE', message: 'Ukuran struk maksimal 5 MB.' } }, { status: 413 });
    }
    const buffer = Buffer.from(cleanBase64, 'base64');
    if (!buffer.length || buffer.toString('base64') !== cleanBase64) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Berkas struk tidak valid.' } }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      const [owner] = await tx.select({ id: schema.profiles.id }).from(schema.profiles)
        .where(eq(schema.profiles.id, user.userId)).for('update');
      if (!owner) throw new Error('UNAUTHORIZED');
      if (!await storageService.hasRoomForReceipt(owner.id, buffer.length)) return null;
      return storageService.uploadReceipt(buffer, input.filename, input.mimeType, owner.id, new URL(request.url).origin);
    });

    return result ? successResponse(result) : Response.json({ error: { code: 'STORAGE_QUOTA',
      message: 'Kuota struk per akun adalah 100 berkas atau 100 MB.' } }, { status: 409 });
  });
