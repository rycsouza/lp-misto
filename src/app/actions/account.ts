"use server";

/**
 * Área logada do cliente (/conta). ATENÇÃO: todo export deste arquivo é um
 * endpoint POST público — cada action valida a entrada, aplica limite e, quando
 * age sobre dados, exige a sessão (getCustomerAccount). A conta só enxerga
 * pedidos e sócio do PRÓPRIO e-mail confirmado.
 */
import { z } from "zod";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { customerAccounts, members, membershipPlans } from "@/lib/db/schema";
import { getClientIp, rateLimit } from "@/lib/ratelimit";
import { getAppBaseUrl, getCurrentTenantSlug } from "@/lib/base-url";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/accounts/password";
import { signAccountToken, verifyAccountToken } from "@/lib/accounts/tokens";
import { endAccountSession, getCustomerAccount, startAccountSession } from "@/lib/accounts/session";

type Result = { ok: boolean; error?: string; message?: string };

const emailSchema = z.email("Informe um e-mail válido.").max(254);
const nameSchema = z.string().trim().min(2, "Informe seu nome.").max(120);
const whatsappSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v === "" || (v.length >= 10 && v.length <= 13), "WhatsApp inválido.");

const GENERIC_SIGNUP =
  "Se o e-mail puder ser usado, enviamos um link de confirmação. Confira sua caixa de entrada (e o spam).";
const GENERIC_RESET = "Se houver uma conta com este e-mail, enviamos o link para criar uma nova senha.";
const BAD_LOGIN = "E-mail ou senha incorretos.";
const UNAVAILABLE = "Área do cliente indisponível no momento. Tente mais tarde.";

async function baseUrl(): Promise<string> {
  return (await getAppBaseUrl()).replace(/\/$/, "");
}

async function limited(keys: [string, number, number][]): Promise<boolean> {
  const results = await Promise.all(keys.map(([k, n, w]) => rateLimit(k, n, w)));
  return results.some((r) => !r.ok);
}

async function findAccountByEmail(email: string) {
  const db = await getDb();
  const [acc] = await db
    .select({
      id: customerAccounts.id,
      name: customerAccounts.name,
      passwordHash: customerAccounts.passwordHash,
      emailVerifiedAt: customerAccounts.emailVerifiedAt,
      passwordChangedAt: customerAccounts.passwordChangedAt,
    })
    .from(customerAccounts)
    .where(eq(customerAccounts.email, email))
    .limit(1);
  return acc ?? null;
}

async function sendVerify(acc: { id: string; name: string; passwordChangedAt: Date }, email: string) {
  const t = await signAccountToken(
    "verify",
    { aid: acc.id, pwv: acc.passwordChangedAt.getTime() },
    await getCurrentTenantSlug()
  );
  if (!t) return false;
  const { sendAccountVerifyEmail } = await import("@/lib/email");
  return sendAccountVerifyEmail(email, acc.name, `${await baseUrl()}/api/conta/verificar?t=${encodeURIComponent(t)}`);
}

async function sendReset(acc: { id: string; passwordChangedAt: Date }, email: string, exists = false) {
  const t = await signAccountToken(
    "reset",
    { aid: acc.id, pwv: acc.passwordChangedAt.getTime() },
    await getCurrentTenantSlug()
  );
  if (!t) return false;
  const url = `${await baseUrl()}/conta/redefinir?t=${encodeURIComponent(t)}`;
  const mod = await import("@/lib/email");
  return exists ? mod.sendAccountExistsEmail(email, url) : mod.sendAccountResetEmail(email, url);
}

// ─── Criar conta ──────────────────────────────────────────────────────────────

/**
 * Cria a conta e envia a confirmação de e-mail. Resposta SEMPRE genérica (não
 * revela se o e-mail já tem conta): se já tiver, o dono recebe um e-mail para
 * redefinir a senha. Login só depois de confirmar o e-mail.
 */
export async function signupAccount(input: {
  name: string;
  email: string;
  password: string;
  whatsapp?: string;
  _hp?: string;
}): Promise<Result> {
  if (input?._hp) return { ok: true, message: GENERIC_SIGNUP };
  const parsed = z
    .object({ name: nameSchema, email: emailSchema, password: z.string(), whatsapp: whatsappSchema.optional() })
    .safeParse({ ...input, email: (input?.email ?? "").trim().toLowerCase() });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { name, email, password } = parsed.data;
  const problem = passwordProblem(password, email);
  if (problem) return { ok: false, error: problem };

  const ip = await getClientIp();
  if (await limited([[`rl:acc-signup:ip:${ip}`, 5, 3600], [`rl:acc-signup:em:${email}`, 3, 3600]])) {
    return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };
  }

  try {
    const existing = await findAccountByEmail(email);
    if (existing) {
      // Conta já existe: confirmada → e-mail de "redefinir senha"; não confirmada → reenvia confirmação.
      if (existing.emailVerifiedAt) await sendReset(existing, email, true);
      else await sendVerify(existing, email);
      return { ok: true, message: GENERIC_SIGNUP };
    }
    const db = await getDb();
    const [acc] = await db
      .insert(customerAccounts)
      .values({
        email,
        name,
        whatsapp: parsed.data.whatsapp || null,
        passwordHash: await hashPassword(password),
      })
      .onConflictDoNothing({ target: customerAccounts.email })
      .returning({ id: customerAccounts.id, name: customerAccounts.name, passwordChangedAt: customerAccounts.passwordChangedAt });
    if (acc) await sendVerify(acc, email);
    return { ok: true, message: GENERIC_SIGNUP };
  } catch (err) {
    console.error("[conta] signup error:", err);
    return { ok: false, error: UNAVAILABLE };
  }
}

/** Reenvia a confirmação de e-mail (resposta genérica). */
export async function resendAccountVerification(input: { email: string }): Promise<Result> {
  const parsed = emailSchema.safeParse((input?.email ?? "").trim().toLowerCase());
  if (!parsed.success) return { ok: false, error: "Informe um e-mail válido." };
  const email = parsed.data;
  const ip = await getClientIp();
  if (await limited([[`rl:acc-verify:ip:${ip}`, 5, 3600], [`rl:acc-verify:em:${email}`, 3, 3600]])) {
    return { ok: true, message: GENERIC_SIGNUP };
  }
  try {
    const acc = await findAccountByEmail(email);
    if (acc && !acc.emailVerifiedAt) await sendVerify(acc, email);
  } catch (err) {
    console.error("[conta] resend verify error:", err);
  }
  return { ok: true, message: GENERIC_SIGNUP };
}

// ─── Entrar / sair ────────────────────────────────────────────────────────────

export async function loginAccount(input: {
  email: string;
  password: string;
}): Promise<Result & { needsVerification?: boolean }> {
  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1).max(200) })
    .safeParse({ email: (input?.email ?? "").trim().toLowerCase(), password: input?.password });
  if (!parsed.success) return { ok: false, error: BAD_LOGIN };
  const { email, password } = parsed.data;

  const ip = await getClientIp();
  if (await limited([[`rl:acc-login:ip:${ip}`, 20, 600], [`rl:acc-login:em:${email}`, 8, 900]])) {
    return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }

  let acc: Awaited<ReturnType<typeof findAccountByEmail>>;
  try {
    acc = await findAccountByEmail(email);
  } catch (err) {
    console.error("[conta] login error:", err);
    return { ok: false, error: UNAVAILABLE };
  }
  // Compara sempre (hash fictício se não houver conta): tempo não revela o e-mail.
  const valid = await verifyPassword(password, acc?.passwordHash);
  if (!acc || !valid) return { ok: false, error: BAD_LOGIN };
  if (!acc.emailVerifiedAt) {
    await sendVerify(acc, email).catch(() => false);
    return {
      ok: false,
      needsVerification: true,
      error: "Confirme seu e-mail para entrar. Reenviamos o link de confirmação.",
    };
  }
  if (!(await startAccountSession(acc))) return { ok: false, error: UNAVAILABLE };
  const db = await getDb();
  await db.update(customerAccounts).set({ lastLoginAt: new Date() }).where(eq(customerAccounts.id, acc.id)).catch(() => {});
  return { ok: true };
}

export async function logoutAccount(): Promise<void> {
  await endAccountSession();
}

// ─── Senha: esqueci / redefinir / trocar ─────────────────────────────────────

export async function requestPasswordReset(input: { email: string }): Promise<Result> {
  const parsed = emailSchema.safeParse((input?.email ?? "").trim().toLowerCase());
  if (!parsed.success) return { ok: false, error: "Informe um e-mail válido." };
  const email = parsed.data;
  const ip = await getClientIp();
  if (await limited([[`rl:acc-reset:ip:${ip}`, 5, 3600], [`rl:acc-reset:em:${email}`, 3, 3600]])) {
    return { ok: true, message: GENERIC_RESET };
  }
  try {
    const acc = await findAccountByEmail(email);
    if (acc) await sendReset(acc, email);
  } catch (err) {
    console.error("[conta] reset request error:", err);
  }
  return { ok: true, message: GENERIC_RESET };
}

/**
 * Nova senha pelo link do e-mail. O link só vale para a versão de senha em que
 * foi emitido (usar uma vez invalida). Redefinir também CONFIRMA o e-mail (o link
 * chegou nele) e abre a sessão.
 */
export async function resetPassword(input: { token: string; password: string }): Promise<Result> {
  const claims = await verifyAccountToken("reset", input?.token ?? "", await getCurrentTenantSlug());
  if (!claims) return { ok: false, error: "Link inválido ou expirado. Peça um novo." };
  const ip = await getClientIp();
  if (await limited([[`rl:acc-reset-do:ip:${ip}`, 10, 3600]])) {
    return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };
  }
  try {
    const db = await getDb();
    const [acc] = await db
      .select({ id: customerAccounts.id, email: customerAccounts.email, passwordChangedAt: customerAccounts.passwordChangedAt, emailVerifiedAt: customerAccounts.emailVerifiedAt })
      .from(customerAccounts)
      .where(eq(customerAccounts.id, claims.aid))
      .limit(1);
    if (!acc || acc.passwordChangedAt.getTime() !== claims.pwv) {
      return { ok: false, error: "Link inválido ou já usado. Peça um novo." };
    }
    const problem = passwordProblem(input.password, acc.email);
    if (problem) return { ok: false, error: problem };
    const now = new Date();
    await db
      .update(customerAccounts)
      .set({ passwordHash: await hashPassword(input.password), passwordChangedAt: now, emailVerifiedAt: acc.emailVerifiedAt ?? now })
      .where(eq(customerAccounts.id, acc.id));
    await startAccountSession({ id: acc.id, passwordChangedAt: now });
    return { ok: true };
  } catch (err) {
    console.error("[conta] reset error:", err);
    return { ok: false, error: UNAVAILABLE };
  }
}

export async function changeMyPassword(input: { current: string; next: string }): Promise<Result> {
  const me = await getCustomerAccount();
  if (!me) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  if (await limited([[`rl:acc-pw:${me.id}`, 5, 900]])) return { ok: false, error: "Muitas tentativas. Aguarde." };
  const problem = passwordProblem(input?.next ?? "", me.email);
  if (problem) return { ok: false, error: problem };
  const db = await getDb();
  const [row] = await db
    .select({ hash: customerAccounts.passwordHash })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, me.id))
    .limit(1);
  if (!(await verifyPassword(input?.current ?? "", row?.hash))) return { ok: false, error: "Senha atual incorreta." };
  const now = new Date();
  await db
    .update(customerAccounts)
    .set({ passwordHash: await hashPassword(input.next), passwordChangedAt: now })
    .where(eq(customerAccounts.id, me.id));
  // Outras sessões caem (versão da senha mudou); esta continua.
  await startAccountSession({ id: me.id, passwordChangedAt: now });
  return { ok: true, message: "Senha alterada." };
}

// ─── Meus dados ───────────────────────────────────────────────────────────────

export async function updateMyProfile(input: { name: string; whatsapp?: string }): Promise<Result> {
  const me = await getCustomerAccount();
  if (!me) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  const parsed = z.object({ name: nameSchema, whatsapp: whatsappSchema.optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const db = await getDb();
  await db
    .update(customerAccounts)
    .set({ name: parsed.data.name, whatsapp: parsed.data.whatsapp || null })
    .where(eq(customerAccounts.id, me.id));
  return { ok: true, message: "Dados atualizados." };
}

// ─── Pedidos (do e-mail confirmado) ──────────────────────────────────────────

export async function getMyOrders() {
  const me = await getCustomerAccount();
  if (!me) return { ok: false as const, orders: [] };
  const { loadOrdersForVerifiedEmail } = await import("@/lib/orders/enrich");
  return { ok: true as const, orders: await loadOrdersForVerifiedEmail(me.email) };
}

// ─── Sócio-torcedor ───────────────────────────────────────────────────────────

async function findMyMember(email: string) {
  const db = await getDb();
  const [m] = await db
    .select({
      id: members.id,
      status: members.status,
      planId: members.planId,
      pendingPlanId: members.pendingPlanId,
      memberCardToken: members.memberCardToken,
      nextBillingDate: members.nextBillingDate,
      subscriptionId: members.subscriptionId,
      gatewaySlug: members.gatewaySlug,
    })
    .from(members)
    .where(sql`lower(${members.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return m ?? null;
}

export async function getMyMembership() {
  const me = await getCustomerAccount();
  if (!me) return { ok: false as const };
  const m = await findMyMember(me.email);
  if (!m) return { ok: true as const, member: null };

  const db = await getDb();
  const planIds = [m.planId, m.pendingPlanId].filter(Boolean) as string[];
  const planRows = planIds.length
    ? await db
        .select({ id: membershipPlans.id, name: membershipPlans.name, priceCents: membershipPlans.priceCents })
        .from(membershipPlans)
        .where(inArray(membershipPlans.id, planIds))
    : [];
  const planById = new Map(planRows.map((p) => [p.id, p]));

  let openInvoiceUrl: string | null = null;
  if (m.status === "pending" || m.status === "suspended") {
    const { getMemberOpenInvoiceUrl } = await import("@/lib/membership/sync");
    openInvoiceUrl = await getMemberOpenInvoiceUrl(m.id).catch(() => null);
  }
  const { getPublicMembershipPlans } = await import("@/app/actions/membership");
  const plans = await getPublicMembershipPlans();

  return {
    ok: true as const,
    member: {
      status: m.status,
      plan: m.planId ? planById.get(m.planId) ?? null : null,
      pendingPlan: m.pendingPlanId ? planById.get(m.pendingPlanId) ?? null : null,
      nextBillingDate: m.nextBillingDate?.toISOString() ?? null,
      cardPath: m.memberCardToken ? `/socios/carteirinha?token=${m.memberCardToken}` : null,
      openInvoiceUrl,
      // Troca de plano: só em dia, com assinatura no Asaas.
      canChangePlan: m.status === "active" && !!m.subscriptionId && !!m.gatewaySlug?.startsWith("asaas"),
    },
    plans: plans.map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents })),
  };
}

/** Logado: cancela direto (a sessão já prova que é o dono do e-mail). */
export async function cancelMyMembership(): Promise<Result & { benefitsUntil?: string | null }> {
  const me = await getCustomerAccount();
  if (!me) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  const m = await findMyMember(me.email);
  if (!m) return { ok: false, error: "Você não tem assinatura de sócio." };
  const { cancelMembership } = await import("@/lib/membership/cancel");
  const r = await cancelMembership(m.id);
  if (r.ok) return { ok: true, benefitsUntil: r.benefitsUntil?.toISOString() ?? null };
  if (r.error === "already_cancelled") return { ok: false, error: "Sua assinatura já está cancelada." };
  return { ok: false, error: "Não conseguimos cancelar agora. Tente novamente em alguns minutos." };
}

const cardSchema = z.object({
  holderName: z.string().trim().min(2).max(100),
  number: z.string().regex(/^\d{13,19}$/),
  expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/),
  expiryYear: z.string().regex(/^\d{4}$/),
  ccv: z.string().regex(/^\d{3,4}$/),
  postalCode: z.string().regex(/^\d{8}$/),
  addressNumber: z.string().trim().min(1).max(20),
});

/** Troca de plano (vale no próximo vencimento). Ver lib/membership/plan-change. */
export async function changeMyPlan(input: {
  planId: string;
  method: "card" | "pix";
  asaasCardData?: z.infer<typeof cardSchema>;
}): Promise<Result & { startsOn?: string; planName?: string }> {
  const me = await getCustomerAccount();
  if (!me) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  const parsed = z
    .object({ planId: z.string().uuid(), method: z.enum(["card", "pix"]), asaasCardData: cardSchema.optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira os dados informados." };
  if (await limited([[`rl:acc-plan:${me.id}`, 5, 3600]])) {
    return { ok: false, error: "Muitas tentativas de troca. Aguarde um pouco." };
  }
  const m = await findMyMember(me.email);
  if (!m) return { ok: false, error: "Você não tem assinatura de sócio." };

  const { checkCardAttemptLimit, CARD_RATE_LIMIT_ERROR } = await import("@/lib/payment/card-ratelimit");
  if (parsed.data.method === "card" && !(await checkCardAttemptLimit({ email: me.email, phone: me.whatsapp }))) {
    return { ok: false, error: CARD_RATE_LIMIT_ERROR };
  }

  const { changeMemberPlan } = await import("@/lib/membership/plan-change");
  const r = await changeMemberPlan({
    memberId: m.id,
    newPlanId: parsed.data.planId,
    method: parsed.data.method,
    asaasCardData: parsed.data.asaasCardData,
    remoteIp: await getClientIp(),
  });
  if (r.ok) return { ok: true, startsOn: r.startsOn, planName: r.planName };
  const messages: Record<string, string> = {
    not_active: "A troca de plano fica disponível com a assinatura em dia.",
    same_plan: "Este já é o seu plano.",
    plan_unavailable: "Este plano não está disponível.",
    unsupported_gateway: "A troca de plano não está disponível para a sua assinatura. Fale com o clube.",
    card_required: "Informe os dados do cartão.",
    gateway_error: "Não foi possível concluir a troca agora. Nada foi alterado — tente novamente.",
    not_found: "Você não tem assinatura de sócio.",
  };
  return { ok: false, error: messages[r.error] ?? "Não foi possível trocar de plano." };
}

// ─── Visão geral ──────────────────────────────────────────────────────────────

export async function getMyAccount(): Promise<{ name: string; email: string; whatsapp: string | null } | null> {
  const me = await getCustomerAccount();
  return me ? { name: me.name, email: me.email, whatsapp: me.whatsapp } : null;
}
