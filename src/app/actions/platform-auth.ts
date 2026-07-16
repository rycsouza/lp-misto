"use server";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getPlatformDb } from "@/lib/db/platform/client";
import { platformAdmins } from "@/lib/db/platform/schema";

/**
 * Sessão do ADMIN DO SISTEMA (plataforma). Escopo separado do admin de tenant:
 * cookie próprio, segredo próprio e claim `scope:"platform"`. NUNCA é derivada
 * do token de tenant, e vice-versa — os dois níveis não se confundem.
 */
export interface PlatformSession {
  adminId: string;
  email: string;
  name: string;
  scope: "platform";
}

const PLATFORM_COOKIE = "sport55_platform_token";

/**
 * Segredo dedicado do JWT de plataforma. Preferimos PLATFORM_JWT_SECRET; caímos
 * para ADMIN_JWT_SECRET só para não derrubar ambientes que ainda não o definiram
 * (com aviso). NÃO reutilizar o ENCRYPTION_KEY de pagamentos.
 */
function getPlatformJwtSecret(): Uint8Array {
  const dedicated = process.env.PLATFORM_JWT_SECRET;
  if (!dedicated && process.env.NODE_ENV === "production") {
    console.warn(
      "[platform-auth] PLATFORM_JWT_SECRET ausente — usando ADMIN_JWT_SECRET como fallback. Defina um PLATFORM_JWT_SECRET dedicado."
    );
  }
  const secret = dedicated ?? process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("PLATFORM_JWT_SECRET ou ADMIN_JWT_SECRET não configurado");
  return new TextEncoder().encode(secret);
}

async function createPlatformToken(session: PlatformSession, durationHours = 12): Promise<string> {
  return new SignJWT({
    adminId: session.adminId,
    email: session.email,
    name: session.name,
    scope: "platform",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${durationHours}h`)
    .sign(getPlatformJwtSecret());
}

/**
 * Verifica o token de plataforma e confirma o admin no platform DB (ativo).
 * Fonte única de verdade — se o admin for desativado, a sessão cai na hora.
 * Retorna null em qualquer falha (fail-closed).
 */
export async function getPlatformSession(): Promise<PlatformSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(PLATFORM_COOKIE)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getPlatformJwtSecret(), { algorithms: ["HS256"] });
    if (payload.scope !== "platform") return null;
    const adminId = payload.adminId as string;
    if (!adminId) return null;

    const [admin] = await getPlatformDb()
      .select({ id: platformAdmins.id, email: platformAdmins.email, name: platformAdmins.name, active: platformAdmins.active })
      .from(platformAdmins)
      .where(eq(platformAdmins.id, adminId))
      .limit(1);

    if (!admin || !admin.active) return null;

    return { adminId: admin.id, email: admin.email, name: admin.name, scope: "platform" };
  } catch {
    return null;
  }
}

export async function platformLogin(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { success: false, error: "E-mail e senha são obrigatórios" };
  }

  const db = getPlatformDb();
  const [admin] = await db
    .select()
    .from(platformAdmins)
    .where(and(eq(platformAdmins.email, email), eq(platformAdmins.active, true)))
    .limit(1);

  // Compara sempre (mesmo sem usuário) para não vazar existência por timing.
  const hash = admin?.passwordHash ?? "$2a$12$0000000000000000000000000000000000000000000000000000";
  const valid = await bcrypt.compare(password, hash);
  if (!admin || !valid) {
    return { success: false, error: "Credenciais inválidas" };
  }

  await db.update(platformAdmins).set({ lastLoginAt: new Date() }).where(eq(platformAdmins.id, admin.id));

  const token = await createPlatformToken({
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    scope: "platform",
  });

  const cookieStore = await cookies();
  cookieStore.set(PLATFORM_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
    path: "/",
  });

  redirect("/admin/sistema");
}

export async function platformLogout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PLATFORM_COOKIE);
  cookieStore.delete("sport55_ctx_tenant"); // limpa o contexto de clube junto
  redirect("/admin/sistema/login");
}
