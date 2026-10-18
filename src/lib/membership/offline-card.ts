/**
 * Carteirinha guardada no aparelho para aparecer sem internet (página /offline).
 *
 * Guarda só o que o MemberCard precisa para desenhar o cartão e o QR, por allowlist.
 * E-mail, CPF, telefone, fundo e logo nunca entram. Além disso, o localStorage é dado
 * não confiável: tudo que sai dele passa por validação campo a campo antes de virar
 * MemberCardData. Qualquer coisa fora do formato é descartada.
 */
import type { MemberCardData } from "./card-data";
import { safeCardColor, type PlanBenefitLine } from "./plan-benefits";

/** Chave por origem (cada clube tem o próprio domínio, então a chave não cruza clubes). */
export const OFFLINE_CARD_KEY = "socio_card_v1";
/** Dado salvo há mais tempo que isso é ignorado. */
export const OFFLINE_CARD_MAX_AGE_MS = 35 * 24 * 60 * 60 * 1000;

const FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_RECORD_CHARS = 64 * 1024;
const MAX_BENEFITS = 50;
const MAX_TEXT = 200;
const MAX_NAME = 120;
const MAX_QR_LENGTH = 2048;
const MEMBER_CODE_RE = /^S-[0-9A-F]{8}$/;
const STATUSES: readonly MemberCardData["status"][] = ["active", "pending", "suspended", "cancelled"];

export interface OfflineMemberCard {
  /** Quando foi salvo (Date). */
  savedAt: Date;
  siteName: string | null;
  /** Pronto para o MemberCard. Logo e fundo ficam nulos (não funcionam offline). */
  card: MemberCardData;
}

/** Monta o registro com allowlist explícita (nunca espalha o objeto do servidor). */
function buildRecord(card: MemberCardData, siteName: string | null | undefined, now: Date) {
  return {
    savedAt: now.toISOString(),
    siteName: typeof siteName === "string" && siteName.trim() ? siteName.trim().slice(0, MAX_NAME) : null,
    card: {
      name: card.name,
      planName: card.planName,
      status: card.status,
      memberSince: card.memberSince,
      nextBillingDate: card.nextBillingDate,
      cardColor: card.cardColor,
      clubColor: card.clubColor,
      benefits: card.benefits.map((b) => ({ key: b.key, text: b.text, automatic: b.automatic })),
      hasDiscounts: card.hasDiscounts,
      hasBenefits: true,
      qrValue: card.qrValue,
      memberCode: card.memberCode ?? null,
    },
  };
}

/** Registro a salvar, ou null quando não há carteirinha com benefício (nada a guardar). */
export function buildOfflineRecord(
  card: MemberCardData,
  siteName: string | null | undefined,
  now: Date = new Date()
): ReturnType<typeof buildRecord> | null {
  if (!card.hasBenefits) return null;
  return buildRecord(card, siteName, now);
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function safeQrValue(value: unknown): string | null {
  const s = text(value, MAX_QR_LENGTH);
  if (!s) return null;
  try {
    const { protocol } = new URL(s);
    return protocol === "https:" || protocol === "http:" ? s : null;
  } catch {
    return null;
  }
}

function parseBenefits(value: unknown): PlanBenefitLine[] | null {
  if (!Array.isArray(value) || value.length > MAX_BENEFITS) return null;
  const out: PlanBenefitLine[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    const key = text(o.key, MAX_TEXT);
    const line = text(o.text, MAX_TEXT);
    if (!key || !line || typeof o.automatic !== "boolean") return null;
    out.push({ key, text: line, automatic: o.automatic });
  }
  return out;
}

/** Lê o JSON salvo e devolve o registro validado, ou null (inválido, vencido ou do futuro). */
export function parseOfflineRecord(raw: string | null | undefined, now: Date = new Date()): OfflineMemberCard | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_RECORD_CHARS) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;

  const savedIso = isoDate(o.savedAt);
  if (!savedIso) return null;
  const savedMs = Date.parse(savedIso);
  if (savedMs > now.getTime() + FUTURE_SKEW_MS) return null;
  if (now.getTime() - savedMs > OFFLINE_CARD_MAX_AGE_MS) return null;

  let siteName: string | null = null;
  if (o.siteName !== null && o.siteName !== undefined) {
    siteName = text(o.siteName, MAX_NAME);
    if (!siteName) return null;
  }

  if (!o.card || typeof o.card !== "object") return null;
  const c = o.card as Record<string, unknown>;

  const name = text(c.name, MAX_NAME);
  const planName = text(c.planName, MAX_NAME);
  const status = STATUSES.find((s) => s === c.status);
  const memberSince = isoDate(c.memberSince);
  const nextBillingDate = c.nextBillingDate === null || c.nextBillingDate === undefined ? null : isoDate(c.nextBillingDate);
  const benefits = parseBenefits(c.benefits);
  const qrValue = safeQrValue(c.qrValue);
  const hasDiscounts = typeof c.hasDiscounts === "boolean" ? c.hasDiscounts : null;

  // Só carteirinha com benefício é salva: se vier outra coisa, o dado não é nosso.
  if (c.hasBenefits !== true) return null;
  if (!name || !planName || !status || !memberSince || nextBillingDate === undefined) return null;
  if (!benefits || !qrValue || hasDiscounts === null) return null;

  // Cores são só cosméticas: valor inválido cai para o padrão, sem descartar o registro.
  const cardColor = typeof c.cardColor === "string" ? safeCardColor(c.cardColor) : null;
  const clubColor = typeof c.clubColor === "string" ? safeCardColor(c.clubColor) : null;
  const memberCode = typeof c.memberCode === "string" && MEMBER_CODE_RE.test(c.memberCode) ? c.memberCode : null;

  return {
    savedAt: new Date(savedMs),
    siteName,
    card: {
      name,
      planName,
      status,
      memberSince,
      nextBillingDate,
      cardColor,
      clubColor,
      clubLogoUrl: null,
      background: null,
      benefits,
      hasDiscounts,
      hasBenefits: true,
      qrValue,
      memberCode,
    },
  };
}

/** Acesso ao localStorage que nunca lança (modo privado restrito, acesso bloqueado). */
function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Salva a carteirinha (sobrescreve a anterior). Sem benefício, remove o que estiver salvo.
 * Erros de armazenamento são ignorados: o site segue funcionando sem o cache offline.
 */
export function saveOfflineCard(card: MemberCardData, siteName: string | null | undefined, now: Date = new Date()): void {
  const record = buildOfflineRecord(card, siteName, now);
  try {
    const store = storage();
    if (!store) return;
    if (record) store.setItem(OFFLINE_CARD_KEY, JSON.stringify(record));
    else store.removeItem(OFFLINE_CARD_KEY);
  } catch {
    // quota cheia, modo privado ou acesso bloqueado: ignora
  }
}

/** Remove a carteirinha do aparelho (usado ao sair da conta). */
export function clearOfflineCard(): void {
  try {
    storage()?.removeItem(OFFLINE_CARD_KEY);
  } catch {
    // ignora
  }
}

/** Texto cru salvo (null se não houver ou se o armazenamento estiver indisponível). */
export function readOfflineCardRaw(): string | null {
  try {
    return storage()?.getItem(OFFLINE_CARD_KEY) ?? null;
  } catch {
    return null;
  }
}
