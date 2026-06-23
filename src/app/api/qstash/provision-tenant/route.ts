import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { Redis } from "@upstash/redis";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql as rawSql } from "drizzle-orm";
import { getPlatformDb } from "@/lib/db/platform/client";
import { organizations, organizationDomains } from "@/lib/db/platform/schema";
import { encryptWithKey } from "@/lib/payment/encryption";
import { createNeonProject } from "@/lib/neon-api";
import { TENANT_SCHEMA_STATEMENTS } from "@/lib/db/tenant-schema";
import { getTenantCacheKey } from "@/lib/tenant";
import type { ProvisionJob } from "@/app/api/admin/tenants/route";

export const runtime = "nodejs";
export const maxDuration = 60;

async function updateJob(redis: Redis, jobId: string, update: Partial<ProvisionJob>) {
  const key = `provision:job:${jobId}`;
  const current = (await redis.get<ProvisionJob>(key)) ?? { status: "pending" };
  await redis.set<ProvisionJob>(key, { ...current, ...update }, { ex: 3600 });
}

export async function POST(req: Request) {
  // ── QStash signature verification ────────────────────────────────────────────
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  // In local dev (no signing keys), skip verification
  if (currentKey && nextKey) {
    const receiver = new Receiver({ currentSigningKey: currentKey, nextSigningKey: nextKey });
    const rawBody = await req.text();
    const signature = req.headers.get("Upstash-Signature") ?? "";
    try {
      await receiver.verify({ signature, body: rawBody });
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    // Re-parse body after consuming it as text
    const { jobId, name, slug, domain } = JSON.parse(rawBody);
    return runProvisioning({ jobId, name, slug, domain });
  }

  const { jobId, name, slug, domain } = await req.json();
  return runProvisioning({ jobId, name, slug, domain });
}

async function runProvisioning({
  jobId,
  name,
  slug,
  domain,
}: {
  jobId: string;
  name: string;
  slug: string;
  domain: string;
}) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const platformKey = process.env.ENCRYPTION_KEY_PLATFORM_DB;

  if (!redisUrl || !redisToken || !platformKey) {
    return NextResponse.json({ error: "Env vars ausentes" }, { status: 500 });
  }

  const redis = new Redis({ url: redisUrl, token: redisToken });

  // Idempotency: skip if already running or done
  const current = await redis.get<ProvisionJob>(`provision:job:${jobId}`);
  if (current?.status === "running" || current?.status === "done") {
    return NextResponse.json({ ok: true });
  }

  await updateJob(redis, jobId, { status: "running" });

  try {
    // ── 1. Create Neon project ─────────────────────────────────────────────────
    const { connectionUri } = await createNeonProject(`tenant-${slug}`);

    // ── 2. Run schema on new DB ────────────────────────────────────────────────
    const tenantDb = drizzle(neon(connectionUri));
    for (const stmt of TENANT_SCHEMA_STATEMENTS) {
      await tenantDb.execute(rawSql.raw(stmt));
    }

    // ── 3. Encrypt URL and persist to Platform DB ──────────────────────────────
    const encryptedDatabaseUrl = encryptWithKey(connectionUri, platformKey);

    const platformDb = getPlatformDb();
    const [org] = await platformDb
      .insert(organizations)
      .values({ name, slug, databaseUrl: encryptedDatabaseUrl })
      .returning({ id: organizations.id });

    await platformDb.insert(organizationDomains).values({
      domain,
      orgId: org.id,
      isPrimary: true,
      verifiedAt: new Date(),
    });

    // ── 4. Warm Redis cache ────────────────────────────────────────────────────
    await redis.set(
      getTenantCacheKey(domain),
      { orgId: org.id, slug, encryptedDatabaseUrl },
      { ex: 300 }
    );

    await updateJob(redis, jobId, { status: "done", slug, doneAt: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[provision-tenant] error:", message);
    await updateJob(redis, jobId, { status: "error", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
