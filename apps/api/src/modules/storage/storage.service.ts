import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import {
  ALLOWED_RECEIPT_MIME_TYPES,
  MAX_RECEIPT_FILE_SIZE_BYTES,
  type AllowedReceiptMimeType,
  type UploadReceiptResponse,
} from '@uangku/contracts';

export class StorageService {
  private localUploadDir: string;

  constructor() {
    this.localUploadDir = path.resolve(__dirname, '../../../public/uploads/receipts');
    // Ensure upload directory exists
    try {
      if (!fs.existsSync(this.localUploadDir)) {
        fs.mkdirSync(this.localUploadDir, { recursive: true });
      }
    } catch (err) {
      logger.warn('Failed to create local upload directory', undefined, err as Error);
    }
  }

  /**
   * Upload receipt buffer to cloud storage (S3/R2/Supabase) or local filesystem fallback
   */
  public async uploadReceipt(
    buffer: Buffer,
    originalFilename: string,
    mimeType: AllowedReceiptMimeType,
    userId: string
  ): Promise<UploadReceiptResponse> {
    // 1. Validation checks
    if (!ALLOWED_RECEIPT_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Tipe file tidak didukung: ${mimeType}. Hanya diperbolehkan JPG, PNG, WEBP, atau PDF.`);
    }

    if (buffer.length > MAX_RECEIPT_FILE_SIZE_BYTES) {
      throw new Error(`Ukuran file melebihi batas maksimum 5MB (ukuran: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB).`);
    }

    // 2. Determine file extension
    const extMap: Record<AllowedReceiptMimeType, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/heic': '.heic',
      'application/pdf': '.pdf',
    };
    const extension = extMap[mimeType] || path.extname(originalFilename) || '.jpg';
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const uniqueId = crypto.randomUUID().slice(0, 8);
    const parsedName = path.parse(originalFilename).name;
    const sanitizedBase = parsedName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 25) || 'receipt';
    const filename = `${datePrefix}_${uniqueId}_${sanitizedBase}${extension}`;
    const storageKey = `receipts/${userId}/${filename}`;

    // 3. Cloud S3 / Cloudflare R2 Upload
    if (
      env.STORAGE_DRIVER !== 'local' &&
      env.S3_ENDPOINT &&
      env.S3_ACCESS_KEY_ID &&
      env.S3_SECRET_ACCESS_KEY
    ) {
      try {
        const s3Url = `${env.S3_ENDPOINT.replace(/\/$/, '')}/${env.S3_BUCKET}/${storageKey}`;
        const uploadRes = await fetch(s3Url, {
          method: 'PUT',
          headers: {
            'Content-Type': mimeType,
            'Content-Length': String(buffer.length),
            Authorization: `AWS ${env.S3_ACCESS_KEY_ID}:${env.S3_SECRET_ACCESS_KEY}`,
          },
          body: new Uint8Array(buffer),
        });

        if (uploadRes.ok) {
          const publicPrefix = env.S3_PUBLIC_URL_PREFIX || `${env.S3_ENDPOINT}/${env.S3_BUCKET}`;
          const fileUrl = `${publicPrefix.replace(/\/$/, '')}/${storageKey}`;
          logger.info(`Receipt uploaded to Cloud Storage (${env.STORAGE_DRIVER}): ${storageKey}`);
          return {
            fileUrl,
            key: storageKey,
            filename,
            mimeType,
            sizeBytes: buffer.length,
            uploadedAt: new Date().toISOString(),
          };
        }
      } catch (s3Err) {
        logger.warn('Remote cloud upload failed, falling back to local storage', undefined, s3Err as Error);
      }
    }

    // 4. Local Filesystem Storage Fallback
    const localFilePath = path.join(this.localUploadDir, filename);
    await fs.promises.writeFile(localFilePath, buffer);

    const baseUrl = `http://localhost:${env.PORT}`;
    const fileUrl = `${baseUrl}/api/v1/storage/receipts/${filename}`;

    logger.info(`Receipt saved locally: ${filename} (${buffer.length} bytes)`);

    return {
      fileUrl,
      key: `local/${filename}`,
      filename,
      mimeType,
      sizeBytes: buffer.length,
      uploadedAt: new Date().toISOString(),
    };
  }

  /**
   * Get file stream/buffer from local storage
   */
  public async getLocalReceipt(filename: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const safeName = path.basename(filename);
    const filePath = path.join(this.localUploadDir, safeName);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const buffer = await fs.promises.readFile(filePath);
    const ext = path.extname(safeName).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
    };
    return {
      buffer,
      mimeType: mimeMap[ext] || 'application/octet-stream',
    };
  }
}

export const storageService = new StorageService();
