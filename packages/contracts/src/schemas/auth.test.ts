import { describe, expect, it } from 'bun:test';
import { registerSchema, loginSchema } from './auth';

describe('Auth Schema Validation', () => {
  it('validates a valid registration payload', () => {
    const valid = {
      email: 'user@uangku.id',
      password: 'password123',
      displayName: 'Gary',
    };
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects registration with invalid email format', () => {
    const invalidEmail = {
      email: 'not-an-email',
      password: 'password123',
    };
    expect(registerSchema.safeParse(invalidEmail).success).toBe(false);
  });

  it('rejects registration with password shorter than 6 characters', () => {
    const shortPass = {
      email: 'user@uangku.id',
      password: '123',
    };
    expect(registerSchema.safeParse(shortPass).success).toBe(false);
  });

  it('validates login payload', () => {
    const valid = {
      email: 'user@uangku.id',
      password: 'password123',
    };
    expect(loginSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects login with empty password', () => {
    const emptyPass = {
      email: 'user@uangku.id',
      password: '',
    };
    expect(loginSchema.safeParse(emptyPass).success).toBe(false);
  });
});
