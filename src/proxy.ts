import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { AFFILIATE_COOKIE } from "@/lib/affiliates/utils";
import { COUPON_COOKIE, COUPON_CODE_RE } from "@/lib/coupon/cookie";
import { resolveTenant } from "@/lib/tenant";

// Rotas somente admin (editores nunca podem acessar)
const ADMIN_ONLY_ROUTES = ["/admin/configuracoes", "/admin/usuarios", "/admin/auditoria", "/admin/tenants"];

// Rotas de PLATAFORMA que rodam sem tenant (usam o platform DB, não getDb):
// cron e callbacks do QStash. Passam pelo fail-closed mesmo sem tenant resolvido.
const TENANT_AGNOSTIC_PREFIXES = ["/api/cron", "/api/qstash"];

/** Em desenvolvimento, localhost é servido pelo DATABASE_URL local (escape de dev). */
function isDevLocalhost(host: string): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  const h = host.split(":")[0].toLowerCase();
  return h === "localhost" || h === "127.0.0.1";
}

/**
 * Content-Security-Policy por requisição, com nonce único.
 *
 * - script-src usa `'nonce-…' 'strict-dynamic'` (sem 'unsafe-inline'): só scripts
 *   com o nonce do request — e os que eles carregam — executam. O Next injeta o
 *   nonce nos seus próprios scripts automaticamente (lê o header do request). O
 *   SDK do Mercado Pago é injetado por um bundle já confiável, logo `strict-dynamic`
 *   o cobre; `https://sdk.mercadopago.com` fica como fallback p/ browsers antigos.
 * - style-src mantém 'unsafe-inline' de propósito: a UI usa muitos `style={{}}`
 *   (atributos de estilo) e estilo não é vetor de XSS de script.
 * - 'unsafe-eval' só em dev (React usa eval p/ debug); nunca em produção.
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://sdk.mercadopago.com${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self' https://api.mercadopago.com https://events.mercadopago.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // CSP por request: nonce novo a cada visita (obrigatório p/ o nonce ser útil).
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  // Resolve tenant and build request headers with slug + nonce + CSP injetados.
  const host = req.headers.get("host") ?? "";
  const tenant = await resolveTenant(host);

  const requestHeaders = new Headers(req.headers);
  if (tenant) requestHeaders.set("x-tenant-slug", tenant.slug);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-nonce", nonce);
  // O Next lê o nonce deste header do request p/ aplicar nos scripts que renderiza.
  requestHeaders.set("content-security-policy", csp);
  const nextOpts = { request: { headers: requestHeaders } };

  // Carimba o CSP na resposta (é o header que o browser realmente aplica).
  const withCsp = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  // Fail-closed (Estágio 2d): não há DB padrão em produção — todo host precisa
  // resolver um tenant. Host sem tenant → tela de erro (ou 421 em /api), nunca o
  // site de outro cliente. Exceções: rotas de plataforma e localhost em dev.
  const tenantAgnostic = TENANT_AGNOSTIC_PREFIXES.some((p) => pathname.startsWith(p));
  if (!tenant && !tenantAgnostic && !isDevLocalhost(host)) {
    if (pathname.startsWith("/api")) {
      return withCsp(NextResponse.json({ error: "Domínio não configurado" }, { status: 421 }));
    }
    return withCsp(NextResponse.rewrite(new URL("/tenant-nao-encontrado", req.nextUrl), nextOpts));
  }

  // Captura ?ref=CODE (afiliado) e ?cupom=CODE em qualquer página pública,
  // persistindo em cookie para sobreviver à navegação até o checkout.
  if (!pathname.startsWith("/admin")) {
    const ref = searchParams.get("ref");
    const cupom = searchParams.get("cupom");
    const validRef = ref && /^[a-zA-Z0-9]{4,20}$/.test(ref);
    const validCupom = cupom && COUPON_CODE_RE.test(cupom);

    if (validRef || validCupom) {
      const response = withCsp(NextResponse.next(nextOpts));
      if (validRef) {
        response.cookies.set(AFFILIATE_COOKIE, ref.toUpperCase(), {
          path: "/",
          sameSite: "lax",
          httpOnly: false,
        });
      }
      if (validCupom) {
        response.cookies.set(COUPON_COOKIE, cupom, {
          path: "/",
          sameSite: "lax",
          httpOnly: false,
          maxAge: 60 * 60 * 24 * 30, // 30 dias
        });
      }
      return response;
    }
    return withCsp(NextResponse.next(nextOpts));
  }

  // Permite login e aceitar convite sem verificação
  if (pathname === "/admin/login" || pathname.startsWith("/admin/aceitar-convite")) {
    return withCsp(NextResponse.next(nextOpts));
  }

  // ── Console do ADMIN DO SISTEMA (plataforma) ──────────────────────────────
  // Escopo separado: usa o cookie/segredo de plataforma, não o token de tenant.
  if (pathname === "/admin/sistema/login") {
    return withCsp(NextResponse.next(nextOpts));
  }
  if (pathname === "/admin/sistema" || pathname.startsWith("/admin/sistema/")) {
    const ptoken = req.cookies.get("sport55_platform_token")?.value;
    if (!ptoken) return withCsp(NextResponse.redirect(new URL("/admin/sistema/login", req.nextUrl)));
    try {
      const psecret = new TextEncoder().encode(
        process.env.PLATFORM_JWT_SECRET ?? process.env.ADMIN_JWT_SECRET
      );
      const { payload } = await jwtVerify(ptoken, psecret, { algorithms: ["HS256"] });
      if (payload.scope !== "platform") throw new Error("scope");
      return withCsp(NextResponse.next(nextOpts));
    } catch {
      const res = withCsp(NextResponse.redirect(new URL("/admin/sistema/login", req.nextUrl)));
      res.cookies.delete("sport55_platform_token");
      return res;
    }
  }

  const token = req.cookies.get("misto_admin_token")?.value;
  if (!token) return withCsp(NextResponse.redirect(new URL("/admin/login", req.nextUrl)));

  try {
    const secret = new TextEncoder().encode(
      process.env.ADMIN_JWT_SECRET ?? process.env.ENCRYPTION_KEY
    );
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const session = payload as { role: string; permissions?: Record<string, boolean> };

    // Admins têm acesso total
    if (session.role === "admin") return withCsp(NextResponse.next(nextOpts));

    // Editores: bloqueia rotas que são sempre admin-only
    if (ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r))) {
      return withCsp(NextResponse.redirect(new URL("/admin/dashboard", req.nextUrl)));
    }

    // Verificação de permissão por módulo fica no layout.tsx (server-side,
    // com permissões sempre atualizadas do DB via getAdminSession).
    return withCsp(NextResponse.next(nextOpts));
  } catch {
    const res = withCsp(NextResponse.redirect(new URL("/admin/login", req.nextUrl)));
    res.cookies.delete("misto_admin_token");
    return res;
  }
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
