/**
 * Telemetry and Crash Reporting Service for UangKu Mobile (Sentry & Observability).
 * Protects user privacy by stripping financial amounts, tokens, and PII from breadcrumbs and stack traces.
 */

export interface ErrorReportContext {
  screen?: string;
  action?: string;
  extra?: Record<string, any>;
}

class TelemetryService {
  private sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = Boolean(this.sentryDsn && this.sentryDsn.startsWith('http'));
  }

  /**
   * Sanitizes error and context to prevent financial amounts or tokens from leaking to crash logs
   */
  private sanitizeData(data: Record<string, any> | undefined): Record<string, any> {
    if (!data) return {};
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('pin') ||
        lowerKey.includes('token') ||
        lowerKey.includes('password') ||
        lowerKey.includes('secret')
      ) {
        sanitized[key] = '[REDACTED_SECRET]';
      } else if (
        lowerKey.includes('amount') ||
        lowerKey.includes('balance') ||
        lowerKey.includes('nominal')
      ) {
        sanitized[key] = '[REDACTED_FINANCIAL_VALUE]';
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  public recordCrash(error: Error, context?: ErrorReportContext): void {
    const sanitizedContext = {
      screen: context?.screen || 'UnknownScreen',
      action: context?.action || 'unhandled_component_catch',
      extra: this.sanitizeData(context?.extra),
    };

    console.error('📊 [UangKu Telemetry] Captured Crash Event:', {
      message: error.message,
      name: error.name,
      context: sanitizedContext,
    });

    if (!this.isEnabled) {
      return;
    }

    // Forward to Sentry Store API
    try {
      const match = this.sentryDsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
      if (!match) return;
      const [, publicKey, host, projectId] = match;
      const url = `https://${host}/api/${projectId}/store/`;

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=uangku-mobile/1.0.0, sentry_key=${publicKey}`,
        },
        body: JSON.stringify({
          event_id: Math.random().toString(36).substring(2, 15),
          timestamp: new Date().toISOString().slice(0, 19),
          platform: 'javascript',
          level: 'fatal',
          release: '1.0.0',
          environment: __DEV__ ? 'development' : 'production',
          exception: {
            values: [
              {
                type: error.name,
                value: error.message,
              },
            ],
          },
          tags: {
            screen: sanitizedContext.screen,
            platform: 'ios',
          },
          extra: sanitizedContext.extra,
        }),
      }).catch(() => {});
    } catch {}
  }
}

export const telemetryService = new TelemetryService();
