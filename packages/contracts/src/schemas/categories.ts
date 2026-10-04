import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi').max(50, 'Nama kategori maksimal 50 karakter'),
  type: z.enum(['income', 'expense']),
  icon: z.string().max(50).nullable().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().max(50).nullable().optional(),
  isArchived: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
