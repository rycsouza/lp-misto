import { headers } from "next/headers";
import { getRedisOrNull } from "@/lib/redis";

/** IP do cliente a partir dos headers (atrás do proxy da Vercel). */
export async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    return h.get("x-real-ip") ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Rate limit por janela fixa em Redis (INCR + EXPIRE). Sem Redis configurado,
 * é fail-open (não bloqueia) — em produção o Redis está sempre presente.
 * Qualquer erro de rede também é fail-open para nunca derrubar um fluxo legítimo.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<{ ok: boolean; remaining: number }> {
  const redis = getRedisOrNull();
  if (!redis) return { ok: true, remaining: limit };
  try {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, windowSec);
    return { ok: n <= limit, remaining: Math.max(0, limit - n) };
  } catch {
    return { ok: true, remaining: limit };
  }
}
