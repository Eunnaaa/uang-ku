export function localMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function localMonthBounds(key: string) {
  const [year, month] = key.split('-').map(Number);
  return [new Date(year, month - 1, 1).toISOString(), new Date(year, month, 1).toISOString()];
}
