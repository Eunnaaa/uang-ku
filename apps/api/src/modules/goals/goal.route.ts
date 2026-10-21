import { Elysia } from 'elysia';
import {
  createGoalSchema,
  updateGoalSchema,
  type GoalModel,
} from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { db, schema } from '../../db/client';
import { eq } from 'drizzle-orm';

export const demoGoals: GoalModel[] = [
  {
    id: 'g1000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000001',
    name: 'Dana Darurat 6 Bulan',
    emoji: '🛡️',
    targetAmount: 30000000,
    currentAmount: 12000000,
    targetDate: '2027-12-31',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'g2000000-0000-0000-0000-000000000002',
    userId: '00000000-0000-0000-0000-000000000001',
    name: 'MacBook Pro M-Series',
    emoji: '💻',
    targetAmount: 25000000,
    currentAmount: 8500000,
    targetDate: '2027-06-30',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const goalRoutes = new Elysia({ prefix: '/api/v1/goals' })
  .use(authMiddleware)
  .get('/', async ({ user }) => {
    const list = demoGoals.filter((g) => g.userId === user.userId && g.status !== 'archived');
    return successResponse(list);
  })
  .post('/', async ({ body, user }) => {
    const input = createGoalSchema.parse(body);

    const initialAmount = input.initialAmount ?? 0;
    const isAchieved = initialAmount >= input.targetAmount;

    const newGoal: GoalModel = {
      id: crypto.randomUUID(),
      userId: user.userId,
      name: input.name,
      emoji: input.emoji ?? '🎯',
      targetAmount: input.targetAmount,
      currentAmount: initialAmount,
      targetDate: input.targetDate ?? null,
      status: isAchieved ? 'achieved' : 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    demoGoals.unshift(newGoal);

    try {
      await db.insert(schema.financialGoals).values({
        id: newGoal.id,
        userId: user.userId,
        name: newGoal.name,
        emoji: newGoal.emoji,
        targetAmount: newGoal.targetAmount,
        currentAmount: newGoal.currentAmount,
        targetDate: newGoal.targetDate,
        status: newGoal.status,
      });
    } catch {}

    return successResponse(newGoal);
  })
  .patch('/:id', async ({ params, body, user }) => {
    const input = updateGoalSchema.parse(body);
    const goal = demoGoals.find((g) => g.id === params.id && g.userId === user.userId);
    if (!goal) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    if (input.name !== undefined) goal.name = input.name;
    if (input.emoji !== undefined) goal.emoji = input.emoji;
    if (input.targetAmount !== undefined) goal.targetAmount = input.targetAmount;
    if (input.targetDate !== undefined) goal.targetDate = input.targetDate;
    if (input.status !== undefined) goal.status = input.status;
    goal.updatedAt = new Date().toISOString();

    try {
      await db.update(schema.financialGoals).set({
        name: goal.name,
        emoji: goal.emoji,
        targetAmount: goal.targetAmount,
        targetDate: goal.targetDate,
        status: goal.status,
        updatedAt: new Date(goal.updatedAt),
      }).where(eq(schema.financialGoals.id, goal.id));
    } catch {}

    return successResponse(goal);
  })
  .delete('/:id', async ({ params, user }) => {
    const goal = demoGoals.find((g) => g.id === params.id && g.userId === user.userId);
    if (!goal) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    goal.status = 'archived';
    goal.updatedAt = new Date().toISOString();

    try {
      await db.update(schema.financialGoals).set({
        status: 'archived',
        updatedAt: new Date(goal.updatedAt),
      }).where(eq(schema.financialGoals.id, goal.id));
    } catch {}

    return successResponse({ id: params.id, archived: true });
  })
  .post('/:id/deposit', async ({ params, body, user, set }) => {
    const goal = demoGoals.find((g) => g.id === params.id && g.userId === user.userId);
    if (!goal) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    const { amount } = body as { amount?: number };
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      set.status = 400;
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Nominal deposit harus lebih besar dari 0' },
      };
    }

    goal.currentAmount += Math.round(amount);
    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = 'achieved';
    }
    goal.updatedAt = new Date().toISOString();

    try {
      await db.update(schema.financialGoals).set({
        currentAmount: goal.currentAmount,
        status: goal.status,
        updatedAt: new Date(goal.updatedAt),
      }).where(eq(schema.financialGoals.id, goal.id));
    } catch {}

    return successResponse(goal);
  });
