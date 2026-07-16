"use server";

import { desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPlatformDb } from "@/lib/db/platform/client";
import { organizations, organizationDomains } from "@/lib/db/platform/schema";
import { getPlatformSession } from "@/app/actions/platform-auth";

const CTX_COOKIE = "sport55_ctx_tenant";

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

/** Slug do clube atualmente em contexto (para a barra do painel). */
export async function getTenantContextSlug(): Promise<string | null> {
  const session = await getPlatformSession();
  if (!session) return null;
  const cookieStore = await cookies();
  return cookieStore.get(CTX_COOKIE)?.value ?? null;
}

/**
 * Entra no contexto de um clube (admin do sistema). Valida que a org existe e
 * está ativa ANTES de gravar o cookie — fail-closed. Depois o painel /admin
 * inteiro passa a operar sobre o DB desse clube (ver getDb).
 */
export async function enterTenantContext(slug: string): Promise<void> {
  const session = await getPlatformSession();
  if (!session) throw new Error("Não autorizado");

  const [org] = await getPlatformDb()
    .select({ slug: organizations.slug, status: organizations.status })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org || org.status !== "active") throw new Error("Clube inválido ou inativo");

  const cookieStore = await cookies();
  cookieStore.set(CTX_COOKIE, org.slug, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  redirect("/admin/dashboard");
}

/** Variante que aceita FormData (usada por forms: seletor da barra e botões do console). */
export async function enterTenantContextForm(formData: FormData): Promise<void> {
  await enterTenantContext(String(formData.get("slug") ?? ""));
}

/** Sai do contexto de clube e volta ao console do sistema. */
export async function exitTenantContext(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CTX_COOKIE);
  redirect("/admin/sistema");
}
