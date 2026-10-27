import Constants from 'expo-constants';

export interface VersionCheckResult {
  isForceUpdateRequired: boolean;
  forceUpdateMessage?: string;
  storeUrl?: string;
  isUpdateAvailable?: boolean;
}

function compareSemver(v1: string, v2: string): number {
  const parts1 = v1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = v2.split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

export class AppConfigService {
  private static baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

  public static async checkVersion(): Promise<VersionCheckResult> {
    const currentVersion = Constants.expoConfig?.version || '1.0.0';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${this.baseUrl}/api/v1/app-config`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return { isForceUpdateRequired: false };
      }

      const body = await res.json();
      const data = body.data;
      if (!data) return { isForceUpdateRequired: false };

      const minVersion = data.minimumAppVersion || '1.0.0';
      const latestVersion = data.latestAppVersion || '1.0.0';

      const isForceUpdateRequired = compareSemver(currentVersion, minVersion) < 0;
      const isUpdateAvailable = compareSemver(currentVersion, latestVersion) < 0;

      return {
        isForceUpdateRequired,
        forceUpdateMessage: data.forceUpdateMessage || 'Versi aplikasi ini sudah tidak didukung. Silakan perbarui di App Store.',
        storeUrl: data.storeUrl || 'https://apps.apple.com',
        isUpdateAvailable,
      };
    } catch {
      // Gracefully continue when offline or API is unreachable
      return { isForceUpdateRequired: false };
    }
  }
}
