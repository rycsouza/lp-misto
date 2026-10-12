import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Cancelamento pelo sócio: pela carteirinha só se PEDE (o link de confirmação vai
 * ao e-mail cadastrado); cancelar exige o token desse e-mail. Quem só tem o
 * link/QR da carteirinha não cancela a assinatura de ninguém.
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const CARD = "5f0d1c9e-8a7b-4c3d-9e2f-1a2b3c4d5e6f";

const h = vi.hoisted(() => ({
  member: null as unknown,
  emails: [] as { id: string; url: string }[],
  emailOk: true,
  limitOk: true,
  cancelResult: { ok: true, benefitsUntil: new Date("2026-11-12") } as unknown,
  cancelCalls: [] as string[],
}));

vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where"]) chain[m] = () => chain;
  chain.limit = async () => (h.member ? [h.member] : []);
  return { getDb: async () => chain };
});
vi.mock("@/lib/ratelimit", () => ({
  getClientIp: async () => "203.0.113.10",
  rateLimit: async () => ({ ok: h.limitOk, remaining: 0 }),
}));
vi.mock("@/lib/base-url", () => ({
  getCurrentTenantSlug: async () => "clube-a",
  getAppBaseUrl: async () => "https://clube.example",
}));
vi.mock("@/lib/email", () => ({
  sendMemberCancelConfirmEmail: async (id: string, url: string) => {
    h.emails.push({ id, url });
    return h.emailOk;
  },
  sendMemberWelcomeEmail: async () => {},
}));
vi.mock("@/lib/membership/cancel", () => ({
  cancelMembership: async (id: string) => {
    h.cancelCalls.push(id);
    return h.cancelResult;
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { requestMembershipCancellation, confirmMembershipCancellation } from "./membership";
import { signCancelToken } from "@/lib/membership/cancel-token";

beforeEach(() => {
  process.env.TICKET_SIGNING_SECRET = "segredo-de-teste-com-tamanho-suficiente";
  h.member = { id: MEMBER_ID, status: "active" };
  h.emails = [];
  h.emailOk = true;
  h.limitOk = true;
  h.cancelResult = { ok: true, benefitsUntil: new Date("2026-11-12") };
  h.cancelCalls = [];
});

describe("requestMembershipCancellation", () => {
  it("envia o link de confirmação ao e-mail cadastrado — e NÃO cancela", async () => {
    expect(await requestMembershipCancellation(CARD)).toEqual({ ok: true });
    expect(h.emails).toHaveLength(1);
    expect(h.emails[0].url).toMatch(/^https:\/\/clube\.example\/socios\/cancelar\?t=/);
    expect(h.cancelCalls).toEqual([]);
  });

  it("token da carteirinha inválido → erro, sem e-mail", async () => {
    expect((await requestMembershipCancellation("abc")).ok).toBe(false);
    expect(h.emails).toEqual([]);
  });

  it("já cancelado → erro, sem e-mail", async () => {
    h.member = { id: MEMBER_ID, status: "cancelled" };
    expect((await requestMembershipCancellation(CARD)).ok).toBe(false);
    expect(h.emails).toEqual([]);
  });

  it("limite estourado → sem novo e-mail", async () => {
    h.limitOk = false;
    expect((await requestMembershipCancellation(CARD)).ok).toBe(false);
    expect(h.emails).toEqual([]);
  });
});

describe("confirmMembershipCancellation", () => {
  it("token válido do e-mail → cancela e informa até quando valem os benefícios", async () => {
    const t = await signCancelToken(MEMBER_ID, "clube-a");
    const r = await confirmMembershipCancellation(t!);
    expect(h.cancelCalls).toEqual([MEMBER_ID]);
    expect(r).toEqual({ ok: true, benefitsUntil: "2026-11-12T00:00:00.000Z" });
  });

  it("token inválido/de outro clube → não cancela", async () => {
    const outro = await signCancelToken(MEMBER_ID, "clube-b");
    expect((await confirmMembershipCancellation(outro!)).ok).toBe(false);
    expect((await confirmMembershipCancellation("lixo")).ok).toBe(false);
    expect(h.cancelCalls).toEqual([]);
  });

  it("o token da carteirinha (UUID) não serve para cancelar", async () => {
    expect((await confirmMembershipCancellation(CARD)).ok).toBe(false);
    expect(h.cancelCalls).toEqual([]);
  });

  it("falha no gateway → erro amigável (assinatura segue ativa)", async () => {
    h.cancelResult = { ok: false, error: "gateway_error" };
    const t = await signCancelToken(MEMBER_ID, "clube-a");
    const r = await confirmMembershipCancellation(t!);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Tente novamente/);
  });
});
