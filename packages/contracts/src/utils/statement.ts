export function parseBankStatement(connectionId: string, csv: string) {
  const occurrences = new Map<string, number>();
  const rows: { date: string; description: string; amount: number; type: 'credit' | 'debit'; externalId: string }[] = [];
  for (const line of csv.trim().split(/\r?\n/)) {
    const fields = line.trim().match(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)?.map(f =>
      f.replace(/,$/, '').trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"'));
    if (!fields) continue;
    const [date, description, rawAmount, rawType] = fields;
    if (!/^\d{4}-\d\d-\d\d$/.test(date)) continue;
    const [y, m, d] = date.split('-').map(Number);
    if (new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10) !== date) continue;
    if (!/^\d+$/.test(rawAmount)) continue;
    const amount = Number(rawAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0) continue;
    const direction = rawType?.toUpperCase();
    if (!['CR','CREDIT','+','DB','DEBIT','-'].includes(direction)) continue;
    const type = ['CR','CREDIT','+'].includes(direction) ? 'credit' as const : 'debit' as const;
    const key = JSON.stringify([connectionId, date, description, amount, type]);
    // Two identical lines in a statement may be two legitimate purchases.
    const occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);
    rows.push({ date, description, amount, type, externalId: `${key}:${occurrence}` });
  }
  const group = (r: typeof rows[number]) => `${r.date}:${r.type}:${r.amount}`;
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(group(row), (counts.get(group(row)) ?? 0) + 1);
  return rows.map(row => ({ ...row, ambiguous: counts.get(group(row))! > 1 }));
}
