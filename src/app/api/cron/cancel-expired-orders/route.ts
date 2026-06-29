import { NextResponse } from "next/server";
import { getPlatformDb } from "@/lib/db/platform/client";
import { organizations, organizationDomains } from "@/lib/db/platform/schema";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron multi-tenant (fan-out): lista os tenants ativos no platform DB e dispara
// o endpoint interno de expiração no DOMÍNIO de cada um, para que a expiração rode
// no contexto de tenant correto (host → getDb). Não usa o DB padrão.
export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const internalSecret = process.env.INTERNAL_CRON_SECRET;
  if (!internalSecret) {
    return NextResponse.json({ error: "INTERNAL_CRON_SECRET não configurado" }, { status: 500 });
  }

  const platformDb = getPlatformDb();
  const tenants = await platformDb
    .select({ slug: organizations.slug, domain: organizationDomains.domain })
    .from(organizations)
    .innerJoin(organizationDomains, eq(organizationDomains.orgId, organizations.id))
    .where(and(eq(organizations.status, "active"), eq(organizationDomains.isPrimary, true)));

  const results: Array<{ slug: string; ok: boolean; cancelled?: number; error?: string }> = [];
  for (const t of tenants) {
    // Pula domínios não-roteáveis (ex.: localhost cadastrado p/ dev).
    if (!t.domain || t.domain === "localhost" || t.domain.startsWith("127.")) continue;
    try {
      const res = await fetch(`https://${t.domain}/api/internal/expire-orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${internalSecret}` },
        signal: AbortSignal.timeout(20_000),
      });
      const body = (await res.json().catch(() => ({}))) as { cancelled?: number };
      results.push({ slug: t.slug, ok: res.ok, cancelled: body.cancelled });
    } catch (err) {
      results.push({ slug: t.slug, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ tenants: results.length, results });
}
