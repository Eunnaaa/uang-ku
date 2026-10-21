import { Elysia } from 'elysia';
import {
  createTemplateSchema,
  updateTemplateSchema,
  type TemplateModel,
} from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { db, schema } from '../../db/client';
import { eq } from 'drizzle-orm';

export const demoTemplates: TemplateModel[] = [
  {
    id: 't1000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000001',
    name: 'Kopi Kenangan Kenangan Mantan',
    templatePayload: {
      type: 'expense',
      amount: 22000,
      accountId: 'a2000000-0000-0000-0000-000000000002',
      categoryId: 'c1000000-0000-0000-0000-000000000001',
      note: 'Kopi Kenangan Regular Mantan',
      currency: 'IDR',
    },
    sortOrder: 0,
    useCount: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 't2000000-0000-0000-0000-000000000002',
    userId: '00000000-0000-0000-0000-000000000001',
    name: 'Bensin Motor Shell V-Power',
    templatePayload: {
      type: 'expense',
      amount: 35000,
      accountId: 'a1000000-0000-0000-0000-000000000001',
      categoryId: 'c1000000-0000-0000-0000-000000000002',
      note: 'Isi Shell V-Power Full',
      currency: 'IDR',
    },
    sortOrder: 1,
    useCount: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const templateRoutes = new Elysia({ prefix: '/api/v1/templates' })
  .use(authMiddleware)
  .get('/', async ({ user }) => {
    const list = demoTemplates
      .filter((t) => t.userId === user.userId)
      .sort((a, b) => b.useCount - a.useCount || a.sortOrder - b.sortOrder);
    return successResponse(list);
  })
  .post('/', async ({ body, user, set }) => {
    const userTemplates = demoTemplates.filter((t) => t.userId === user.userId);
    if (userTemplates.length >= 20) {
      set.status = 400;
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Maksimum 20 template per pengguna telah tercapai.',
        },
      };
    }

    const input = createTemplateSchema.parse(body);
    const newTemplate: TemplateModel = {
      id: crypto.randomUUID(),
      userId: user.userId,
      name: input.name,
      templatePayload: input.templatePayload,
      sortOrder: input.sortOrder ?? 0,
      useCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    demoTemplates.unshift(newTemplate);

    try {
      await db.insert(schema.transactionTemplates).values({
        id: newTemplate.id,
        userId: user.userId,
        name: newTemplate.name,
        templatePayload: newTemplate.templatePayload,
        sortOrder: newTemplate.sortOrder,
        useCount: 0,
      });
    } catch {}

    return successResponse(newTemplate);
  })
  .patch('/:id', async ({ params, body, user }) => {
    const input = updateTemplateSchema.parse(body);
    const template = demoTemplates.find((t) => t.id === params.id && t.userId === user.userId);
    if (!template) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    if (input.name !== undefined) template.name = input.name;
    if (input.templatePayload !== undefined) {
      template.templatePayload = {
        ...template.templatePayload,
        ...input.templatePayload,
      };
    }
    if (input.sortOrder !== undefined) template.sortOrder = input.sortOrder;
    template.updatedAt = new Date().toISOString();

    try {
      await db.update(schema.transactionTemplates).set({
        name: template.name,
        templatePayload: template.templatePayload,
        sortOrder: template.sortOrder,
        updatedAt: new Date(template.updatedAt),
      }).where(eq(schema.transactionTemplates.id, template.id));
    } catch {}

    return successResponse(template);
  })
  .delete('/:id', async ({ params, user }) => {
    const index = demoTemplates.findIndex((t) => t.id === params.id && t.userId === user.userId);
    if (index === -1) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    demoTemplates.splice(index, 1);

    try {
      await db.delete(schema.transactionTemplates).where(eq(schema.transactionTemplates.id, params.id));
    } catch {}

    return successResponse({ id: params.id, deleted: true });
  })
  .post('/:id/use', async ({ params, user }) => {
    const template = demoTemplates.find((t) => t.id === params.id && t.userId === user.userId);
    if (!template) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    template.useCount += 1;
    template.updatedAt = new Date().toISOString();

    try {
      await db.update(schema.transactionTemplates).set({
        useCount: template.useCount,
        updatedAt: new Date(template.updatedAt),
      }).where(eq(schema.transactionTemplates.id, template.id));
    } catch {}

    return successResponse(template);
  });
