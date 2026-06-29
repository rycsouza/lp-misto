import { NextRequest, NextResponse } from "next/server";
import { cancelExpiredPendingOrders } from "@/app/actions/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Endpoint interno por-tenant: o cron (fan-out) chama isto no DOMÍNIO de cada
// tenant, então o contexto de tenant é resolvido pelo host (proxy → x-tenant-slug
// → getDb). Protegido por INTERNAL_CRON_SECRET — não é público.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.INTERNAL_CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await cancelExpiredPendingOrders();
  return NextResponse.json(result);
}
