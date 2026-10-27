import { pgTable, uuid, varchar, bigint, boolean, timestamp, integer, jsonb, text, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 1. Profiles Table
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  displayName: varchar('display_name', { length: 100 }),
  email: varchar('email', { length: 255 }),
  passwordHash: text('password_hash'),
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

// 3.1 Pockets Table (PRD Section 79 & Shared Pockets)
export const pockets = pgTable('pockets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  emoji: varchar('emoji', { length: 20 }).default('wallet'),
  type: varchar('type', { length: 20 }).notNull(), // 'spending' | 'saving' | 'locked' | 'bills' | 'shared'
  allocatedBalance: bigint('allocated_balance', { mode: 'number' }).default(0).notNull(),
  targetAmount: bigint('target_amount', { mode: 'number' }),
  isLocked: boolean('is_locked').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isShared: boolean('is_shared').default(false).notNull(),
  inviteCode: varchar('invite_code', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_pockets_user_account').on(table.userId, table.accountId),
  index('idx_pockets_invite_code').on(table.inviteCode),
  check('chk_pocket_allocated', sql`allocated_balance >= 0`),
]);

export const pocketMembers = pgTable('pocket_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  pocketId: uuid('pocket_id').references(() => pockets.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  avatarEmoji: varchar('avatar_emoji', { length: 20 }).default('user'),
  role: varchar('role', { length: 20 }).default('contributor').notNull(), // 'owner' | 'contributor' | 'viewer'
  totalContributed: bigint('total_contributed', { mode: 'number' }).default(0).notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_pocket_members_pocket').on(table.pocketId),
]);

export const pocketContributions = pgTable('pocket_contributions', {
  id: uuid('id').defaultRandom().primaryKey(),
  pocketId: uuid('pocket_id').references(() => pockets.id, { onDelete: 'cascade' }).notNull(),
  memberId: uuid('member_id').references(() => pocketMembers.id, { onDelete: 'cascade' }),
  memberName: varchar('member_name', { length: 50 }).notNull(),
  memberAvatar: varchar('member_avatar', { length: 20 }).default('user'),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  note: varchar('note', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_pocket_contrib_pocket').on(table.pocketId),
]);

// 4. Transactions Table
export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  accountId: uuid('account_id').references(() => accounts.id).notNull(),
  destinationAccountId: uuid('destination_account_id').references(() => accounts.id),
  categoryId: uuid('category_id').references(() => categories.id),
  pocketId: uuid('pocket_id').references(() => pockets.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 20 }).notNull(), // 'income' | 'expense' | 'transfer'
  amount: bigint('amount', { mode: 'number' }).notNull(),
  transferFee: bigint('transfer_fee', { mode: 'number' }).default(0).notNull(),
  currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
  note: text('note'),
  receiptUrl: text('receipt_url'),
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

// 7. Budgets Table (PRD Section 60.3)
export const budgets = pgTable('budgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  categoryId: uuid('category_id').references(() => categories.id).notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
  period: varchar('period', { length: 10 }).default('monthly').notNull(), // 'monthly' | 'weekly'
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_budgets_user_active').on(table.userId, table.categoryId, table.isActive),
  check('chk_budget_amount', sql`amount > 0`),
]);

// 8. Financial Goals Table (PRD Section 61.3)
export const financialGoals = pgTable('financial_goals', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  emoji: varchar('emoji', { length: 20 }).default('target'),
  targetAmount: bigint('target_amount', { mode: 'number' }).notNull(),
  currentAmount: bigint('current_amount', { mode: 'number' }).default(0).notNull(),
  currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
  targetDate: varchar('target_date', { length: 20 }),
  status: varchar('status', { length: 20 }).default('active').notNull(), // 'active' | 'achieved' | 'archived'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_goals_user_status').on(table.userId, table.status),
  check('chk_goal_target', sql`target_amount > 0`),
]);

// 9. Recurring Rules Table (PRD Section 58.3)
export const recurringRules = pgTable('recurring_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  accountId: uuid('account_id').references(() => accounts.id).notNull(),
  categoryId: uuid('category_id').references(() => categories.id),
  type: varchar('type', { length: 20 }).notNull(), // 'income' | 'expense'
  amount: bigint('amount', { mode: 'number' }).notNull(),
  frequency: varchar('frequency', { length: 20 }).notNull(), // 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  note: text('note'),
  nextDueDate: varchar('next_due_date', { length: 20 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_recurring_user_due').on(table.userId, table.isActive, table.nextDueDate),
  check('chk_recurring_amount', sql`amount > 0`),
]);

// 10. Transaction Templates Table (PRD Section 59.3)
export const transactionTemplates = pgTable('transaction_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  templatePayload: jsonb('template_payload').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  useCount: integer('use_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_templates_user_use').on(table.userId, table.useCount),
]);

// 11. Bank Connections Table (PRD Section 80.3)
export const bankConnections = pgTable('bank_connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(), // 'statement_import' | 'brick' | 'ayoconnect' | 'shortcuts'
  institutionCode: varchar('institution_code', { length: 20 }).notNull(), // 'BCA' | 'MANDIRI' | 'BRI' | 'BNI' | 'GOPAY' | 'OVO'
  maskedAccountNumber: varchar('masked_account_number', { length: 30 }),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_bank_conn_user').on(table.userId, table.accountId),
]);

// 12. Bank Mutations Table (PRD Section 80.3)
export const bankMutations = pgTable('bank_mutations', {
  id: uuid('id').defaultRandom().primaryKey(),
  connectionId: uuid('connection_id').references(() => bankConnections.id, { onDelete: 'cascade' }).notNull(),
  externalId: varchar('external_id', { length: 100 }).notNull().unique(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  type: varchar('type', { length: 10 }).notNull(), // 'debit' | 'credit'
  description: text('description').notNull(),
  transactionTime: timestamp('transaction_time', { withTimezone: true }).notNull(),
  reconciliationStatus: varchar('reconciliation_status', { length: 20 }).default('pending').notNull(),
  matchedTransactionId: uuid('matched_transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_bank_mut_conn_status').on(table.connectionId, table.reconciliationStatus),
  check('chk_bank_mut_amount', sql`amount > 0`),
]);

export type Profile = typeof profiles.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Pocket = typeof pockets.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type FinancialGoal = typeof financialGoals.$inferSelect;
export type RecurringRule = typeof recurringRules.$inferSelect;
export type TransactionTemplate = typeof transactionTemplates.$inferSelect;
export type BankConnection = typeof bankConnections.$inferSelect;
export type BankMutation = typeof bankMutations.$inferSelect;
