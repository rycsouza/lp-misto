import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * "Minha carteirinha": o link vai só para o e-mail CADASTRADO, a resposta não
 * revela se o e-mail é sócio, e há limite por IP e por e-mail.
 */
const h = vi.hoisted(() => ({
  member: null as unknown,
  dbCalls: 0,
  sent: [] as string[],
  ipOk: true,
  emailOk: true,
}));

vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "leftJoin", "innerJoin", "orderBy"]) chain[m] = () => chain;
  chain.limit = async () => (h.member ? [h.member] : []);
  return {
    getDb: async () => {
      h.dbCalls++;
      return chain;
    },
  };
});
vi.mock("@/lib/ratelimit", () => ({
  getClientIp: async () => "203.0.113.10",
  rateLimit: async (key: string) => ({ ok: key.includes(":ip:") ? h.ipOk : h.emailOk, remaining: 0 }),
}));
vi.mock("@/lib/email", () => ({
  sendMemberCardLinkEmail: async (id: string) => {
    h.sent.push(id);
    return true;
  },
  sendMemberWelcomeEmail: async () => {},
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { requestMemberCardLink } from "./membership";
import { getMemberCardView } from "@/lib/membership/card";

beforeEach(() => {
  h.member = { id: "m1" };
  h.dbCalls = 0;
  h.sent = [];
  h.ipOk = true;
  h.emailOk = true;
});

describe("requestMemberCardLink", () => {
  it("e-mail de sócio → envia o link ao e-mail cadastrado", async () => {
    expect(await requestMemberCardLink({ email: " Titular@Example.com " })).toEqual({ ok: true });
    expect(h.sent).toEqual(["m1"]);
  });

  it("e-mail que não é sócio → mesma resposta, nada enviado (sem enumeração)", async () => {
    h.member = null;
    expect(await requestMemberCardLink({ email: "outro@example.com" })).toEqual({ ok: true });
    expect(h.sent).toEqual([]);
  });

  it("e-mail inválido → erro de validação, sem banco", async () => {
    const r = await requestMemberCardLink({ email: "nao-e-email" });
    expect(r.ok).toBe(false);
    expect(h.dbCalls).toBe(0);
  });

  it("honeypot preenchido → finge sucesso, sem banco nem envio", async () => {
    expect(await requestMemberCardLink({ email: "titular@example.com", _hp: "bot" })).toEqual({ ok: true });
    expect(h.dbCalls).toBe(0);
    expect(h.sent).toEqual([]);
  });

  it("limite por IP → erro, sem envio", async () => {
    h.ipOk = false;
    const r = await requestMemberCardLink({ email: "titular@example.com" });
    expect(r.ok).toBe(false);
    expect(h.sent).toEqual([]);
  });

  it("limite por e-mail → resposta genérica, sem reenviar (não vira spam)", async () => {
    h.emailOk = false;
    expect(await requestMemberCardLink({ email: "titular@example.com" })).toEqual({ ok: true });
    expect(h.sent).toEqual([]);
  });
});

describe("getMemberCardView", () => {
  it("token inválido → null sem consultar o banco", async () => {
    expect(await getMemberCardView("abc")).toBeNull();
    expect(h.dbCalls).toBe(0);
  });

  it("não expõe e-mail, CPF nem telefone", async () => {
    h.member = {
      memberId: "m1",
      name: "Titular Exemplo",
      status: "active",
      createdAt: new Date("2026-01-01"),
      nextBillingDate: null,
      cancelledAt: null,
      planId: null,
      planName: "Ouro",
      ticketDiscountPct: 10,
      productDiscountPct: 5,
    };
    const card = await getMemberCardView("5f0d1c9e-8a7b-4c3d-9e2f-1a2b3c4d5e6f");
    expect(card).not.toBeNull();
    const keys = Object.keys(card!);
    expect(keys).not.toContain("email");
    expect(keys).not.toContain("cpf");
    expect(keys).not.toContain("whatsapp");
  });
});
