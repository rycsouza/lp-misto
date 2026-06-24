import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getAdminSession } from "@/app/actions/admin-auth";
import type { ProvisionJob } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId obrigatório" }, { status: 400 });

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) {
    return NextResponse.json({ error: "Redis não configurado" }, { status: 503 });
  }

  const redis = new Redis({ url: redisUrl, token: redisToken });
  const job = await redis.get<ProvisionJob>(`provision:job:${jobId}`);
  if (!job) return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });

  return NextResponse.json(job);
}
