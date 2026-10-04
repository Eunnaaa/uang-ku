import { pgTable, uuid, varchar, bigint, boolean, timestamp, integer, jsonb, text, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 1. Profiles Table
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  displayName: varchar('display_name', { length: 100 }),
  defaultCurrency: varchar('default_currency', { length: 3 }).default('IDR').notNull(),
  timezone: varchar('timezone', { length: 50 }).default('Asia/Jakarta').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Accounts Table
export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'cash' | 'bank' | 'e_wallet' | 'other'
  currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
  initialBalance: bigint('initial_balance', { mode: 'number' }).default(0).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_accounts_user_active').on(table.userId, table.isArchived)
]);

// 3. Categories Table
export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }), // NULL for system categories
  name: varchar('name', { length: 50 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'income' | 'expense'
  icon: varchar('icon', { length: 50 }),
  isSystem: boolean('is_system').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_categories_user').on(table.userId, table.isArchived)
]);

// 4. Transactions Table
export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  accountId: uuid('account_id').references(() => accounts.id).notNull(),
  destinationAccountId: uuid('destination_account_id').references(() => accounts.id),
  categoryId: uuid('category_id').references(() => categories.id),
  type: varchar('type', { length: 20 }).notNull(), // 'income' | 'expense' | 'transfer'
  amount: bigint('amount', { mode: 'number' }).notNull(),
  transferFee: bigint('transfer_fee', { mode: 'number' }).default(0).notNull(),
  currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
  note: text('note'),
  transactionDate: timestamp('transaction_date', { withTimezone: true }).notNull(),
  clientId: uuid('client_id').notNull().unique(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_tx_active_user_date').on(table.userId, table.transactionDate.desc()).where(sql`deleted_at IS NULL`),
  index('idx_tx_active_account').on(table.userId, table.accountId, table.transactionDate.desc()).where(sql`deleted_at IS NULL`),
  index('idx_tx_active_dest_account').on(table.userId, table.destinationAccountId, table.transactionDate.desc()).where(sql`deleted_at IS NULL AND destination_account_id IS NOT NULL`),
  index('idx_tx_active_category').on(table.userId, table.categoryId, table.transactionDate.desc()).where(sql`deleted_at IS NULL`),
  index('idx_tx_client_id').on(table.userId, table.clientId),
  index('idx_tx_updated_at').on(table.userId, table.updatedAt),
  check('chk_tx_amount', sql`amount > 0`),
  check('chk_tx_fee', sql`transfer_fee >= 0`),
]);

// 5. Idempotency Keys Table
export const idempotencyKeys = pgTable('idempotency_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  key: varchar('key', { length: 128 }).notNull().unique(),
  requestHash: varchar('request_hash', { length: 64 }).notNull(),
  responseJson: jsonb('response_json').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => [
  index('idx_idempotency_lookup').on(table.userId, table.key),
  index('idx_idempotency_expiry').on(table.expiresAt)
]);

// 6. Sync Events Table (for incremental pull change feed)
export const syncEvents = pgTable('sync_events', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  entityType: varchar('entity_type', { length: 20 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  operation: varchar('operation', { length: 10 }).notNull(),
  version: integer('version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_sync_events_user_cursor').on(table.userId, table.id)
]);

export type Profile = typeof profiles.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
