import { z } from 'zod';

export const CreateGoalSchema = z.object({
  name: z.string().min(1, 'Nama goal wajib diisi').max(100),
  emoji: z.string().optional().default('target'),
  targetAmount: z.number().int().positive('Nominal target tabungan harus bilangan bulat positif'),
  initialAmount: z.number().int().nonnegative().optional().default(0),
  targetDate: z.string().optional(),
});

export const UpdateGoalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  emoji: z.string().optional(),
  targetAmount: z.number().int().positive().optional(),
  currentAmount: z.number().int().nonnegative().optional(),
  targetDate: z.string().optional(),
  status: z.enum(['active', 'achieved', 'archived']).optional(),
});

export const createGoalSchema = CreateGoalSchema;
export const updateGoalSchema = UpdateGoalSchema;

export type CreateGoalInput = z.infer<typeof CreateGoalSchema>;
export type UpdateGoalInput = z.infer<typeof UpdateGoalSchema>;
