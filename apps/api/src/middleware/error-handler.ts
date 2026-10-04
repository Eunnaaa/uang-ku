import { Elysia } from 'elysia';

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

export const errorHandler = new Elysia({ name: 'error-handler' })
  .onError(({ code, error, set }) => {
    const requestId = crypto.randomUUID();
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (code === 'VALIDATION') {
      set.status = 400;
      return {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Data yang dikirim tidak valid.',
          details: errorMessage,
          requestId,
        },
      };
    }

    if (errorMessage === 'UNAUTHORIZED') {
      set.status = 401;
      return {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Sesi login telah berakhir. Silakan masuk kembali.',
          requestId,
        },
      };
    }

    if (errorMessage === 'SAME_ACCOUNT_TRANSFER') {
      set.status = 400;
      return {
        error: {
          code: 'SAME_ACCOUNT_TRANSFER',
          message: 'Akun asal dan akun tujuan transfer tidak boleh sama.',
          requestId,
        },
      };
    }

    if (errorMessage === 'RESOURCE_NOT_FOUND') {
      set.status = 404;
      return {
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Data tidak ditemukan.',
          requestId,
        },
      };
    }

    if (errorMessage === 'SYNC_CONFLICT') {
      set.status = 409;
      return {
        error: {
          code: 'SYNC_CONFLICT',
          message: 'Terjadi perbedaan versi data.',
          requestId,
        },
      };
    }

    // Default Internal Server Error
    set.status = (set.status as number) >= 400 ? set.status : 500;
    return {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Terjadi kendala pada sistem. Tim kami sedang memperbaikinya.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        requestId,
      },
    };
  });
