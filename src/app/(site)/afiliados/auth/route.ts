import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { affiliates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function getJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET ?? process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("ADMIN_JWT_SECRET ou ENCRYPTION_KEY não configurado");
  return new TextEncoder().encode(secret);
}

const appUrl = (process.env.APP_URL ?? "https://mistoesporteclube.com.br").replace(/\/$/, "");

function errorRedirect(msg: string) {
  return NextResponse.redirect(
    `${appUrl}/afiliados/login?error=${encodeURIComponent(msg)}`
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";

  if (!token) return errorRedirect("Link inválido.");

  const [affiliate] = await db
    .select()
    .from(affiliates)
    .where(eq(affiliates.loginToken, token))
    .limit(1);

  if (!affiliate || !affiliate.active) {
    return errorRedirect("Link inválido ou expirado.");
  }

  if (!affiliate.loginTokenExpiresAt || affiliate.loginTokenExpiresAt < new Date()) {
    return errorRedirect("Este link expirou. Solicite um novo.");
  }

  // Consume the token
  await db
    .update(affiliates)
    .set({ loginToken: null, loginTokenExpiresAt: null })
    .where(eq(affiliates.id, affiliate.id));

  const jwtToken = await new SignJWT({
    affiliateId: affiliate.id,
    code: affiliate.code,
    name: affiliate.name,
    email: affiliate.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());

  const cookieStore = await cookies();
  cookieStore.set("misto_affiliate_token", jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return NextResponse.redirect(`${appUrl}/afiliados/${affiliate.code}`);
}
