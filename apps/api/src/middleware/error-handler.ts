import { Elysia } from 'elysia';
import { ERROR_CODES, type ApiErrorResponse } from '@uangku/contracts';
import { sentry } from '../utils/sentry';
import { logger } from '../utils/logger';

export function successResponse<T>(data: T, requestId?: string) {
  return {
    data,
    meta: {
      requestId: requestId || crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  };
}

export function paginatedResponse<T>(data: T[], nextCursor?: string | null, limit = 30) {
  return {
    data,
    meta: {
      nextCursor: nextCursor || null,
      hasMore: Boolean(nextCursor),
      limit,
      requestId: crypto.randomUUID(),
    },
  };
}

export function handleAppError({ code, error, set }: { code: any; error: any; set: any }): Response {
  const requestId = crypto.randomUUID();
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (code === 'VALIDATION' || (error as any)?.name === 'ZodError' || Boolean((error as any)?.issues)) {
    const response: ApiErrorResponse = {
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Data yang dikirim tidak valid.',
        details: errorMessage,
        requestId,
      },
    };
    return Response.json(response, { status: 400 });
  }

  if (errorMessage === ERROR_CODES.UNAUTHORIZED) {
    const response: ApiErrorResponse = {
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Sesi login telah berakhir. Silakan masuk kembali.',
        requestId,
      },
    };
    return Response.json(response, { status: 401 });
  }

  if (errorMessage === ERROR_CODES.SAME_ACCOUNT_TRANSFER) {
    const response: ApiErrorResponse = {
      error: {
        code: ERROR_CODES.SAME_ACCOUNT_TRANSFER,
        message: 'Akun asal dan akun tujuan transfer tidak boleh sama.',
        requestId,
      },
    };
    return Response.json(response, { status: 400 });
  }

  if (errorMessage === ERROR_CODES.RESOURCE_NOT_FOUND) {
    const response: ApiErrorResponse = {
      error: {
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Data tidak ditemukan.',
        requestId,
      },
    };
    return Response.json(response, { status: 404 });
  }

  if (errorMessage === ERROR_CODES.SYNC_CONFLICT) {
    const response: ApiErrorResponse = {
      error: {
        code: ERROR_CODES.SYNC_CONFLICT,
        message: 'Terjadi perbedaan versi data.',
        requestId,
      },
    };
    return Response.json(response, { status: 409 });
  }

  if (errorMessage === ERROR_CODES.RATE_LIMIT_EXCEEDED || errorMessage === 'RATE_LIMITED') {
    const response: ApiErrorResponse = {
      error: {
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: 'Terlalu banyak permintaan. Silakan tunggu beberapa saat.',
        requestId,
      },
    };
    return Response.json(response, { status: 429 });
  }

  if (errorMessage === ERROR_CODES.FORBIDDEN) {
    const response: ApiErrorResponse = {
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: 'Akses ditolak. Anda tidak memiliki izin untuk tindakan ini.',
        requestId,
      },
    };
    return Response.json(response, { status: 403 });
  }

  // Capture unexpected 500 exceptions in Sentry and structured logger
  sentry.captureException(error, { requestId, extra: { code } });

  // Default Internal Server Error
  const response: ApiErrorResponse = {
    error: {
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'Terjadi kendala pada sistem. Tim kami sedang memperbaikinya.',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      requestId,
    },
  };
  return Response.json(response, { status: 500 });
}

export const errorHandler = new Elysia({ name: 'error-handler' })
  .onError(handleAppError);
