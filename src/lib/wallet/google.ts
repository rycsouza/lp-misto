/**
 * Google Wallet: carteirinha "Salvar no Google Carteira". INTERNO (só server) — nunca
 * exportar de arquivo "use server".
 *
 * Abordagem sem chamada à API REST: o link https://pay.google.com/gp/v/save/<JWT> leva,
 * dentro do JWT (RS256, assinado com a chave da conta de serviço do emissor), a CLASSE e
 * o OBJETO do passe genérico. O Google cria o passe do lado do usuário quando ele clica.
 *
 * Emissor único da Play55; a classe é por clube (id com o slug do tenant) e o objeto
 * é por sócio E por carteirinha: o id leva uma impressão do QR atual. O Google não
 * atualiza um objeto já salvo pelo link, então, ao "Gerar nova carteirinha", o passe
 * novo precisa de outro id (o antigo fica com o QR revogado, que não verifica mais).
 *
 * Só entram no passe nome, plano, data de adesão e o QR (link de verificação ao vivo).
 * E-mail, CPF e telefone nunca.
 */
import { createHash } from "node:crypto";
import { SignJWT, importPKCS8 } from "jose";
import { FALLBACK_CARD_COLOR, safeLogoUrl } from "@/lib/membership/card-visual";
import { safeCardColor } from "@/lib/membership/plan-benefits";
import type { MemberCardData } from "@/lib/membership/card-data";

const SAVE_URL = "https://pay.google.com/gp/v/save/";
const ISSUER_ID_RE = /^\d{1,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+$/;
const LANG = "pt-BR";

/** Ambiente de leitura (process.env ou um objeto de teste). */
export type WalletEnv = Record<string, string | undefined>;

export interface GoogleWalletConfig {
  issuerId: string;
  serviceAccountEmail: string;
  privateKeyPem: string;
}

/**
 * Configuração a partir do ambiente. Sem as três variáveis (ou com formato inválido) →
 * null: o recurso fica desligado (o botão não aparece).
 */
export function getGoogleWalletConfig(env: WalletEnv = process.env): GoogleWalletConfig | null {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID?.trim() ?? "";
  const serviceAccountEmail = env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL?.trim() ?? "";
  // Chave colada no painel da Vercel: pode vir entre aspas e com "\n" escapado.
  const rawKey = (env.GOOGLE_WALLET_PRIVATE_KEY ?? "").trim().replace(/^"([\s\S]*)"$/, "$1");
  if (!issuerId || !serviceAccountEmail || !rawKey) return null;
  if (!ISSUER_ID_RE.test(issuerId) || !EMAIL_RE.test(serviceAccountEmail)) return null;
  const privateKeyPem = rawKey.replace(/\\n/g, "\n");
  if (!privateKeyPem.includes("BEGIN PRIVATE KEY")) return null;
  return { issuerId, serviceAccountEmail, privateKeyPem };
}

export function isGoogleWalletConfigured(env: WalletEnv = process.env): boolean {
  return getGoogleWalletConfig(env) !== null;
}

/** Id do Google: só [A-Za-z0-9._-]. Qualquer outro caractere vira "_". */
export function walletIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

export function walletClassId(issuerId: string, tenantSlug: string): string {
  return `${issuerId}.socio_${walletIdPart(tenantSlug)}`;
}

export function walletObjectId(
  issuerId: string,
  tenantSlug: string,
  memberId: string,
  qrValue?: string
): string {
  const base = `${walletClassId(issuerId, tenantSlug)}_${walletIdPart(memberId)}`;
  if (!qrValue) return base;
  // Impressão (não o token): 12 hex do SHA-256 do QR — muda quando a carteirinha é trocada.
  return `${base}_${createHash("sha256").update(qrValue).digest("hex").slice(0, 12)}`;
}

export interface WalletPassInput {
  issuerId: string;
  /** Slug do clube atual (multi-tenant). Obrigatório: entra no id da classe e do objeto. */
  tenantSlug: string;
  /** Nome do clube (cardTitle e issuerName). */
  clubName: string;
  /** Origem absoluta do clube (ex.: https://clube.com.br). Usada no logo relativo e em origins. */
  baseUrl: string | null;
  memberId: string;
  card: MemberCardData;
}

export interface WalletPassContent {
  payload: {
    genericClasses: Record<string, unknown>[];
    genericObjects: Record<string, unknown>[];
  };
  origins: string[];
}

/**
 * Logo do passe: o Google exige URL https absoluta. Relativo ("/logo.png") vira absoluto
 * com a origem do clube; qualquer outra coisa (http, data:, javascript:) é omitido.
 */
export function walletLogoUrl(logo: string | null | undefined, baseUrl: string | null): string | null {
  const safe = safeLogoUrl(logo);
  if (!safe) return null;
  try {
    const url = new URL(safe, baseUrl ?? undefined);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function httpsOrigin(baseUrl: string | null): string | null {
  if (!baseUrl) return null;
  try {
    const url = new URL(baseUrl);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

const localized = (value: string) => ({ defaultValue: { language: LANG, value } });

const fmtMonthYear = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

/**
 * Monta a classe e o objeto do passe genérico. Função PURA (sem chave, sem I/O): é o
 * que o teste inspeciona. A assinatura fica em signWalletJwt.
 */
export function buildWalletPassPayload(input: WalletPassInput): WalletPassContent {
  if (!input.tenantSlug?.trim()) throw new Error("wallet: tenant sem slug");
  const { card } = input;
  const clubName = input.clubName.trim() || "Clube";
  const classId = walletClassId(input.issuerId, input.tenantSlug);
  const objectId = walletObjectId(input.issuerId, input.tenantSlug, input.memberId, card.qrValue);
  const color = safeCardColor(card.cardColor ?? card.clubColor) ?? FALLBACK_CARD_COLOR;
  const logo = walletLogoUrl(card.clubLogoUrl, input.baseUrl);
  const origin = httpsOrigin(input.baseUrl);

  const genericClass = {
    id: classId,
    issuerName: clubName,
    // Classe nova entra em revisão: até o Google aprovar, só contas de teste salvam.
    reviewStatus: "UNDER_REVIEW",
  };

  const genericObject: Record<string, unknown> = {
    id: objectId,
    classId,
    state: "ACTIVE",
    cardTitle: localized(clubName),
    header: localized(card.name),
    // Nome do programa de sócio do clube (vem validado no cartão).
    subheader: localized(card.programName),
    textModulesData: [
      { id: "plano", header: "Plano", body: card.planName },
      { id: "socio_desde", header: "Sócio desde", body: fmtMonthYear(card.memberSince) },
    ],
    // QR = link de verificação ao vivo: a portaria vê a situação atual ao escanear.
    barcode: { type: "QR_CODE", value: card.qrValue },
    hexBackgroundColor: color,
  };
  if (logo) genericObject.logo = { sourceUri: { uri: logo } };

  return {
    payload: { genericClasses: [genericClass], genericObjects: [genericObject] },
    origins: origin ? [origin] : [],
  };
}

/** Assina o conteúdo do passe (RS256) com a conta de serviço do emissor. */
export async function signWalletJwt(content: WalletPassContent, config: GoogleWalletConfig): Promise<string> {
  const key = await importPKCS8(config.privateKeyPem, "RS256");
  return new SignJWT({ typ: "savetowallet", origins: content.origins, payload: content.payload })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(config.serviceAccountEmail)
    .setAudience("google")
    .setIssuedAt()
    .sign(key);
}

/**
 * Link "Salvar no Google Carteira" do sócio. Devolve null se o recurso está desligado.
 * Erros de chave/assinatura sobem para quem chama (que responde com mensagem genérica).
 */
export async function buildGoogleWalletSaveUrl(
  input: Omit<WalletPassInput, "issuerId">,
  env: WalletEnv = process.env
): Promise<string | null> {
  const config = getGoogleWalletConfig(env);
  if (!config) return null;
  // O emissor vem SEMPRE da configuração, nunca do chamador.
  const content = buildWalletPassPayload({ ...input, issuerId: config.issuerId });
  return `${SAVE_URL}${await signWalletJwt(content, config)}`;
}
