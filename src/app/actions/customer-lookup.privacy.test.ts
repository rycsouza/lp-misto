import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Privacidade (LGPD): o lookup por WhatsApp é público e sem autenticação. Ele
 * pode confirmar que existe cadastro, mas NUNCA devolver nome/e-mail completos
 * nem o CPF — só versões mascaradas e se há CPF salvo. E saveCustomerData nunca
 * sobrescreve o cadastro com nome/e-mail vazios ou inválidos.
 */
const STORED = { name: "Titular Exemplo Silva", email: "titular@example.com", cpf: "11144477735" };

const h = vi.hoisted(() => ({ row: null as unknown, upserts: 0, limited: false, owner: true, remembered: [] as unknown[] }));

vi.mock("@/lib/customers/device-trust", () => ({
  canReuseStoredIdentity: async () => h.owner,
  rememberDeviceIfOwner: async (...a: unknown[]) => {
    h.remembered.push(a);
  },
}));

vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "values", "onConflictDoUpdate"]) chain[m] = () => chain;
  chain.limit = async () => (h.row ? [h.row] : []);
  chain.insert = () => {
    h.upserts++;
    return chain;
  };
  chain.returning = async () => [{ id: "cust-1" }];
  return { getDb: async () => chain };
});
vi.mock("@/lib/ratelimit", () => ({
  getClientIp: async () => "203.0.113.10",
  rateLimit: async () => ({ ok: !h.limited, remaining: 0 }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

import { lookupCustomer, saveCustomerData } from "./checkout";

beforeEach(() => {
  h.row = STORED;
  h.upserts = 0;
  h.limited = false;
  h.owner = true;
  h.remembered = [];
});

describe("lookupCustomer não expõe dados pessoais completos", () => {
  it("dono (logado ou aparelho lembrado): mascarados + hasCpf + canUseStored", async () => {
    const r = await lookupCustomer("11900000000");
    expect(r).toEqual({
      found: true,
      maskedName: "Titular ***",
      maskedEmail: "titu***@example.com",
      hasCpf: true,
      canUseStored: true,
    });
  });

  it("outra pessoa digitando o WhatsApp: não pode usar o cadastro e nem sabe se há CPF", async () => {
    h.owner = false;
    const r = await lookupCustomer("11900000000");
    expect(r).toMatchObject({ found: true, hasCpf: false, canUseStored: false });
  });

  it("nenhum valor completo aparece em lugar nenhum da resposta", async () => {
    const json = JSON.stringify(await lookupCustomer("11900000000"));
    expect(json).not.toContain(STORED.name);
    expect(json).not.toContain(STORED.email);
    expect(json).not.toContain(STORED.cpf);
  });

  it("sem cadastro → found:false", async () => {
    h.row = null;
    expect(await lookupCustomer("11900000000")).toEqual({ found: false });
  });

  it("rate limit estourado degrada para found:false", async () => {
    h.limited = true;
    expect(await lookupCustomer("11900000000")).toEqual({ found: false });
  });
});

describe("saveCustomerData não sobrescreve o cadastro com dados vazios/inválidos", () => {
  it("nome/e-mail vazios (cliente usou o cadastro) → não grava", async () => {
    await saveCustomerData("", "", "11900000000");
    expect(h.upserts).toBe(0);
  });

  it("e-mail inválido → não grava", async () => {
    await saveCustomerData("Nome Valido", "nao-e-email", "11900000000");
    expect(h.upserts).toBe(0);
  });

  it("dados válidos → grava e tenta lembrar o aparelho (a checagem de dono fica no device-trust)", async () => {
    await saveCustomerData("Nome Valido", "novo@example.com", "11900000000");
    expect(h.upserts).toBe(1);
    expect(h.remembered).toEqual([["11900000000", "novo@example.com"]]);
  });

  it("dados inválidos → não lembra o aparelho", async () => {
    await saveCustomerData("", "", "11900000000");
    expect(h.remembered).toEqual([]);
  });
});
