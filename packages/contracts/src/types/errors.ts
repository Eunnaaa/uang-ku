export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SAME_ACCOUNT_TRANSFER: 'SAME_ACCOUNT_TRANSFER',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  SYNC_CONFLICT: 'SYNC_CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ApiErrorPayload {
  code: ErrorCode;
  message: string;
  details?: string;
  requestId: string;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}
