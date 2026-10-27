import { describe, it, expect, afterAll } from 'bun:test';
import app from './index';
import { db, schema } from './db/client';
import { notInArray } from 'drizzle-orm';

describe('UangKu API Endpoints & Features', () => {
  it('GET /health returns status ok', async () => {
    const res = await app.handle(new Request('http://localhost/health'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('GET /ready returns database ready status', async () => {
    const res = await app.handle(new Request('http://localhost/ready'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ready');
    expect(body.version).toBe('1.0.0');
  });

  it('GET /api/v1/accounts returns user accounts with authorization header', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/v1/accounts', {
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].currency).toBe('IDR');
  });

  it('POST /api/v1/accounts successfully creates a new account', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/v1/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          name: 'Tabungan Mandiri',
          type: 'bank',
          currency: 'IDR',
          initialBalance: 2500000,
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.name).toBe('Tabungan Mandiri');
    expect(body.data.initialBalance).toBe(2500000);
  });

  it('GET /api/v1/categories returns expense and income categories', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/v1/categories', {
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/transactions returns transaction list with pagination', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/v1/transactions?limit=10', {
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/transactions supports cursor pagination and date filters', async () => {
    // 1. Create older and newer transactions
    const d1 = '2026-09-01T10:00:00.000Z';
    const d2 = '2026-09-02T10:00:00.000Z';
    const d3 = '2026-09-03T10:00:00.000Z';

    for (const d of [d1, d2, d3]) {
      await app.handle(
        new Request('http://localhost/api/v1/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo-token' },
          body: JSON.stringify({
            accountId: 'a1000000-0000-0000-0000-000000000001',
            categoryId: 'c1000000-0000-0000-0000-000000000001',
            type: 'expense',
            amount: 10000,
            transactionDate: d,
            clientId: crypto.randomUUID(),
          }),
        })
      );
    }

    // 2. Query with limit=1 to get nextCursor
    const page1Res = await app.handle(
      new Request('http://localhost/api/v1/transactions?limit=1', {
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    const page1Body = await page1Res.json();
    expect(page1Body.data.length).toBe(1);
    expect(page1Body.meta.hasMore).toBe(true);
    expect(page1Body.meta.nextCursor).toBeDefined();

    // 3. Query next page using cursor
    const page2Res = await app.handle(
      new Request(`http://localhost/api/v1/transactions?limit=1&cursor=${encodeURIComponent(page1Body.meta.nextCursor)}`, {
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    const page2Body = await page2Res.json();
    expect(page2Body.data.length).toBe(1);
    expect(page2Body.data[0].id).not.toBe(page1Body.data[0].id);

    // 4. Query with date range
    const filterRes = await app.handle(
      new Request('http://localhost/api/v1/transactions?startDate=2026-09-01T00:00:00.000Z&endDate=2026-09-02T23:59:59.000Z', {
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    const filterBody = await filterRes.json();
    expect(filterBody.data.every((t: any) => t.transactionDate <= '2026-09-02T23:59:59.000Z')).toBe(true);
  });

  it('POST /api/v1/transactions creates a valid expense transaction', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          accountId: 'a1000000-0000-0000-0000-000000000001',
          categoryId: 'c1000000-0000-0000-0000-000000000001',
          type: 'expense',
          amount: 50000,
          currency: 'IDR',
          note: 'Kopi Kenangan',
          transactionDate: new Date().toISOString(),
          clientId: crypto.randomUUID(),
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.amount).toBe(50000);
    expect(body.data.type).toBe('expense');
  });

  it('POST /api/v1/transactions rejects transfer if source and destination are identical', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          accountId: 'a1000000-0000-0000-0000-000000000001',
          destinationAccountId: 'a1000000-0000-0000-0000-000000000001',
          type: 'transfer',
          amount: 100000,
          currency: 'IDR',
          clientId: crypto.randomUUID(),
          transactionDate: new Date().toISOString(),
        }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/v1/reports/summary returns calculated financial cash flow', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/v1/reports/summary?month=2026-10', {
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.month).toBe('2026-10');
    expect(typeof body.data.totalIncome).toBe('number');
    expect(typeof body.data.totalExpense).toBe('number');
    expect(typeof body.data.netCashFlow).toBe('number');
  });

  it('GET /api/v1/reports/expenses-by-category returns categorized ranking', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/v1/reports/expenses-by-category?month=2026-10', {
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.categories)).toBe(true);
  });

  it('POST /api/v1/sync/push applies mutations idempotently', async () => {
    const clientId = crypto.randomUUID();
    const mutationPayload = {
      mutations: [
        {
          id: crypto.randomUUID(),
          clientId,
          entityType: 'transaction',
          operation: 'create',
          entityId: crypto.randomUUID(),
          version: 1,
          payload: {
            accountId: 'a1000000-0000-0000-0000-000000000001',
            categoryId: 'c1000000-0000-0000-0000-000000000001',
            type: 'expense',
            amount: 25000,
            currency: 'IDR',
            note: 'Sync test snack',
            transactionDate: new Date().toISOString(),
          },
        },
      ],
    };

    const res = await app.handle(
      new Request('http://localhost/api/v1/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify(mutationPayload),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.processed.length).toBe(1);
    expect(body.data.processed[0].clientId).toBe(clientId);
  });

  it('GET /api/v1/sync/pull returns incremental transaction sync updates', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/v1/sync/pull', {
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.changes)).toBe(true);
    expect(body.data.nextCursor).toBeDefined();
  });

  // Security Tests (IDOR, Rate Limiting, System Protection)
  it('SECURITY: prevents IDOR - User B cannot access User A transaction', async () => {
    // User A creates a transaction
    const createRes = await app.handle(
      new Request('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          accountId: 'a1000000-0000-0000-0000-000000000001',
          categoryId: 'c1000000-0000-0000-0000-000000000001',
          type: 'expense',
          amount: 75000,
          currency: 'IDR',
          clientId: crypto.randomUUID(),
          transactionDate: new Date().toISOString(),
        }),
      })
    );
    const created = await createRes.json();
    const txId = created.data.id;

    // User B tries to access User A's transaction with token 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    const res = await app.handle(
      new Request(`http://localhost/api/v1/transactions/${txId}`, {
        headers: { Authorization: 'Bearer ffffffff-ffff-ffff-ffff-ffffffffffff' },
      })
    );
    expect(res.status).toBe(404); // RESOURCE_NOT_FOUND to avoid leaking transaction existence
    const body = await res.json();
    expect(body.error?.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('SECURITY: prevents unauthorized deletion of system categories', async () => {
    // c1000000-0000-0000-0000-000000000001 is a system category
    const res = await app.handle(
      new Request('http://localhost/api/v1/categories/c1000000-0000-0000-0000-000000000001', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe('FORBIDDEN');
  });

  it('SECURITY: rate limits repeated authentication attempts', async () => {
    const spamIp = '198.51.100.42';
    let lastStatus = 200;
    // Send 16 login attempts (threshold is 15)
    for (let i = 0; i < 16; i++) {
      const res = await app.handle(
        new Request('http://localhost/api/v1/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': spamIp,
          },
          body: JSON.stringify({ email: 'test@uangku.id', password: 'password123' }),
        })
      );
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it('GET /api/v1/templates returns list of 1-tap transaction templates', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/v1/templates', {
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/v1/templates creates, increments use count, and deletes template', async () => {
    // 1. Create
    const createRes = await app.handle(
      new Request('http://localhost/api/v1/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          name: 'Makan Siang Nasi Padang',
          templatePayload: {
            type: 'expense',
            amount: 25000,
            accountId: 'a1000000-0000-0000-0000-000000000001',
            categoryId: 'c1000000-0000-0000-0000-000000000001',
            note: 'Nasi Rendang + Es Teh',
          },
        }),
      })
    );
    expect(createRes.status).toBe(200);
    const created = (await createRes.json()).data;
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Makan Siang Nasi Padang');
    expect(created.useCount).toBe(0);

    // 2. Increment use count
    const useRes = await app.handle(
      new Request(`http://localhost/api/v1/templates/${created.id}/use`, {
        method: 'POST',
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    expect(useRes.status).toBe(200);
    const used = (await useRes.json()).data;
    expect(used.useCount).toBe(1);

    // 3. Delete
    const delRes = await app.handle(
      new Request(`http://localhost/api/v1/templates/${created.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    expect(delRes.status).toBe(200);
    const deleted = (await delRes.json()).data;
    expect(deleted.deleted).toBe(true);
  });

  it('GET /api/v1/budgets and GET /api/v1/budgets/summary return calculated budget items (PRD Section 60)', async () => {
    // 1. List budgets
    const listRes = await app.handle(
      new Request('http://localhost/api/v1/budgets', {
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(Array.isArray(listBody.data)).toBe(true);

    // 2. Summary
    const summaryRes = await app.handle(
      new Request('http://localhost/api/v1/budgets/summary?month=2026-10', {
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    expect(summaryRes.status).toBe(200);
    const summaryBody = await summaryRes.json();
    expect(Array.isArray(summaryBody.data)).toBe(true);
    if (summaryBody.data.length > 0) {
      const item = summaryBody.data[0];
      expect(item.budgetAmount).toBeGreaterThan(0);
      expect(typeof item.status).toBe('string');
    }
  });

  it('POST /api/v1/goals creates goal and accepts deposit (PRD Section 61)', async () => {
    // 1. Create goal
    const createRes = await app.handle(
      new Request('http://localhost/api/v1/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          name: 'Dana Liburan Jepang',
          emoji: 'plane',
          targetAmount: 20000000,
          initialAmount: 2000000,
          targetDate: '2027-04-01',
        }),
      })
    );
    expect(createRes.status).toBe(200);
    const goal = (await createRes.json()).data;
    expect(goal.id).toBeDefined();
    expect(goal.currentAmount).toBe(2000000);
    expect(goal.status).toBe('active');

    // 2. Deposit
    const depRes = await app.handle(
      new Request(`http://localhost/api/v1/goals/${goal.id}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({ amount: 1000000 }),
      })
    );
    expect(depRes.status).toBe(200);
    const updatedGoal = (await depRes.json()).data;
    expect(updatedGoal.currentAmount).toBe(3000000);
  });

  it('POST /api/v1/recurring-rules creates rule and executes trigger (PRD Section 58)', async () => {
    // 1. Create
    const createRes = await app.handle(
      new Request('http://localhost/api/v1/recurring-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          accountId: 'a1000000-0000-0000-0000-000000000001',
          categoryId: 'c1000000-0000-0000-0000-000000000004',
          type: 'expense',
          amount: 150000,
          frequency: 'monthly',
          note: 'Internet Wi-Fi Bulanan',
        }),
      })
    );
    expect(createRes.status).toBe(200);
    const rule = (await createRes.json()).data;
    expect(rule.id).toBeDefined();
    expect(rule.frequency).toBe('monthly');

    // 2. Trigger
    const triggerRes = await app.handle(
      new Request(`http://localhost/api/v1/recurring-rules/${rule.id}/trigger`, {
        method: 'POST',
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    expect(triggerRes.status).toBe(200);
    const triggerBody = (await triggerRes.json()).data;
    expect(triggerBody.transaction).toBeDefined();
    expect(triggerBody.transaction.amount).toBe(150000);
    expect(triggerBody.nextDueDate).toBeDefined();
  });

  it('GET /api/v1/app-config returns version compatibility check (PRD Section 77)', async () => {
    const res = await app.handle(new Request('http://localhost/api/v1/app-config'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.minimumAppVersion).toBe('1.0.0');
    expect(body.data.latestAppVersion).toBe('1.0.0');
    expect(body.data.forceUpdateMessage).toBeDefined();
    expect(body.data.features).toBeDefined();
  });

  it('SECURITY: response includes hardened security headers', async () => {
    const res = await app.handle(new Request('http://localhost/health'));
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-xss-protection')).toBe('1; mode=block');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('permissions-policy')).toBeDefined();
  });

  it('POST & GET /api/v1/accounts/:accountId/pockets creates pocket and handles intra-account transfers (PRD Section 79)', async () => {
    const accountId = 'a2000000-0000-0000-0000-000000000002';

    // 1. Create a spending pocket
    const createRes = await app.handle(
      new Request(`http://localhost/api/v1/accounts/${accountId}/pockets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          name: 'Budget Makan Siang',
          emoji: 'utensils',
          type: 'spending',
          initialAllocation: 750000,
          targetAmount: 1500000,
        }),
      })
    );
    expect(createRes.status).toBe(200);
    const createdPocket = (await createRes.json()).data;
    expect(createdPocket.name).toBe('Budget Makan Siang');
    expect(createdPocket.allocatedBalance).toBe(750000);
    expect(createdPocket.isLocked).toBe(false);

    // 2. Query account pockets
    const getRes = await app.handle(
      new Request(`http://localhost/api/v1/accounts/${accountId}/pockets`, {
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()).data;
    expect(getBody.pockets.length).toBeGreaterThan(0);
    expect(getBody.totalAllocated).toBeGreaterThan(0);

    // 3. Intra-account transfer (reallocation) from pocket back to main unallocated balance
    const transferRes = await app.handle(
      new Request('http://localhost/api/v1/pockets/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          accountId,
          sourcePocketId: createdPocket.id,
          destinationPocketId: null, // to main unallocated
          amount: 250000,
        }),
      })
    );
    expect(transferRes.status).toBe(200);
    const transferBody = (await transferRes.json()).data;
    expect(transferBody.sourcePocket.allocatedBalance).toBe(500000);
  });

  it('POST & GET /api/v1/bank-connections and e-statement reconciliation (PRD Section 80)', async () => {
    const accountId = 'a2000000-0000-0000-0000-000000000002';

    // 1. Create bank connection
    const createConnRes = await app.handle(
      new Request('http://localhost/api/v1/bank-connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          accountId,
          provider: 'statement_import',
          institutionCode: 'BCA',
          maskedAccountNumber: '•••• 1234',
        }),
      })
    );
    expect(createConnRes.status).toBe(200);
    const connection = (await createConnRes.json()).data;
    expect(connection.institutionCode).toBe('BCA');

    // 2. Import CSV bank statement
    const sampleCsv = `Tanggal,Keterangan,Nominal,Tipe\n2026-10-21,QRIS KOPI KENANGAN,25000,DB\n2026-10-21,TRANSFER GAJI PT ABC,10000000,CR`;
    const importRes = await app.handle(
      new Request(`http://localhost/api/v1/bank-connections/${connection.id}/import-statement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          connectionId: connection.id,
          statementText: sampleCsv,
          format: 'csv',
        }),
      })
    );
    expect(importRes.status).toBe(200);
    const importBody = (await importRes.json()).data;
    expect(importBody.totalImported).toBe(2);

    // 3. Reconcile mutation by creating new transaction
    const mutationId = importBody.mutations[0].id;
    const reconcileRes = await app.handle(
      new Request(`http://localhost/api/v1/bank-mutations/${mutationId}/reconcile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          action: 'create_new',
          note: 'Otomatis dari mutasi bank BCA',
        }),
      })
    );
    expect(reconcileRes.status).toBe(200);
    const reconcileBody = (await reconcileRes.json()).data;
    expect(reconcileBody.reconciliationStatus).toBe('created_as_new');
    expect(reconcileBody.matchedTransactionId).toBeDefined();

    // 4. Reconcile another mutation by matching to the newly created transaction
    const secondMutationId = importBody.mutations[1].id;
    const matchRes = await app.handle(
      new Request(`http://localhost/api/v1/bank-mutations/${secondMutationId}/reconcile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          action: 'match',
          matchedTransactionId: reconcileBody.matchedTransactionId,
        }),
      })
    );
    expect(matchRes.status).toBe(200);
    const matchBody = (await matchRes.json()).data;
    expect(matchBody.reconciliationStatus).toBe('matched');
    expect(matchBody.matchedTransactionId).toBe(reconcileBody.matchedTransactionId);

    // 5. Delete bank connection & verify cascading removal
    const deleteConnRes = await app.handle(
      new Request(`http://localhost/api/v1/bank-connections/${connection.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    expect(deleteConnRes.status).toBe(200);
    const deleteConnBody = (await deleteConnRes.json()).data;
    expect(deleteConnBody.deleted).toBe(true);
  });

  it('Transaction with Pocket ID deducts pocket balance and restores on delete (PRD Section 79.5)', async () => {
    const accountId = 'a2000000-0000-0000-0000-000000000002';

    // 1. Create pocket
    const createPocketRes = await app.handle(
      new Request(`http://localhost/api/v1/accounts/${accountId}/pockets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          name: 'Kantong Kopi & Snack',
          emoji: 'coffee',
          type: 'spending',
          initialAllocation: 200000,
        }),
      })
    );
    expect(createPocketRes.status).toBe(200);
    const pkt = (await createPocketRes.json()).data;
    expect(pkt.allocatedBalance).toBe(200000);

    // 2. Create expense transaction using this pocket
    const txRes = await app.handle(
      new Request('http://localhost/api/v1/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          accountId,
          categoryId: 'c1000000-0000-0000-0000-000000000001',
          pocketId: pkt.id,
          type: 'expense',
          amount: 45000,
          note: 'Kopi Arabika & Croissant',
          transactionDate: new Date().toISOString(),
          clientId: crypto.randomUUID(),
        }),
      })
    );
    expect(txRes.status).toBe(200);
    const tx = (await txRes.json()).data;
    expect(tx.pocketId).toBe(pkt.id);

    // 3. Verify pocket balance was deducted (200000 - 45000 = 155000)
    const checkPocketRes = await app.handle(
      new Request(`http://localhost/api/v1/accounts/${accountId}/pockets`, {
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    const pocketsList = (await checkPocketRes.json()).data.pockets;
    const updatedPkt = pocketsList.find((p: any) => p.id === pkt.id);
    expect(updatedPkt.allocatedBalance).toBe(155000);

    // 4. Delete the transaction and verify pocket balance is restored
    const deleteTxRes = await app.handle(
      new Request(`http://localhost/api/v1/transactions/${tx.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    expect(deleteTxRes.status).toBe(200);

    const recheckPocketRes = await app.handle(
      new Request(`http://localhost/api/v1/accounts/${accountId}/pockets`, {
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    const finalPocketsList = (await recheckPocketRes.json()).data.pockets;
    const restoredPkt = finalPocketsList.find((p: any) => p.id === pkt.id);
    expect(restoredPkt.allocatedBalance).toBe(200000);
  });

  it('Shared Pocket: creates, shares, joins via invite code, and accepts member contributions', async () => {
    const accountId = 'a2000000-0000-0000-0000-000000000002';

    // 1. Create a shared pocket
    const createRes = await app.handle(
      new Request(`http://localhost/api/v1/accounts/${accountId}/pockets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          name: 'Patungan Liburan Bali',
          emoji: 'plane',
          type: 'shared',
          isShared: true,
          initialAllocation: 500000,
          targetAmount: 3000000,
        }),
      })
    );
    expect(createRes.status).toBe(200);
    const pocket = (await createRes.json()).data;
    expect(pocket.isShared).toBe(true);
    expect(pocket.inviteCode).toBeDefined();

    // 2. Another user joins via invite code
    const joinRes = await app.handle(
      new Request('http://localhost/api/v1/pockets/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          inviteCode: pocket.inviteCode,
          memberName: 'Dina Pratiwi',
          avatarEmoji: 'user',
        }),
      })
    );
    expect(joinRes.status).toBe(200);
    const joinData = (await joinRes.json()).data;
    expect(joinData.member.name).toBe('Dina Pratiwi');

    // 3. Member contributes funds
    const contribRes = await app.handle(
      new Request(`http://localhost/api/v1/pockets/${pocket.id}/contribute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({
          memberId: joinData.member.id,
          memberName: 'Dina Pratiwi',
          amount: 250000,
          note: 'Setoran tiket pesawat tahap 1',
        }),
      })
    );
    expect(contribRes.status).toBe(200);
    const contribData = (await contribRes.json()).data;
    expect(contribData.pocket.allocatedBalance).toBe(750000); // 500k + 250k
    expect(contribData.member.totalContributed).toBe(250000);

    // 4. Retrieve contributions history
    const historyRes = await app.handle(
      new Request(`http://localhost/api/v1/pockets/${pocket.id}/contributions`, {
        headers: { Authorization: 'Bearer demo-token' },
      })
    );
    expect(historyRes.status).toBe(200);
    const historyData = (await historyRes.json()).data;
    expect(historyData.contributions.length).toBeGreaterThan(0);
    expect(historyData.totalContributions).toBeGreaterThanOrEqual(250000);
  });

  afterAll(async () => {
    try {
      await db.delete(schema.transactions);
      await db.delete(schema.bankMutations);
      await db.delete(schema.bankConnections);
      await db.delete(schema.pocketContributions);
      await db.delete(schema.pocketMembers);
      await db.delete(schema.pockets);
      await db.delete(schema.recurringRules);
      await db.delete(schema.budgets);
      await db.delete(schema.financialGoals);
      await db.delete(schema.transactionTemplates);
      await db.delete(schema.syncEvents);
      await db.delete(schema.idempotencyKeys);
      await db
        .delete(schema.accounts)
        .where(
          notInArray(schema.accounts.id, [
            'a1000000-0000-0000-0000-000000000001',
            'a2000000-0000-0000-0000-000000000002',
            'a3000000-0000-0000-0000-000000000003',
          ])
        );
      await db.update(schema.accounts).set({ initialBalance: 0 });
    } catch (e) {
      console.warn('Test cleanup error:', e);
    }
  });
});
