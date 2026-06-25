"use server";

import { getDb } from "@/lib/db/client";
import { customers, orders } from "@/lib/db/schema";
import { eq, desc, ilike, sql, count } from "drizzle-orm";

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
} = {}): Promise<{ rows: CustomerRow[]; total: number }> {
  const db = await getDb();
  const { page = 1, search } = params;
  const limit = 30;
  const offset = (page - 1) * limit;

  // Total count with search
  const totalQuery = db
    .select({ total: count() })
    .from(customers);

  if (search?.trim()) {
    const pat = `%${search.trim()}%`;
    const [totalRow] = await db
      .select({ total: count() })
      .from(customers)
      .where(
        sql`${customers.name} ILIKE ${pat} OR ${customers.email} ILIKE ${pat} OR ${customers.whatsapp} ILIKE ${pat}`
      );
    const [countRow] = [totalRow];

    const rows = await db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        whatsapp: customers.whatsapp,
        orderCount: sql<number>`count(${orders.id})`,
        paidOrderCount: sql<number>`count(${orders.id}) filter (where ${orders.status} = 'paid')`,
        totalSpentCents: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.status} = 'paid'), 0)`,
        lastOrderAt: sql<Date | null>`max(${orders.createdAt})`,
        firstSeenAt: customers.createdAt,
      })
      .from(customers)
      .leftJoin(orders, eq(orders.customerId, customers.id))
      .where(
        sql`${customers.name} ILIKE ${pat} OR ${customers.email} ILIKE ${pat} OR ${customers.whatsapp} ILIKE ${pat}`
      )
      .groupBy(customers.id)
      .orderBy(desc(customers.createdAt))
      .limit(limit)
      .offset(offset);

    return { rows, total: Number(countRow.total) };
  }

  const [totalRow] = await totalQuery;

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      whatsapp: customers.whatsapp,
      orderCount: sql<number>`count(${orders.id})`,
      paidOrderCount: sql<number>`count(${orders.id}) filter (where ${orders.status} = 'paid')`,
      totalSpentCents: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.status} = 'paid'), 0)`,
      lastOrderAt: sql<Date | null>`max(${orders.createdAt})`,
      firstSeenAt: customers.createdAt,
    })
    .from(customers)
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .groupBy(customers.id)
    .orderBy(desc(customers.createdAt))
    .limit(limit)
    .offset(offset);

  return { rows, total: Number(totalRow.total) };
}

export async function getAdminCustomerById(id: string): Promise<(CustomerRow & { orders: { id: string; status: string; totalCents: number; createdAt: Date }[] }) | null> {
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
