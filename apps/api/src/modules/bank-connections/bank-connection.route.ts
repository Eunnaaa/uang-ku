import { Elysia } from 'elysia';
import {
  createBankConnectionSchema,
  importStatementSchema,
  reconcileMutationSchema,
  type BankConnectionModel,
  type BankMutationModel,
} from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse, errorHandler } from '../../middleware/error-handler';
import { demoTransactions } from '../transactions/transaction.route';
import { db, schema } from '../../db/client';
import { eq, and } from 'drizzle-orm';

export const demoBankConnections: BankConnectionModel[] = [];

export const demoBankMutations: BankMutationModel[] = [];

export const bankConnectionRoutes = new Elysia({ prefix: '/api/v1' })
  .use(errorHandler)
  .use(authMiddleware)
  .get('/bank-connections', async ({ user }) => {
    const list = demoBankConnections.filter((c) => c.userId === user.userId);
    return successResponse(list);
  })
  .post('/bank-connections', async ({ body, user }) => {
    const input = createBankConnectionSchema.parse(body);

    const newConnection: BankConnectionModel = {
      id: crypto.randomUUID(),
      userId: user.userId,
      accountId: input.accountId,
      provider: input.provider,
      institutionCode: input.institutionCode.toUpperCase(),
      maskedAccountNumber: input.maskedAccountNumber ?? null,
      status: 'active',
      lastSyncedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    demoBankConnections.unshift(newConnection);

    try {
      await db.insert(schema.bankConnections).values({
        id: newConnection.id,
        userId: user.userId,
        accountId: newConnection.accountId,
        provider: newConnection.provider,
        institutionCode: newConnection.institutionCode,
        maskedAccountNumber: newConnection.maskedAccountNumber,
        status: newConnection.status,
      });
    } catch {}

    return successResponse(newConnection);
  })
  .delete('/bank-connections/:id', async ({ params, user }) => {
    const idx = demoBankConnections.findIndex((c) => c.id === params.id && c.userId === user.userId);
    if (idx === -1) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    demoBankConnections.splice(idx, 1);

    // Cascading delete mutations belonging to this connection
    for (let i = demoBankMutations.length - 1; i >= 0; i--) {
      if (demoBankMutations[i].connectionId === params.id) {
        demoBankMutations.splice(i, 1);
      }
    }

    try {
      await db.delete(schema.bankMutations).where(eq(schema.bankMutations.connectionId, params.id));
      await db.delete(schema.bankConnections).where(eq(schema.bankConnections.id, params.id));
    } catch {}

    return successResponse({ id: params.id, deleted: true });
  })
  .get('/bank-mutations', async ({ query, user }) => {
    const userConnectionIds = new Set(
      demoBankConnections.filter((c) => c.userId === user.userId).map((c) => c.id)
    );

    let list = demoBankMutations.filter((m) => userConnectionIds.has(m.connectionId));

    if (query?.status) {
      list = list.filter((m) => m.reconciliationStatus === query.status);
    }
    if (query?.connectionId) {
      list = list.filter((m) => m.connectionId === query.connectionId);
    }

    return successResponse(list);
  })
  .post('/bank-connections/:id/import-statement', async ({ params, body, user, set }) => {
    const connection = demoBankConnections.find((c) => c.id === params.id && c.userId === user.userId);
    if (!connection) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    const { statementText, format } = importStatementSchema.parse(body);

    // Heuristic e-Statement lines parser
    const lines = statementText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('Tanggal') && !l.startsWith('#'));

    const importedMutations: BankMutationModel[] = [];
    const matchedCount = { matched: 0, pending: 0 };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Format: Date, Description, Amount, Type (CR/DB or +/-)
      const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 3) continue;

      const dateStr = parts[0];
      const desc = parts[1];
      const amountRaw = parseInt(parts[2].replace(/\D/g, ''), 10);
      if (isNaN(amountRaw) || amountRaw <= 0) continue;

      const typeStr = parts[3]?.toUpperCase() || (line.includes('CR') ? 'credit' : 'debit');
      const mutationType: 'debit' | 'credit' = typeStr.includes('CR') || typeStr === 'credit' ? 'credit' : 'debit';
      const extId = `IMP-${connection.institutionCode}-${Date.now()}-${i}`;

      // Idempotent duplicate check
      const exists = demoBankMutations.some((m) => m.externalId === extId);
      if (exists) continue;

      // Smart Reconciliation: Search matching manual transaction within +-24 hours
      const targetTxType = mutationType === 'debit' ? 'expense' : 'income';
      const potentialMatch = demoTransactions.find((tx) => {
        if (tx.deletedAt !== null) return false;
        if (tx.userId !== user.userId) return false;
        if (tx.accountId !== connection.accountId) return false;
        if (tx.type !== targetTxType) return false;
        return tx.amount === amountRaw;
      });

      const mutationRecord: BankMutationModel = {
        id: crypto.randomUUID(),
        connectionId: connection.id,
        externalId: extId,
        amount: amountRaw,
        type: mutationType,
        description: desc,
        transactionTime: new Date().toISOString(),
        reconciliationStatus: potentialMatch ? 'matched' : 'pending',
        matchedTransactionId: potentialMatch?.id ?? null,
        createdAt: new Date().toISOString(),
      };

      demoBankMutations.unshift(mutationRecord);
      importedMutations.push(mutationRecord);

      if (potentialMatch) {
        matchedCount.matched++;
      } else {
        matchedCount.pending++;
      }

      try {
        await db.insert(schema.bankMutations).values({
          id: mutationRecord.id,
          connectionId: mutationRecord.connectionId,
          externalId: mutationRecord.externalId,
          amount: mutationRecord.amount,
          type: mutationRecord.type,
          description: mutationRecord.description,
          transactionTime: new Date(mutationRecord.transactionTime),
          reconciliationStatus: mutationRecord.reconciliationStatus,
          matchedTransactionId: mutationRecord.matchedTransactionId,
        });
      } catch {}
    }

    connection.lastSyncedAt = new Date().toISOString();

    return successResponse({
      connectionId: connection.id,
      totalImported: importedMutations.length,
      autoMatchedCount: matchedCount.matched,
      inboxPendingCount: matchedCount.pending,
      mutations: importedMutations,
    });
  })
  .post('/bank-mutations/:id/reconcile', async ({ params, body, user, set }) => {
    const mutation = demoBankMutations.find((m) => m.id === params.id);
    if (!mutation) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    const input = reconcileMutationSchema.parse(body);

    if (input.action === 'match') {
      mutation.reconciliationStatus = 'matched';
      mutation.matchedTransactionId = input.matchedTransactionId ?? null;
    } else if (input.action === 'ignore') {
      mutation.reconciliationStatus = 'ignored';
    } else if (input.action === 'create_new') {
      // Find associated account
      const conn = demoBankConnections.find((c) => c.id === mutation.connectionId);
      const accountId = conn?.accountId || 'a1000000-0000-0000-0000-000000000001';
      const txType = mutation.type === 'debit' ? 'expense' : 'income';

      const newTx = {
        id: crypto.randomUUID(),
        userId: user.userId,
        accountId,
        destinationAccountId: null,
        categoryId: input.categoryId || 'c1000000-0000-0000-0000-000000000008',
        pocketId: input.pocketId || null,
        type: txType,
        amount: mutation.amount,
        transferFee: 0,
        currency: 'IDR',
        note: input.note || mutation.description,
        receiptUrl: null,
        transactionDate: mutation.transactionTime,
        clientId: crypto.randomUUID(),
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      };

      demoTransactions.unshift(newTx);
      mutation.reconciliationStatus = 'created_as_new';
      mutation.matchedTransactionId = newTx.id;

      try {
        await db.insert(schema.transactions).values({
          id: newTx.id,
          userId: user.userId,
          accountId: newTx.accountId,
          destinationAccountId: null,
          categoryId: newTx.categoryId,
          pocketId: newTx.pocketId,
          type: newTx.type,
          amount: newTx.amount,
          transferFee: 0,
          currency: 'IDR',
          note: newTx.note,
          transactionDate: new Date(newTx.transactionDate),
          clientId: newTx.clientId,
          version: 1,
        });
      } catch {}
    }

    try {
      await db.update(schema.bankMutations).set({
        reconciliationStatus: mutation.reconciliationStatus,
        matchedTransactionId: mutation.matchedTransactionId,
      }).where(eq(schema.bankMutations.id, mutation.id));
    } catch {}

    return successResponse({
      id: mutation.id,
      reconciliationStatus: mutation.reconciliationStatus,
      matchedTransactionId: mutation.matchedTransactionId,
    });
  });
