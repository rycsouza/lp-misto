"use server";

import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { affiliates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AffiliateSession {
  affiliateId: string;
  code: string;
  name: string;
  email: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET ?? process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("ADMIN_JWT_SECRET ou ENCRYPTION_KEY não configurado");
  return new TextEncoder().encode(secret);
}

function getTransport() {
  const host = process.env.MAILTRAP_HOST;
  const user = process.env.MAILTRAP_USER;
  const pass = process.env.MAILTRAP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.MAILTRAP_PORT ?? 587),
    auth: { user, pass },
  });
}

// ─── Session ──────────────────────────────────────────────────────────────────

export async function getAffiliateSession(): Promise<AffiliateSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("misto_affiliate_token")?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ["HS256"] });

    return {
      affiliateId: payload.affiliateId as string,
      code: payload.code as string,
      name: payload.name as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

export async function affiliateLogout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("misto_affiliate_token");
  redirect("/afiliados/login");
}

// ─── Magic Link ───────────────────────────────────────────────────────────────

export async function requestAffiliateLogin(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  if (!email) return { success: false, error: "E-mail obrigatório." };

  const [affiliate] = await db
    .select({ id: affiliates.id, name: affiliates.name, email: affiliates.email, code: affiliates.code, active: affiliates.active })
    .from(affiliates)
    .where(eq(affiliates.email, email))
    .limit(1);

  // Don't reveal whether email exists
  if (!affiliate || !affiliate.active) {
    return { success: true };
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await db
    .update(affiliates)
    .set({ loginToken: token, loginTokenExpiresAt: expiresAt })
    .where(eq(affiliates.id, affiliate.id));

  const appUrl = (process.env.APP_URL ?? "https://mistoesporteclube.com.br").replace(/\/$/, "");
  const loginLink = `${appUrl}/afiliados/auth?token=${token}`;

  const transport = getTransport();
  if (transport) {
    await transport.sendMail({
      from: `"Misto EC" <${process.env.MAILTRAP_FROM ?? "noreply@mistoesporteclube.com.br"}>`,
      to: affiliate.email,
      subject: "Acesso ao seu Portal de Afiliado",
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#111;border:1px solid #222;border-radius:12px;overflow:hidden">
        <tr><td style="background:#c9a227;padding:24px 32px;text-align:center">
          <span style="font-size:22px;font-weight:900;color:#000;letter-spacing:2px">MISTO EC</span>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="color:#aaa;font-size:14px;margin:0 0 8px">Olá, ${affiliate.name}!</p>
          <h2 style="color:#fff;font-size:20px;margin:0 0 16px">Acesse seu Portal de Afiliado</h2>
          <p style="color:#aaa;font-size:14px;margin:0 0 24px;line-height:1.6">
            Clique no botão abaixo para entrar no seu painel. O link é válido por 30 minutos.
          </p>
          <a href="${loginLink}" style="display:inline-block;background:#c9a227;color:#000;font-weight:700;font-size:14px;padding:14px 28px;border-radius:8px;text-decoration:none">
            Acessar meu portal →
          </a>
          <p style="color:#555;font-size:11px;margin:24px 0 0;line-height:1.6">
            Se você não solicitou este acesso, ignore este e-mail.<br>
            Link: <a href="${loginLink}" style="color:#c9a227">${loginLink}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    }).catch(console.error);
  }

  return { success: true };
}

