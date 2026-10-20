import { describe, it, expect } from 'bun:test';
import { ERROR_CODES, type ApiErrorResponse } from './errors';

describe('Contracts Error System & Error Codes (PRD Section 31)', () => {
  it('defines all required standardized error codes', () => {
    expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ERROR_CODES.SAME_ACCOUNT_TRANSFER).toBe('SAME_ACCOUNT_TRANSFER');
    expect(ERROR_CODES.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(ERROR_CODES.FORBIDDEN).toBe('FORBIDDEN');
    expect(ERROR_CODES.RESOURCE_NOT_FOUND).toBe('RESOURCE_NOT_FOUND');
    expect(ERROR_CODES.SYNC_CONFLICT).toBe('SYNC_CONFLICT');
    expect(ERROR_CODES.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
    expect(ERROR_CODES.INTERNAL_SERVER_ERROR).toBe('INTERNAL_SERVER_ERROR');
  });

  it('structures ApiErrorResponse with requestId and localized message', () => {
    const errorResponse: ApiErrorResponse = {
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Data tidak valid',
        details: 'Field amount harus bilangan bulat positif',
        requestId: 'req-test-1234',
      },
    };

    expect(errorResponse.error.code).toBe('VALIDATION_ERROR');
    expect(errorResponse.error.requestId).toBe('req-test-1234');
    expect(errorResponse.error.message).toContain('tidak valid');
    expect(errorResponse.error.details).toBeDefined();
  });
});
