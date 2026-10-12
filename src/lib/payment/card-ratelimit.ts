import { getClientIp, rateLimit } from "@/lib/ratelimit";

/**
 * Anti card-testing: limita tentativas de pagamento com CARTÃO antes de tocar o
 * gateway. Sem isso, um robô usa o checkout público para validar cartões
 * roubados em massa (gera chargebacks, taxas e pode bloquear a conta no gateway).
 *
 * Conta por IP e pelos identificadores do comprador (telefone e e-mail), em
 * janela fixa. Não usa nada derivado do número do cartão (fora do escopo PCI).
 * Chamar DEPOIS da checagem de idempotência — retentativas da mesma tentativa
 * não devem consumir o limite.
 */
export const CARD_ATTEMPT_LIMITS = {
  ip: { limit: 10, windowSec: 3600 },
  buyer: { limit: 5, windowSec: 3600 },
} as const;

export const CARD_RATE_LIMIT_ERROR =
  "Muitas tentativas de pagamento com cartão. Aguarde alguns minutos ou pague com PIX.";

export async function checkCardAttemptLimit(buyer: {
  phone?: string | null;
  email?: string | null;
}): Promise<boolean> {
  const ip = await getClientIp();
  const phone = buyer.phone?.replace(/\D/g, "") ?? "";
  const email = buyer.email?.trim().toLowerCase() ?? "";

  const checks = [
    rateLimit(`rl:card:ip:${ip}`, CARD_ATTEMPT_LIMITS.ip.limit, CARD_ATTEMPT_LIMITS.ip.windowSec),
  ];
  if (phone) {
    checks.push(
      rateLimit(`rl:card:ph:${phone}`, CARD_ATTEMPT_LIMITS.buyer.limit, CARD_ATTEMPT_LIMITS.buyer.windowSec)
    );
  }
  if (email) {
    checks.push(
      rateLimit(`rl:card:em:${email}`, CARD_ATTEMPT_LIMITS.buyer.limit, CARD_ATTEMPT_LIMITS.buyer.windowSec)
    );
  }

  const results = await Promise.all(checks);
  return results.every((r) => r.ok);
}
