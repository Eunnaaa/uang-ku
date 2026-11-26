import { z } from 'zod';

export const bankProviderEnum = z.enum(['statement_import', 'brick', 'ayoconnect', 'shortcuts']);
export const mutationTypeEnum = z.enum(['debit', 'credit']);
export const reconciliationStatusEnum = z.enum(['pending', 'matched', 'created_as_new', 'ignored']);

export const createBankConnectionSchema = z.object({
  accountId: z.guid('ID Akun tidak valid'),
  provider: bankProviderEnum.default('statement_import'),
  institutionCode: z.string().trim().min(2, 'Kode institusi bank minimal 2 karakter').max(20),
  maskedAccountNumber: z.string().max(30).nullable().optional(),
});

export const importStatementSchema = z.object({
  connectionId: z.guid('ID Koneksi Bank tidak valid'),
  statementText: z.string().min(1, 'Isi mutasi rekening tidak boleh kosong'),
  format: z.enum(['csv', 'bca_csv', 'mandiri_csv', 'raw_text']).default('csv'),
});

export const reconcileMutationSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('ignore') }),
  z.strictObject({ action: z.literal('match'), matchedTransactionId: z.guid() }),
  z.strictObject({ action: z.literal('create_new'), categoryId: z.guid().nullish(),
    pocketId: z.guid().nullish(), note: z.string().max(255).nullish() }),
]);

export type CreateBankConnectionInput = z.infer<typeof createBankConnectionSchema>;
export type ImportStatementInput = z.infer<typeof importStatementSchema>;
export type ReconcileMutationInput = z.infer<typeof reconcileMutationSchema>;
