"use server";

import { getDb } from "@/lib/db/client";
import { customers, orders } from "@/lib/db/schema";
import { eq, desc, sql, count } from "drizzle-orm";
import { requireModule } from "@/lib/admin/auth-guard";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/pagination";
import { CUSTOMER_SORT_KEYS, type CustomerSortKey } from "@/lib/admin/customer-sort";

export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  orderCount: number;
  paidOrderCount: number;
  totalSpentCents: number;
  lastOrderAt: Date | null;
  firstSeenAt: Date;
}

export async function getAdminCustomers(params: {
  page?: number;
  search?: string;
  sort?: string;
  dir?: string;
} = {}): Promise<{ rows: CustomerRow[]; total: number }> {
  await requireModule("pedidos");
  const db = await getDb();
  const { page = 1, search } = params;
  const limit = ADMIN_PAGE_SIZE;
  const offset = (page - 1) * limit;

  const whereClause = search?.trim()
    ? (() => {
        const pat = `%${search.trim()}%`;
        return sql`${customers.name} ILIKE ${pat} OR ${customers.email} ILIKE ${pat} OR ${customers.whatsapp} ILIKE ${pat}`;
      })()
    : undefined;

  // Ordenação: só chaves da whitelist entram; direção limitada a asc/desc.
  const paidOrderCountExpr = sql`count(${orders.id}) filter (where ${orders.status} = 'paid')`;
  const totalSpentExpr = sql`coalesce(sum(${orders.totalCents}) filter (where ${orders.status} = 'paid'), 0)`;
  const lastOrderExpr = sql`max(${orders.createdAt})`;
  const sortColumn: Record<CustomerSortKey, ReturnType<typeof sql>> = {
    name: sql`${customers.name}`,
    whatsapp: sql`${customers.whatsapp}`,
    orders: paidOrderCountExpr,
    total: totalSpentExpr,
    last: lastOrderExpr,
    first: sql`${customers.createdAt}`,
  };
  const sortKey = (CUSTOMER_SORT_KEYS as readonly string[]).includes(params.sort ?? "")
    ? (params.sort as CustomerSortKey)
    : "first";
  const dirSql = params.dir === "asc" ? sql`asc` : sql`desc`;
  const orderBy = sql`${sortColumn[sortKey]} ${dirSql} nulls last`;

  const selectShape = {
    id: customers.id,
    name: customers.name,
    email: customers.email,
    whatsapp: customers.whatsapp,
    orderCount: sql<number>`count(${orders.id})`,
    paidOrderCount: sql<number>`count(${orders.id}) filter (where ${orders.status} = 'paid')`,
    totalSpentCents: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.status} = 'paid'), 0)`,
    lastOrderAt: sql<Date | null>`max(${orders.createdAt})`,
    firstSeenAt: customers.createdAt,
  };

  const [totalRow] = whereClause
    ? await db.select({ total: count() }).from(customers).where(whereClause)
    : await db.select({ total: count() }).from(customers);

  const rows = whereClause
    ? await db
        .select(selectShape)
        .from(customers)
        .leftJoin(orders, eq(orders.customerId, customers.id))
        .where(whereClause)
        .groupBy(customers.id)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset)
    : await db
        .select(selectShape)
        .from(customers)
        .leftJoin(orders, eq(orders.customerId, customers.id))
        .groupBy(customers.id)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset);

  return { rows, total: Number(totalRow.total) };
}

export async function getAdminCustomerById(id: string): Promise<(CustomerRow & { orders: { id: string; status: string; totalCents: number; createdAt: Date }[] }) | null> {
  await requireModule("pedidos");
  const db = await getDb();
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);

  if (!customer) return null;

  const customerOrders = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.customerId, id))
    .orderBy(desc(orders.createdAt));

  const paidOrders = customerOrders.filter((o) => o.status === "paid");

  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    whatsapp: customer.whatsapp,
    orderCount: customerOrders.length,
    paidOrderCount: paidOrders.length,
    totalSpentCents: paidOrders.reduce((acc, o) => acc + o.totalCents, 0),
    lastOrderAt: customerOrders[0]?.createdAt ?? null,
    firstSeenAt: customer.createdAt,
    orders: customerOrders,
  };
}
