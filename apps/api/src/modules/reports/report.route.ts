import { Elysia } from 'elysia';
import { and, desc, eq, gte, isNull, lt, or, sql } from 'drizzle-orm';
import { reportSummaryQuerySchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { db, schema } from '../../db/client';
import { walletBalance } from '../../db/ledger';
import { monthBounds } from '../../db/month';

const { transactions: t, accounts: a, categories: c } = schema;
const period = (owner: string, start: Date, end: Date) => and(eq(t.userId,owner),isNull(t.deletedAt),gte(t.transactionDate,start),lt(t.transactionDate,end));
function totals(owner: string, start: Date, end: Date) {
  return db.select({ income: sql`coalesce(sum(${t.amount}) filter (where ${t.type}='income'),0)`.mapWith(Number),
    expense: sql`coalesce(sum(${t.amount}) filter (where ${t.type}='expense'),0)`.mapWith(Number),
    fees: sql`coalesce(sum(${t.transferFee}) filter (where ${t.type}='transfer'),0)`.mapWith(Number) }).from(t).where(period(owner,start,end));
}
const diff = (n: number, prev: number) => prev ? Math.round((n-prev)/prev*1000)/10 : n ? 100 : 0;
export const reportRoutes = new Elysia({ prefix: '/api/v1/reports' }).use(authMiddleware)
  .get('/summary',async ({ query,user }) => {
    const { month } = reportSummaryQuerySchema.parse(query);
    const { startDate,endDate,prevStartDate } = await monthBounds(user.userId,month);
    const [[now],[prev],wallets] = await Promise.all([totals(user.userId,startDate,endDate),totals(user.userId,prevStartDate,startDate),
      db.select({ balance: walletBalance }).from(a).where(and(eq(a.userId,user.userId),eq(a.isArchived,false)))]);
    return successResponse({ month,totalIncome: now.income,totalExpense: now.expense,totalTransferFees: now.fees,
      netCashFlow: now.income-now.expense-now.fees,currentNetWorth: wallets.reduce((n,w)=>n+w.balance,0),
      previousMonthComparison: { incomeDiffPercentage: diff(now.income,prev.income),expenseDiffPercentage: diff(now.expense,prev.expense) } });
  })
  .get('/expenses-by-category',async ({ query,user }) => {
    const { month } = reportSummaryQuerySchema.parse(query);
    const { startDate,endDate } = await monthBounds(user.userId,month);
    const amount = sql`sum(${t.amount})`.mapWith(Number);
    const rows = await db.select({ categoryId: c.id,categoryName: c.name,categoryIcon: c.icon,totalAmount: amount }).from(t)
      .leftJoin(c,and(eq(t.categoryId,c.id),or(eq(c.userId,t.userId),and(isNull(c.userId),eq(c.isSystem,true)))))
      .where(and(period(user.userId,startDate,endDate),eq(t.type,'expense'))).groupBy(c.id).orderBy(desc(amount));
    const grandTotalExpense = rows.reduce((n,r)=>n+r.totalAmount,0);
    return successResponse({ month,grandTotalExpense,categories: rows.map(r=>({ ...r,categoryId: r.categoryId ?? 'other',
      categoryName: r.categoryName ?? 'Lainnya',categoryIcon: r.categoryIcon ?? 'tag',percentage: Math.round(r.totalAmount/grandTotalExpense*1000)/10 })) });
  });
