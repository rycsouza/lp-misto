import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({ row: null as unknown, dbCalls: 0, lastWhatsapp: null as unknown }));

vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.from = () => chain;
  chain.where = (cond: unknown) => {
    h.lastWhatsapp = cond;
    return chain;
  };
  chain.limit = async () => (h.row ? [h.row] : []);
  return {
    getDb: async () => {
      h.dbCalls++;
      return chain;
    },
  };
});

import { withStoredIdentity } from "./identity";

const STORED = { name: "Titular Exemplo", email: "titular@example.com" };

beforeEach(() => {
  h.row = STORED;
  h.dbCalls = 0;
});

describe("withStoredIdentity (cliente recorrente)", () => {
  it("nome e e-mail informados vencem e nem consultam o banco", async () => {
    const buyer = { name: "Outro Nome", email: "outro@example.com", whatsapp: "11900000000" };
    expect(await withStoredIdentity(buyer)).toEqual(buyer);
    expect(h.dbCalls).toBe(0);
  });

  it("sem nome/e-mail, completa a partir do cadastro do WhatsApp", async () => {
    const r = await withStoredIdentity({ name: "", email: "", whatsapp: "(11) 90000-0000" });
    expect(r).toMatchObject({ ...STORED, whatsapp: "(11) 90000-0000" });
    expect(h.dbCalls).toBe(1);
  });

  it("completa só o campo que faltou", async () => {
    const r = await withStoredIdentity({ name: "Nome Digitado", email: "", whatsapp: "11900000000" });
    expect(r).toMatchObject({ name: "Nome Digitado", email: STORED.email });
  });

  it("sem cadastro para o WhatsApp, devolve como veio (o schema rejeita depois)", async () => {
    h.row = null;
    const buyer = { name: "", email: "", whatsapp: "11900000000" };
    expect(await withStoredIdentity(buyer)).toEqual(buyer);
  });

  it("WhatsApp inválido não consulta o banco", async () => {
    const buyer = { name: "", email: "", whatsapp: "123" };
    expect(await withStoredIdentity(buyer)).toEqual(buyer);
    expect(h.dbCalls).toBe(0);
  });

  it("entrada que não é objeto passa direto", async () => {
    expect(await withStoredIdentity(undefined as unknown as { whatsapp: string })).toBeUndefined();
    expect(h.dbCalls).toBe(0);
  });
});
