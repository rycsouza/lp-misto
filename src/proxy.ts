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

export async function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Resolve tenant and build request headers with slug injected
  const host = req.headers.get("host") ?? "";
  const tenant = await resolveTenant(host);

  // Fail-closed (Estágio 2d): não há DB padrão em produção — todo host precisa
  // resolver um tenant. Host sem tenant → tela de erro (ou 421 em /api), nunca o
  // site de outro cliente. Exceções: rotas de plataforma e localhost em dev.
  const tenantAgnostic = TENANT_AGNOSTIC_PREFIXES.some((p) => pathname.startsWith(p));
  if (!tenant && !tenantAgnostic && !isDevLocalhost(host)) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Domínio não configurado" }, { status: 421 });
    }
    return NextResponse.rewrite(new URL("/tenant-nao-encontrado", req.nextUrl));
  }

  const requestHeaders = new Headers(req.headers);
  if (tenant) requestHeaders.set("x-tenant-slug", tenant.slug);
  requestHeaders.set("x-pathname", pathname);
  const nextOpts = { request: { headers: requestHeaders } };

  // Captura ?ref=CODE (afiliado) e ?cupom=CODE em qualquer página pública,
  // persistindo em cookie para sobreviver à navegação até o checkout.
  if (!pathname.startsWith("/admin")) {
    const ref = searchParams.get("ref");
    const cupom = searchParams.get("cupom");
    const validRef = ref && /^[a-zA-Z0-9]{4,20}$/.test(ref);
    const validCupom = cupom && COUPON_CODE_RE.test(cupom);

    if (validRef || validCupom) {
      const response = NextResponse.next(nextOpts);
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
    return NextResponse.next(nextOpts);
  }

  // Permite login e aceitar convite sem verificação
  if (pathname === "/admin/login" || pathname.startsWith("/admin/aceitar-convite")) {
    return NextResponse.next(nextOpts);
  }

  const token = req.cookies.get("misto_admin_token")?.value;
  if (!token) return NextResponse.redirect(new URL("/admin/login", req.nextUrl));

  try {
    const secret = new TextEncoder().encode(
      process.env.ADMIN_JWT_SECRET ?? process.env.ENCRYPTION_KEY
    );
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const session = payload as { role: string; permissions?: Record<string, boolean> };

    // Admins têm acesso total
    if (session.role === "admin") return NextResponse.next(nextOpts);

    // Editores: bloqueia rotas que são sempre admin-only
    if (ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r))) {
      return NextResponse.redirect(new URL("/admin/dashboard", req.nextUrl));
    }

    // Verificação de permissão por módulo fica no layout.tsx (server-side,
    // com permissões sempre atualizadas do DB via getAdminSession).
    return NextResponse.next(nextOpts);
  } catch {
    const res = NextResponse.redirect(new URL("/admin/login", req.nextUrl));
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
