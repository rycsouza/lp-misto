import crypto from "crypto";
import { getRedisOrNull } from "@/lib/redis";

const OTP_TTL_SEC = 300; // 5 minutos
const MAX_VERIFY_ATTEMPTS = 5;

function key(digits: string) {
  return `otp:orders:${digits}`;
}
function attemptsKey(digits: string) {
  return `otp:orders:${digits}:n`;
}

/** Hash do código (nunca guardamos o código em claro). */
function hashCode(code: string, digits: string): string {
  const salt = process.env.TICKET_SIGNING_SECRET ?? "";
  return crypto.createHash("sha256").update(`${code}:${digits}:${salt}`).digest("hex");
}

/**
 * Gera um código de 6 dígitos e guarda o hash no Redis (TTL 5min). Devolve o
 * código em claro para o CHAMADOR entregar pelo canal disponível (WhatsApp ou
 * e-mail) — a entrega não é responsabilidade deste módulo, para que nenhum
 * canal específico seja ponto único de falha. Retorna null se não houver Redis.
 */
export async function issueOtpCode(digits: string): Promise<string | null> {
  const redis = getRedisOrNull();
  if (!redis) return null;

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await redis.set(key(digits), { h: hashCode(code, digits) }, { ex: OTP_TTL_SEC });
  await redis.del(attemptsKey(digits));
  return code;
}

/** Confere o código. Consome (deleta) em caso de acerto; limita tentativas. */
export async function checkOrdersOtp(digits: string, code: string): Promise<boolean> {
  const redis = getRedisOrNull();
  if (!redis) return false;

  const stored = await redis.get<{ h: string }>(key(digits));
  if (!stored?.h) return false;

  const attempts = await redis.incr(attemptsKey(digits));
  if (attempts === 1) await redis.expire(attemptsKey(digits), OTP_TTL_SEC);
  if (attempts > MAX_VERIFY_ATTEMPTS) {
    await redis.del(key(digits));
    await redis.del(attemptsKey(digits));
    return false;
  }

  if (hashCode(code, digits) !== stored.h) return false;

  await redis.del(key(digits));
  await redis.del(attemptsKey(digits));
  return true;
}
