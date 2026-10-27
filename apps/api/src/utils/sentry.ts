import { env } from '../config/env';
import { logger } from './logger';

export interface SentryContext {
  userId?: string;
  requestId?: string;
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}

class SentryService {
  private isEnabled: boolean;
  private dsn: string;

  constructor() {
    this.dsn = env.SENTRY_DSN;
    this.isEnabled = Boolean(this.dsn && this.dsn.startsWith('http'));
    if (this.isEnabled) {
      logger.info('Sentry Error Monitoring initialized for UangKu API', {
        dsnPrefix: this.dsn.split('@')[1] || 'configured',
      });
    }
  }

  public captureException(error: Error | unknown, context?: SentryContext) {
    const err = error instanceof Error ? error : new Error(String(error));

    // Structured logging always captures the error
    logger.error(`[SentryCapture] ${err.message}`, err, {
      requestId: context?.requestId,
      userId: context?.userId,
      ...context?.extra,
    });

    if (!this.isEnabled) {
      return;
    }

    // Direct HTTP Envelope dispatch to Sentry Store API if SDK is not bundled
    this.sendToSentry(err, context).catch((e) => {
      logger.warn('Failed to forward error event to Sentry DSN', undefined, e);
    });
  }

  private async sendToSentry(err: Error, context?: SentryContext) {
    try {
      // Parse DSN: https://<key>@<host>/<projectId>
      const match = this.dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
      if (!match) return;

      const [, publicKey, host, projectId] = match;
      const url = `https://${host}/api/${projectId}/store/`;

      const payload = {
        event_id: crypto.randomUUID().replace(/-/g, ''),
        timestamp: new Date().toISOString().slice(0, 19),
        platform: 'node',
        level: 'error',
        server_name: 'uangku-api',
        release: '1.0.0',
        environment: env.NODE_ENV,
        exception: {
          values: [
            {
              type: err.name,
              value: err.message,
              stacktrace: {
                frames: (err.stack || '')
                  .split('\n')
                  .slice(1)
                  .map((line) => ({ filename: line.trim() })),
              },
            },
          ],
        },
        user: context?.userId ? { id: context.userId } : undefined,
        tags: {
          requestId: context?.requestId || 'unknown',
          environment: env.NODE_ENV,
          ...context?.tags,
        },
        extra: context?.extra,
      };

      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=uangku-api/1.0.0, sentry_key=${publicKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Best-effort Sentry dispatch
    }
  }
}

export const sentry = new SentryService();
