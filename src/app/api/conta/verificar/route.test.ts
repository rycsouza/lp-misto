import { describe, it, expect, beforeEach, vi } from "vitest";

/** Confirmação de e-mail: confirma, NÃO abre sessão (login CSRF), e recusa link inválido. */
const AID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const h = vi.hoisted(() => ({ row: null as unknown, updates: [] as Record<string, unknown>[] }));

vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "update"]) chain[m] = () => chain;
  chain.limit = async () => (h.row ? [h.row] : []);
  chain.set = (v: Record<string, unknown>) => { h.updates.push(v); return { where: async () => [] }; };
  return { getDb: async () => chain };
});
vi.mock("@/lib/base-url", () => ({ getCurrentTenantSlug: async () => "clube-a" }));

import { GET } from "./route";
import { signAccountToken } from "@/lib/accounts/tokens";
import { NextRequest } from "next/server";

beforeEach(() => {
  process.env.TICKET_SIGNING_SECRET = "segredo-de-teste-com-tamanho-suficiente";
  h.row = { id: AID, emailVerifiedAt: null };
  h.updates = [];
});

describe("GET /api/conta/verificar", () => {
  it("link válido → confirma e redireciona sem cookie de sessão", async () => {
    const t = await signAccountToken("verify", { aid: AID, pwv: 1 }, "clube-a");
    const res = await GET(new NextRequest(`https://clube.example/api/conta/verificar?t=${t}`));
    expect(res.headers.get("location")).toBe("https://clube.example/conta?confirmacao=ok");
    expect(h.updates[0].emailVerifiedAt).toBeInstanceOf(Date);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("token de sessão/reset ou de outro clube não confirma", async () => {
    const sess = await signAccountToken("session", { aid: AID, pwv: 1 }, "clube-a");
    const outro = await signAccountToken("verify", { aid: AID, pwv: 1 }, "clube-b");
    for (const t of [sess, outro, "lixo"]) {
      const res = await GET(new NextRequest(`https://clube.example/api/conta/verificar?t=${t}`));
      expect(res.headers.get("location")).toContain("confirmacao=invalida");
    }
    expect(h.updates).toEqual([]);
  });
});
