import { eq, sql } from 'drizzle-orm';
import { db, schema } from './client';

export async function monthBounds(owner: string, month?: string) {
  const midnight = month ? sql`${month + '-01'}::date` :
    sql`date_trunc('month', now() AT TIME ZONE ${schema.profiles.timezone})`;
  const [bounds] = await db.select({
    start: sql<string>`(${midnight}::timestamp AT TIME ZONE ${schema.profiles.timezone})::text`,
    end: sql<string>`((${midnight} + interval '1 month') AT TIME ZONE ${schema.profiles.timezone})::text`,
    prev: sql<string>`((${midnight} - interval '1 month') AT TIME ZONE ${schema.profiles.timezone})::text`,
  }).from(schema.profiles).where(eq(schema.profiles.id, owner));
  return { startDate: new Date(bounds.start), endDate: new Date(bounds.end), prevStartDate: new Date(bounds.prev) };
}
