import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Ingresso grátis do sócio por jogo em casa. O banco é um fake que devolve os
 * resultados de uma fila (na ordem dos awaits) e registra inserts/updates/deletes
 * por tabela, para provar o que foi (ou não foi) gravado.
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const PLAN_ID = "1c7f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e70";
const GAME_ID = "2d8f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e71";
const RES_ID = "3e9f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e72";
const NOW = new Date("2026-10-14T15:00:00Z");

const h = vi.hoisted(() => ({
  results: [] as unknown[],
  log: [] as { op: string; table?: string; values?: unknown }[],
  batchCalls: 0,
  batchError: null as unknown,
  ensured: [] as string[],
  emails: [] as string[],
  types: [{ code: "inteira", name: "Inteira", priceCents: 5000 }] as unknown[],
  stock: [] as string[],
  soldOut: false,
}));

vi.mock("@/lib/db/client", async () => {
  const schema = await import("@/lib/db/schema");
  const names = new Map<unknown, string>([
    [schema.games, "games"],
    [schema.membershipPlans, "membershipPlans"],
    [schema.memberTicketRedemptions, "memberTicketRedemptions"],
    [schema.orders, "orders"],
    [schema.orderItems, "orderItems"],
  ]);
  const nameOf = (t: unknown) => names.get(t) ?? "outra";

  // Cada `await` numa cadeia consome o próximo resultado da fila (ou [] se vazia).
  function chain(table: string | undefined): unknown {
    const next = () => (h.results.length ? h.results.shift() : []);
    const c: unknown = new Proxy(function () {}, {
      get: (_t, prop) => {
        if (prop === "then") {
          return (res: (v: unknown) => void, rej: (e: unknown) => void) => Promise.resolve(next()).then(res, rej);
        }
        if (prop === "catch") return (fn: (e: unknown) => void) => Promise.resolve(next()).catch(fn);
        if (prop === "values") {
          return (v: unknown) => {
            h.log.push({ op: "insert", table, values: v });
            return c;
          };
        }
        if (prop === "set") {
          return (v: unknown) => {
            h.log.push({ op: "update", table, values: v });
            return c;
          };
        }
        return () => c;
      },
      apply: () => c,
    });
    return c;
  }

  const db = {
    select: () => chain(undefined),
    insert: (t: unknown) => chain(nameOf(t)),
    update: (t: unknown) => chain(nameOf(t)),
    delete: (t: unknown) => {
      h.log.push({ op: "delete", table: nameOf(t) });
      return chain(nameOf(t));
    },
    batch: async () => {
      h.batchCalls++;
      if (h.batchError) throw h.batchError;
      return [];
    },
  };
  return { getDb: async () => db };
});

vi.mock("@/lib/db/queries", () => ({ ticketSalesOpen: () => undefined }));
vi.mock("@/lib/config", () => ({ getSiteConfig: async () => ({}) }));
vi.mock("@/lib/tickets/resolve", () => ({
  getTicketTypesForGames: async () => ({ [GAME_ID]: h.types }),
}));
vi.mock("@/lib/tickets/reserve", () => ({
  reserveTicketStock: async (_db: unknown, lines: { id: string }[]) => {
    h.stock.push(...lines.map((l) => `reserve:${l.id}`));
    return h.soldOut ? { ok: false, soldOutName: "Inteira" } : { ok: true };
  },
  releaseTicketStockById: async (_db: unknown, lines: { id: string }[]) => {
    h.stock.push(...lines.map((l) => `release:${l.id}`));
  },
}));
vi.mock("@/lib/tickets/generate", () => ({
  ensureTicketsForOrder: async (orderId: string) => {
    h.ensured.push(orderId);
    return [];
  },
}));
vi.mock("@/lib/email", () => ({
  sendOrderConfirmation: async (orderId: string) => {
    h.emails.push(orderId);
  },
}));

import {
  getMyFreeTicketsView,
  isBookableHomeGame,
  memberBlock,
  redeemFreeTicket,
  type FreeTicketMember,
} from "./free-tickets";

const member = (over: Partial<FreeTicketMember> = {}): FreeTicketMember => ({
  id: MEMBER_ID,
  name: "Sócio Teste",
  planId: PLAN_ID,
  status: "active",
  nextBillingDate: new Date("2026-11-01T12:00:00Z"),
  hasPaid: true,
  ...over,
});
const account = { email: "socio@example.com", whatsapp: "67999998888" as string | null };

const game = (over: Record<string, unknown> = {}) => ({
  id: GAME_ID,
  opponent: "Rival",
  competition: "Série D",
  round: "1",
  date: new Date("2026-10-20T22:00:00Z"),
  venue: "Estádio Teste",
  isHome: true,
  active: true,
  ticketSalesEndsAt: null,
  ticketPriceInteiraCents: null,
  ticketPriceMeiaCents: null,
  meiaEligibilityLabel: null,
  ...over,
});

beforeEach(() => {
  h.results = [];
  h.log = [];
  h.batchCalls = 0;
  h.batchError = null;
  h.ensured = [];
  h.emails = [];
  h.types = [{ code: "inteira", name: "Inteira", priceCents: 5000 }];
  h.stock = [];
  h.soldOut = false;
});

const inserts = (table: string) => h.log.filter((l) => l.op === "insert" && l.table === table);

describe("elegibilidade do sócio", () => {
  it("sem plano → não elegível (nenhum jogo listado)", async () => {
    const view = await getMyFreeTicketsView(member({ planId: null }), account, NOW);
    expect(view).toEqual({ eligible: false });
  });

  it("plano sem ingresso por jogo (0) → não elegível", async () => {
    h.results = [[{ name: "Raiz", perGame: 0 }]];
    const view = await getMyFreeTicketsView(member(), account, NOW);
    expect(view).toEqual({ eligible: false });
  });

  it("hasPaid false → lista com bloqueio 'not_paid' e não resgata", async () => {
    h.results = [[{ name: "Elite", perGame: 1 }], [game()], []];
    const view = await getMyFreeTicketsView(member({ hasPaid: false }), account, NOW);
    expect(view.eligible).toBe(true);
    if (!view.eligible) return;
    expect(view.games[0]).toMatchObject({ block: "not_paid", canRedeem: false, used: 0, limit: 1 });

    h.results = [[{ name: "Elite", perGame: 1 }]];
    const r = await redeemFreeTicket(member({ hasPaid: false }), account, GAME_ID, NOW);
    expect(r).toEqual({ ok: false, error: "Disponível após a confirmação da 1ª mensalidade." });
    expect(inserts("memberTicketRedemptions")).toHaveLength(0);
    expect(h.batchCalls).toBe(0);
  });

  it("assinatura suspensa → bloqueio 'inactive'", () => {
    expect(memberBlock(member({ status: "suspended" }), account, NOW)).toBe("inactive");
    expect(memberBlock(member({ status: "cancelled", nextBillingDate: new Date("2026-10-01T00:00:00Z") }), account, NOW)).toBe("inactive");
  });

  it("cancelada com benefícios ainda válidos → sem bloqueio", () => {
    expect(memberBlock(member({ status: "cancelled", nextBillingDate: new Date("2026-11-01T00:00:00Z") }), account, NOW)).toBeNull();
  });

  it("conta sem WhatsApp → bloqueio 'no_whatsapp' (o pedido exige o contato)", async () => {
    expect(memberBlock(member(), { ...account, whatsapp: null }, NOW)).toBe("no_whatsapp");
    h.results = [[{ name: "Elite", perGame: 1 }]];
    const r = await redeemFreeTicket(member(), { ...account, whatsapp: null }, GAME_ID, NOW);
    expect(r.ok).toBe(false);
    expect(h.batchCalls).toBe(0);
  });
});

describe("jogo elegível (em casa, ativo, futuro, vendas abertas)", () => {
  const base = {
    isHome: true,
    active: true,
    date: new Date("2026-10-20T22:00:00Z"),
    ticketSalesEndsAt: null as Date | null,
  };

  it("jogo em casa futuro com venda aberta → elegível", () => {
    expect(isBookableHomeGame(base, NOW)).toBe(true);
  });

  it("jogo fora de casa → não elegível", () => {
    expect(isBookableHomeGame({ ...base, isHome: false }, NOW)).toBe(false);
  });

  it("jogo inativo → não elegível", () => {
    expect(isBookableHomeGame({ ...base, active: false }, NOW)).toBe(false);
  });

  it("jogo já realizado → não elegível", () => {
    expect(isBookableHomeGame({ ...base, date: new Date("2026-10-14T10:00:00Z") }, NOW)).toBe(false);
  });

  it("vendas encerradas (ticketSalesEndsAt no passado) → não elegível", () => {
    expect(isBookableHomeGame({ ...base, ticketSalesEndsAt: new Date("2026-10-14T12:00:00Z") }, NOW)).toBe(false);
  });

  it("sem ticketSalesEndsAt, a venda segue aberta enquanto o jogo não começou", () => {
    const jogoNoDia = { ...base, date: new Date("2026-10-14T23:30:00Z") }; // 20:30 em Brasília
    expect(isBookableHomeGame(jogoNoDia, new Date("2026-10-14T16:00:00Z"))).toBe(true);
    expect(isBookableHomeGame(jogoNoDia, new Date("2026-10-14T23:31:00Z"))).toBe(false);
  });
});

describe("limite por jogo", () => {
  it("limite atingido → bloqueio na listagem", async () => {
    h.results = [[{ name: "Elite", perGame: 1 }], [game()], [{ gameId: GAME_ID, n: 1 }]];
    const view = await getMyFreeTicketsView(member(), account, NOW);
    if (!view.eligible) throw new Error("deveria ser elegível");
    expect(view.games[0]).toMatchObject({ used: 1, limit: 1, canRedeem: false, block: "limit_reached" });
  });

  it("limite atingido → recusa antes de reservar", async () => {
    h.results = [[{ name: "Elite", perGame: 2 }], [game()], [{ n: 2 }]];
    const r = await redeemFreeTicket(member(), account, GAME_ID, NOW);
    expect(r).toEqual({ ok: false, error: "Limite atingido para este jogo." });
    expect(inserts("memberTicketRedemptions")).toHaveLength(0);
    expect(h.batchCalls).toBe(0);
  });

  it("jogo fora de casa / inexistente → recusa sem reservar", async () => {
    h.results = [[{ name: "Elite", perGame: 1 }], [game({ isHome: false })]];
    const fora = await redeemFreeTicket(member(), account, GAME_ID, NOW);
    expect(fora).toEqual({ ok: false, error: "Este jogo não está disponível para resgate." });

    h.results = [[{ name: "Elite", perGame: 1 }], []];
    const inexistente = await redeemFreeTicket(member(), account, GAME_ID, NOW);
    expect(inexistente.ok).toBe(false);
    expect(inserts("memberTicketRedemptions")).toHaveLength(0);
    expect(h.batchCalls).toBe(0);
  });

  it("jogo sem tipo de ingresso cadastrado → recusa sem reservar", async () => {
    h.types = [];
    h.results = [[{ name: "Elite", perGame: 1 }], [game()]];
    const r = await redeemFreeTicket(member(), account, GAME_ID, NOW);
    expect(r.ok).toBe(false);
    expect(inserts("memberTicketRedemptions")).toHaveLength(0);
  });
});

describe("resgate", () => {
  it("corrida: nenhuma posição livre na reserva → recusa sem criar pedido", async () => {
    h.results = [[{ name: "Elite", perGame: 1 }], [game()], [{ n: 0 }], []];
    const r = await redeemFreeTicket(member(), account, GAME_ID, NOW);
    expect(r.ok).toBe(false);
    expect(inserts("memberTicketRedemptions")).toEqual([
      { op: "insert", table: "memberTicketRedemptions", values: { memberId: MEMBER_ID, gameId: GAME_ID, seq: 1 } },
    ]);
    expect(inserts("orders")).toHaveLength(0);
    expect(h.batchCalls).toBe(0);
    expect(h.ensured).toEqual([]);
  });

  it("falha ao criar o pedido → apaga a reserva (libera a vaga) e devolve erro genérico", async () => {
    h.results = [[{ name: "Elite", perGame: 1 }], [game()], [{ n: 0 }], [{ id: RES_ID }]];
    h.batchError = new Error("falha de banco com detalhe interno");
    const r = await redeemFreeTicket(member(), account, GAME_ID, NOW);
    expect(r).toEqual({ ok: false, error: "Não foi possível resgatar agora. Tente novamente em alguns minutos." });
    expect(h.log).toContainEqual({ op: "delete", table: "memberTicketRedemptions" });
    expect(h.ensured).toEqual([]);
    expect(h.emails).toEqual([]);
  });

  it("posição 1 ocupada (reserva liberada fora de ordem) → usa a próxima livre", async () => {
    h.results = [[{ name: "Empresarial", perGame: 2 }], [game()], [{ n: 1 }], [], [{ id: RES_ID }]];
    const r = await redeemFreeTicket(member(), account, GAME_ID, NOW);
    expect(r.ok).toBe(true);
    expect(inserts("memberTicketRedemptions").map((l) => (l.values as { seq: number }).seq)).toEqual([1, 2]);
  });

  it("tipo com teto: consome estoque; esgotado → libera a reserva e recusa", async () => {
    h.types = [{ id: "tt-1", code: "inteira", name: "Inteira", priceCents: 5000, maxQuantity: 100 }];
    h.soldOut = true;
    h.results = [[{ name: "Elite", perGame: 1 }], [game()], [{ n: 0 }], [{ id: RES_ID }]];
    const r = await redeemFreeTicket(member(), account, GAME_ID, NOW);
    expect(r).toEqual({ ok: false, error: "Os ingressos deste jogo esgotaram." });
    expect(h.stock).toEqual(["reserve:tt-1"]);
    expect(h.log).toContainEqual({ op: "delete", table: "memberTicketRedemptions" });
    expect(inserts("orders")).toHaveLength(0);
  });

  it("tipo com teto + falha ao criar o pedido → devolve o estoque", async () => {
    h.types = [{ id: "tt-1", code: "inteira", name: "Inteira", priceCents: 5000, maxQuantity: 100 }];
    h.batchError = new Error("x");
    h.results = [[{ name: "Elite", perGame: 1 }], [game()], [{ n: 0 }], [{ id: RES_ID }]];
    expect((await redeemFreeTicket(member(), account, GAME_ID, NOW)).ok).toBe(false);
    expect(h.stock).toEqual(["reserve:tt-1", "release:tt-1"]);
  });

  it("caminho feliz: cria pedido R$ 0 pago com metadata e dados do comprador da sessão", async () => {
    h.results = [[{ name: "Elite", perGame: 2 }], [game()], [{ n: 1 }], [{ id: RES_ID }]];
    const r = await redeemFreeTicket(member(), account, GAME_ID, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.orderId).toMatch(/^[0-9a-f-]{36}$/);

    // tenta a 1ª posição livre (1..limite): a 1 retornou linha
    expect(inserts("memberTicketRedemptions")[0].values).toEqual({ memberId: MEMBER_ID, gameId: GAME_ID, seq: 1 });

    const [order] = inserts("orders").map((l) => l.values as Record<string, unknown>);
    expect(order).toEqual({
      id: r.orderId,
      customerName: "Sócio Teste",
      customerEmail: "socio@example.com",
      customerWhatsapp: "67999998888",
      status: "paid",
      totalCents: 0,
    });

    const [item] = inserts("orderItems").map((l) => l.values as Record<string, unknown>);
    expect(item).toMatchObject({
      orderId: r.orderId,
      type: "ticket",
      referenceId: GAME_ID,
      quantity: 1,
      unitPriceCents: 0,
      metadata: {
        ticketType: "inteira",
        typeName: "Inteira",
        isMemberFreeTicket: true,
        memberId: MEMBER_ID,
        planName: "Elite",
      },
    });

    expect(h.log).toContainEqual({ op: "update", table: "memberTicketRedemptions", values: { orderId: r.orderId } });
    expect(h.batchCalls).toBe(1);
    expect(h.log).not.toContainEqual({ op: "delete", table: "memberTicketRedemptions" });
    expect(h.ensured).toEqual([r.orderId]);
    await vi.waitFor(() => expect(h.emails).toEqual([r.orderId]));
  });

  it("usa o nome do sócio e não o que o client enviar", async () => {
    // O resgate só recebe gameId da action; o comprador vem do sócio/conta da sessão.
    h.results = [[{ name: "Elite", perGame: 1 }], [game()], [{ n: 0 }], [{ id: RES_ID }]];
    await redeemFreeTicket(member({ name: "Nome do Sócio" }), account, GAME_ID, NOW);
    const [order] = inserts("orders").map((l) => l.values as Record<string, unknown>);
    expect(order.customerName).toBe("Nome do Sócio");
    expect(order.customerEmail).toBe("socio@example.com");
  });
});
