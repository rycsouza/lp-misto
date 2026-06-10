import { db } from './client';
import { players, sponsors, products, membershipPlans, boardMembers } from './schema';
import { sql } from 'drizzle-orm';

async function main() {
  for (const [name, t] of [
    ['players', players],
    ['sponsors', sponsors],
    ['products', products],
    ['membership_plans', membershipPlans],
    ['board_members', boardMembers],
  ] as const) {
    const [row] = await (db.select({ count: sql<number>`count(*)` }).from(t as typeof players));
    console.log(name + ':', row.count);
  }
  process.exit(0);
}

main().catch(console.error);
