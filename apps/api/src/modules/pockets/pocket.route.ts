import { randomBytes } from 'node:crypto';
import { Elysia } from 'elysia';
import { and, desc, eq, gt, inArray, isNull, ne, sql } from 'drizzle-orm';
import { createPocketSchema, updatePocketSchema, pocketTransferSchema, joinPocketSchema,
  pocketContributionSchema, addPocketMemberSchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { db, schema } from '../../db/client';
import type { Tx } from '../../db/ledger';

const { accounts, pockets: p, pocketMembers: m, pocketContributions: c } = schema;
const invite = () => randomBytes(10).toString('hex').toUpperCase();
async function owned(tx: Tx, id: string, owner: string) {
  const [row] = await tx.select().from(p).where(and(eq(p.id, id), eq(p.userId, owner))).for('update');
  if (!row) throw new Error('RESOURCE_NOT_FOUND');
  return row;
}
async function share(tx: Tx, pocket: typeof p.$inferSelect) {
  const [row] = await tx.update(p).set({ isShared: true, inviteCode: invite(), inviteExpiresAt: new Date(Date.now()+86400000), updatedAt: new Date() })
    .where(eq(p.id, pocket.id)).returning();
  const members = await tx.select().from(m).where(and(eq(m.pocketId, row.id), isNull(m.revokedAt)));
  if (!members.some(x => x.userId === row.userId && x.role === 'owner')) {
    const [owner] = await tx.insert(m).values({ pocketId: row.id, userId: row.userId, name: 'Saya (Pembuat)',
      role: 'owner', totalContributed: row.allocatedBalance }).returning();
    members.push(owner);
    if (row.allocatedBalance) await tx.insert(c).values({ pocketId: row.id, memberId: owner.id,
      memberName: owner.name, amount: row.allocatedBalance, note: 'Alokasi awal' });
  }
  return { pocket: row, inviteCode: row.inviteCode, members };
}
async function access(tx: Tx, id: string, userId: string) {
  const [pocket] = await tx.select().from(p).where(eq(p.id, id)).for('update');
  if (!pocket) throw new Error('RESOURCE_NOT_FOUND');
  const [member] = await tx.select().from(m).where(and(eq(m.pocketId, id), eq(m.userId, userId), isNull(m.revokedAt)));
  if (pocket.userId !== userId && !(pocket.isShared && member)) throw new Error('RESOURCE_NOT_FOUND');
  return { pocket, member, owner: pocket.userId === userId };
}
export const pocketRoutes = new Elysia({ prefix: '/api/v1' }).use(authMiddleware)
  .get('/accounts/:accountId/pockets', async ({ params, user }) => {
    const rows = await db.select().from(p).where(and(eq(p.accountId, params.accountId), eq(p.userId, user.userId)));
    const ids = rows.map(r => r.id);
    const [members, contributions] = await Promise.all([db.select().from(m).where(and(inArray(m.pocketId, ids), isNull(m.revokedAt))),
      db.select().from(c).where(inArray(c.pocketId, ids)).orderBy(desc(c.createdAt))]);
    return successResponse({ pockets: rows.map(row => { const group = members.filter(x => x.pocketId === row.id);
      return { ...row, members: group, membersCount: group.length, contributions: contributions.filter(x => x.pocketId === row.id).slice(0,10) }; }),
      totalAllocated: rows.reduce((n,r) => n+r.allocatedBalance,0) });
  })
  .post('/accounts/:accountId/pockets', async ({ params, body, user }) => {
    const input = createPocketSchema.parse(body);
    return successResponse(await db.transaction(async tx => {
      if (!(await tx.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.id, params.accountId), eq(accounts.userId, user.userId))))[0]) throw new Error('RESOURCE_NOT_FOUND');
      const [row] = await tx.insert(p).values({ accountId: params.accountId, userId: user.userId, name: input.name,
        type: input.type, emoji: input.emoji, allocatedBalance: input.initialAllocation, targetAmount: input.targetAmount,
        sortOrder: input.sortOrder, isLocked: input.type === 'locked' }).returning();
      return input.isShared || input.type === 'shared' ? (await share(tx,row)).pocket : row;
    }));
  })
  .patch('/pockets/:id', async ({ params, body, user }) => {
    const input = updatePocketSchema.parse(body);
    return successResponse(await db.transaction(async tx => {
      await owned(tx,params.id,user.userId);
      const [row] = await tx.update(p).set({ ...input, ...(input.type === 'locked' && { isLocked: true }),
        ...(input.isShared === false && { inviteCode: null, inviteExpiresAt: null }), updatedAt: new Date() }).where(eq(p.id,params.id)).returning();
      return input.isShared ? (await share(tx,row)).pocket : row;
    }));
  })
  .delete('/pockets/:id', async ({ params, user }) => {
    const [row] = await db.delete(p).where(and(eq(p.id, params.id),eq(p.userId,user.userId))).returning();
    if (!row) throw new Error('RESOURCE_NOT_FOUND');
    return successResponse({ id: row.id, freedBalance: row.allocatedBalance, deleted: true });
  })
  .post('/pockets/transfer', async ({ body, user }) => {
    const input = pocketTransferSchema.parse(body);
    return successResponse(await db.transaction(async tx => {
      let sourcePocket = null, destinationPocket = null;
      for (const id of [input.sourcePocketId,input.destinationPocketId].filter((id): id is string => !!id).sort()) {
        const row = await owned(tx,id,user.userId);
        if (row.accountId !== input.accountId) throw new Error('RESOURCE_NOT_FOUND');
        const balance = row.allocatedBalance + (id === input.sourcePocketId ? -input.amount : input.amount);
        if (balance < 0) throw new Error('SYNC_CONFLICT');
        const [updated] = await tx.update(p).set({ allocatedBalance: balance, updatedAt: new Date() }).where(eq(p.id,id)).returning();
        if (id === input.sourcePocketId) sourcePocket = updated; else destinationPocket = updated;
      }
      return { sourcePocket, destinationPocket, transferredAmount: input.amount };
    }));
  })
  .post('/pockets/:id/share', async ({ params, user }) => successResponse(await db.transaction(async tx => share(tx,await owned(tx,params.id,user.userId)))))
  .post('/pockets/join', async ({ body, user }) => {
    const input = joinPocketSchema.parse(body);
    return successResponse(await db.transaction(async tx => {
      const rows = await tx.select().from(p).where(and(eq(p.isShared,true),eq(p.inviteCode,input.inviteCode.toUpperCase()),
        gt(p.inviteExpiresAt, sql`now()`))).limit(2).for('update');
      if (rows.length !== 1) throw new Error('RESOURCE_NOT_FOUND');
      const pocket = rows[0];
      let [member] = await tx.select().from(m).where(and(eq(m.userId,user.userId),eq(m.pocketId,pocket.id),isNull(m.revokedAt)));
      if (!member) [member] = await tx.insert(m).values({ pocketId: pocket.id,userId: user.userId,name: input.memberName,avatarEmoji: input.avatarEmoji }).returning();
      await tx.update(p).set({ inviteCode: null, inviteExpiresAt: null }).where(eq(p.id,pocket.id));
      return { pocket: { ...pocket, inviteCode: null, inviteExpiresAt: null }, member };
    }));
  })
  .post('/pockets/:id/members', async ({ params, body, user }) => {
    const input = addPocketMemberSchema.parse(body);
    if (input.role === 'owner') throw new Error('FORBIDDEN');
    return successResponse(await db.transaction(async tx => {
      await owned(tx, params.id, user.userId);
      return (await tx.insert(m).values({ ...input, pocketId: params.id }).returning())[0];
    }));
  })
  .delete('/pockets/:id/members/:memberId', async ({ params, user }) => successResponse(await db.transaction(async tx => {
    await owned(tx,params.id,user.userId);
    const [row] = await tx.update(m).set({ revokedAt: new Date() })
      .where(and(eq(m.id,params.memberId),eq(m.pocketId,params.id),ne(m.role,'owner'),isNull(m.revokedAt))).returning();
    if (!row) throw new Error('RESOURCE_NOT_FOUND');
    await tx.update(p).set({ inviteCode: null, inviteExpiresAt: null }).where(eq(p.id,params.id));
    return { memberId: row.id, removed: true };
  })))
  .post('/pockets/:id/contribute', async ({ params, body, user }) => {
    const input = pocketContributionSchema.parse(body);
    return successResponse(await db.transaction(async tx => {
      const auth = await access(tx,params.id,user.userId);
      if (!auth.owner && (auth.member.role !== 'contributor' || (input.memberId && input.memberId !== auth.member.id))) throw new Error('FORBIDDEN');
      let member = auth.member;
      if (auth.owner && input.memberId) [member] = await tx.select().from(m).where(and(eq(m.id,input.memberId),eq(m.pocketId,params.id),isNull(m.revokedAt)));
      if (!member) throw new Error('RESOURCE_NOT_FOUND');
      [member] = await tx.update(m).set({ totalContributed: sql`${m.totalContributed}+${input.amount}` }).where(eq(m.id,member.id)).returning();
      const [pocket] = await tx.update(p).set({ allocatedBalance: sql`${p.allocatedBalance}+${input.amount}`,updatedAt: new Date() }).where(eq(p.id,params.id)).returning();
      const [contribution] = await tx.insert(c).values({ pocketId: params.id,memberId: member.id,memberName: member.name,
        memberAvatar: member.avatarEmoji,amount: input.amount,note: input.note }).returning();
      return { pocket: auth.owner ? pocket : { ...pocket, inviteCode: null, inviteExpiresAt: null },member,contribution };
    }));
  })
  .get('/pockets/:id/contributions', async ({ params, user }) => successResponse(await db.transaction(async tx => {
    await access(tx,params.id,user.userId);
    const contributions = await tx.select().from(c).where(eq(c.pocketId,params.id)).orderBy(desc(c.createdAt));
    return { contributions,totalContributions: contributions.reduce((n,r) => n+r.amount,0) };
  })));
