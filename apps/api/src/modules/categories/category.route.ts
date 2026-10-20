import { Elysia } from 'elysia';
import { createCategorySchema, updateCategorySchema, type CategoryModel } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';

export const defaultCategories: CategoryModel[] = [
  // Expense
  { id: 'c1000000-0000-0000-0000-000000000001', userId: null, name: 'Makanan & Minuman', type: 'expense', icon: 'utensils', isSystem: true, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c1000000-0000-0000-0000-000000000002', userId: null, name: 'Transportasi', type: 'expense', icon: 'car', isSystem: true, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c1000000-0000-0000-0000-000000000003', userId: null, name: 'Belanja & Kebutuhan', type: 'expense', icon: 'shopping-bag', isSystem: true, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c1000000-0000-0000-0000-000000000004', userId: null, name: 'Tagihan & Langganan', type: 'expense', icon: 'file-text', isSystem: true, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c1000000-0000-0000-0000-000000000005', userId: null, name: 'Hiburan & Liburan', type: 'expense', icon: 'film', isSystem: true, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c1000000-0000-0000-0000-000000000006', userId: null, name: 'Kesehatan', type: 'expense', icon: 'heart', isSystem: true, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c1000000-0000-0000-0000-000000000007', userId: null, name: 'Pendidikan', type: 'expense', icon: 'book', isSystem: true, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c1000000-0000-0000-0000-000000000008', userId: null, name: 'Lainnya', type: 'expense', icon: 'more-horizontal', isSystem: true, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // Income
  { id: 'c2000000-0000-0000-0000-000000000001', userId: null, name: 'Gaji Utama', type: 'income', icon: 'briefcase', isSystem: true, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c2000000-0000-0000-0000-000000000002', userId: null, name: 'Bonus & THR', type: 'income', icon: 'gift', isSystem: true, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c2000000-0000-0000-0000-000000000003', userId: null, name: 'Freelance & Proyek', type: 'income', icon: 'laptop', isSystem: true, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c2000000-0000-0000-0000-000000000004', userId: null, name: 'Hasil Bisnis', type: 'income', icon: 'trending-up', isSystem: true, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c2000000-0000-0000-0000-000000000005', userId: null, name: 'Pemberian / Hadiah', type: 'income', icon: 'heart', isSystem: true, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c2000000-0000-0000-0000-000000000006', userId: null, name: 'Lainnya', type: 'income', icon: 'more-horizontal', isSystem: true, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export const categoryRoutes = new Elysia({ prefix: '/api/v1/categories' })
  .use(authMiddleware)
  .get('/', async ({ query, user }) => {
    const typeFilter = query.type as string | undefined;
    let list = defaultCategories.filter((c) => !c.isArchived && (c.userId === null || c.userId === user.userId));
    if (typeFilter && (typeFilter === 'income' || typeFilter === 'expense')) {
      list = list.filter((c) => c.type === typeFilter);
    }
    return successResponse(list);
  })
  .post('/', async ({ body, user }) => {
    const input = createCategorySchema.parse(body);
    const newCategory: CategoryModel = {
      id: crypto.randomUUID(),
      userId: user.userId,
      name: input.name,
      type: input.type,
      icon: input.icon || 'tag',
      isSystem: false,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    defaultCategories.push(newCategory);
    return successResponse(newCategory);
  })
  .patch('/:id', async ({ params, body, user }) => {
    const input = updateCategorySchema.parse(body);
    const category = defaultCategories.find((c) => c.id === params.id && (c.userId === user.userId || c.userId === null));
    if (!category) {
      throw new Error('RESOURCE_NOT_FOUND');
    }
    if (category.isSystem) {
      throw new Error('FORBIDDEN');
    }
    if (input.name) category.name = input.name;
    if (input.icon !== undefined) category.icon = input.icon ?? null;
    if (input.isArchived !== undefined) category.isArchived = input.isArchived;
    category.updatedAt = new Date().toISOString();
    return successResponse(category);
  })
  .delete('/:id', async ({ params, user }) => {
    const category = defaultCategories.find((c) => c.id === params.id && (c.userId === user.userId || c.userId === null));
    if (!category) {
      throw new Error('RESOURCE_NOT_FOUND');
    }
    if (category.isSystem) {
      throw new Error('FORBIDDEN');
    }
    category.isArchived = true;
    category.updatedAt = new Date().toISOString();
    return successResponse({ id: category.id, isArchived: true });
  });
