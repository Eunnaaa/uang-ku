import { z } from 'zod';

export const ALLOWED_RECEIPT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
] as const;

export type AllowedReceiptMimeType = (typeof ALLOWED_RECEIPT_MIME_TYPES)[number];

export const MAX_RECEIPT_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const uploadReceiptResponseSchema = z.object({
  fileUrl: z.string().url(),
  key: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.enum(ALLOWED_RECEIPT_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_RECEIPT_FILE_SIZE_BYTES),
  uploadedAt: z.string().datetime(),
});

export type UploadReceiptResponse = z.infer<typeof uploadReceiptResponseSchema>;

export const uploadReceiptPayloadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_RECEIPT_MIME_TYPES),
  base64Data: z.string().min(1),
});

export type UploadReceiptPayload = z.infer<typeof uploadReceiptPayloadSchema>;
