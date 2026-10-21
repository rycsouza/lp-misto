"use server";

/**
 * Área logada do cliente (/conta). ATENÇÃO: todo export deste arquivo é um
 * endpoint POST público — cada action valida a entrada, aplica limite e, quando
 * age sobre dados, exige a sessão (getCustomerAccount).
 *
 * Login: WhatsApp + senha (o identificador que o cliente usa para comprar).
 * Como o WhatsApp NÃO é verificado, a conta só é ativada pelo link enviado ao
 * e-mail — é nesse link que a pessoa CRIA a senha (quem define a senha é sempre
 * o dono do e-mail: ninguém cria uma conta com o e-mail de outro e uma senha
 * que ele conhece). Se o WhatsApp já tem cadastro de compras, o link vai para o
 * e-mail DESSE cadastro (ninguém "reivindica" o telefone de outro cliente).
 * Pedidos e sócio são sempre os do e-mail confirmado da conta.
 */
import { z } from "zod";
import { after } from "next/server";
import { eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { customerAccounts, customers, members, membershipPlans } from "@/lib/db/schema";
import { getSiteConfig } from "@/lib/config";
import { getClientIp, rateLimit } from "@/lib/ratelimit";
import { getAppBaseUrl, getCurrentTenantSlug } from "@/lib/base-url";
import { hashPassword, passwordProblem, UNUSABLE_PASSWORD_HASH, verifyPassword } from "@/lib/accounts/password";
import { signAccountToken, verifyAccountToken } from "@/lib/accounts/tokens";
import { endAccountSession, getCustomerAccount, startAccountSession } from "@/lib/accounts/session";
import { maskEmail, normalizeAccountPhone } from "@/lib/accounts/identity";
import { wallNameSchema } from "@/lib/membership/wall-name";
import { getMemberDiscountForEmail } from "@/lib/membership/discount";
import { buildGoogleWalletSaveUrl, isGoogleWalletConfigured } from "@/lib/wallet/google";

type Result = { ok: boolean; error?: string; message?: string };
type Db = Awaited<ReturnType<typeof getDb>>;
type AccountRef = { id: string; name: string; email: string; passwordChangedAt: Date };

const emailSchema = z.email("Informe um e-mail válido.").max(254);
const nameSchema = z.string().trim().min(2, "Informe seu nome.").max(120);
const identitySchema = z.object({ name: nameSchema, email: emailSchema });

const INVALID_PHONE = "Informe um WhatsApp válido, com DDD.";
// Validades: redefinição 1h e criação de senha 48h (ver lib/accounts/tokens.ts).
const GENERIC_RESET =
  "Se este WhatsApp tiver cadastro, enviamos ao e-mail cadastrado um LINK para criar ou redefinir sua senha. Confira a caixa de entrada e o spam — o link vale por 1 hora (redefinição) ou 48 horas (criação).";
const BAD_LOGIN =
  "WhatsApp ou senha incorretos. Acabou de criar a conta? Crie sua senha pelo LINK que enviamos ao seu e-mail.";
const LINK_GONE = "Este link expirou ou já foi usado. Peça um novo.";
const UNAVAILABLE = "Área do cliente indisponível no momento. Tente mais tarde.";
const TOO_MANY = "Muitas tentativas. Aguarde alguns minutos.";

/** Mesma resposta para cadastro novo e já existente: não revela se havia conta. */
const sentTo = (email: string) =>
  `Enviamos o link para ${maskEmail(email)}. Abra o e-mail e toque em "Criar minha senha". Confira também o spam. O link vale por 48 horas.`;

/**
 * Roda o trabalho (consultas + e-mail) DEPOIS da resposta. Assim o tempo de resposta
 * não depende de existir conta/cadastro nem da latência do SMTP. Erros só viram log
 * (sem mensagem nem stack: podem trazer dados do destinatário).
 */
function runAfterResponse(job: () => Promise<unknown>): void {
  after(async () => {
    try {
      await job();
    } catch (err) {
      console.error("[conta] tarefa em segundo plano falhou:", err instanceof Error ? err.name : "erro");
    }
  });
}

async function baseUrl(): Promise<string> {
  return (await getAppBaseUrl()).replace(/\/$/, "");
}

async function limited(keys: [string, number, number][]): Promise<boolean> {
  const results = await Promise.all(keys.map(([k, n, w]) => rateLimit(k, n, w)));
  return results.some((r) => !r.ok);
}

const accountCols = {
  id: customerAccounts.id,
  name: customerAccounts.name,
  email: customerAccounts.email,
  whatsapp: customerAccounts.whatsapp,
  passwordHash: customerAccounts.passwordHash,
  emailVerifiedAt: customerAccounts.emailVerifiedAt,
  passwordChangedAt: customerAccounts.passwordChangedAt,
};

/**
 * Conta pelo login digitado: WhatsApp (padrão) ou, para contas antigas criadas
 * só com e-mail, o próprio e-mail.
 */
async function findAccountByLogin(login: string) {
  const db = await getDb();
  const phone = normalizeAccountPhone(login);
  const email = login.includes("@") ? login.trim().toLowerCase() : null;
  if (!phone && !email) return null;
  const [acc] = await db
    .select(accountCols)
    .from(customerAccounts)
    .where(phone ? eq(customerAccounts.whatsapp, phone) : eq(customerAccounts.email, email!))
    .limit(1);
  return acc ?? null;
}

/**
 * Link para CRIAR a senha (/conta/redefinir?novo=1). Token de uso "verify" (48h),
 * preso à versão de senha atual — criar a senha o invalida.
 */
async function verifyLink(acc: { id: string; passwordChangedAt: Date }): Promise<string | null> {
  const t = await signAccountToken(
    "verify",
    { aid: acc.id, pwv: acc.passwordChangedAt.getTime() },
    await getCurrentTenantSlug()
  );
  return t ? `${await baseUrl()}/conta/redefinir?t=${encodeURIComponent(t)}&novo=1` : null;
}

/** Conta pendente: "Crie sua senha" (link de criar senha). */
async function sendVerify(acc: { id: string; name: string; passwordChangedAt: Date }, email: string) {
  const url = await verifyLink(acc);
  if (!url) return false;
  const { sendAccountVerifyEmail } = await import("@/lib/email");
  return sendAccountVerifyEmail(email, acc.name, url);
}

/** Conta criada agora a partir de um pedido de "esqueci a senha" (sem conta antes). */
async function sendCreate(acc: { id: string; passwordChangedAt: Date }, email: string) {
  const url = await verifyLink(acc);
  if (!url) return false;
  const { sendAccountCreateEmail } = await import("@/lib/email");
  return sendAccountCreateEmail(email, url);
}

/** Redefinição (link de 1h, invalida ao trocar a senha). `exists`: aviso a quem tentou criar conta já existente. */
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

/**
 * Caminho ÚNICO de "conta pendente" (cadastro e esqueci-a-senha sem conta). Recebe
 * identidade JÁ validada e NÃO envia nada: quem chama escolhe o e-mail de destino.
 * - conta ATIVA (pelo WhatsApp ou pelo e-mail) → devolve a ativa, nada é alterado;
 * - conta pendente → reaproveita uma e descarta as demais (WhatsApp e e-mail são
 *   únicos), com nova versão de senha: links enviados antes deixam de valer;
 * - sem conta → cria, sem senha (quem cria a senha é o dono do e-mail, pelo link).
 */
async function upsertPendingAccount(
  db: Db,
  identity: { phone: string; name: string; email: string }
): Promise<{ kind: "active" | "new" | "pending"; acc: AccountRef } | null> {
  const { phone, name, email } = identity;
  const existing = await db
    .select(accountCols)
    .from(customerAccounts)
    .where(or(eq(customerAccounts.whatsapp, phone), eq(customerAccounts.email, email)));
  const active = existing.find((a) => a.emailVerifiedAt);
  if (active) return { kind: "active", acc: active };

  const passwordHash = UNUSABLE_PASSWORD_HASH;
  const now = new Date();
  const ref = {
    id: customerAccounts.id,
    name: customerAccounts.name,
    email: customerAccounts.email,
    passwordChangedAt: customerAccounts.passwordChangedAt,
  };
  if (existing.length > 0) {
    const [keep, ...rest] = existing;
    if (rest.length) await db.delete(customerAccounts).where(inArray(customerAccounts.id, rest.map((a) => a.id)));
    const [acc] = await db
      .update(customerAccounts)
      .set({ name, email, whatsapp: phone, passwordHash, passwordChangedAt: now })
      .where(eq(customerAccounts.id, keep.id))
      .returning(ref);
    return acc ? { kind: "pending", acc } : null;
  }
  const [acc] = await db
    .insert(customerAccounts)
    .values({ email, name, whatsapp: phone, passwordHash })
    .onConflictDoNothing()
    .returning(ref);
  return acc ? { kind: "new", acc } : null;
}

// ─── Criar conta ──────────────────────────────────────────────────────────────

/**
 * Cria a conta pelo WhatsApp e envia ao e-mail o link para criar a senha (a
 * conta só funciona depois disso).
 *
 * - WhatsApp com cadastro de compras → nome/e-mail vêm DESSE cadastro (o que o
 *   client mandar é ignorado): o link chega ao dono do cadastro.
 * - WhatsApp sem cadastro → usa nome/e-mail informados.
 * - Já existe conta ATIVA (pelo WhatsApp ou pelo e-mail) → nada muda; o dono
 *   recebe um e-mail para redefinir a senha. Conta ainda não ativada é
 *   substituída (ninguém "segura" um WhatsApp sem ter o e-mail).
 */
export async function signupAccount(input: {
  whatsapp: string;
  name?: string;
  email?: string;
  _hp?: string;
}): Promise<Result> {
  if (input?._hp) return { ok: true, message: "Enviamos o link para você criar sua senha. Confira seu e-mail." };
  const phone = normalizeAccountPhone(input?.whatsapp);
  if (!phone) return { ok: false, error: INVALID_PHONE };

  const ip = await getClientIp();
  if (await limited([[`rl:acc-signup:ip:${ip}`, 5, 3600], [`rl:acc-signup:tel:${phone}`, 3, 3600]])) {
    return { ok: false, error: TOO_MANY };
  }

  try {
    const db = await getDb();
    // Identidade: a do cadastro de compras deste WhatsApp, se houver.
    const [stored] = await db
      .select({ name: customers.name, email: customers.email })
      .from(customers)
      .where(eq(customers.whatsapp, phone))
      .limit(1);
    const parsed = identitySchema.safeParse(
      stored
        ? { name: stored.name, email: stored.email.trim().toLowerCase() }
        : { name: input?.name, email: (input?.email ?? "").trim().toLowerCase() }
    );
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const { name, email } = parsed.data;

    const r = await upsertPendingAccount(db, { phone, name, email });
    // O e-mail sai depois da resposta; a resposta é a mesma em todos os casos.
    if (r?.kind === "active") runAfterResponse(() => sendReset(r.acc, r.acc.email, true));
    else if (r) runAfterResponse(() => sendVerify(r.acc, r.acc.email));
    return { ok: true, message: sentTo(email) };
  } catch (err) {
    console.error("[conta] signup error:", err);
    return { ok: false, error: UNAVAILABLE };
  }
}

/** Reenvia o link de criar senha para conta pendente (resposta genérica). */
export async function resendAccountVerification(input: { whatsapp: string }): Promise<Result> {
  const generic = { ok: true, message: "Se a conta estiver aguardando a criação de senha, reenviamos o LINK para o e-mail cadastrado." };
  const phone = normalizeAccountPhone(input?.whatsapp);
  if (!phone) return { ok: false, error: INVALID_PHONE };
  const ip = await getClientIp();
  if (await limited([[`rl:acc-verify:ip:${ip}`, 5, 3600], [`rl:acc-verify:tel:${phone}`, 3, 3600]])) {
    return generic;
  }
  runAfterResponse(async () => {
    const acc = await findAccountByLogin(phone);
    if (acc && !acc.emailVerifiedAt) await sendVerify(acc, acc.email);
  });
  return generic;
}

// ─── Entrar / sair ────────────────────────────────────────────────────────────

export async function loginAccount(input: {
  login: string;
  password: string;
}): Promise<Result & { needsVerification?: boolean }> {
  const login = typeof input?.login === "string" ? input.login.trim().slice(0, 254) : "";
  const password = typeof input?.password === "string" ? input.password : "";
  if (!login || !password || password.length > 200) return { ok: false, error: BAD_LOGIN };
  const key = normalizeAccountPhone(login) ?? login.toLowerCase();

  const ip = await getClientIp();
  if (await limited([[`rl:acc-login:ip:${ip}`, 20, 600], [`rl:acc-login:id:${key}`, 8, 900]])) {
    return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }

  let acc: Awaited<ReturnType<typeof findAccountByLogin>>;
  try {
    acc = await findAccountByLogin(login);
  } catch (err) {
    console.error("[conta] login error:", err);
    return { ok: false, error: UNAVAILABLE };
  }
  // Compara sempre (hash fictício se não houver conta): tempo não revela o cadastro.
  const valid = await verifyPassword(password, acc?.passwordHash);
  if (!acc || !valid) return { ok: false, error: BAD_LOGIN };
  if (!acc.emailVerifiedAt) {
    await sendVerify(acc, acc.email).catch(() => false);
    return {
      ok: false,
      needsVerification: true,
      error: `Sua conta ainda não foi ativada. Reenviamos um LINK para criar sua senha ao e-mail ${maskEmail(acc.email)}. Abra o e-mail e toque em "Criar minha senha".`,
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

export async function requestPasswordReset(input: { whatsapp: string }): Promise<Result> {
  const login = typeof input?.whatsapp === "string" ? input.whatsapp.trim().slice(0, 254) : "";
  const phone = normalizeAccountPhone(login);
  const key = phone ?? (login.includes("@") ? login.toLowerCase() : null);
  if (!key) return { ok: false, error: INVALID_PHONE };
  const ip = await getClientIp();
  if (await limited([[`rl:acc-reset:ip:${ip}`, 5, 3600], [`rl:acc-reset:id:${key}`, 3, 3600]])) {
    return { ok: true, message: GENERIC_RESET };
  }
  runAfterResponse(() => deliverPasswordLink(login, phone));
  return { ok: true, message: GENERIC_RESET };
}

/**
 * "Esqueci a senha" (roda depois da resposta). Nesta ordem:
 * 1. conta ATIVA → link de redefinição para o e-mail da conta;
 * 2. WhatsApp com cadastro de compras → conta pendente pelo MESMO caminho do cadastro
 *    (upsertPendingAccount) e o link vai ao e-mail DO CADASTRO: quem pede não escolhe
 *    o destino;
 * 3. conta pendente sem cadastro → reenvia o link de criar senha;
 * 4. nada disso → nada é enviado.
 */
async function deliverPasswordLink(login: string, phone: string | null): Promise<void> {
  const db = await getDb();
  const acc = await findAccountByLogin(login);
  if (acc?.emailVerifiedAt) {
    await sendReset(acc, acc.email);
    return;
  }
  const [stored] = phone
    ? await db
        .select({ name: customers.name, email: customers.email })
        .from(customers)
        .where(eq(customers.whatsapp, phone))
        .limit(1)
    : [];
  const parsed = stored
    ? identitySchema.safeParse({ name: stored.name, email: stored.email.trim().toLowerCase() })
    : null;
  if (phone && parsed && parsed.success) {
    const r = await upsertPendingAccount(db, { phone, ...parsed.data });
    if (r?.kind === "active") await sendReset(r.acc, r.acc.email);
    else if (r?.kind === "new") await sendCreate(r.acc, r.acc.email);
    else if (r) await sendVerify(r.acc, r.acc.email);
    return;
  }
  if (acc) await sendVerify(acc, acc.email);
}

/**
 * Senha pelo link do e-mail (esqueci a senha, ou ativação da conta). O link só
 * vale para a versão de senha em que foi emitido (usar uma vez invalida). Criar
 * a senha também CONFIRMA o e-mail (o link chegou nele) e abre a sessão.
 */
export async function resetPassword(input: { token: string; password: string }): Promise<Result & { linkInvalid?: boolean }> {
  // "reset" (esqueci a senha) ou "verify" (ativação: criar a 1ª senha).
  const tenant = await getCurrentTenantSlug();
  const claims =
    (await verifyAccountToken("reset", input?.token ?? "", tenant)) ??
    (await verifyAccountToken("verify", input?.token ?? "", tenant));
  // linkInvalid: a tela oferece "pedir um novo link" (o motivo não é revelado).
  if (!claims) return { ok: false, error: LINK_GONE, linkInvalid: true };
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
      return { ok: false, error: LINK_GONE, linkInvalid: true };
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

/**
 * Nome é livre. O WhatsApp é o login: fixo depois de definido — só contas antigas
 * (criadas com e-mail, sem WhatsApp) podem cadastrá-lo, uma vez, se estiver livre.
 * Se o sócio está no Mural, o nome exibido acompanha o novo nome da conta.
 */
export async function updateMyProfile(input: { name: string; whatsapp?: string }): Promise<Result> {
  const me = await getCustomerAccount();
  if (!me) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  const parsed = nameSchema.safeParse(input?.name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const set: { name: string; whatsapp?: string } = { name: parsed.data };
  if (!me.whatsapp && input?.whatsapp) {
    const phone = normalizeAccountPhone(input.whatsapp);
    if (!phone) return { ok: false, error: INVALID_PHONE };
    set.whatsapp = phone;
  }
  const db = await getDb();
  try {
    await db.update(customerAccounts).set(set).where(eq(customerAccounts.id, me.id));
  } catch (err) {
    if ((err as { code?: string })?.code === "23505" || /unique/i.test(String(err))) {
      return { ok: false, error: "Este WhatsApp já está em outra conta." };
    }
    console.error("[conta] profile update error:", err);
    return { ok: false, error: UNAVAILABLE };
  }
  try {
    const warning = await syncWallWithAccountName(me.email, parsed.data);
    if (warning) return { ok: true, message: `Dados atualizados. ${warning}` };
  } catch (err) {
    console.error("[conta] falha ao sincronizar nome no mural:", err instanceof Error ? err.name : "erro");
    return {
      ok: true,
      message: "Dados atualizados. Não conseguimos atualizar seu nome no mural agora; salve de novo em instantes.",
    };
  }
  return { ok: true, message: "Dados atualizados." };
}

/**
 * Nome da conta mudou: se o sócio da sessão está no Mural, o nome exibido vira o
 * novo. Se o nome novo não puder aparecer, o sócio sai do mural e o aviso volta ao
 * cliente. Sócio que não está no mural não é tocado.
 */
async function syncWallWithAccountName(email: string, name: string): Promise<string | null> {
  const found = await findMyMember(email);
  if (!found?.wallName) return null;
  const wall = wallNameSchema.safeParse(name);
  const db = await getDb();
  await db.update(members).set({ wallName: wall.success ? wall.data : null }).where(eq(members.id, found.id));
  if (wall.success) return null;
  const problem = wall.error.issues[0]?.message ?? "";
  return `Seu nome saiu do Mural dos Sócios. ${problem} Ative de novo quando o nome estiver certo.`;
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
      name: members.name,
      status: members.status,
      planId: members.planId,
      hasPaid: members.hasPaid,
      pendingPlanId: members.pendingPlanId,
      memberCardToken: members.memberCardToken,
      nextBillingDate: members.nextBillingDate,
      subscriptionId: members.subscriptionId,
      gatewaySlug: members.gatewaySlug,
      wallName: members.wallName,
    })
    .from(members)
    .where(sql`lower(${members.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return m ?? null;
}

/** Carteirinha para a área logada (datas em ISO — vai para o client). */
async function loadMyCard(m: { id: string; status: string; memberCardToken: string | null }) {
  if (!m.memberCardToken) return null;
  const { getMemberCardView } = await import("@/lib/membership/card");
  // Pendente: reconsulta o gateway antes (webhook perdido/atrasado), com limite.
  if (m.status === "pending") {
    try {
      if ((await rateLimit(`rl:member-sync:${m.id}`, 1, 20)).ok) {
        const { syncMemberById } = await import("@/lib/membership/sync");
        await syncMemberById(m.id);
      }
    } catch (err) {
      console.error("[conta] falha ao sincronizar sócio pendente:", err);
    }
  }
  const card = await getMemberCardView(m.memberCardToken);
  if (!card) return null;
  const [{ buildMemberCardData }, { memberShortCode }, config] = await Promise.all([
    import("@/lib/membership/card-data"),
    import("@/lib/membership/carteirinha-access"),
    getSiteConfig(),
  ]);
  return buildMemberCardData(card, {
    // QR de identificação: aponta para a verificação pública do token (portaria).
    qrValue: `${await baseUrl()}/socios/carteirinha?token=${encodeURIComponent(m.memberCardToken)}`,
    // Código curto (S-XXXXXXXX) para digitar na portaria se o QR não ler.
    memberCode: memberShortCode(m.memberCardToken),
    clubColor: config.primaryColor,
    clubLogoUrl: config.clubLogoUrl,
    cardBackground: {
      url: config.memberCardBackgroundUrl,
      fit: config.memberCardBackgroundFit,
      opacity: config.memberCardBackgroundOpacity,
      blend: config.memberCardBackgroundBlend,
    },
  });
}

export async function getMyMembership() {
  const me = await getCustomerAccount();
  if (!me) return { ok: false as const };
  const found = await findMyMember(me.email);
  if (!found) return { ok: true as const, member: null, googleWalletAvailable: false };
  const card = await loadMyCard(found);
  // A sincronização pode ter ativado o sócio: relê o estado.
  const m = (card && found.status === "pending" ? await findMyMember(me.email) : found) ?? found;

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
    // Só configuração (sem segredo): a UI decide se mostra o botão da Google Carteira.
    googleWalletAvailable: isGoogleWalletConfigured(),
    member: {
      name: m.name,
      status: m.status,
      /** Nome no Mural dos Sócios (NULL = não aparece). É o próprio dado do sócio logado. */
      wallName: m.wallName ?? null,
      /** Nome da conta: é o que aparece no mural quando o sócio liga a opção. */
      accountName: me.name,
      plan: m.planId ? planById.get(m.planId) ?? null : null,
      pendingPlan: m.pendingPlanId ? planById.get(m.pendingPlanId) ?? null : null,
      nextBillingDate: m.nextBillingDate?.toISOString() ?? null,
      card,
      openInvoiceUrl,
      // Troca de plano: só em dia, com assinatura no Asaas.
      canChangePlan: m.status === "active" && !!m.subscriptionId && !!m.gatewaySlug?.startsWith("asaas"),
    },
    plans: plans.map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents })),
  };
}

/**
 * Gera uma carteirinha nova: troca o token do sócio da sessão. O QR/link antigo (prints,
 * links compartilhados, passe da Google Carteira) para de funcionar na hora. Opera SÓ no
 * sócio do e-mail da sessão; nada vem do client e o token antigo/novo nunca é devolvido.
 */
export async function regenerateMyCard(): Promise<Result> {
  const me = await getCustomerAccount();
  if (!me) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  if (await limited([[`rl:acc-card-regen:${me.id}`, 3, 3600]])) {
    return { ok: false, error: "Você já gerou carteirinhas novas há pouco. Tente de novo mais tarde." };
  }
  try {
    const found = await findMyMember(me.email);
    if (!found?.memberCardToken) return { ok: false, error: "Você ainda não tem carteirinha." };
    const { rotateMemberCardToken } = await import("@/lib/membership/card-token");
    const db = await getDb();
    const done = await rotateMemberCardToken(db, found.id);
    if (!done) return { ok: false, error: "Você ainda não tem carteirinha." };
    return {
      ok: true,
      message: "Nova carteirinha gerada. O QR anterior não funciona mais.",
    };
  } catch (err) {
    console.error("[conta] falha ao gerar nova carteirinha:", err instanceof Error ? err.name : "erro");
    return { ok: false, error: UNAVAILABLE };
  }
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

/**
 * Troca de plano (vale no próximo vencimento). Só cartão: o payload é estrito, então
 * outra forma de pagamento (ex.: "method": "pix") é recusada. Ver lib/membership/plan-change.
 */
export async function changeMyPlan(input: {
  planId: string;
  asaasCardData?: z.infer<typeof cardSchema>;
}): Promise<Result & { startsOn?: string; planName?: string }> {
  const me = await getCustomerAccount();
  if (!me) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  const parsed = z
    .strictObject({ planId: z.string().uuid(), asaasCardData: cardSchema.optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira os dados informados." };
  if (!parsed.data.asaasCardData) return { ok: false, error: "Informe os dados do cartão." };
  if (await limited([[`rl:acc-plan:${me.id}`, 5, 3600]])) {
    return { ok: false, error: "Muitas tentativas de troca. Aguarde um pouco." };
  }
  const m = await findMyMember(me.email);
  if (!m) return { ok: false, error: "Você não tem assinatura de sócio." };

  const { checkCardAttemptLimit, MEMBER_CARD_RATE_LIMIT_ERROR } = await import("@/lib/payment/card-ratelimit");
  if (!(await checkCardAttemptLimit({ email: me.email, phone: me.whatsapp }))) {
    return { ok: false, error: MEMBER_CARD_RATE_LIMIT_ERROR };
  }

  const { changeMemberPlan } = await import("@/lib/membership/plan-change");
  const r = await changeMemberPlan({
    memberId: m.id,
    newPlanId: parsed.data.planId,
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

// ─── Ingressos de sócio (jogos em casa) ──────────────────────────────────────

/** Próximos jogos em casa e o resgate do sócio logado (só pelo e-mail da sessão). */
export async function getMyFreeTickets() {
  const me = await getCustomerAccount();
  if (!me) return { ok: false as const, error: "Sua sessão expirou. Entre novamente." };
  try {
    const found = await findMyMember(me.email);
    if (!found) return { ok: true as const, eligible: false as const };
    const { getMyFreeTicketsView } = await import("@/lib/membership/free-tickets");
    const view = await getMyFreeTicketsView(found, me);
    return { ok: true as const, ...view };
  } catch (err) {
    console.error("[conta] falha ao listar ingressos de sócio:", err);
    return { ok: false as const, error: UNAVAILABLE };
  }
}

/**
 * Resgata 1 ingresso grátis do plano para um jogo em casa. O sócio vem da SESSÃO
 * (nunca do client); o client manda só o gameId.
 */
export async function redeemMyFreeTicket(input: { gameId: string }): Promise<Result & { orderId?: string }> {
  const me = await getCustomerAccount();
  if (!me) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  const parsed = z.object({ gameId: z.uuid("Jogo inválido.") }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Jogo inválido." };
  if (await limited([[`rl:acc-free-ticket:${me.id}`, 10, 600]])) {
    return { ok: false, error: TOO_MANY };
  }
  try {
    const found = await findMyMember(me.email);
    if (!found) return { ok: false, error: "Você não tem assinatura de sócio." };
    const { redeemFreeTicket } = await import("@/lib/membership/free-tickets");
    const r = await redeemFreeTicket(found, me, parsed.data.gameId);
    if (r.ok) return { ok: true, message: r.message, orderId: r.orderId };
    return { ok: false, error: r.error };
  } catch (err) {
    console.error("[conta] falha ao resgatar ingresso de sócio:", err);
    return { ok: false, error: UNAVAILABLE };
  }
}

/**
 * Mural dos sócios: liga ou desliga o próprio nome. Ligado → aparece o NOME DA CONTA
 * (o da sessão; nunca texto enviado pelo client). Desligado → sai do mural. Opera SÓ
 * no sócio do e-mail da sessão; o id nunca vem do client. Payload estrito: só `optIn`.
 */
export async function setMyWallOptIn(input: {
  optIn: boolean;
}): Promise<Result & { wallName?: string | null }> {
  const me = await getCustomerAccount();
  if (!me) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  const parsed = z.strictObject({ optIn: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha uma opção válida." };
  if (await limited([[`rl:acc-wall:${me.id}`, 10, 600]])) {
    return { ok: false, error: TOO_MANY };
  }

  let wallName: string | null = null;
  if (parsed.data.optIn) {
    const wall = wallNameSchema.safeParse(me.name);
    if (!wall.success) {
      const problem = wall.error.issues[0]?.message ?? "";
      return {
        ok: false,
        error: `Seu nome da conta não pode aparecer no mural. ${problem} Ajuste o nome em "Meus dados" e tente de novo.`,
      };
    }
    wallName = wall.data;
  }

  try {
    const found = await findMyMember(me.email);
    if (!found) return { ok: false, error: "Você não tem assinatura de sócio." };
    const db = await getDb();
    await db.update(members).set({ wallName }).where(eq(members.id, found.id));
    return {
      ok: true,
      wallName,
      message: wallName ? "Pronto! Seu nome está no Mural dos Sócios." : "Seu nome saiu do Mural dos Sócios.",
    };
  } catch (err) {
    console.error("[conta] falha ao atualizar o mural:", err instanceof Error ? err.name : "erro");
    return { ok: false, error: UNAVAILABLE };
  }
}

// ─── Google Carteira ──────────────────────────────────────────────────────────

const WALLET_OFF = "Salvar no Google Carteira não está disponível no momento.";
const WALLET_FAIL = "Não foi possível gerar o link agora. Tente mais tarde.";

/**
 * Link "Salvar no Google Carteira" da carteirinha do sócio logado. Só o sócio do
 * e-mail da sessão, e só com assinatura em dia (benefícios). O link (JWT assinado
 * com a chave do emissor) é montado aqui, a cada clique, nunca no render.
 */
export async function getMyGoogleWalletUrl(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const me = await getCustomerAccount();
  if (!me) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  if (!isGoogleWalletConfigured()) return { ok: false, error: WALLET_OFF };
  if (await limited([[`rl:acc-gwallet:${me.id}`, 10, 600]])) return { ok: false, error: TOO_MANY };
  try {
    const found = await findMyMember(me.email);
    const card = found ? await loadMyCard(found) : null;
    if (!found || !card) return { ok: false, error: "Você ainda não tem carteirinha." };
    if (!card.hasBenefits) return { ok: false, error: "Disponível com a assinatura em dia." };
    const tenantSlug = await getCurrentTenantSlug();
    if (!tenantSlug) return { ok: false, error: WALLET_FAIL };
    const [{ siteName }, base] = await Promise.all([getSiteConfig(), baseUrl()]);
    const url = await buildGoogleWalletSaveUrl({
      tenantSlug,
      clubName: siteName,
      baseUrl: base || null,
      memberId: found.id,
      card,
    });
    if (!url) return { ok: false, error: WALLET_OFF };
    return { ok: true, url };
  } catch (err) {
    // Só o tipo do erro: a mensagem de falha da lib de chave pode trazer pedaços da chave.
    console.error("[conta] falha ao montar link da Google Carteira:", err instanceof Error ? err.name : "erro");
    return { ok: false, error: WALLET_FAIL };
  }
}

// ─── Checkout: identificação automática ─────────────────────────────────────

/**
 * Dados do cliente LOGADO para pré-preencher os checkouts (são dele mesmo).
 * Sem sessão → null e o checkout segue o fluxo normal por WhatsApp. O CPF nunca
 * vai ao client: só se há um salvo (o servidor reaproveita na cobrança).
 */
export async function getCheckoutIdentity(): Promise<{
  name: string;
  email: string;
  whatsapp: string;
  hasCpf: boolean;
} | null> {
  const me = await getCustomerAccount();
  if (!me?.whatsapp) return null;
  let hasCpf = false;
  try {
    const db = await getDb();
    const [row] = await db
      .select({ cpf: customers.cpf })
      .from(customers)
      .where(eq(customers.whatsapp, me.whatsapp))
      .limit(1);
    hasCpf = !!row?.cpf && row.cpf.replace(/\D/g, "").length === 11;
  } catch {
    /* sem CPF salvo: o checkout pede */
  }
  return { name: me.name, email: me.email, whatsapp: me.whatsapp, hasCpf };
}

/**
 * Desconto de sócio do cliente LOGADO, só para MOSTRAR preço antes de pagar (o
 * servidor do checkout recalcula tudo; o client nunca envia o desconto). Sem
 * sessão ou sem benefício vigente → null. Devolve só percentuais e o nome do
 * plano — nada de e-mail ou ids.
 */
export async function getMyMemberPricing(): Promise<{
  ticketDiscountPct: number;
  productDiscountPct: number;
  planName: string;
} | null> {
  // Mesma regra de getSessionMemberDiscount, sem a 2ª leitura da sessão. Visitante
  // sem cookie sai antes do limite (o drawer do carrinho consulta em toda página).
  const me = await getCustomerAccount();
  if (!me) return null;
  // Limite por CONTA (não por IP: no estádio muita gente sai pelo mesmo IP).
  if (!(await rateLimit(`rl:member-pricing:${me.id}`, 300, 600)).ok) return null;
  const d = await getMemberDiscountForEmail(me.email);
  if (!d) return null;
  return { ticketDiscountPct: d.ticketDiscountPct, productDiscountPct: d.productDiscountPct, planName: d.planName };
}

// ─── Visão geral ──────────────────────────────────────────────────────────────

export async function getMyAccount(): Promise<{ name: string; email: string; whatsapp: string | null } | null> {
  const me = await getCustomerAccount();
  return me ? { name: me.name, email: me.email, whatsapp: me.whatsapp } : null;
}
