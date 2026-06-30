import { Redis } from "@upstash/redis";
import { getPlatformDb } from "@/lib/db/platform/client";
import { organizationDomains, organizations } from "@/lib/db/platform/schema";
import { eq } from "drizzle-orm";

export interface TenantContext {
  orgId: string;
  slug: string;
  encryptedDatabaseUrl: string;
}

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Upstash Redis env vars not set");
  _redis = new Redis({ url, token });
  return _redis;
}

export function getTenantCacheKey(domain: string) {
  return `tenant:domain:${domain}`;
}

export async function resolveTenant(host: string): Promise<TenantContext | null> {
  if (
    !process.env.PLATFORM_DATABASE_URL ||
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }

  const domain = host.split(":")[0];
  const cacheKey = getTenantCacheKey(domain);

  try {
    const redis = getRedis();

    const cached = await redis.get<TenantContext>(cacheKey);
    if (cached) return cached;

    const rows = await getPlatformDb()
      .select({
        orgId: organizations.id,
        slug: organizations.slug,
        databaseUrl: organizations.databaseUrl,
        status: organizations.status,
      })
      .from(organizationDomains)
      .innerJoin(organizations, eq(organizations.id, organizationDomains.orgId))
      .where(eq(organizationDomains.domain, domain))
      .limit(1);

    if (!rows[0] || rows[0].status !== "active") return null;

    const tenant: TenantContext = {
      orgId: rows[0].orgId,
      slug: rows[0].slug,
      encryptedDatabaseUrl: rows[0].databaseUrl, // stored encrypted in Redis
    };

    // Sem TTL: a string cifrada do DB do tenant raramente muda. Toda mutação de
    // tenant (URL/status/domínio) DEVE chamar invalidateTenantCache (ex.: o script
    // set-tenant-runtime-url). Evita reconsulta ao platform DB a cada request.
    await redis.set(cacheKey, tenant);
    return tenant;
  } catch (err) {
    console.error("[tenant] resolveTenant error:", err);
    return null;
  }
}

export async function invalidateTenantCache(domain: string): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return;
  try {
    await getRedis().del(getTenantCacheKey(domain));
  } catch {
    // best-effort
  }
}
