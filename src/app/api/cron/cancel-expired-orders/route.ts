import { NextResponse } from "next/server";
import { cancelExpiredPendingOrders } from "@/app/actions/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await cancelExpiredPendingOrders();
  return NextResponse.json(result);
}
