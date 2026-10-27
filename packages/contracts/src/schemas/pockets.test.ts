import { describe, it, expect } from 'bun:test';
import {
  createPocketSchema,
  updatePocketSchema,
  pocketTransferSchema,
  joinPocketSchema,
  pocketContributionSchema,
  addPocketMemberSchema,
  createBankConnectionSchema,
  reconcileMutationSchema,
} from '../index';

describe('Pocketing & Bank Integration Schemas (PRD Sections 79 & 80)', () => {
  it('validates a valid pocket creation payload', () => {
    const valid = {
      name: 'Makan & Kuliner',
      emoji: 'utensils',
      type: 'spending',
      initialAllocation: 500000,
      targetAmount: 1500000,
    };
    const parsed = createPocketSchema.parse(valid);
    expect(parsed.name).toBe('Makan & Kuliner');
    expect(parsed.type).toBe('spending');
    expect(parsed.initialAllocation).toBe(500000);
  });

  it('sets default emoji and initial allocation if omitted', () => {
    const min = {
      name: 'Cicilan Mobil',
      type: 'bills',
    };
    const parsed = createPocketSchema.parse(min);
    expect(parsed.emoji).toBe('wallet');
    expect(parsed.initialAllocation).toBe(0);
  });

  it('rejects pocket with empty name', () => {
    expect(() => {
      createPocketSchema.parse({
        name: '   ',
        type: 'spending',
      });
    }).toThrow();
  });

  it('rejects invalid pocket type', () => {
    expect(() => {
      createPocketSchema.parse({
        name: 'Kantong Ajaib',
        type: 'invalid_type',
      });
    }).toThrow();
  });

  it('validates valid pocket transfer within account', () => {
    const transfer = {
      accountId: 'a1000000-0000-4000-8000-000000000001',
      sourcePocketId: 'c1000000-0000-4000-8000-000000000001',
      destinationPocketId: null, // transfer back to main balance
      amount: 150000,
    };
    const parsed = pocketTransferSchema.parse(transfer);
    expect(parsed.amount).toBe(150000);
    expect(parsed.destinationPocketId).toBeNull();
  });

  it('rejects pocket transfer if source and destination are identical', () => {
    expect(() => {
      pocketTransferSchema.parse({
        accountId: 'a1000000-0000-4000-8000-000000000001',
        sourcePocketId: 'c1000000-0000-4000-8000-000000000001',
        destinationPocketId: 'c1000000-0000-4000-8000-000000000001',
        amount: 50000,
      });
    }).toThrow();
  });

  it('validates bank connection creation', () => {
    const conn = {
      accountId: 'a2000000-0000-4000-8000-000000000002',
      institutionCode: 'BCA',
      maskedAccountNumber: '•••• 8821',
    };
    const parsed = createBankConnectionSchema.parse(conn);
    expect(parsed.institutionCode).toBe('BCA');
    expect(parsed.provider).toBe('statement_import');
  });

  it('validates mutation reconciliation matching existing transaction', () => {
    const match = {
      action: 'match' as const,
      matchedTransactionId: 'b1000000-0000-4000-8000-000000000001',
    };
    const parsed = reconcileMutationSchema.parse(match);
    expect(parsed.action).toBe('match');
    expect(parsed.matchedTransactionId).toBe('b1000000-0000-4000-8000-000000000001');
  });

  it('rejects match action if matchedTransactionId is missing', () => {
    expect(() => {
      reconcileMutationSchema.parse({
        action: 'match',
      });
    }).toThrow();
  });

  it('validates a shared pocket creation and join schemas', () => {
    const sharedPocket = createPocketSchema.parse({
      name: 'Patungan Liburan Bali',
      emoji: 'plane',
      type: 'shared',
      isShared: true,
      targetAmount: 5000000,
    });
    expect(sharedPocket.type).toBe('shared');
    expect(sharedPocket.isShared).toBe(true);

    const joinPayload = {
      inviteCode: 'PKT-BALI2026',
      memberName: 'Sarah',
    };
    const parsedJoin = joinPocketSchema.parse(joinPayload);
    expect(parsedJoin.inviteCode).toBe('PKT-BALI2026');
    expect(parsedJoin.memberName).toBe('Sarah');
    expect(parsedJoin.avatarEmoji).toBe('user');

    const contribution = pocketContributionSchema.parse({
      memberName: 'Sarah',
      amount: 500000,
      note: 'Cicilan hotel tahap 1',
    });
    expect(contribution.amount).toBe(500000);
    expect(contribution.note).toBe('Cicilan hotel tahap 1');
  });
});
