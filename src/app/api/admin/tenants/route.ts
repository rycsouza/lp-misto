import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Client } from "@upstash/qstash";
import { Redis } from "@upstash/redis";
import { createNeonProject } from "@/lib/neon-api";

// Edge runtime: 30s timeout (vs 10s for serverless) — needed for Neon project creation
export const runtime = "edge";

export interface ProvisionJob {
  status: "pending" | "running" | "done" | "error";
  slug?: string;
  error?: string;
  doneAt?: string;
}

async function isAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("misto_admin_token")?.value;
    if (!token) return false;
    const secret = new TextEncoder().encode(
      process.env.ADMIN_JWT_SECRET ?? process.env.ENCRYPTION_KEY ?? ""
    );
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; slug?: string; domain?: string; ownerName?: string; ownerEmail?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, slug, domain, ownerName, ownerEmail } = body;
  if (!name?.trim() || !slug?.trim() || !domain?.trim()) {
    return NextResponse.json({ error: "name, slug e domain são obrigatórios" }, { status: 400 });
  }
  if (!ownerName?.trim() || !ownerEmail?.trim()) {
    return NextResponse.json({ error: "ownerName e ownerEmail são obrigatórios" }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "slug inválido: use apenas letras minúsculas, números e hífens" },
      { status: 400 }
    );
  }

  const qstashToken = process.env.QSTASH_TOKEN;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!qstashToken || !redisUrl || !redisToken) {
    return NextResponse.json({ error: "Serviço de provisionamento não configurado" }, { status: 503 });
  }

  const jobId = crypto.randomUUID();
  const redis = new Redis({ url: redisUrl, token: redisToken });

  await redis.set<ProvisionJob>(`provision:job:${jobId}`, { status: "pending", slug }, { ex: 3600 });

  // ── Create Neon project here (Edge fn = 30s timeout, enough for Neon API) ──
  let connectionUri: string;
  try {
    const result = await createNeonProject(`tenant-${slug.trim()}`);
    connectionUri = result.connectionUri;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await redis.set<ProvisionJob>(`provision:job:${jobId}`, { status: "error", error: message }, { ex: 3600 });
    return NextResponse.json({ error: `Falha ao criar banco Neon: ${message}` }, { status: 500 });
  }

  // ── Publish QStash for the fast part: schema + Platform DB ──────────────────
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.APP_URL ?? "http://localhost:3000");

  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

  const client = new Client({ token: qstashToken });
  await client.publishJSON({
    url: `${baseUrl}/api/qstash/provision-tenant`,
    headers: bypassSecret
      ? { "x-vercel-protection-bypass": bypassSecret }
      : undefined,
    body: {
      jobId,
      name: name.trim(),
      slug: slug.trim(),
      domain: domain.trim().toLowerCase(),
      connectionUri,
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim().toLowerCase(),
    },
    retries: 3,
  });

  return NextResponse.json({ jobId });
}
