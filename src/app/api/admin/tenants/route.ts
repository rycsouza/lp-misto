import { NextResponse } from "next/server";
import { Client } from "@upstash/qstash";
import { Redis } from "@upstash/redis";
import { getAdminSession } from "@/app/actions/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ProvisionJob {
  status: "pending" | "running" | "done" | "error";
  slug?: string;
  error?: string;
  doneAt?: string;
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; slug?: string; domain?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, slug, domain } = body;
  if (!name?.trim() || !slug?.trim() || !domain?.trim()) {
    return NextResponse.json({ error: "name, slug e domain são obrigatórios" }, { status: 400 });
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

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.APP_URL ?? "http://localhost:3000");

  const client = new Client({ token: qstashToken });
  await client.publishJSON({
    url: `${baseUrl}/api/qstash/provision-tenant`,
    body: { jobId, name: name.trim(), slug: slug.trim(), domain: domain.trim().toLowerCase() },
    retries: 0,
  });

  return NextResponse.json({ jobId });
}
