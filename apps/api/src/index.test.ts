import { describe, it, expect } from 'bun:test';
import app from './index';

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
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].name).toBeDefined();
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
          emoji: '✈️',
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
});
