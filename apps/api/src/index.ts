import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { env } from './config/env';
import { errorHandler, handleAppError } from './middleware/error-handler';
import { db } from './db/client';
import { sql } from 'drizzle-orm';
import { authRoutes } from './modules/auth/auth.route';
import { accountRoutes } from './modules/accounts/account.route';
import { categoryRoutes } from './modules/categories/category.route';
import { transactionRoutes } from './modules/transactions/transaction.route';
import { reportRoutes } from './modules/reports/report.route';
import { syncRoutes } from './modules/sync/sync.route';
import { templateRoutes } from './modules/templates/template.route';
import { budgetRoutes } from './modules/budgets/budget.route';
import { goalRoutes } from './modules/goals/goal.route';
import { recurringRoutes } from './modules/recurring/recurring.route';
import { appConfigRoutes } from './modules/app-config/app-config.route';
import { pocketRoutes } from './modules/pockets/pocket.route';
import { bankConnectionRoutes } from './modules/bank-connections/bank-connection.route';
import { seedDatabase } from './db/seed';

// Seed PostgreSQL database asynchronously on startup
if (process.env.NODE_ENV !== 'test') {
  seedDatabase().catch(console.error);
}

const corsOrigin = env.CORS_ORIGIN
  ? env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : true;

const app = new Elysia()
  .use(
    cors({
      origin: corsOrigin,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-app-version'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  )
  .onRequest(({ set }) => {
    set.headers['X-Content-Type-Options'] = 'nosniff';
    set.headers['X-Frame-Options'] = 'DENY';
    set.headers['X-XSS-Protection'] = '1; mode=block';
    set.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    set.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()';
  })
  .use(
    swagger({
      documentation: {
        info: {
          title: 'UangKu API',
          version: '1.0.0',
          description: 'High-performance Personal Finance API with Offline Synchronization & Drizzle ORM',
        },
      },
      path: '/swagger',
    })
  )
  .onError(handleAppError)
  // Health checks
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .get('/ready', async ({ set }) => {
    const start = performance.now();
    try {
      await db.execute(sql`SELECT 1`);
      const latencyMs = Math.round(performance.now() - start);
      return {
        status: 'ready',
        database: 'connected',
        latencyMs,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      set.status = 503;
      return {
        status: 'degraded',
        database: 'disconnected',
        error: err?.message || 'Database unreachable',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      };
    }
  })
  // Feature routes
  .use(authRoutes)
  .use(accountRoutes)
  .use(categoryRoutes)
  .use(transactionRoutes)
  .use(reportRoutes)
  .use(syncRoutes)
  .use(templateRoutes)
  .use(budgetRoutes)
  .use(goalRoutes)
  .use(recurringRoutes)
  .use(appConfigRoutes)
  .use(pocketRoutes)
  .use(bankConnectionRoutes)
  .listen(env.PORT);

console.log(`✨ UangKu Elysia API is running at http://${app.server?.hostname}:${app.server?.port}`);
console.log(`📚 Swagger documentation available at http://${app.server?.hostname}:${app.server?.port}/swagger`);

export type App = typeof app;
export default app;
