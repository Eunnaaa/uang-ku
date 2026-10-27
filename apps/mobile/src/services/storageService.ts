import * as FileSystem from 'expo-file-system';
import { getStoredToken } from '../auth/authContext';
import { type AllowedReceiptMimeType } from '@uangku/contracts';

class MobileStorageService {
  private baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

  /**
   * Uploads receipt image to Cloud / API storage.
   * If offline or upload fails, gracefully falls back to returning the local device URI.
   */
  public async uploadReceiptImage(localUri: string): Promise<string> {
    if (!localUri) return '';

    // If already a remote URL, return as-is
    if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
      return localUri;
    }

    try {
      // 1. Read local file as base64
      const base64Data = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 2. Infer mime type from extension
      const lowerUri = localUri.toLowerCase();
      let mimeType: AllowedReceiptMimeType = 'image/jpeg';
      if (lowerUri.endsWith('.png')) mimeType = 'image/png';
      else if (lowerUri.endsWith('.webp')) mimeType = 'image/webp';
      else if (lowerUri.endsWith('.pdf')) mimeType = 'application/pdf';

      const filename = `receipt_${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`;
      const token = (await getStoredToken()) || 'demo-token';

      // 3. 10-second timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${this.baseUrl}/api/v1/storage/upload-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filename,
          mimeType,
          base64Data,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json.data?.fileUrl) {
          return json.data.fileUrl;
        }
      }
    } catch (err) {
      console.warn('Receipt upload failed, preserving local device URI:', err);
    }

    // Graceful offline fallback: keep local device file URI
    return localUri;
  }
}

export const mobileStorageService = new MobileStorageService();
