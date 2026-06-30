"use server";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { adminUsers, adminInvites, siteConfig } from "@/lib/db/schema";
import { eq, and, gt, isNull, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { sendInviteEmail } from "@/lib/email-admin";
import { getAppBaseUrl } from "@/lib/base-url";
import { getFirstAccessibleRoute } from "@/lib/admin/nav";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: "admin" | "editor";
  permissions: Record<string, boolean>;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor";
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  permissions: Record<string, boolean>;
  invitedBy: string | null;
}

export interface PendingInviteRow {
  id: string;
  token: string;
  email: string;
  name: string;
  role: "admin" | "editor";
  expiresAt: Date;
  createdAt: Date;
}

export type { AdminPermissions } from "@/lib/db/schema/admin-auth";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getJwtSecret() {
  const dedicated = process.env.ADMIN_JWT_SECRET;
  // Segurança: o segredo do JWT NÃO deve ser o mesmo ENCRYPTION_KEY que cifra as
  // credenciais de pagamento (vazar um comprometeria o outro). Mantemos o
  // fallback para não derrubar produção, mas avisamos para forçar a correção.
  if (!dedicated && process.env.NODE_ENV === "production") {
    console.warn(
      "[auth] ADMIN_JWT_SECRET ausente — usando ENCRYPTION_KEY como fallback (reuso de segredo). Defina um ADMIN_JWT_SECRET dedicado na Vercel."
    );
  }
  const secret = dedicated ?? process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("ADMIN_JWT_SECRET ou ENCRYPTION_KEY não configurado");
  return new TextEncoder().encode(secret);
}

async function createSessionToken(session: AdminSession, durationHours = 24): Promise<string> {
  return new SignJWT({
    userId: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
    permissions: session.permissions,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${durationHours}h`)
    .sign(getJwtSecret());
}

async function setSessionCookie(token: string, durationHours = 24) {
  const cookieStore = await cookies();
  cookieStore.set("misto_admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * durationHours,
    path: "/",
  });
}

async function getSessionDurationHours(): Promise<number> {
  const db = await getDb();
  try {
    const [row] = await db
      .select({ value: siteConfig.value })
      .from(siteConfig)
      .where(eq(siteConfig.key, "sessionDurationHours"))
      .limit(1);
    const parsed = row ? parseInt(row.value, 10) : NaN;
    return isNaN(parsed) || parsed < 1 ? 24 : parsed;
  } catch {
    return 24;
  }
}

// ─── Auth Actions ─────────────────────────────────────────────────────────────

export async function adminLogin(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { success: false, error: "E-mail e senha são obrigatórios" };
  }

  const rows = await db
    .select()
    .from(adminUsers)
    .where(and(eq(adminUsers.email, email), eq(adminUsers.active, true)))
    .limit(1);

  const user = rows[0];
  if (!user) {
    return { success: false, error: "Credenciais inválidas" };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { success: false, error: "Credenciais inválidas" };
  }

  // Update last login
  await db
    .update(adminUsers)
    .set({ lastLoginAt: new Date() })
    .where(eq(adminUsers.id, user.id));

  const session: AdminSession = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "admin" | "editor",
    permissions: (user.permissions as Record<string, boolean>) ?? {},
  };

  const durationHours = await getSessionDurationHours();
  const token = await createSessionToken(session, durationHours);
  await setSessionCookie(token, durationHours);

  redirect(getFirstAccessibleRoute(session.role, session.permissions));
}

export async function adminLogout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("misto_admin_token");
  redirect("/admin/login");
}

export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("misto_admin_token")?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ["HS256"] });
    const userId = payload.userId as string;
    if (!userId) return null;

    // Permissões sempre vindas do DB — garante que mudanças pelo admin
    // entram em vigor imediatamente, sem precisar de logout/login.
    const db = await getDb();
    const [user] = await db
      .select({ role: adminUsers.role, permissions: adminUsers.permissions, active: adminUsers.active })
      .from(adminUsers)
      .where(eq(adminUsers.id, userId))
      .limit(1);

    if (!user || !user.active) return null;

    return {
      userId,
      email: payload.email as string,
      name: payload.name as string,
      role: user.role as "admin" | "editor",
      permissions: (user.permissions as Record<string, boolean>) ?? {},
    };
  } catch {
    return null;
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getAdminUsersList(): Promise<AdminUserRow[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(adminUsers)
    .orderBy(desc(adminUsers.createdAt));

  return rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as "admin" | "editor",
    active: u.active,
    lastLoginAt: u.lastLoginAt ?? null,
    createdAt: u.createdAt,
    permissions: (u.permissions as Record<string, boolean>) ?? {},
    invitedBy: u.invitedBy ?? null,
  }));
}

export async function updateAdminUser(
  id: string,
  data: {
    name?: string;
    role?: "admin" | "editor";
    permissions?: Record<string, boolean>;
    active?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return { success: false, error: "Acesso negado" };
  }

  try {
    const updateData: Partial<typeof adminUsers.$inferInsert> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.permissions !== undefined) updateData.permissions = data.permissions;
    if (data.active !== undefined) updateData.active = data.active;

    await db.update(adminUsers).set(updateData).where(eq(adminUsers.id, id));
    return { success: true };
  } catch (err) {
    console.error("updateAdminUser error:", err);
    return { success: false, error: "Erro ao atualizar usuário" };
  }
}

// ─── Invites ─────────────────────────────────────────────────────────────────

export async function inviteUser(input: {
  name: string;
  email: string;
  role: "admin" | "editor";
  permissions: Record<string, boolean>;
}): Promise<{ success: boolean; inviteLink?: string; error?: string }> {
  const db = await getDb();
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return { success: false, error: "Apenas admins podem convidar usuários" };
  }

  const email = input.email.toLowerCase().trim();

  // Check if email already has an account
  const existing = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  if (existing.length > 0) {
    return { success: false, error: "Este e-mail já possui uma conta" };
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(adminInvites).values({
    token,
    email,
    name: input.name,
    role: input.role,
    permissions: input.permissions,
    invitedBy: session.userId,
    expiresAt,
  });

  const appUrl = (await getAppBaseUrl()).replace(/\/$/, "");
  const inviteLink = `${appUrl}/admin/aceitar-convite?token=${token}`;

  await sendInviteEmail({
    to: email,
    inviteeName: input.name,
    inviterName: session.name,
    role: input.role,
    inviteLink,
  });

  return { success: true, inviteLink };
}

export async function getInviteByToken(token: string): Promise<{
  valid: boolean;
  name?: string;
  email?: string;
  expired?: boolean;
  alreadyAccepted?: boolean;
}> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(adminInvites)
    .where(eq(adminInvites.token, token))
    .limit(1);

  const invite = rows[0];
  if (!invite) return { valid: false };

  if (invite.acceptedAt) return { valid: false, alreadyAccepted: true };
  if (invite.expiresAt < new Date()) return { valid: false, expired: true };

  return { valid: true, name: invite.name, email: invite.email };
}

export async function acceptInvite(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!token || !password || !confirmPassword) {
    return { success: false, error: "Todos os campos são obrigatórios" };
  }

  if (password !== confirmPassword) {
    return { success: false, error: "As senhas não coincidem" };
  }

  if (password.length < 8) {
    return { success: false, error: "A senha deve ter no mínimo 8 caracteres" };
  }

  const rows = await db
    .select()
    .from(adminInvites)
    .where(eq(adminInvites.token, token))
    .limit(1);

  const invite = rows[0];
  if (!invite) return { success: false, error: "Convite inválido" };
  if (invite.acceptedAt) return { success: false, error: "Este convite já foi utilizado" };
  if (invite.expiresAt < new Date()) return { success: false, error: "Este convite expirou" };

  const passwordHash = await bcrypt.hash(password, 12);

  const [newUser] = await db
    .insert(adminUsers)
    .values({
      email: invite.email,
      passwordHash,
      name: invite.name,
      role: invite.role as "admin" | "editor",
      permissions: invite.permissions,
      invitedBy: invite.invitedBy,
    })
    .returning();

  // Mark invite as accepted
  await db
    .update(adminInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(adminInvites.id, invite.id));

  // Auto login
  const session: AdminSession = {
    userId: newUser.id,
    email: newUser.email,
    name: newUser.name,
    role: newUser.role as "admin" | "editor",
    permissions: (newUser.permissions as Record<string, boolean>) ?? {},
  };

  const sessionToken = await createSessionToken(session);
  await setSessionCookie(sessionToken);

  redirect(getFirstAccessibleRoute(session.role, session.permissions));
}

export async function getPendingInvites(): Promise<PendingInviteRow[]> {
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .select()
    .from(adminInvites)
    .where(and(isNull(adminInvites.acceptedAt), gt(adminInvites.expiresAt, now)))
    .orderBy(desc(adminInvites.createdAt));

  return rows.map((i) => ({
    id: i.id,
    token: i.token,
    email: i.email,
    name: i.name,
    role: i.role as "admin" | "editor",
    expiresAt: i.expiresAt,
    createdAt: i.createdAt,
  }));
}

export async function resendInvite(
  inviteId: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return { success: false, error: "Acesso negado" };
  }

  const rows = await db
    .select()
    .from(adminInvites)
    .where(eq(adminInvites.id, inviteId))
    .limit(1);

  const invite = rows[0];
  if (!invite) return { success: false, error: "Convite não encontrado" };
  if (invite.acceptedAt) return { success: false, error: "Convite já aceito" };

  const newToken = crypto.randomUUID();
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db
    .update(adminInvites)
    .set({ token: newToken, expiresAt: newExpiresAt })
    .where(eq(adminInvites.id, inviteId));

  const appUrl = (await getAppBaseUrl()).replace(/\/$/, "");
  const inviteLink = `${appUrl}/admin/aceitar-convite?token=${newToken}`;

  await sendInviteEmail({
    to: invite.email,
    inviteeName: invite.name,
    inviterName: session.name,
    role: invite.role as "admin" | "editor",
    inviteLink,
  });

  return { success: true };
}

export async function deleteInvite(
  inviteId: string
): Promise<{ success: boolean }> {
  const db = await getDb();
  const session = await getAdminSession();
  if (!session || session.role !== "admin") return { success: false };
  await db.delete(adminInvites).where(eq(adminInvites.id, inviteId));
  return { success: true };
}
