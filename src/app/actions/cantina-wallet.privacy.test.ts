import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Carteira da cantina: nome completo + QR (credencial do balcão) só para o DONO,
 * logado. Telefone digitado por terceiros não pode revelar nada (mesma regra do
 * lookupCustomer — ver customer-lookup.privacy.test.ts).
 */
const h = vi.hoisted(() => ({
  enabled: true,
  mine: null as null | { phone: string; where: unknown },
  customerRows: [] as { id: string; name: string }[],
  voucherRows: [] as unknown[],
  dbCalls: 0,
}));

vi.mock("@/lib/cantina/flag", () => ({
  get CANTINA_ENABLED() {
    return h.enabled;
  },
}));
vi.mock("@/lib/accounts/my-customer", () => ({ getMyCustomerWhere: async () => h.mine }));
vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "innerJoin"]) chain[m] = () => chain;
  chain.limit = async () => h.customerRows;
  chain.orderBy = async () => h.voucherRows;
  return {
    getDb: async () => {
      h.dbCalls++;
      return chain;
    },
  };
});
vi.mock("@/lib/admin/auth-guard", () => ({
  requireModule: async () => {
    throw new Error("não deve ser chamado");
  },
}));

import { getCantinaWallet } from "./cantina";

const PHONE = "11987654321";

beforeEach(() => {
  h.enabled = true;
  h.mine = null;
  h.customerRows = [{ id: "00000000-0000-4000-8000-0000000000aa", name: "Fulano de Teste" }];
  h.voucherRows = [];
  h.dbCalls = 0;
  vi.stubEnv("TICKET_SIGNING_SECRET", "test-ticket-secret-0000000000000000");
});

describe("getCantinaWallet — só o dono, logado", () => {
  it("feature desligada → nada", async () => {
    h.enabled = false;
    h.mine = { phone: PHONE, where: {} };
    expect(await getCantinaWallet(PHONE)).toEqual({ found: false });
    expect(h.dbCalls).toBe(0);
  });

  it("anônimo com telefone de um cliente → pede login, sem nome nem QR", async () => {
    const r = await getCantinaWallet(PHONE);
    expect(r).toEqual({ found: false, needsLogin: true });
    expect(r.customerName).toBeUndefined();
    expect(r.walletToken).toBeUndefined();
    expect(h.dbCalls).toBe(0);
  });

  it("logado consultando OUTRO telefone → nada", async () => {
    h.mine = { phone: "11900000000", where: {} };
    expect(await getCantinaWallet(PHONE)).toEqual({ found: false });
    expect(h.dbCalls).toBe(0);
  });

  it("logado consultando o próprio telefone → carteira com QR", async () => {
    h.mine = { phone: PHONE, where: {} };
    const r = await getCantinaWallet("(11) 98765-4321");
    expect(r.found).toBe(true);
    expect(r.customerName).toBe("Fulano de Teste");
    expect(typeof r.walletToken).toBe("string");
  });
});
