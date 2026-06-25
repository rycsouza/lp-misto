import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { Redis } from "@upstash/redis";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql as rawSql } from "drizzle-orm";
import { getPlatformDb } from "@/lib/db/platform/client";
import { organizations, organizationDomains } from "@/lib/db/platform/schema";
import { adminInvites } from "@/lib/db/schema/admin-auth";
import { encryptWithKey } from "@/lib/payment/encryption";
import { TENANT_SCHEMA_STATEMENTS } from "@/lib/db/tenant-schema";
import { getTenantCacheKey } from "@/lib/tenant";
import { sendTenantOnboardingEmail } from "@/lib/email-admin";
import { registerTenantSubdomain } from "@/lib/dns";
import type { ProvisionJob } from "@/app/api/admin/tenants/route";

// Node.js runtime: schema execution requires drizzle + neon HTTP
export const runtime = "nodejs";
export const maxDuration = 60;

async function updateJob(redis: Redis, jobId: string, update: Partial<ProvisionJob>) {
  const key = `provision:job:${jobId}`;
  const current = (await redis.get<ProvisionJob>(key)) ?? { status: "pending" };
  await redis.set<ProvisionJob>(key, { ...current, ...update }, { ex: 3600 });
}

export async function POST(req: Request) {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  let payload: { jobId: string; name: string; slug: string; domain: string; connectionUri: string; ownerName: string; ownerEmail: string };

  if (currentKey && nextKey) {
    const receiver = new Receiver({ currentSigningKey: currentKey, nextSigningKey: nextKey });
    const rawBody = await req.text();
    const signature = req.headers.get("Upstash-Signature") ?? "";
    try {
      await receiver.verify({ signature, body: rawBody });
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    payload = JSON.parse(rawBody);
  } else {
    payload = await req.json();
  }

  const { jobId, name, slug, domain, connectionUri, ownerName, ownerEmail } = payload;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const platformKey = process.env.ENCRYPTION_KEY_PLATFORM_DB;

  if (!redisUrl || !redisToken || !platformKey) {
    return NextResponse.json({ error: "Env vars ausentes" }, { status: 500 });
  }

  const redis = new Redis({ url: redisUrl, token: redisToken });

  // Idempotency: skip if already done
  const current = await redis.get<ProvisionJob>(`provision:job:${jobId}`);
  if (current?.status === "done") return NextResponse.json({ ok: true });

  await updateJob(redis, jobId, { status: "running" });

  try {
    // ── 1. Run schema on new DB (~2-4s, well within 10s limit) ────────────────
    const tenantDb = drizzle(neon(connectionUri));
    for (const stmt of TENANT_SCHEMA_STATEMENTS) {
      await tenantDb.execute(rawSql.raw(stmt));
    }

    // ── 2. Encrypt URL and persist to Platform DB ──────────────────────────────
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

    // ── 3. Registrar subdomínio sport55.com.br (Cloudflare + Vercel) ──────────
    const dnsResult = await registerTenantSubdomain(slug);

    if (dnsResult.ok) {
      await platformDb.insert(organizationDomains).values({
        domain: dnsResult.subdomain,
        orgId: org.id,
        isPrimary: false,
        verifiedAt: new Date(),
      }).onConflictDoNothing();
    } else {
      console.warn(`[provision-tenant] DNS falhou para ${slug}: ${dnsResult.error}`);
    }

    // ── 4. Warm Redis cache (domínio principal + subdomínio sport55) ───────────
    const tenantCtx = { orgId: org.id, slug, encryptedDatabaseUrl };
    await redis.set(getTenantCacheKey(domain), tenantCtx, { ex: 300 });

    if (dnsResult.ok) {
      await redis.set(getTenantCacheKey(dnsResult.subdomain), tenantCtx, { ex: 300 });
    }

    // ── 5. Create first-access invite in tenant DB ─────────────────────────────
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h
    const SYSTEM_UUID = "00000000-0000-0000-0000-000000000001";

    await tenantDb.insert(adminInvites).values({
      token: inviteToken,
      email: ownerEmail,
      name: ownerName,
      role: "admin",
      permissions: {},
      invitedBy: SYSTEM_UUID,
      expiresAt,
    });

    // ── 6. Send welcome e-mail with magic link ─────────────────────────────────
    const inviteLink = `https://${domain}/admin/aceitar-convite?token=${inviteToken}`;
    await sendTenantOnboardingEmail({
      to: ownerEmail,
      ownerName,
      clubName: name,
      domain,
      inviteLink,
    });

    await updateJob(redis, jobId, { status: "done", slug, doneAt: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[provision-tenant] error:", message);
    await updateJob(redis, jobId, { status: "error", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
