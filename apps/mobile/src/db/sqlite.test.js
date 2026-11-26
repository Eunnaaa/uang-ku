import { Database } from 'bun:sqlite';
import { beforeEach, expect, it, mock } from 'bun:test';
import { generateTransactionsCsv } from '@uangku/contracts';

let memory;
beforeEach(() => { memory = new Database(':memory:'); });
const adapter = {
  execAsync: async sql => memory.exec(sql),
  runAsync: async (sql, args = []) => memory.query(sql).run(...args),
  getFirstAsync: async (sql, args = []) => memory.query(sql).get(...args),
  getAllAsync: async (sql, args = []) => memory.query(sql).all(...args),
  withTransactionAsync: async fn => {
    memory.exec('BEGIN');
    try { await fn(); memory.exec('COMMIT'); }
    catch (e) { memory.exec('ROLLBACK'); throw e; }
  },
};
mock.module('expo-sqlite', () => ({ openDatabaseAsync: async () => adapter }));
const store = await import('./sqlite');

it('opens a pre-marker database without losing queued changes or balances', async () => {
  memory.exec(`CREATE TABLE mutation_outbox (
    id TEXT PRIMARY KEY, client_id TEXT NOT NULL UNIQUE, entity_type TEXT NOT NULL,
    operation TEXT NOT NULL, entity_id TEXT NOT NULL, payload TEXT NOT NULL,
    retry_count INTEGER DEFAULT 0, status TEXT DEFAULT 'pending', last_error TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    INSERT INTO mutation_outbox VALUES ('m','c','transaction','create','t','{}',0,'pending',NULL,'2026','2026');
    CREATE TABLE local_accounts (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT, type TEXT, currency TEXT,
    initial_balance INTEGER, is_default INTEGER, is_archived INTEGER, created_at TEXT, updated_at TEXT);
    INSERT INTO local_accounts VALUES ('wallet','owner','Tunai','cash','IDR',85000,1,0,'2026','2026');
    CREATE TABLE local_transactions (
      id TEXT PRIMARY KEY, user_id TEXT, account_id TEXT, destination_account_id TEXT, category_id TEXT,
      type TEXT, amount INTEGER, transfer_fee INTEGER, currency TEXT, note TEXT, transaction_date TEXT,
      client_id TEXT UNIQUE, version INTEGER, sync_status TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);
    INSERT INTO local_transactions VALUES ('t','owner','wallet',NULL,NULL,'expense',3000,0,'IDR','lama',
      '2026-09-01','c',1,'pending_sync','2026','2026',NULL);`);
  await store.getDb();
  await store.initLocalDatabase(adapter);
  store.setActiveUserId('owner');
  expect((await store.getLocalTransactionById('t')).note).toBe('lama');
  expect(memory.query('SELECT id FROM mutation_outbox').all()).toEqual([{ id: 'm' }]);
  expect(memory.query('SELECT initial_balance FROM local_accounts WHERE id=?').get('wallet')).toEqual({ initial_balance: 85000 });
});

async function wallet() {
  await store.initLocalDatabase(adapter);
  await store.selectLocalUser(crypto.randomUUID());
  return store.insertLocalAccount({ name: 'Tunai', type: 'cash', initialBalance: 85000 });
}

it('restores pending edits and deletes, without reading or replacing another owner', async () => {
  const a = await wallet();
  const t = await store.insertLocalTransaction({ accountId: a.id, type: 'expense', amount: 2500 });
  await store.updateLocalTransaction(t.id, { amount: 3000 });
  const backup = await store.exportFullLocalBackup();
  const b = await wallet();
  expect(await store.getLocalTransactionById(t.id)).toBeNull();
  expect((await store.getLocalAccounts()).map(x => x.id)).not.toContain(a.id);
  expect((await store.restoreFullLocalBackup(backup)).success).toBe(false);
  await store.setActiveUserId(a.userId);
  await store.deleteLocalTransaction(t.id);
  const deleted = await store.exportFullLocalBackup();
  for (const snapshot of [backup, deleted]) {
    expect((await store.restoreFullLocalBackup(snapshot)).success).toBe(true);
    const restored = JSON.parse(await store.exportFullLocalBackup()).data;
    expect(restored.outbox).toEqual(JSON.parse(snapshot).data.outbox);
    expect(restored.transactions[0].sync_status).toBe('pending_sync');
  }
  await store.clearAllLocalTransactions(a.userId, true);
  store.setActiveUserId(b.userId);
  expect((await store.getLocalAccounts()).map(x => x.id)).toContain(b.id);
});

it('imports statement dates once per connection and preserves identical purchases within a file', async () => {
  const a = await wallet();
  const t = await store.insertLocalTransaction({ accountId: a.id, type: 'expense', amount: 20000,
    transactionDate: new Date(2026,10,1,12).toISOString() });
  const c = await store.insertLocalBankConnection({ accountId: a.id, provider: 'statement_import', institutionCode: 'BCA' });
  const csv = 'Tanggal,Keterangan,Nominal,Tipe\n2026-11-01,Kopi,20000,DB\n2026-11-01,Kopi,20000,DB';
  expect(await store.importLocalBankStatement(c.id, csv)).toEqual({importedCount: 2, autoMatchedCount: 0});
  expect((await store.importLocalBankStatement(c.id, csv)).importedCount).toBe(0);
  const rows = await store.getLocalBankMutations();
  expect(rows.map(r => r.transactionTime)).toEqual(Array(2).fill(new Date(2026, 10, 1).toISOString()));
  await store.reconcileLocalBankMutation(rows[0].id, 'match', t.id);
  await expect(store.reconcileLocalBankMutation(rows[1].id, 'match', t.id)).rejects.toThrow();
  expect((await store.getLocalBankMutations('pending')).length).toBe(1);
});

it('refunds only the pocket-funded amount when editing, moving, or cancelling an expense', async () => {
  const a = await wallet();
  const pocket = await store.insertLocalPocket({ accountId:a.id,name:'Makan',type:'spending',initialAllocation:10000 });
  const balance = async () => (await store.getLocalPockets(a.id))[0].allocatedBalance;
  const t = await store.insertLocalTransaction({accountId:a.id,pocketId:pocket.id,type:'expense',amount:30000});
  expect(await balance()).toBe(0);
  await store.updateLocalTransaction(t.id,{amount:20000});
  expect((await store.getLocalTransactionById(t.id)).pocketDebit).toBe(10000);
  const date = '2026-11-12T12:00:00.000Z';
  await store.updateLocalTransaction(t.id,{pocketId:null,transactionDate:date});
  expect(await balance()).toBe(10000);
  expect((await store.getLocalTransactionById(t.id)).transactionDate).toBe(date);
  await store.updateLocalTransaction(t.id,{pocketId:pocket.id});
  await store.deleteLocalTransaction(t.id);
  expect(await balance()).toBe(10000);
});

it('round-trips a transfer, quoted multiline note, fee and timestamp; rejects unavailable wallets', async () => {
  const a = await wallet();
  const b = await store.insertLocalAccount({name:'Bank',type:'bank'});
  const input = {accountId:a.id,destinationAccountId:b.id,type:'transfer',amount:50000,transferFee:2500,
    note:'=kopi, \"pagi\"\\n& makan',transactionDate:'2026-10-03T23:01:02.456Z'};
  const t = await store.insertLocalTransaction(input);
  const csv = generateTransactionsCsv([t]);
  await store.deleteLocalTransaction(t.id);
  expect((await store.importTransactionsFromCsv(csv)).success).toBe(1);
  expect(await store.getLocalTransactions()).toMatchObject([input]);
  await store.archiveLocalAccount(b.id);
  expect(await store.importTransactionsFromCsv(csv)).toMatchObject({success:0,failed:1});
  expect(await store.getLocalTransactions()).toHaveLength(1);
});

it('groups transactions from local midnight up to but excluding next month', async () => {
  const a = await wallet();
  for (const [date, amount] of [[new Date(2026, 9, 31, 23, 59), 1], [new Date(2026, 10, 1, 0, 15), 2], [new Date(2026, 11, 1), 4]]) {
    await store.insertLocalTransaction({ accountId: a.id, type: 'expense', amount, transactionDate: date.toISOString() });
  }
  expect((await store.getLocalDashboardSummary('2026-11')).totalExpense).toBe(2);
  expect((await store.getLocalTransactions({ month: '2026-11' })).map(t => t.amount)).toEqual([2]);
});

it('keeps local data when account deletion is offline or unconfirmed', async () => {
  const a = await wallet();
  const t = await store.insertLocalTransaction({ accountId: a.id, type: 'expense', amount: 1500 });
  const { deleteAccountData } = await import('../auth/deleteAccount');
  const originalFetch = globalThis.fetch;
  try {
    for (const failure of [async () => { throw new Error('offline'); }, async () => new Response(null, { status: 503 }),
      async () => Response.json({ data: {} })]) {
      globalThis.fetch = failure;
      await expect(deleteAccountData('http://localhost', { id: a.userId }, 'fixture', 'test password')).rejects.toThrow();
      expect((await store.getLocalTransactionById(t.id)).syncStatus).toBe('pending_sync');
    }
  } finally { globalThis.fetch = originalFetch; }
});

it.skipIf(!process.env.TEST_DATABASE_URL)('retries a lost acknowledgement and pulls every committed version onto a second device', async () => {
  await import('../../../api/src/db/test-guard');
  const { default: app } = await import('../../../api/src/index');
  const { db, schema } = await import('../../../api/src/db/client');
  const { eq, sql } = await import('../../../api/node_modules/drizzle-orm');
  const registered = await app.handle(new Request('http://localhost/api/v1/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${crypto.randomUUID()}@example.test`, password: crypto.randomUUID() }),
  }));
  const { token, user } = (await registered.json()).data;
  await store.initLocalDatabase(adapter);
  await store.selectLocalUser(user.id);
  const a = await store.insertLocalAccount({ name: 'Dompet offline', type: 'cash', initialBalance: 20000 });
  const c = await store.insertLocalCategory({ name: 'Kopi', type: 'expense' });
  const create = () => store.insertLocalTransaction({ accountId: a.id, categoryId: c.id, type: 'expense', amount: 10 });
  const t = await create();
  await store.updateLocalTransaction(t.id, { amount: 20 });
  mock.module('../auth/authContext', () => ({ getStoredToken: async () => token }));
  const { SyncEngine } = await import('../sync/syncEngine');
  const originalFetch = globalThis.fetch;
  let loseResponse = true;
  globalThis.fetch = async (url, init) => {
    const response = await app.handle(new Request(url, init));
    if (loseResponse) { loseResponse = false; throw new Error('Lost response'); }
    return response;
  };
  try {
    expect((await SyncEngine.processOutbox()).errors).toBe(1);
    expect((await store.getLocalTransactionById(t.id)).syncStatus).toBe('pending_sync');
    expect(await SyncEngine.processOutbox()).toEqual({ processedCount: 2, errors: 0 });
    await store.updateLocalTransaction(t.id, { amount: 30 });
    for (let i = 0; i < 50; i++) await create();
    expect(await SyncEngine.processOutbox()).toEqual({ processedCount: 51, errors: 0 });
    await db.update(schema.transactions).set({ updatedAt: sql`'2026-11-01T00:15:00.123456Z'::timestamptz` })
      .where(eq(schema.transactions.userId, user.id));
    memory = new Database(':memory:');
    await store.initLocalDatabase(adapter);
    await store.selectLocalUser(user.id);
    expect(await SyncEngine.pull()).toEqual({ pulledCount: 51, errors: 0 });
    expect(await SyncEngine.pull()).toEqual({ pulledCount: 0, errors: 0 });
    expect((await store.getLocalTransactionById(t.id))).toMatchObject({ amount: 30, version: 3, syncStatus: 'synced',
      account: { name: a.name }, category: { name: c.name } });
    expect((await store.getLocalAccounts()).find(w => w.id === a.id).currentBalance).toBe(19470);
    const emptyWallet = await store.insertLocalAccount({name:'Tanpa transaksi',type:'bank',initialBalance:100000,reservedAmount:17000});
    expect((await SyncEngine.syncAll()).errors).toBe(0);
    const firstDevice = memory;
    memory = new Database(':memory:');
    await store.initLocalDatabase(adapter);
    await store.selectLocalUser(user.id);
    expect((await SyncEngine.pull()).errors).toBe(0);
    expect((await store.getLocalAccounts()).find(w=>w.id===emptyWallet.id)).toMatchObject({currentBalance:100000,reservedAmount:17000});
    await store.archiveLocalAccount(emptyWallet.id);
    expect((await SyncEngine.syncAll()).errors).toBe(0);
    memory = firstDevice;
    await SyncEngine.pull();
    expect((await store.getLocalAccounts()).some(w=>w.id===emptyWallet.id)).toBe(false);
    const pocket = await store.insertLocalPocket({accountId:a.id,name:'Kopi',type:'spending',initialAllocation:10000});
    const expense = await store.insertLocalTransaction({accountId:a.id,categoryId:c.id,pocketId:pocket.id,type:'expense',amount:30000});
    expect((await SyncEngine.syncAll()).errors).toBe(0);
    const sender = memory;
    memory = new Database(':memory:');
    await store.initLocalDatabase(adapter);
    await store.selectLocalUser(user.id);
    expect((await SyncEngine.pull()).errors).toBe(0);
    expect((await store.getLocalPockets(a.id))[0].allocatedBalance).toBe(0);
    await store.deleteLocalTransaction(expense.id);
    expect((await SyncEngine.syncAll()).errors).toBe(0);
    memory = sender;
    await SyncEngine.pull();
    expect((await store.getLocalPockets(a.id))[0].allocatedBalance).toBe(10000);
    const withReceipt = await store.insertLocalTransaction({accountId:a.id,categoryId:c.id,type:'expense',amount:100,
      receiptUrl:'file:///missing/receipt.jpg'});
    await create();
    expect(await SyncEngine.processOutbox()).toEqual({processedCount:1,errors:1});
    await store.updateLocalTransaction(withReceipt.id,{receiptUrl:null});
    expect(await SyncEngine.processOutbox()).toEqual({processedCount:2,errors:0});
    const missing = await store.insertLocalTransaction({ accountId: crypto.randomUUID(), categoryId: c.id, type: 'expense', amount: 1 });
    expect((await SyncEngine.processOutbox()).processedCount).toBe(0);
    expect((await store.getLocalTransactionById(missing.id)).syncStatus).not.toBe('synced');
    expect(JSON.parse(await store.exportFullLocalBackup()).data.outbox).toHaveLength(1);
  } finally { globalThis.fetch = originalFetch; }
});

it('shares the completed backup only, and removes its staged copy if sharing fails', async () => {
  const a = await wallet();
  const files = new Map();
  const cache = { uri:'cache://', list:() => [] };
  class Directory {
    constructor(parent, ...path) { this.uri = [parent.uri,...path].join('/'); }
    create() {}
  }
  class File {
    constructor(parent, name) { this.uri = typeof parent === 'string' ? parent : `${parent.uri}/${name}`; }
    get parentDirectory() { return { uri: this.uri.slice(0,this.uri.lastIndexOf('/')) }; }
    async text() { if (files.get(this.uri) === null) throw Error('Gagal membaca'); return files.get(this.uri); }
    get exists() { return files.has(this.uri); }
    async write(text) {
      await Bun.sleep(5);
      files.set(this.uri, text);
    }
    delete() { files.delete(this.uri); }
  }
  mock.module('expo-file-system', () => ({Directory,File,Paths:{cache}}));
  mock.module('expo-sharing', () => ({ isAvailableAsync:async () => true, shareAsync:async uri => {
    expect(files.get(uri)).toBe('cadangan');
    expect(uri).toContain(a.userId);
    throw new Error('Dialog ditutup.');
  } }));
  const { shareExport } = await import('../services/exportFiles');
  await expect(shareExport(a.userId,'cadangan',true)).rejects.toThrow('Dialog ditutup.');
  expect(files.size).toBe(0);
  const { readPickedBackup } = await import('../services/importFile');
  const staged = new Directory(cache, 'DocumentPicker').uri + '/import.ukbak';
  files.set(staged, 'cadangan');
  expect(await readPickedBackup(staged)).toBe('cadangan');
  expect(files.has(staged)).toBe(false);
  files.set(staged, null);
  await expect(readPickedBackup(staged)).rejects.toThrow('Gagal membaca');
  expect(files.has(staged)).toBe(false);
  const original = 'documents://personal/backup.ukbak';
  files.set(original, 'original');
  await expect(readPickedBackup(original)).rejects.toThrow();
  expect(files.get(original)).toBe('original');
});
