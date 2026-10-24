import { describe, it, expect, beforeEach, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/**
 * Endereços salvos são dado pessoal. O telefone digitado no checkout NÃO prova
 * identidade: ler/gravar exige conta logada, e o filtro amarra WhatsApp E e-mail
 * verificado da conta ao cadastro de compras.
 */
const h = vi.hoisted(() => ({
  account: null as null | { id: string; email: string; name: string; whatsapp: string | null },
  rows: [] as { addresses: unknown }[],
  wheres: [] as unknown[],
  updates: [] as unknown[],
  dbCalls: 0,
}));

vi.mock("@/lib/accounts/session", () => ({ getCustomerAccount: async () => h.account }));
vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.from = () => chain;
  chain.where = (w: unknown) => {
    h.wheres.push(w);
    return chain;
  };
  chain.limit = async () => h.rows;
  chain.update = () => ({
    set: (v: unknown) => ({
      where: async (w: unknown) => {
        h.updates.push(v);
        h.wheres.push(w);
      },
    }),
  });
  return {
    getDb: async () => {
      h.dbCalls++;
      return chain;
    },
  };
});

import { getCustomerAddresses, saveCustomerAddress } from "./shipping";

const ADDR = {
  cep: "01001000",
  logradouro: "Praça da Sé",
  numero: "1",
  complemento: "",
  bairro: "Sé",
  cidade: "São Paulo",
  estado: "SP",
};
const dialect = new PgDialect();
const render = (w: unknown) => dialect.sqlToQuery(w as SQL);

beforeEach(() => {
  h.account = null;
  h.rows = [{ addresses: [ADDR] }];
  h.wheres = [];
  h.updates = [];
  h.dbCalls = 0;
});

describe("endereços salvos — só do cliente logado", () => {
  it("sem sessão: não lê o banco e não devolve endereço", async () => {
    expect(await getCustomerAddresses()).toEqual({ canSave: false, addresses: [] });
    expect(h.dbCalls).toBe(0);
  });

  it("sem sessão: salvar é no-op", async () => {
    await saveCustomerAddress(ADDR);
    expect(h.dbCalls).toBe(0);
    expect(h.updates).toEqual([]);
  });

  it("conta sem WhatsApp: nada", async () => {
    h.account = { id: "a", email: "eu@example.test", name: "Eu", whatsapp: null };
    expect(await getCustomerAddresses()).toEqual({ canSave: false, addresses: [] });
    expect(h.dbCalls).toBe(0);
  });

  it("logado: filtro usa WhatsApp E e-mail da SESSÃO", async () => {
    h.account = { id: "a", email: "Eu@Example.test", name: "Eu", whatsapp: "11987654321" };
    const r = await getCustomerAddresses();
    expect(r).toEqual({ canSave: true, addresses: [ADDR] });
    const q = render(h.wheres[0]);
    expect(q.sql).toMatch(/"whatsapp" = \$1/);
    expect(q.sql).toMatch(/lower\("customers"\."email"\) = \$2/);
    expect(q.params).toEqual(["11987654321", "eu@example.test"]);
  });

  it("logado sem cadastro de compras correspondente: canSave=false", async () => {
    h.account = { id: "a", email: "eu@example.test", name: "Eu", whatsapp: "11987654321" };
    h.rows = [];
    expect(await getCustomerAddresses()).toEqual({ canSave: false, addresses: [] });
  });

  it("payload fora do schema (campo extra / CEP inválido) não é gravado", async () => {
    h.account = { id: "a", email: "eu@example.test", name: "Eu", whatsapp: "11987654321" };
    await saveCustomerAddress({ ...ADDR, extra: "x" } as never);
    await saveCustomerAddress({ ...ADDR, cep: "abc" });
    await saveCustomerAddress({ ...ADDR, logradouro: "x".repeat(500) });
    expect(h.updates).toEqual([]);
  });

  it("logado: salva no PRÓPRIO cadastro (mesmo filtro da sessão)", async () => {
    h.account = { id: "a", email: "eu@example.test", name: "Eu", whatsapp: "11987654321" };
    h.rows = [{ addresses: [] }];
    await saveCustomerAddress(ADDR);
    expect(h.updates).toEqual([{ addresses: [ADDR] }]);
    expect(render(h.wheres.at(-1)).params).toEqual(["11987654321", "eu@example.test"]);
  });
});
