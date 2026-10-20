import { db, schema } from './client';
import { eq } from 'drizzle-orm';

export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function seedDatabase(): Promise<void> {
  try {
    // 1. Ensure Profile exists
    const [existingProfile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.id, DEFAULT_USER_ID));

    if (!existingProfile) {
      await db.insert(schema.profiles).values({
        id: DEFAULT_USER_ID,
        displayName: 'Gary Hardyansyah',
        defaultCurrency: 'IDR',
        timezone: 'Asia/Jakarta',
      });
      console.log('🌱 Seeded default user profile in PostgreSQL');
    }

    // 2. Ensure Accounts exist
    const accountsCount = await db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, DEFAULT_USER_ID));

    if (accountsCount.length === 0) {
      await db.insert(schema.accounts).values([
        {
          id: 'a1000000-0000-0000-0000-000000000001',
          userId: DEFAULT_USER_ID,
          name: 'Dompet Tunai',
          type: 'cash',
          currency: 'IDR',
          initialBalance: 0,
          isDefault: true,
          isArchived: false,
        },
        {
          id: 'a2000000-0000-0000-0000-000000000002',
          userId: DEFAULT_USER_ID,
          name: 'BCA Utama',
          type: 'bank',
          currency: 'IDR',
          initialBalance: 0,
          isDefault: false,
          isArchived: false,
        },
        {
          id: 'a3000000-0000-0000-0000-000000000003',
          userId: DEFAULT_USER_ID,
          name: 'GoPay',
          type: 'e_wallet',
          currency: 'IDR',
          initialBalance: 0,
          isDefault: false,
          isArchived: false,
        },
      ]);
      console.log('🌱 Seeded default accounts in PostgreSQL');
    }

    // 3. Ensure System Categories exist
    const systemCategories = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.isSystem, true));

    if (systemCategories.length === 0) {
      await db.insert(schema.categories).values([
        // Expense
        { id: 'c1000000-0000-0000-0000-000000000001', userId: null, name: 'Makanan & Minuman', type: 'expense', icon: 'utensils', isSystem: true, isArchived: false },
        { id: 'c1000000-0000-0000-0000-000000000002', userId: null, name: 'Transportasi', type: 'expense', icon: 'car', isSystem: true, isArchived: false },
        { id: 'c1000000-0000-0000-0000-000000000003', userId: null, name: 'Belanja & Kebutuhan', type: 'expense', icon: 'shopping-bag', isSystem: true, isArchived: false },
        { id: 'c1000000-0000-0000-0000-000000000004', userId: null, name: 'Tagihan & Langganan', type: 'expense', icon: 'file-text', isSystem: true, isArchived: false },
        { id: 'c1000000-0000-0000-0000-000000000005', userId: null, name: 'Hiburan & Liburan', type: 'expense', icon: 'film', isSystem: true, isArchived: false },
        { id: 'c1000000-0000-0000-0000-000000000006', userId: null, name: 'Kesehatan', type: 'expense', icon: 'heart', isSystem: true, isArchived: false },
        { id: 'c1000000-0000-0000-0000-000000000007', userId: null, name: 'Pendidikan', type: 'expense', icon: 'book', isSystem: true, isArchived: false },
        { id: 'c1000000-0000-0000-0000-000000000008', userId: null, name: 'Lainnya', type: 'expense', icon: 'more-horizontal', isSystem: true, isArchived: false },
        // Income
        { id: 'c2000000-0000-0000-0000-000000000001', userId: null, name: 'Gaji Utama', type: 'income', icon: 'briefcase', isSystem: true, isArchived: false },
        { id: 'c2000000-0000-0000-0000-000000000002', userId: null, name: 'Bonus & THR', type: 'income', icon: 'gift', isSystem: true, isArchived: false },
        { id: 'c2000000-0000-0000-0000-000000000003', userId: null, name: 'Freelance & Proyek', type: 'income', icon: 'laptop', isSystem: true, isArchived: false },
        { id: 'c2000000-0000-0000-0000-000000000004', userId: null, name: 'Hasil Bisnis', type: 'income', icon: 'trending-up', isSystem: true, isArchived: false },
        { id: 'c2000000-0000-0000-0000-000000000005', userId: null, name: 'Pemberian / Hadiah', type: 'income', icon: 'heart', isSystem: true, isArchived: false },
        { id: 'c2000000-0000-0000-0000-000000000006', userId: null, name: 'Lainnya', type: 'income', icon: 'more-horizontal', isSystem: true, isArchived: false },
      ]);
      console.log('🌱 Seeded system categories in PostgreSQL');
    }
  } catch (err: any) {
    console.warn('Database seed skipped or failed (Postgres offline or read-only):', err.message);
  }
}
