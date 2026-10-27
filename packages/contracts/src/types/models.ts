export type TransactionType = 'income' | 'expense' | 'transfer';
export type AccountType = 'cash' | 'bank' | 'e_wallet' | 'other';
export type SyncStatus = 'synced' | 'pending_sync' | 'failed';
export type OutboxOperation = 'create' | 'update' | 'delete';
export type EntityType = 'transaction' | 'account' | 'category' | 'pocket' | 'bank_connection' | 'bank_mutation';
export type PocketType = 'spending' | 'saving' | 'locked' | 'bills' | 'shared';
export type PocketMemberRole = 'owner' | 'contributor' | 'viewer';

export interface ProfileModel {
  id: string;
  displayName: string | null;
  defaultCurrency: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountModel {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  currency: string;
  initialBalance: number;
  currentBalance?: number;
  reservedAmount?: number;
  allocatedAmount?: number;
  color?: string | null;
  isHidden?: boolean;
  sortOrder?: number;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionHistoryModel {
  id: string;
  transactionId: string;
  changedBy: 'user' | 'system';
  snapshotBefore: Record<string, unknown>;
  snapshotAfter: Record<string, unknown>;
  summary: string;
  changedAt: string;
}

export interface PocketMemberModel {
  id: string;
  pocketId: string;
  userId?: string | null;
  name: string;
  avatarEmoji?: string;
  role: PocketMemberRole;
  totalContributed: number;
  joinedAt: string;
}

export interface PocketContributionModel {
  id: string;
  pocketId: string;
  memberId: string;
  memberName: string;
  memberAvatar?: string;
  amount: number;
  note?: string | null;
  createdAt: string;
}

export interface PocketModel {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  emoji?: string | null;
  type: PocketType;
  allocatedBalance: number;
  targetAmount?: number | null;
  isLocked: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  accountName?: string;
  isShared?: boolean;
  inviteCode?: string | null;
  membersCount?: number;
  members?: PocketMemberModel[];
  contributions?: PocketContributionModel[];
}

export interface BankConnectionModel {
  id: string;
  userId: string;
  accountId: string;
  provider: 'statement_import' | 'brick' | 'ayoconnect' | 'shortcuts';
  institutionCode: string; // 'BCA' | 'MANDIRI' | 'BRI' | 'BNI' | 'GOPAY' | 'OVO'
  maskedAccountNumber?: string | null;
  status: 'active' | 'requires_reauth' | 'disconnected';
  lastSyncedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  accountName?: string;
}

export interface BankMutationModel {
  id: string;
  connectionId: string;
  externalId: string;
  amount: number;
  type: 'debit' | 'credit';
  description: string;
  transactionTime: string;
  reconciliationStatus: 'pending' | 'matched' | 'created_as_new' | 'ignored';
  matchedTransactionId?: string | null;
  createdAt: string;
}

export interface CategoryModel {
  id: string;
  userId: string | null;
  name: string;
  type: 'income' | 'expense';
  icon: string | null;
  isSystem: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionModel {
  id: string;
  userId: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  pocketId?: string | null;
  type: TransactionType;
  amount: number;
  transferFee: number;
  currency: string;
  note: string | null;
  transactionDate: string;
  clientId: string;
  version: number;
  syncStatus?: SyncStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  receiptUrl?: string | null;
  // Joined relation fields for UI convenience
  account?: Pick<AccountModel, 'id' | 'name' | 'type'>;
  destinationAccount?: Pick<AccountModel, 'id' | 'name' | 'type'> | null;
  category?: Pick<CategoryModel, 'id' | 'name' | 'icon'> | null;
  pocket?: Pick<PocketModel, 'id' | 'name' | 'emoji' | 'type'> | null;
  isBankVerified?: boolean;
}

export interface OutboxMutationModel {
  id: string;
  clientId: string;
  entityType: EntityType;
  operation: OutboxOperation;
  entityId: string;
  payload: Record<string, unknown>;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalModel {
  id: string;
  userId: string;
  name: string;
  emoji?: string | null;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string | null;
  status: 'active' | 'achieved' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface RecurringRuleModel {
  id: string;
  userId: string;
  accountId: string;
  categoryId?: string | null;
  type: TransactionType;
  amount: number;
  frequency: RecurringFrequency;
  note?: string | null;
  nextDueDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  accountName?: string;
  categoryName?: string;
}

export interface TemplatePayload {
  amount: number;
  categoryId?: string | null;
  accountId: string;
  destinationAccountId?: string | null;
  type: TransactionType;
  note?: string | null;
  currency: string;
}

export interface TemplateModel {
  id: string;
  userId: string;
  name: string;
  templatePayload: TemplatePayload;
  sortOrder: number;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}
