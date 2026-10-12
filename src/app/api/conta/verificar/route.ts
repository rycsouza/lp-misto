import { NextRequest, NextResponse } from "next/server";

/**
 * Links de ativação antigos (/api/conta/verificar?t=…). A ativação agora é
 * "crie sua senha": só quem recebeu o e-mail define a senha — confirmar o e-mail
 * sem isso ativaria uma conta com a senha de quem a cadastrou (sequestro de
 * conta pré-cadastro). Só redireciona; não altera nada (leitores de e-mail que
 * pré-carregam links não causam efeito).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const dest = new URL("/conta/redefinir", req.nextUrl);
  if (token) {
    dest.searchParams.set("t", token);
    dest.searchParams.set("novo", "1");
  }
  return NextResponse.redirect(dest);
}
