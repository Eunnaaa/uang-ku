import { z } from 'zod';
import { transactionTypeEnum } from './transactions';

export const templatePayloadSchema = z.object({
  amount: z.number().int().positive('Nominal template harus lebih besar dari 0').max(999999999999),
  categoryId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid('Akun wajib dipilih'),
  destinationAccountId: z.string().uuid().nullable().optional(),
  type: transactionTypeEnum,
  note: z.string().max(255).nullable().optional(),
  currency: z.string().length(3).default('IDR'),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Nama template wajib diisi').max(50, 'Nama template maksimal 50 karakter'),
  templatePayload: templatePayloadSchema,
  sortOrder: z.number().int().default(0),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  templatePayload: templatePayloadSchema.optional(),
  sortOrder: z.number().int().optional(),
  useCount: z.number().int().min(0).optional(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type TemplatePayloadInput = z.infer<typeof templatePayloadSchema>;
