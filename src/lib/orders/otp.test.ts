import { describe, it, expect, beforeEach, vi } from "vitest";

// Redis em memória + captura de mensagens enviadas (hoisted p/ os mocks).
const h = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  const counters = new Map<string, number>();
  const sent: { phone: string; msg: string }[] = [];
  const fakeRedis = {
    get: async (k: string) => (store.has(k) ? store.get(k) : null),
    set: async (k: string, v: unknown) => { store.set(k, v); },
    del: async (k: string) => { store.delete(k); counters.delete(k); },
    incr: async (k: string) => { const n = (counters.get(k) ?? 0) + 1; counters.set(k, n); return n; },
    expire: async () => {},
  };
  return { store, counters, sent, fakeRedis };
});

vi.mock("@/lib/redis", () => ({ getRedisOrNull: () => h.fakeRedis }));
vi.mock("@/lib/whatsapp/zapi", () => ({
  isZapiConfigured: () => true,
  toBrazilPhone: (s: string) => {
    const d = String(s).replace(/\D/g, "");
    return d.length >= 10 ? (d.startsWith("55") ? d : `55${d}`) : null;
  },
  sendWhatsappText: async (phone: string, msg: string) => {
    h.sent.push({ phone, msg });
    return { ok: true };
  },
}));

import { sendOrdersOtp, checkOrdersOtp } from "./otp";

const PHONE = "5567999990000";

/** Extrai o código de 6 dígitos da última mensagem enviada. */
function lastCode(): string {
  const msg = h.sent[h.sent.length - 1]?.msg ?? "";
  return msg.match(/\b(\d{6})\b/)?.[1] ?? "";
}

describe("orders OTP", () => {
  beforeEach(() => {
    process.env.TICKET_SIGNING_SECRET = "test-secret";
    h.store.clear();
    h.counters.clear();
    h.sent.length = 0;
  });

  it("envia um código de 6 dígitos por WhatsApp", async () => {
    const r = await sendOrdersOtp(PHONE);
    expect(r.ok).toBe(true);
    expect(lastCode()).toMatch(/^\d{6}$/);
  });

  it("rejeita telefone inválido antes de enviar", async () => {
    const r = await sendOrdersOtp("123");
    expect(r).toEqual({ ok: false, error: "invalid_phone" });
    expect(h.sent.length).toBe(0);
  });

  it("verifica o código correto e o consome (uso único)", async () => {
    await sendOrdersOtp(PHONE);
    const code = lastCode();
    expect(await checkOrdersOtp(PHONE, code)).toBe(true);
    // Segunda tentativa com o mesmo código falha (já consumido).
    expect(await checkOrdersOtp(PHONE, code)).toBe(false);
  });

  it("rejeita código errado", async () => {
    await sendOrdersOtp(PHONE);
    const wrong = lastCode() === "000000" ? "111111" : "000000";
    expect(await checkOrdersOtp(PHONE, wrong)).toBe(false);
  });

  it("invalida o código após 5 tentativas erradas (anti-brute-force)", async () => {
    await sendOrdersOtp(PHONE);
    const code = lastCode();
    for (let i = 0; i < 5; i++) {
      expect(await checkOrdersOtp(PHONE, "000001")).toBe(false);
    }
    // 6ª tentativa, mesmo com o código certo, já está bloqueada.
    expect(await checkOrdersOtp(PHONE, code)).toBe(false);
  });

  it("retorna false quando não há código armazenado", async () => {
    expect(await checkOrdersOtp(PHONE, "123456")).toBe(false);
  });
});
