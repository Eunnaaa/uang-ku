import { env } from '../config/env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private formatLog(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): LogPayload {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      requestId: context?.requestId,
      context,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: env.NODE_ENV === 'development' ? error.stack : undefined,
          }
        : undefined,
    };
  }

  private output(payload: LogPayload) {
    if (env.NODE_ENV === 'production') {
      // In production, emit clean single-line structured JSON
      const jsonStr = JSON.stringify(payload);
      if (payload.level === 'error') {
        console.error(jsonStr);
      } else if (payload.level === 'warn') {
        console.warn(jsonStr);
      } else {
        console.log(jsonStr);
      }
    } else {
      // Development readable formatting
      const timeStr = payload.timestamp.slice(11, 19);
      const levelColors: Record<LogLevel, string> = {
        debug: '\x1b[90m',
        info: '\x1b[36m',
        warn: '\x1b[33m',
        error: '\x1b[31m',
      };
      const reset = '\x1b[0m';
      const color = levelColors[payload.level] || '';
      const prefix = `${color}[${timeStr}] [${payload.level.toUpperCase()}]${reset}`;
      const reqInfo = payload.requestId ? `\x1b[90m(${payload.requestId.slice(0, 8)})\x1b[0m ` : '';
      console.log(`${prefix} ${reqInfo}${payload.message}`);
      if (payload.context && Object.keys(payload.context).length > 0) {
        console.log('   ', payload.context);
      }
      if (payload.error?.stack) {
        console.error('   ', payload.error.stack);
      }
    }
  }

  public debug(message: string, context?: Record<string, any>) {
    if (env.LOG_LEVEL === 'debug') {
      this.output(this.formatLog('debug', message, context));
    }
  }

  public info(message: string, context?: Record<string, any>) {
    this.output(this.formatLog('info', message, context));
  }

  public warn(message: string, context?: Record<string, any>, error?: Error) {
    this.output(this.formatLog('warn', message, context, error));
  }

  public error(message: string, error?: Error | unknown, context?: Record<string, any>) {
    const errObj = error instanceof Error ? error : error ? new Error(String(error)) : undefined;
    this.output(this.formatLog('error', message, context, errObj));
  }
}

export const logger = new Logger();
