import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });

// ─── Multi-tenant: per-request DB resolver ────────────────────────────────────
// Returns the tenant's Drizzle instance based on the x-tenant-slug header
// injected by proxy.ts. Falls back to the singleton db if no tenant is resolved.
// Nothing else in the codebase calls this yet — migration happens in Noite 2.

import { headers } from "next/headers";
import { Redis } from "@upstash/redis";
import type { TenantContext } from "@/lib/tenant";

type DrizzleDb = typeof db;

// Module-level cache per serverless instance (non-shared, per-invocation reuse)
const connCache = new Map<string, DrizzleDb>();

export async function getDb(): Promise<DrizzleDb> {
  const h = await headers();
  const slug = h.get("x-tenant-slug");

  // No slug = local dev or platform route → use singleton
  if (!slug) return db;
  if (connCache.has(slug)) return connCache.get(slug)!;

  // databaseUrl is cached in Redis by proxy.ts's resolveTenant call
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) return db;

  try {
    const redis = new Redis({ url: redisUrl, token: redisToken });
    const host = h.get("host")?.split(":")[0] ?? "";
    const tenant = await redis.get<TenantContext>(`tenant:domain:${host}`);

    if (!tenant?.databaseUrl) return db;

    const tenantDb = drizzle(neon(tenant.databaseUrl), { schema });
    connCache.set(slug, tenantDb);
    return tenantDb;
  } catch {
    return db;
  }
}
