import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { AFFILIATE_COOKIE } from "@/lib/affiliates/utils";

// Mapa: prefixo de rota → chave de módulo
const ROUTE_TO_MODULE: [string, string][] = [
  ["/admin/pedidos",        "pedidos"],
  ["/admin/jogos",          "jogos"],
  ["/admin/noticias",       "noticias"],
  ["/admin/elenco",         "elenco"],
  ["/admin/patrocinadores", "patrocinadores"],
  ["/admin/loja",           "loja"],
  ["/admin/leads",          "leads"],
  ["/admin/upsell",         "upsell"],
  ["/admin/socios",         "socios"],
  ["/admin/diretoria",      "diretoria"],
  ["/admin/lendas",         "lendas"],
  ["/admin/personalidades", "personalidades"],
  ["/admin/historia",       "historia"],
];

// Rotas somente admin
const ADMIN_ONLY_ROUTES = ["/admin/configuracoes", "/admin/usuarios"];

export async function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Affiliate referral cookie: capture ?ref=CODE for all public pages
  if (!pathname.startsWith("/admin")) {
    const ref = searchParams.get("ref");
    if (ref && /^[a-zA-Z0-9]{4,20}$/.test(ref)) {
      const response = NextResponse.next();
      response.cookies.set(AFFILIATE_COOKIE, ref.toUpperCase(), {
        path: "/",
        sameSite: "lax",
        httpOnly: false,
      });
      return response;
    }
    return NextResponse.next();
  }

  // Permite login e aceitar convite sem verificação
  if (pathname === "/admin/login" || pathname.startsWith("/admin/aceitar-convite")) {
    return NextResponse.next();
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
    if (session.role === "admin") return NextResponse.next();

    // Editores: bloqueia rotas admin-only
    if (ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r))) {
      return NextResponse.redirect(new URL("/admin/dashboard", req.nextUrl));
    }

    // Editores: verifica permissão por módulo
    const matched = ROUTE_TO_MODULE.find(([prefix]) => pathname.startsWith(prefix));
    if (matched) {
      const [, moduleKey] = matched;
      if (!session.permissions?.[moduleKey]) {
        return NextResponse.redirect(new URL("/admin/dashboard", req.nextUrl));
      }
    }

    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL("/admin/login", req.nextUrl));
    res.cookies.delete("misto_admin_token");
    return res;
  }
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
