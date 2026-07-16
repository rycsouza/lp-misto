import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { headers, cookies } from "next/headers";
import { jwtVerify } from "jose";
import { Redis } from "@upstash/redis";
import { decryptWithKey } from "@/lib/payment/encryption";
import { getPlatformDb } from "@/lib/db/platform/client";
import { organizations } from "@/lib/db/platform/schema";
import type { TenantContext } from "@/lib/tenant";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

// Lazy singleton — only initializes when DATABASE_URL is present and db is actually used
let _defaultDb: DrizzleDb | null = null;

function resolveDefaultDb(): DrizzleDb {
  if (_defaultDb) return _defaultDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — use getDb() for tenant-aware queries");
  _defaultDb = drizzle(neon(url), { schema });
  return _defaultDb;
}

// Safe to import without DATABASE_URL — throws only when a method is actually called
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_, prop, receiver) {
    return Reflect.get(resolveDefaultDb() as object, prop, receiver);
  },
});

// Module-level cache per serverless instance (non-shared, per-invocation reuse)
const connCache = new Map<string, DrizzleDb>();

const TENANT_SLUG_RE = /^[a-z0-9-]{1,64}$/;

/**
 * Override de contexto do ADMIN DO SISTEMA: quando um admin de plataforma
 * (escopo "platform") escolheu um clube, ele opera o painel /admin desse clube.
 *
 * BLINDAGEM (isolamento de tenant): o override SÓ vale se o cookie de plataforma
 * for um JWT válido de escopo "platform". Um editor/admin de tenant NÃO consegue
 * forjar isso — o cookie `sport55_ctx_tenant` sozinho é inerte sem o token
 * assinado. Também restringe às rotas /admin (fora de /admin/sistema) para não
 * afetar o site público servido pelo host. Fail-closed: qualquer falha → null.
 */
async function resolvePlatformOverrideSlug(pathname: string): Promise<string | null> {
  if (!pathname.startsWith("/admin") || pathname.startsWith("/admin/sistema")) return null;

  const cookieStore = await cookies();
  const ptoken = cookieStore.get("sport55_platform_token")?.value;
  const ctx = cookieStore.get("sport55_ctx_tenant")?.value;
  if (!ptoken || !ctx || !TENANT_SLUG_RE.test(ctx)) return null;

  try {
    const secret = new TextEncoder().encode(
      process.env.PLATFORM_JWT_SECRET ?? process.env.ADMIN_JWT_SECRET
    );
    const { payload } = await jwtVerify(ptoken, secret, { algorithms: ["HS256"] });
    if (payload.scope !== "platform") return null;
    return ctx;
  } catch {
    return null;
  }
}

/** Conecta ao DB de um tenant pelo slug, resolvendo a URL cifrada no platform DB. */
async function connectTenantBySlug(slug: string): Promise<DrizzleDb> {
  if (connCache.has(slug)) return connCache.get(slug)!;

  const [org] = await getPlatformDb()
    .select({ databaseUrl: organizations.databaseUrl, status: organizations.status })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org || org.status !== "active") {
    throw new Error(`[getDb] Clube '${slug}' não encontrado ou inativo (contexto de plataforma).`);
  }

  const platformKey = process.env.ENCRYPTION_KEY_PLATFORM_DB;
  if (!platformKey) {
    throw new Error("[getDb] ENCRYPTION_KEY_PLATFORM_DB não configurado (contexto de plataforma).");
  }

  const databaseUrl = decryptWithKey(org.databaseUrl, platformKey);
  const tenantDb = drizzle(neon(databaseUrl), { schema });
  connCache.set(slug, tenantDb);
  return tenantDb;
}

export async function getDb(): Promise<DrizzleDb> {
  const h = await headers();

  // Admin do sistema operando um clube escolhido → aponta pro DB daquele clube.
  const overrideSlug = await resolvePlatformOverrideSlug(h.get("x-pathname") ?? "");
  if (overrideSlug) return connectTenantBySlug(overrideSlug);

  const slug = h.get("x-tenant-slug");

  if (!slug) {
    // Estágio 2d: não há mais DB padrão em produção. Em DEV, usamos o
    // DATABASE_URL local como conveniência (localhost). Em produção, todo acesso
    // precisa resolver um tenant — o proxy já barra hosts sem tenant, então
    // chegar aqui sem slug em prod é um caso anômalo que deve falhar alto.
    if (process.env.NODE_ENV === "development" && process.env.DATABASE_URL) {
      return db;
    }
    throw new Error("[getDb] Nenhum tenant resolvido para este host (produção não possui DB padrão).");
  }

  if (connCache.has(slug)) return connCache.get(slug)!;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) {
    throw new Error(`[getDb] Tenant '${slug}' resolvido mas UPSTASH_REDIS_REST_URL ou UPSTASH_REDIS_REST_TOKEN não configurados.`);
  }

  try {
    const redis = new Redis({ url: redisUrl, token: redisToken });
    const host = h.get("host")?.split(":")[0] ?? "";
    const tenant = await redis.get<TenantContext>(`tenant:domain:${host}`);

    if (!tenant?.encryptedDatabaseUrl) {
      throw new Error(`[getDb] Tenant '${slug}' não encontrado no cache Redis para o host '${host}'. Verifique se o tenant foi provisionado corretamente.`);
    }

    const platformKey = process.env.ENCRYPTION_KEY_PLATFORM_DB;
    if (!platformKey) {
      throw new Error(`[getDb] ENCRYPTION_KEY_PLATFORM_DB não configurado — necessário para decifrar a URL do banco do tenant '${slug}'.`);
    }

    const databaseUrl = decryptWithKey(tenant.encryptedDatabaseUrl, platformKey);
    const tenantDb = drizzle(neon(databaseUrl), { schema });
    connCache.set(slug, tenantDb);
    return tenantDb;
  } catch (err) {
    // Re-throw errors we already formatted
    if (err instanceof Error && err.message.startsWith("[getDb]")) throw err;
    throw new Error(`[getDb] Falha ao resolver DB para tenant '${slug}': ${err instanceof Error ? err.message : String(err)}`);
  }
}
