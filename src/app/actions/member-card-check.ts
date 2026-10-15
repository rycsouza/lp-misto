"use server";

import { z } from "zod";
import { requireModule } from "@/lib/admin/auth-guard";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { getMemberCardView } from "@/lib/membership/card";
import { syncMemberById } from "@/lib/membership/sync";
import { memberHasBenefits } from "@/lib/membership/status";
import { CARD_TOKEN_RE, benefitsUntilIso } from "@/lib/membership/carteirinha-access";
import type { MemberStatus } from "@/lib/membership/status";

/**
 * Conferência de sócio pelo QR da carteirinha (validador da portaria).
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
      reason: "forbidden" | "invalid_token" | "rate_limited" | "not_found" | "error";
      message: string;
    };

// Entrada vem do cliente: schema explícito, sem campos extras.
const inputSchema = z
  .object({
    token: z.string().regex(CARD_TOKEN_RE),
  })
  .strict();

const RATE_LIMIT_CHECKS_PER_MIN = 60;

export async function verifyMemberCard(rawToken: unknown): Promise<MemberCardCheck> {
  // Mesma regra da rota /admin/validacao. Falha de autorização não revela nada
  // sobre o token nem sobre o banco.
  let session: Awaited<ReturnType<typeof requireModule>>;
  try {
    session = await requireModule("validacao");
  } catch {
    return { found: false, reason: "forbidden", message: "Sem permissão para validar sócios." };
  }

  const parsed = inputSchema.safeParse({ token: rawToken });
  if (!parsed.success) {
    return { found: false, reason: "invalid_token", message: "QR de sócio inválido." };
  }

  const limit = await rateLimit(`rl:member-card-check:${session.userId}`, RATE_LIMIT_CHECKS_PER_MIN, 60);
  if (!limit.ok) {
    return { found: false, reason: "rate_limited", message: "Muitas consultas seguidas. Aguarde um instante." };
  }

  const token = parsed.data.token;
  let view;
  try {
    view = await getMemberCardView(token);
    // Pendente: reconsulta o gateway (webhook perdido/atrasado), com limite por sócio.
    if (view?.status === "pending") {
      try {
        if ((await rateLimit(`rl:member-sync:${view.memberId}`, 1, 20)).ok) await syncMemberById(view.memberId);
      } catch {
        // Erro bruto não é logado: pode trazer parâmetros da query (o token é segredo).
        console.error("[validacao-socio] falha ao sincronizar sócio pendente");
      }
      view = await getMemberCardView(token);
    }
  } catch {
    console.error("[validacao-socio] falha ao consultar carteirinha");
    return { found: false, reason: "error", message: "Não foi possível consultar a carteirinha. Tente de novo." };
  }

  if (!view) {
    return { found: false, reason: "not_found", message: "Carteirinha não encontrada." };
  }

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
