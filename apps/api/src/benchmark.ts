import app from './index';

interface LatencyStats {
  endpoint: string;
  totalRequests: number;
  durationMs: number;
  rps: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
}

async function benchmarkEndpoint(
  name: string,
  createRequest: () => Request,
  iterations: number = 200,
  concurrency: number = 20
): Promise<LatencyStats> {
  // Warmup 20 requests
  for (let i = 0; i < 20; i++) {
    await app.handle(createRequest());
  }

  const latencies: number[] = [];
  const startTime = performance.now();

  let completed = 0;
  async function worker() {
    while (completed < iterations) {
      completed++;
      const reqStart = performance.now();
      const res = await app.handle(createRequest());
      const reqDuration = performance.now() - reqStart;
      latencies.push(reqDuration);
      if (res.status >= 500) {
        console.error(`Error on ${name}: ${res.status}`);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const totalDuration = performance.now() - startTime;
  latencies.sort((a, b) => a - b);

  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p90 = latencies[Math.floor(latencies.length * 0.9)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const rps = Math.round((latencies.length / (totalDuration / 1000)));

  return {
    endpoint: name,
    totalRequests: latencies.length,
    durationMs: Math.round(totalDuration),
    rps,
    minMs: Number(min.toFixed(2)),
    maxMs: Number(max.toFixed(2)),
    p50Ms: Number(p50.toFixed(2)),
    p90Ms: Number(p90.toFixed(2)),
    p95Ms: Number(p95.toFixed(2)),
    p99Ms: Number(p99.toFixed(2)),
  };
}

async function runBenchmarks() {
  console.log('⚡ Menjalankan Benchmark Kinerja API UangKu (Bun + Elysia + PostgreSQL)...\n');

  const startMem = process.memoryUsage();

  const results: LatencyStats[] = [];

  // 1. Health check (No DB)
  results.push(
    await benchmarkEndpoint(
      'GET /health',
      () => new Request('http://localhost/health'),
      500,
      25
    )
  );

  // 2. Readiness check (Raw DB ping)
  results.push(
    await benchmarkEndpoint(
      'GET /ready (Postgres Ping)',
      () => new Request('http://localhost/ready'),
      200,
      15
    )
  );

  // 3. Accounts List (DB Query + Drizzle ORM)
  results.push(
    await benchmarkEndpoint(
      'GET /api/v1/accounts',
      () =>
        new Request('http://localhost/api/v1/accounts', {
          headers: { Authorization: 'Bearer demo-token' },
        }),
      200,
      15
    )
  );

  // 4. Reports Summary (Aggregated SQL SUM / Count)
  results.push(
    await benchmarkEndpoint(
      'GET /api/v1/reports/summary',
      () =>
        new Request('http://localhost/api/v1/reports/summary', {
          headers: { Authorization: 'Bearer demo-token' },
        }),
      200,
      15
    )
  );

  // 5. Transactions Query (Indexed Query + Cursor)
  results.push(
    await benchmarkEndpoint(
      'GET /api/v1/transactions',
      () =>
        new Request('http://localhost/api/v1/transactions?limit=20', {
          headers: { Authorization: 'Bearer demo-token' },
        }),
      200,
      15
    )
  );

  // 6. Push Sync Mutation (Batch Insert + Sync Log)
  results.push(
    await benchmarkEndpoint(
      'POST /api/v1/sync/push (Batch)',
      () =>
        new Request('http://localhost/api/v1/sync/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer demo-token',
          },
          body: JSON.stringify({
            mutations: [
              {
                id: crypto.randomUUID(),
                clientId: crypto.randomUUID(),
                entityType: 'transaction',
                operation: 'insert',
                entityId: crypto.randomUUID(),
                version: 1,
                payload: {
                  accountId: 'a1000000-0000-0000-0000-000000000001',
                  categoryId: 'c1000000-0000-0000-0000-000000000001',
                  type: 'expense',
                  amount: 25000,
                  transactionDate: new Date().toISOString(),
                  note: 'Benchmark sync',
                },
              },
            ],
          }),
        }),
      100,
      10
    )
  );

  const endMem = process.memoryUsage();

  console.table(
    results.map((r) => ({
      Endpoint: r.endpoint,
      'Total Req': r.totalRequests,
      'Throughput (RPS)': `${r.rps} req/s`,
      'Min (ms)': `${r.minMs}ms`,
      'p50 (ms)': `${r.p50Ms}ms`,
      'p90 (ms)': `${r.p90Ms}ms`,
      'p95 (ms)': `${r.p95Ms}ms`,
      'p99 (ms)': `${r.p99Ms}ms`,
      'Max (ms)': `${r.maxMs}ms`,
    }))
  );

  console.log('\n📊 Analisis Penggunaan Memori Bun Server-Side:');
  console.log(`• RSS Memory: ${(endMem.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`• Heap Total: ${(endMem.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`• Heap Used: ${(endMem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`• Delta Heap: ${((endMem.heapUsed - startMem.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
  process.exit(0);
}

runBenchmarks().catch((err) => {
  console.error(err);
  process.exit(1);
});
