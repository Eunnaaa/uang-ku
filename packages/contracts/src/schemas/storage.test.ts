import { describe, it, expect } from 'bun:test';
import {
  uploadReceiptPayloadSchema,
  uploadReceiptResponseSchema,
  ALLOWED_RECEIPT_MIME_TYPES,
  MAX_RECEIPT_FILE_SIZE_BYTES,
} from './storage';

describe('Receipt Storage Schemas (PRD Section 63)', () => {
  it('validates a valid receipt upload payload', () => {
    const valid = uploadReceiptPayloadSchema.safeParse({
      filename: 'receipt-lunch.jpg',
      mimeType: 'image/jpeg',
      base64Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects unsupported mime types', () => {
    const invalid = uploadReceiptPayloadSchema.safeParse({
      filename: 'malicious.exe',
      mimeType: 'application/x-msdownload',
      base64Data: 'AAAA',
    });
    expect(invalid.success).toBe(false);
  });

  it('validates upload receipt response schema', () => {
    const valid = uploadReceiptResponseSchema.safeParse({
      fileUrl: 'https://r2.uangku.id/receipts/rec-123.jpg',
      key: 'receipts/rec-123.jpg',
      filename: 'rec-123.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 154200,
      uploadedAt: new Date().toISOString(),
    });
    expect(valid.success).toBe(true);
  });

  it('rejects receipt exceeding max file size limit of 5MB', () => {
    const invalid = uploadReceiptResponseSchema.safeParse({
      fileUrl: 'https://r2.uangku.id/receipts/rec-large.jpg',
      key: 'receipts/rec-large.jpg',
      filename: 'rec-large.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: MAX_RECEIPT_FILE_SIZE_BYTES + 1,
      uploadedAt: new Date().toISOString(),
    });
    expect(invalid.success).toBe(false);
  });
});
