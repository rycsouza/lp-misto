"use server";

import { z } from "zod";
import { requireModule } from "@/lib/admin/auth-guard";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import {
  getMemberCardView,
  getMemberCardViewByCodePrefix,
  type MemberCardLookupByCode,
} from "@/lib/membership/card";
import { syncMemberById } from "@/lib/membership/sync";
import { memberHasBenefits } from "@/lib/membership/status";
import {
  CARD_TOKEN_RE,
  benefitsUntilIso,
  parseMemberShortCode,
} from "@/lib/membership/carteirinha-access";
import type { MemberStatus } from "@/lib/membership/status";

/**
 * Conferência de sócio pela carteirinha (validador da portaria), por QR (token) ou
 * por código curto digitado (S-XXXXXXXX).
 *
 * Não é validação de ingresso: não grava nada em ticketValidations nem entra nas
 * estatísticas da portaria. Só registra consulta na auditoria (ids, sem nome).
 *
 * Resposta mínima por desenho: nome, plano, situação, benefícios e data de
 * adesão. Nada de e-mail, CPF, telefone, id interno ou o próprio token.
 */

export type MemberCardCheck =
  | {
      found: true;
      name: string;
      planName: string;
      status: MemberStatus;
      hasBenefits: boolean;
      /** ISO. Só para sócio cancelado com benefício vigente no período pago. */
      benefitsUntil: string | null;
      /** ISO. */
      memberSince: string;
    }
  | {
      found: false;
      reason:
        | "forbidden"
        | "invalid_token"
        | "invalid_code"
        | "rate_limited"
        | "not_found"
        | "ambiguous"
        | "error";
      message: string;
    };

// Entrada vem do cliente: schema explícito, um de dois formatos, sem campos extras.
const inputSchema = z.union([
  z.object({ token: z.string().regex(CARD_TOKEN_RE) }).strict(),
  z.object({ code: z.string().max(32) }).strict(),
]);

const RATE_LIMIT_CHECKS_PER_MIN = 60;
// Busca por código é mais fácil de varrer (8 hex): limite extra, por admin, no mesmo minuto.
const RATE_LIMIT_CODE_LOOKUPS_PER_MIN = 30;

const RATE_LIMITED = {
  found: false as const,
  reason: "rate_limited" as const,
  message: "Muitas consultas seguidas. Aguarde um instante.",
};

type Target = { token: string } | { code: string };

async function lookupCard(target: Target): Promise<MemberCardLookupByCode> {
  if ("code" in target) return getMemberCardViewByCodePrefix(target.code);
  const view = await getMemberCardView(target.token);
  return view ? { kind: "found", view } : { kind: "none" };
}

export async function verifyMemberCard(rawInput: unknown): Promise<MemberCardCheck> {
  // Mesma regra da rota /admin/validacao. Falha de autorização não revela nada
  // sobre o token/código nem sobre o banco.
  let session: Awaited<ReturnType<typeof requireModule>>;
  try {
    session = await requireModule("validacao");
  } catch {
    return { found: false, reason: "forbidden", message: "Sem permissão para validar sócios." };
  }

  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { found: false, reason: "invalid_token", message: "QR ou código de sócio inválido." };
  }

  let target: Target;
  if ("code" in parsed.data) {
    const code = parseMemberShortCode(parsed.data.code);
    if (!code) {
      return { found: false, reason: "invalid_code", message: "Código de sócio inválido." };
    }
    target = { code };
  } else {
    target = { token: parsed.data.token };
  }

  const limit = await rateLimit(`rl:member-card-check:${session.userId}`, RATE_LIMIT_CHECKS_PER_MIN, 60);
  if (!limit.ok) return RATE_LIMITED;
  if ("code" in target) {
    const codeLimit = await rateLimit(
      `rl:member-card-code:${session.userId}`,
      RATE_LIMIT_CODE_LOOKUPS_PER_MIN,
      60
    );
    if (!codeLimit.ok) return RATE_LIMITED;
  }

  let lookup: MemberCardLookupByCode;
  try {
    lookup = await lookupCard(target);
    // Pendente: reconsulta o gateway (webhook perdido/atrasado), com limite por sócio.
    if (lookup.kind === "found" && lookup.view.status === "pending") {
      try {
        if ((await rateLimit(`rl:member-sync:${lookup.view.memberId}`, 1, 20)).ok) {
          await syncMemberById(lookup.view.memberId);
        }
      } catch {
        // Erro bruto não é logado: pode trazer parâmetros da query (o token é segredo).
        console.error("[validacao-socio] falha ao sincronizar sócio pendente");
      }
      lookup = await lookupCard(target);
    }
  } catch {
    console.error("[validacao-socio] falha ao consultar carteirinha");
    return { found: false, reason: "error", message: "Não foi possível consultar a carteirinha. Tente de novo." };
  }

  if (lookup.kind === "none") {
    return { found: false, reason: "not_found", message: "Carteirinha não encontrada." };
  }
  if (lookup.kind === "ambiguous") {
    return { found: false, reason: "ambiguous", message: "Código ambíguo — leia o QR da carteirinha." };
  }

  const view = lookup.view;
  const hasBenefits = memberHasBenefits(view);
  await logAudit("member_card_check", "member", view.memberId, { status: view.status });

  return {
    found: true,
    name: view.name,
    planName: view.planName,
    status: view.status,
    hasBenefits,
    benefitsUntil: benefitsUntilIso(view.status, hasBenefits, view.nextBillingDate),
    memberSince: view.memberSince.toISOString(),
  };
}
