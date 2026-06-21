import { headers } from "next/headers";
import { NextResponse } from "next/server";

// Temporary endpoint — remove after Noite 1 smoke test
export async function GET() {
  const h = await headers();
  const slug = h.get("x-tenant-slug");
  const host = h.get("host");
  return NextResponse.json({ slug, host, ok: !!slug });
}
