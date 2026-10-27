import { Elysia } from 'elysia';
import {
  createPocketSchema,
  updatePocketSchema,
  pocketTransferSchema,
  joinPocketSchema,
  pocketContributionSchema,
  addPocketMemberSchema,
  type PocketModel,
  type PocketMemberModel,
  type PocketContributionModel,
} from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse, errorHandler } from '../../middleware/error-handler';
import { db, schema } from '../../db/client';
import { eq, and, sql } from 'drizzle-orm';

// In-memory fallback stores for rapid unit tests & offline running
export const demoPocketMembers: PocketMemberModel[] = [];

export const demoPocketContributions: PocketContributionModel[] = [];

export const demoPockets: PocketModel[] = [];

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PKT-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const pocketRoutes = new Elysia({ prefix: '/api/v1' })
  .use(errorHandler)
  .use(authMiddleware)
  .get('/accounts/:accountId/pockets', async ({ params, user }) => {
    const list = demoPockets
      .filter((p) => p.accountId === params.accountId && p.userId === user.userId)
      .map((p) => {
        const members = demoPocketMembers.filter((m) => m.pocketId === p.id);
        const contributions = demoPocketContributions.filter((c) => c.pocketId === p.id);
        return {
          ...p,
          membersCount: members.length,
          members,
          contributions: contributions.slice(0, 10),
        };
      });

    const totalAllocated = list.reduce((sum, p) => sum + p.allocatedBalance, 0);

    return successResponse({
      pockets: list,
      totalAllocated,
    });
  })
  .post('/accounts/:accountId/pockets', async ({ params, body, user }) => {
    const input = createPocketSchema.parse(body);

    const isShared = Boolean(input.isShared || input.type === 'shared');
    const inviteCode = isShared ? (input.inviteCode || generateInviteCode()) : null;

    const newPocket: PocketModel = {
      id: crypto.randomUUID(),
      userId: user.userId,
      accountId: params.accountId,
      name: input.name,
      emoji: input.emoji ?? (isShared ? 'users' : 'wallet'),
      type: input.type,
      allocatedBalance: input.initialAllocation ?? 0,
      targetAmount: input.targetAmount ?? null,
      isLocked: input.type === 'locked',
      sortOrder: input.sortOrder ?? 0,
      isShared,
      inviteCode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    demoPockets.unshift(newPocket);

    if (isShared) {
      const ownerMember: PocketMemberModel = {
        id: crypto.randomUUID(),
        pocketId: newPocket.id,
        userId: user.userId,
        name: 'Saya (Pembuat)',
        avatarEmoji: 'crown',
        role: 'owner',
        totalContributed: newPocket.allocatedBalance,
        joinedAt: newPocket.createdAt,
      };
      demoPocketMembers.push(ownerMember);

      if (newPocket.allocatedBalance > 0) {
        demoPocketContributions.unshift({
          id: crypto.randomUUID(),
          pocketId: newPocket.id,
          memberId: ownerMember.id,
          memberName: ownerMember.name,
          memberAvatar: ownerMember.avatarEmoji,
          amount: newPocket.allocatedBalance,
          note: 'Setoran modal awal',
          createdAt: newPocket.createdAt,
        });
      }
    }

    try {
      await db.insert(schema.pockets).values({
        id: newPocket.id,
        userId: user.userId,
        accountId: params.accountId,
        name: newPocket.name,
        emoji: newPocket.emoji,
        type: newPocket.type,
        allocatedBalance: newPocket.allocatedBalance,
        targetAmount: newPocket.targetAmount,
        isLocked: newPocket.isLocked,
        sortOrder: newPocket.sortOrder,
        isShared: newPocket.isShared || false,
        inviteCode: newPocket.inviteCode || null,
      });
    } catch {}

    return successResponse(newPocket);
  })
  .patch('/pockets/:id', async ({ params, body, user }) => {
    const input = updatePocketSchema.parse(body);
    const pocket = demoPockets.find((p) => p.id === params.id && p.userId === user.userId);
    if (!pocket) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    if (input.name !== undefined) pocket.name = input.name;
    if (input.emoji !== undefined) pocket.emoji = input.emoji;
    if (input.type !== undefined) {
      pocket.type = input.type;
      if (input.type === 'locked') pocket.isLocked = true;
    }
    if (input.targetAmount !== undefined) pocket.targetAmount = input.targetAmount;
    if (input.isLocked !== undefined) pocket.isLocked = input.isLocked;
    if (input.sortOrder !== undefined) pocket.sortOrder = input.sortOrder;
    if (input.isShared !== undefined) {
      pocket.isShared = input.isShared;
      if (input.isShared && !pocket.inviteCode) {
        pocket.inviteCode = generateInviteCode();
      }
    }
    pocket.updatedAt = new Date().toISOString();

    try {
      await db.update(schema.pockets).set({
        name: pocket.name,
        emoji: pocket.emoji,
        type: pocket.type,
        targetAmount: pocket.targetAmount,
        isLocked: pocket.isLocked,
        sortOrder: pocket.sortOrder,
        isShared: pocket.isShared || false,
        inviteCode: pocket.inviteCode,
        updatedAt: new Date(pocket.updatedAt),
      }).where(eq(schema.pockets.id, pocket.id));
    } catch {}

    return successResponse(pocket);
  })
  .delete('/pockets/:id', async ({ params, user }) => {
    const index = demoPockets.findIndex((p) => p.id === params.id && p.userId === user.userId);
    if (index === -1) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    const removed = demoPockets[index];
    demoPockets.splice(index, 1);

    try {
      await db.delete(schema.pockets).where(eq(schema.pockets.id, params.id));
    } catch {}

    return successResponse({ id: params.id, freedBalance: removed.allocatedBalance, deleted: true });
  })
  .post('/pockets/transfer', async ({ body, user, set }) => {
    const input = pocketTransferSchema.parse(body);

    const sourcePocket = input.sourcePocketId
      ? demoPockets.find((p) => p.id === input.sourcePocketId && p.userId === user.userId && p.accountId === input.accountId)
      : null;

    const destPocket = input.destinationPocketId
      ? demoPockets.find((p) => p.id === input.destinationPocketId && p.userId === user.userId && p.accountId === input.accountId)
      : null;

    if (input.sourcePocketId && !sourcePocket) {
      set.status = 404;
      return { success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Kantong sumber tidak ditemukan' } };
    }
    if (input.destinationPocketId && !destPocket) {
      set.status = 404;
      return { success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Kantong tujuan tidak ditemukan' } };
    }

    if (sourcePocket) {
      if (sourcePocket.allocatedBalance < input.amount) {
        set.status = 400;
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Saldo kantong sumber tidak mencukupi untuk transfer' },
        };
      }
      sourcePocket.allocatedBalance -= input.amount;
      sourcePocket.updatedAt = new Date().toISOString();

      try {
        await db.update(schema.pockets).set({
          allocatedBalance: sourcePocket.allocatedBalance,
          updatedAt: new Date(sourcePocket.updatedAt),
        }).where(eq(schema.pockets.id, sourcePocket.id));
      } catch {}
    }

    if (destPocket) {
      destPocket.allocatedBalance += input.amount;
      destPocket.updatedAt = new Date().toISOString();

      try {
        await db.update(schema.pockets).set({
          allocatedBalance: destPocket.allocatedBalance,
          updatedAt: new Date(destPocket.updatedAt),
        }).where(eq(schema.pockets.id, destPocket.id));
      } catch {}
    }

    return successResponse({
      message: 'Transfer alokasi antar kantong berhasil',
      sourcePocket,
      destinationPocket: destPocket,
      transferredAmount: input.amount,
    });
  })
  // ==========================================
  // SHARED POCKET SPECIFIC ENDPOINTS
  // ==========================================
  .post('/pockets/:id/share', async ({ params, user }) => {
    const pocket = demoPockets.find((p) => p.id === params.id && p.userId === user.userId);
    if (!pocket) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    pocket.isShared = true;
    if (!pocket.inviteCode) {
      pocket.inviteCode = generateInviteCode();
    }
    pocket.updatedAt = new Date().toISOString();

    // Check if owner member exists
    let owner = demoPocketMembers.find((m) => m.pocketId === pocket.id && m.role === 'owner');
    if (!owner) {
      owner = {
        id: crypto.randomUUID(),
        pocketId: pocket.id,
        userId: user.userId,
        name: 'Saya (Pembuat)',
        avatarEmoji: 'crown',
        role: 'owner',
        totalContributed: pocket.allocatedBalance,
        joinedAt: new Date().toISOString(),
      };
      demoPocketMembers.push(owner);
    }

    try {
      await db.update(schema.pockets).set({
        isShared: true,
        inviteCode: pocket.inviteCode,
        updatedAt: new Date(pocket.updatedAt),
      }).where(eq(schema.pockets.id, pocket.id));
    } catch {}

    const members = demoPocketMembers.filter((m) => m.pocketId === pocket.id);
    return successResponse({
      pocket,
      inviteCode: pocket.inviteCode,
      members,
    });
  })
  .post('/pockets/join', async ({ body, set }) => {
    const input = joinPocketSchema.parse(body);

    const pocket = demoPockets.find(
      (p) => p.isShared && p.inviteCode?.toUpperCase() === input.inviteCode.toUpperCase()
    );

    if (!pocket) {
      set.status = 404;
      return {
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Kode undangan kantong bersama tidak ditemukan atau tidak aktif' },
      };
    }

    const newMember: PocketMemberModel = {
      id: crypto.randomUUID(),
      pocketId: pocket.id,
      name: input.memberName,
      avatarEmoji: input.avatarEmoji || 'user',
      role: 'contributor',
      totalContributed: 0,
      joinedAt: new Date().toISOString(),
    };

    demoPocketMembers.push(newMember);

    try {
      await db.insert(schema.pocketMembers).values({
        id: newMember.id,
        pocketId: pocket.id,
        name: newMember.name,
        avatarEmoji: newMember.avatarEmoji,
        role: newMember.role,
        totalContributed: 0,
      });
    } catch {}

    return successResponse({
      message: `Berhasil bergabung ke Kantong Bersama "${pocket.name}"`,
      pocket,
      member: newMember,
    });
  })
  .post('/pockets/:id/members', async ({ params, body }) => {
    const pocket = demoPockets.find((p) => p.id === params.id);
    if (!pocket) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    const input = addPocketMemberSchema.parse(body);
    const newMember: PocketMemberModel = {
      id: crypto.randomUUID(),
      pocketId: pocket.id,
      name: input.name,
      avatarEmoji: input.avatarEmoji || 'user',
      role: input.role || 'contributor',
      totalContributed: 0,
      joinedAt: new Date().toISOString(),
    };

    demoPocketMembers.push(newMember);

    try {
      await db.insert(schema.pocketMembers).values({
        id: newMember.id,
        pocketId: pocket.id,
        name: newMember.name,
        avatarEmoji: newMember.avatarEmoji,
        role: newMember.role,
        totalContributed: 0,
      });
    } catch {}

    return successResponse(newMember);
  })
  .delete('/pockets/:id/members/:memberId', async ({ params, user }) => {
    const pocket = demoPockets.find((p) => p.id === params.id && p.userId === user.userId);
    if (!pocket) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    const index = demoPocketMembers.findIndex(
      (m) => m.pocketId === params.id && m.id === params.memberId
    );
    if (index === -1) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    const removed = demoPocketMembers[index];
    if (removed.role === 'owner') {
      throw new Error('Owner tidak dapat dihapus dari Kantong Bersama');
    }

    demoPocketMembers.splice(index, 1);

    try {
      await db.delete(schema.pocketMembers).where(eq(schema.pocketMembers.id, params.memberId));
    } catch {}

    return successResponse({ memberId: params.memberId, removed: true });
  })
  .post('/pockets/:id/contribute', async ({ params, body, set }) => {
    const input = pocketContributionSchema.parse(body);
    const pocket = demoPockets.find((p) => p.id === params.id);
    if (!pocket) {
      set.status = 404;
      return { success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Kantong tidak ditemukan' } };
    }

    let member = input.memberId
      ? demoPocketMembers.find((m) => m.id === input.memberId && m.pocketId === pocket.id)
      : demoPocketMembers.find((m) => m.name.toLowerCase() === input.memberName.toLowerCase() && m.pocketId === pocket.id);

    if (!member) {
      member = {
        id: crypto.randomUUID(),
        pocketId: pocket.id,
        name: input.memberName,
        avatarEmoji: input.memberAvatar || 'user',
        role: 'contributor',
        totalContributed: 0,
        joinedAt: new Date().toISOString(),
      };
      demoPocketMembers.push(member);
    }

    member.totalContributed += input.amount;
    pocket.allocatedBalance += input.amount;
    pocket.updatedAt = new Date().toISOString();

    const contribution: PocketContributionModel = {
      id: crypto.randomUUID(),
      pocketId: pocket.id,
      memberId: member.id,
      memberName: member.name,
      memberAvatar: member.avatarEmoji,
      amount: input.amount,
      note: input.note || null,
      createdAt: new Date().toISOString(),
    };
    demoPocketContributions.unshift(contribution);

    try {
      await db.update(schema.pockets).set({
        allocatedBalance: pocket.allocatedBalance,
        updatedAt: new Date(pocket.updatedAt),
      }).where(eq(schema.pockets.id, pocket.id));

      await db.insert(schema.pocketContributions).values({
        id: contribution.id,
        pocketId: pocket.id,
        memberId: member.id,
        memberName: member.name,
        memberAvatar: member.avatarEmoji,
        amount: contribution.amount,
        note: contribution.note,
      });
    } catch {}

    return successResponse({
      message: `Setoran Rp ${input.amount.toLocaleString('id-ID')} berhasil dicatat`,
      pocket,
      member,
      contribution,
    });
  })
  .get('/pockets/:id/contributions', async ({ params }) => {
    const list = demoPocketContributions.filter((c) => c.pocketId === params.id);
    return successResponse({
      contributions: list,
      totalContributions: list.reduce((sum, c) => sum + c.amount, 0),
    });
  });
