export function requireRow<T>(rows: T[]): T {
  if (!rows.length) throw new Error('RESOURCE_NOT_FOUND');
  return rows[0];
}
