import { z } from 'zod';

export const bankProviderEnum = z.enum(['statement_import', 'brick', 'ayoconnect', 'shortcuts']);
export const mutationTypeEnum = z.enum(['debit', 'credit']);
export const reconciliationStatusEnum = z.enum(['pending', 'matched', 'created_as_new', 'ignored']);

export const createBankConnectionSchema = z.object({
  accountId: z.string().uuid('ID Akun tidak valid'),
  provider: bankProviderEnum.default('statement_import'),
  institutionCode: z.string().trim().min(2, 'Kode institusi bank minimal 2 karakter').max(20),
  maskedAccountNumber: z.string().max(30).nullable().optional(),
});

export const importStatementSchema = z.object({
  connectionId: z.string().uuid('ID Koneksi Bank tidak valid'),
  statementText: z.string().min(1, 'Isi mutasi rekening tidak boleh kosong'),
  format: z.enum(['csv', 'bca_csv', 'mandiri_csv', 'raw_text']).default('csv'),
});

export const reconcileMutationSchema = z.object({
  action: z.enum(['match', 'create_new', 'ignore']),
  matchedTransactionId: z.string().uuid('ID Transaksi tidak valid').nullable().optional(),
  categoryId: z.string().uuid('ID Kategori tidak valid').nullable().optional(),
  pocketId: z.string().uuid('ID Kantong tidak valid').nullable().optional(),
  note: z.string().max(255).nullable().optional(),
}).refine((data) => {
  if (data.action === 'match') {
    return Boolean(data.matchedTransactionId);
  }
  return true;
}, {
  message: 'Wajib memilih transaksi yang dicocokkan',
  path: ['matchedTransactionId'],
});

export type CreateBankConnectionInput = z.infer<typeof createBankConnectionSchema>;
export type ImportStatementInput = z.infer<typeof importStatementSchema>;
export type ReconcileMutationInput = z.infer<typeof reconcileMutationSchema>;
