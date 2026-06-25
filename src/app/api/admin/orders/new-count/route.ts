import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/actions/admin-auth";
import { getDb } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { eq, and, gt, count } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const db = await getDb();
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : new Date(0);

  const [row] = await db
    .select({ total: count() })
    .from(orders)
    .where(and(eq(orders.status, "pending"), gt(orders.createdAt, since)));

  return NextResponse.json({ count: Number(row.total) });
}
