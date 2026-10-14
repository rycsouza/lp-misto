import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * getMemberCardView: a carteirinha lê só o que o cartão mostra (nome, plano, situação,
 * cor, ingressos e benefícios). E-mail, CPF e telefone não entram na consulta.
 */
const h = vi.hoisted(() => ({
  results: [] as unknown[],
  selects: [] as Record<string, unknown>[],
}));

// Banco falso encadeável: cada `await` de uma query devolve o próximo item da fila.
// Um Error na fila simula falha da query.
function fakeDb(): unknown {
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === "then") {
        const value = h.results.length ? h.results.shift() : [];
        return (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
          value instanceof Error ? reject(value) : resolve(value);
      }
      return () => chain;
    },
    apply: () => chain,
  });
  return {
    select: (fields: Record<string, unknown>) => {
      h.selects.push(fields);
      return chain;
    },
  };
}

vi.mock("@/lib/db/client", () => ({ getDb: async () => fakeDb() }));

import { getMemberCardView } from "./card";

const TOKEN = "11111111-2222-4333-8444-555555555555";
const ROW = {
  memberId: "m-1",
  name: "Ana Torcedora",
  status: "active",
  createdAt: new Date("2026-03-01T12:00:00Z"),
  nextBillingDate: new Date("2026-11-10T12:00:00Z"),
  cancelledAt: null,
  planId: "plan-1",
  planName: "Carcará",
  ticketDiscountPct: 5,
  productDiscountPct: 10,
  freeTicketsPerHomeGame: 1,
  cardColor: "#1E3A8A",
};

beforeEach(() => {
  h.results = [];
  h.selects = [];
  vi.restoreAllMocks();
});

describe("getMemberCardView", () => {
  it("token malformado não consulta o banco", async () => {
    expect(await getMemberCardView("nao-e-uuid")).toBeNull();
    expect(h.selects).toHaveLength(0);
  });

  it("token sem sócio → null", async () => {
    h.results = [[]];
    expect(await getMemberCardView(TOKEN)).toBeNull();
  });

  it("devolve cor do plano normalizada, ingressos grátis e benefícios com detalhe", async () => {
    h.results = [
      [ROW],
      [
        { id: "b1", label: "Treino aberto", detail: null },
        { id: "b2", label: "Feijoada", detail: "2 por ano" },
      ],
    ];
    const card = await getMemberCardView(TOKEN);
    expect(card).toMatchObject({
      memberId: "m-1",
      name: "Ana Torcedora",
      planName: "Carcará",
      status: "active",
      ticketDiscountPct: 5,
      productDiscountPct: 10,
      freeTicketsPerHomeGame: 1,
      cardColor: "#1e3a8a",
      benefits: [
        { id: "b1", label: "Treino aberto", detail: null },
        { id: "b2", label: "Feijoada", detail: "2 por ano" },
      ],
    });
  });

  it("cor do plano malformada vira null (cartão usa a cor do clube)", async () => {
    h.results = [[{ ...ROW, cardColor: "red; background:url(x)" }], []];
    expect((await getMemberCardView(TOKEN))?.cardColor).toBeNull();
  });

  it("plano sem linhas de benefício → lista vazia", async () => {
    h.results = [[{ ...ROW, ticketDiscountPct: null, productDiscountPct: null, freeTicketsPerHomeGame: null }], []];
    expect(await getMemberCardView(TOKEN)).toMatchObject({
      benefits: [],
      ticketDiscountPct: 0,
      productDiscountPct: 0,
      freeTicketsPerHomeGame: 0,
    });
  });

  it("falha ao ler benefícios não derruba a carteirinha", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.results = [[ROW], new Error("connection reset")];
    const card = await getMemberCardView(TOKEN);
    expect(card).toMatchObject({ name: "Ana Torcedora", benefits: [] });
    // Log só com mensagem genérica: nem o erro bruto nem o token entram no log.
    expect(spy).toHaveBeenCalledWith("[carteirinha] falha ao ler benefícios do plano");
    expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("connection reset");
  });

  it("nenhuma consulta pede e-mail, CPF ou telefone do sócio", async () => {
    h.results = [[ROW], []];
    await getMemberCardView(TOKEN);
    const projected = h.selects.flatMap((fields) => Object.keys(fields));
    expect(projected.length).toBeGreaterThan(0);
    for (const forbidden of ["email", "cpf", "phone", "whatsapp", "cpfCnpj", "mobilePhone"]) {
      expect(projected).not.toContain(forbidden);
    }
  });

  it("o objeto devolvido não traz campos de contato", async () => {
    h.results = [[ROW], []];
    const card = (await getMemberCardView(TOKEN)) as unknown as Record<string, unknown>;
    for (const key of ["email", "cpf", "phone", "whatsapp"]) expect(card).not.toHaveProperty(key);
  });
});
