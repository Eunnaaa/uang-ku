export function testDatabaseUrl(): string {
  const url = new URL(process.env.TEST_DATABASE_URL || 'file:///');
  if (process.env.NODE_ENV !== 'test' || url.protocol !== 'postgresql:' ||
      url.hostname !== '127.0.0.1' || !/^\/uangku_test_[a-f0-9]{32}$/.test(url.pathname) ||
      url.port === '5432' || !url.port || url.search) {
    throw new Error('Integration tests require a temporary cluster. Run bun run test from the repository root.');
  }
  return url.href;
}
