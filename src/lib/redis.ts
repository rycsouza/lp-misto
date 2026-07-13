import { Redis } from "@upstash/redis";

/**
 * Cliente Upstash Redis compartilhado (o mesmo já usado na resolução de tenant).
 * Retorna null se as env vars não estiverem configuradas — quem usa deve
 * degradar com segurança (ex.: rate limit fail-open, OTP indisponível).
 */
let _redis: Redis | null = null;
let _initialized = false;

export function getRedisOrNull(): Redis | null {
  if (_initialized) return _redis;
  _initialized = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) _redis = new Redis({ url, token });
  return _redis;
}
