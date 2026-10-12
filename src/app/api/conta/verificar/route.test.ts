import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

/**
 * Links de ativação antigos: só redirecionam para "crie sua senha" — não
 * confirmam nada sozinhos (confirmar sem o dono do e-mail definir a senha
 * permitiria sequestro de conta pré-cadastro) e não abrem sessão.
 */
beforeEach(() => {
  process.env.TICKET_SIGNING_SECRET = "segredo-de-teste-com-tamanho-suficiente";
});

describe("GET /api/conta/verificar", () => {
  it("leva o token para a página de criar senha, sem cookie", async () => {
    const res = await GET(new NextRequest("https://clube.example/api/conta/verificar?t=abc.def.ghi"));
    expect(res.headers.get("location")).toBe("https://clube.example/conta/redefinir?t=abc.def.ghi&novo=1");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("sem token → página de senha sem token (mostra 'link inválido')", async () => {
    const res = await GET(new NextRequest("https://clube.example/api/conta/verificar"));
    expect(res.headers.get("location")).toBe("https://clube.example/conta/redefinir");
  });
});
