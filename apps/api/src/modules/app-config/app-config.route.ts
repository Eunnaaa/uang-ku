import { Elysia } from 'elysia';
import { successResponse } from '../../middleware/error-handler';

export const appConfigRoutes = new Elysia({ prefix: '/api/v1/app-config' })
  .get('/', () => {
    return successResponse({
      minimumAppVersion: '1.0.0',
      latestAppVersion: '1.0.0',
      forceUpdateMessage: 'Versi aplikasi ini sudah tidak didukung. Silakan perbarui UangKu di Apple App Store.',
      storeUrl: 'https://apps.apple.com/app/uangku/id6741234567',
      features: {
        offlineSyncEnabled: true,
        biometricLockEnabled: true,
        receiptUploadEnabled: true,
        exportCsvEnabled: true,
        importCsvEnabled: true,
      },
    });
  });
