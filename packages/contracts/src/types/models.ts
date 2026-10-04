export type TransactionType = 'income' | 'expense' | 'transfer';
export type AccountType = 'cash' | 'bank' | 'e_wallet' | 'other';
export type SyncStatus = 'synced' | 'pending_sync' | 'failed';
export type OutboxOperation = 'create' | 'update' | 'delete';
export type EntityType = 'transaction' | 'account' | 'category';

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
  isDefault: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
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
  // Joined relation fields for UI convenience
  account?: Pick<AccountModel, 'id' | 'name' | 'type'>;
  destinationAccount?: Pick<AccountModel, 'id' | 'name' | 'type'> | null;
  category?: Pick<CategoryModel, 'id' | 'name' | 'icon'> | null;
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
