"use server";

import { desc } from "drizzle-orm";
import { getPlatformDb } from "@/lib/db/platform/client";
import { organizations, organizationDomains } from "@/lib/db/platform/schema";
import { getPlatformSession } from "@/app/actions/platform-auth";

export interface PlatformOrgRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  primaryDomain: string | null;
  createdAt: Date;
}

/**
 * Lista os clubes (organizations) para o console do sistema. SÓ admin de
 * plataforma — dado cross-tenant, jamais exposto ao admin de tenant.
 */
export async function getPlatformOrganizations(): Promise<PlatformOrgRow[]> {
  const session = await getPlatformSession();
  if (!session) throw new Error("Não autorizado");

  const db = getPlatformDb();
  const orgs = await db
    .select()
    .from(organizations)
    .orderBy(desc(organizations.createdAt));

  // Domínio primário de cada org (uma consulta simples por org; poucas orgs).
  const domains = await db
    .select({ orgId: organizationDomains.orgId, domain: organizationDomains.domain, isPrimary: organizationDomains.isPrimary })
    .from(organizationDomains);

  const primaryByOrg = new Map<string, string>();
  for (const d of domains) {
    if (d.isPrimary || !primaryByOrg.has(d.orgId)) primaryByOrg.set(d.orgId, d.domain);
  }

  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    status: o.status,
    plan: o.plan,
    primaryDomain: primaryByOrg.get(o.id) ?? null,
    createdAt: o.createdAt,
  }));
}
