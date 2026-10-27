import { Elysia } from 'elysia';
import { uploadReceiptPayloadSchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { storageService } from './storage.service';

export const storageRoutes = new Elysia({ prefix: '/api/v1/storage' })
  .get('/receipts/:filename', async ({ params, set }) => {
    const file = await storageService.getLocalReceipt(params.filename);
    if (!file) {
      set.status = 404;
      return { error: { code: 'RESOURCE_NOT_FOUND', message: 'Bukti transaksi tidak ditemukan.' } };
    }

    set.headers['Content-Type'] = file.mimeType;
    set.headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    return new Response(new Uint8Array(file.buffer), {
      headers: {
        'Content-Type': file.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  })
  .use(authMiddleware)
  .post('/upload-receipt', async ({ body, user }) => {
    const input = uploadReceiptPayloadSchema.parse(body);

    // Strip data URL header if present (e.g., "data:image/jpeg;base64,")
    const cleanBase64 = input.base64Data.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const result = await storageService.uploadReceipt(
      buffer,
      input.filename,
      input.mimeType,
      user.userId
    );

    return successResponse(result);
  });
