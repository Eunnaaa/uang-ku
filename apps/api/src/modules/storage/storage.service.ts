import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../../config/env';
import {
  ALLOWED_RECEIPT_MIME_TYPES,
  MAX_RECEIPT_FILE_SIZE_BYTES,
  type AllowedReceiptMimeType,
  type UploadReceiptResponse,
} from '@uangku/contracts';

export class StorageService {
  private localUploadDir = path.resolve(env.STORAGE_LOCAL_DIR, 'receipts');
  private bucket = env.STORAGE_DRIVER === 'local' ? null : new Bun.S3Client({
    endpoint: env.S3_ENDPOINT, bucket: env.S3_BUCKET, region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  });

  public async uploadReceipt(
    buffer: Buffer,
    originalFilename: string,
    mimeType: AllowedReceiptMimeType,
    userId: string,
    origin: string
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
    const uniqueId = crypto.randomUUID();
    const parsedName = path.parse(originalFilename).name;
    const sanitizedBase = parsedName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 25) || 'receipt';
    const filename = `${datePrefix}_${uniqueId}_${sanitizedBase}${extension}`;
    const storageKey = `receipts/${userId}/${filename}`;

    if (this.bucket) {
      await this.bucket.write(storageKey, buffer, { type: mimeType });
    } else {
      const dir = path.join(this.localUploadDir, userId);
      await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
      await fs.promises.writeFile(path.join(dir, filename), buffer, { flag: 'wx', mode: 0o600 });
    }
    return {
      fileUrl: `${origin}/api/v1/storage/receipts/${filename}`,
      key: storageKey,
      filename,
      mimeType,
      sizeBytes: buffer.length,
      uploadedAt: new Date().toISOString(),
    };
  }

  // Called under the owner's PostgreSQL row lock. Count existing objects, including pre-quota uploads.
  public async hasRoomForReceipt(userId: string, bytes: number) {
    let count = 1, total = bytes;
    const fits = (size: number) => {
      count++;
      total += size;
      return count <= 100 && total <= 100 * 1024 * 1024;
    };
    if (this.bucket) {
      let continuationToken: string | undefined;
      do {
        const page = await this.bucket.list({ prefix: `receipts/${userId}/`, continuationToken, maxKeys: 100 });
        for (const obj of page.contents ?? []) if (obj.size == null || !fits(obj.size)) return false;
        if (!page.isTruncated) break;
        if (!page.nextContinuationToken || page.nextContinuationToken === continuationToken) throw new Error('Incomplete receipt inventory');
        continuationToken = page.nextContinuationToken;
      } while (continuationToken);
    } else {
      const dir = path.join(this.localUploadDir, userId);
      try {
        for await (const entry of await fs.promises.opendir(dir)) {
          if (!entry.isFile() || !fits((await fs.promises.stat(path.join(dir, entry.name))).size)) return false;
        }
      } catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; }
    }
    return true;
  }

  public async getReceipt(userId: string, filename: string) {
    if (!/^[\w-]+\.[A-Za-z0-9]+$/.test(filename)) return null;
    const file = this.bucket ? this.bucket.file(`receipts/${userId}/${filename}`) :
      Bun.file(path.join(this.localUploadDir, userId, filename));
    if (!await file.exists()) return null;
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.heic': 'image/heic',
      '.pdf': 'application/pdf',
    };
    return {
      buffer: await file.arrayBuffer(),
      mimeType: mimeMap[ext] || 'application/octet-stream',
    };
  }

  public async deleteReceipts(userId: string) {
    // Flat legacy uploads have no trusted owner. Never infer one from an editable transaction URL.
    const legacy = env.STORAGE_LEGACY_DIR || path.resolve(__dirname, '../../../public/uploads/receipts');
    let files: string[];
    try { files = await fs.promises.readdir(legacy); }
    catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      files = [];
    }
    if (files.some(name => /^\d{8}_[a-f0-9]{8}_/.test(name))) throw new Error('Legacy receipt ownership must be reconciled first');
    const prefix = `receipts/${userId}/`;
    if (this.bucket) {
      let continuationToken: string | undefined;
      do {
        const page = await this.bucket.list({ prefix, continuationToken });
        for (const obj of page.contents || []) {
          if (!obj.key?.startsWith(prefix)) throw new Error('Invalid receipt storage key');
          await this.bucket.delete(obj.key);
        }
        if (page.isTruncated && !page.nextContinuationToken) throw new Error('Incomplete receipt listing');
        continuationToken = page.nextContinuationToken;
      } while (continuationToken);
    }
    await fs.promises.rm(path.join(this.localUploadDir, userId), { recursive: true, force: true });
  }
}

export const storageService = new StorageService();
