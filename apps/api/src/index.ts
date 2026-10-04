import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { authRoutes } from './modules/auth/auth.route';
import { accountRoutes } from './modules/accounts/account.route';
import { categoryRoutes } from './modules/categories/category.route';
import { transactionRoutes } from './modules/transactions/transaction.route';
import { reportRoutes } from './modules/reports/report.route';
import { syncRoutes } from './modules/sync/sync.route';

const app = new Elysia()
  .use(cors())
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
  .use(errorHandler)
  // Health checks
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .get('/ready', () => ({ status: 'ready', database: 'connected', version: '1.0.0' }))
  // Feature routes
  .use(authRoutes)
  .use(accountRoutes)
  .use(categoryRoutes)
  .use(transactionRoutes)
  .use(reportRoutes)
  .use(syncRoutes)
  .listen(env.PORT);

console.log(`✨ UangKu Elysia API is running at http://${app.server?.hostname}:${app.server?.port}`);
console.log(`📚 Swagger documentation available at http://${app.server?.hostname}:${app.server?.port}/swagger`);

export type App = typeof app;
export default app;
