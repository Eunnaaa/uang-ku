import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';

// Start a new cluster, not a new schema on the developer's database server.
const dir = mkdtempSync(join(tmpdir(), 'uangku-test-'));
const bin = Bun.spawnSync(['pg_config', '--bindir']).stdout.toString().trim();
const port = 49152 + Math.floor(Math.random() * 16384);
const database = `uangku_test_${crypto.randomUUID().replaceAll('-', '')}`;
const url = `postgresql://${encodeURIComponent(userInfo().username)}@127.0.0.1:${port}/${database}`;
const env = { ...process.env, TZ: 'Asia/Jakarta', NODE_ENV: 'test', DATABASE_URL: url, TEST_DATABASE_URL: url,
  STORAGE_LOCAL_DIR: join(dir, 'uploads'), STORAGE_LEGACY_DIR: join(dir, 'legacy'), STORAGE_DRIVER: 'local',
  SUPABASE_JWT_SECRET: '', JWT_SECRET: crypto.randomUUID(),
  REDIS_URL: '', UPSTASH_REDIS_REST_URL: '', SENTRY_DSN: '' };
function run(args: string[], cwd = import.meta.dir) {
  const result = Bun.spawnSync(args, { cwd, env, stdout: 'inherit', stderr: 'inherit' });
  if (result.exitCode !== 0) throw new Error(`${args[0]} failed (${result.exitCode})`);
}
const cluster = join(dir, 'pg');
let running = false;
try {
  run([join(bin, 'initdb'), '-D', cluster, '-A', 'trust', '--no-locale', '-E', 'UTF8']);
  run([join(bin, 'pg_ctl'), '-D', cluster, '-l', join(dir, 'postgres.log'), '-o',
    `-h 127.0.0.1 -k '' -p ${port}`, '-w', 'start']);
  running = true;
  run([join(bin, 'createdb'), '-h', '127.0.0.1', '-p', String(port), database]);
  run(['bun', 'run', 'db:migrate'], join(import.meta.dir, 'apps/api'));
  run(['bun', '-e', "await (await import('./src/db/seed')).seedDatabase(); process.exit(0)"], join(import.meta.dir, 'apps/api'));
  run(['bun', 'test', ...process.argv.slice(2)]);
} finally {
  if (running) run([join(bin, 'pg_ctl'), '-D', cluster, '-m', 'fast', '-w', 'stop']);
  rmSync(dir, { recursive: true });
}
