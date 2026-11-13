import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * "Lembrar o aparelho": os dados guardados (nome/e-mail/CPF) só são reaproveitados
 * para o dono do WhatsApp — logado, ou num navegador que já provou ser dele.
 * Quem digita o WhatsApp de outra pessoa não ganha o cookie.
 */
const h = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  setOptions: [] as Record<string, unknown>[],
  tenant: "clube-a" as string | null,
  storedEmail: "titular@example.com" as string | null,
  mine: null as null | { phone: string; where: unknown },
  mineRow: true,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (h.jar.has(n) ? { value: h.jar.get(n)! } : undefined),
    set: (n: string, v: string, o: Record<string, unknown>) => {
      h.jar.set(n, v);
      h.setOptions.push(o);
    },
  }),
}));
vi.mock("@/lib/base-url", () => ({ getCurrentTenantSlug: async () => h.tenant }));
vi.mock("@/lib/accounts/my-customer", () => ({ getMyCustomerWhere: async () => h.mine }));
vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where"]) chain[m] = () => chain;
  chain.limit = async () => {
    if (h.mine) return h.mineRow ? [{ id: "c1" }] : [];
    return h.storedEmail ? [{ email: h.storedEmail }] : [];
  };
  return { getDb: async () => chain };
});

import { DEVICE_COOKIE, canReuseStoredIdentity, isTrustedDeviceFor, rememberDeviceIfOwner } from "./device-trust";

const PHONE = "11987654321";

beforeEach(() => {
  process.env.CUSTOMER_AUTH_SECRET = "test-secret-device-trust-0123456789";
  h.jar = new Map();
  h.setOptions = [];
  h.tenant = "clube-a";
  h.storedEmail = "titular@example.com";
  h.mine = null;
  h.mineRow = true;
});

describe("rememberDeviceIfOwner", () => {
  it("e-mail igual ao do cadastro → lembra o aparelho (cookie httpOnly, lax)", async () => {
    await rememberDeviceIfOwner("(11) 98765-4321", "Titular@Example.com ");
    expect(h.jar.has(DEVICE_COOKIE)).toBe(true);
    expect(h.setOptions[0]).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(await isTrustedDeviceFor(PHONE)).toBe(true);
    expect(await canReuseStoredIdentity(PHONE)).toBe(true);
  });

  it("e-mail diferente do cadastro (WhatsApp de outra pessoa) → não lembra", async () => {
    await rememberDeviceIfOwner(PHONE, "atacante@example.com");
    expect(h.jar.has(DEVICE_COOKIE)).toBe(false);
    expect(await canReuseStoredIdentity(PHONE)).toBe(false);
  });

  it("sem cadastro para o WhatsApp → não lembra", async () => {
    h.storedEmail = null;
    await rememberDeviceIfOwner(PHONE, "titular@example.com");
    expect(h.jar.has(DEVICE_COOKIE)).toBe(false);
  });

  it("o cookie não leva o telefone em claro", async () => {
    await rememberDeviceIfOwner(PHONE, "titular@example.com");
    const token = h.jar.get(DEVICE_COOKIE)!;
    const payload = Buffer.from(token.split(".")[1], "base64url").toString();
    expect(payload).not.toContain(PHONE);
    expect(payload).not.toContain("987654321");
  });

  it("vale só para o telefone lembrado", async () => {
    await rememberDeviceIfOwner(PHONE, "titular@example.com");
    expect(await isTrustedDeviceFor("11911112222")).toBe(false);
  });

  it("aparelho compartilhado: guarda até 5 telefones, os mais recentes", async () => {
    const phones = ["11900000001", "11900000002", "11900000003", "11900000004", "11900000005", "11900000006"];
    for (const p of phones) await rememberDeviceIfOwner(p, "titular@example.com");
    expect(await isTrustedDeviceFor(phones[0])).toBe(false);
    for (const p of phones.slice(1)) expect(await isTrustedDeviceFor(p)).toBe(true);
  });

  it("sem segredo configurado → não lembra nem confia", async () => {
    delete process.env.CUSTOMER_AUTH_SECRET;
    delete process.env.TICKET_SIGNING_SECRET;
    await rememberDeviceIfOwner(PHONE, "titular@example.com");
    expect(h.jar.size).toBe(0);
    expect(await isTrustedDeviceFor(PHONE)).toBe(false);
  });
});

describe("isTrustedDeviceFor recusa cookie forjado ou de outro clube", () => {
  it("cookie adulterado (assinatura inválida) → não confia", async () => {
    await rememberDeviceIfOwner(PHONE, "titular@example.com");
    const [hd, , sig] = h.jar.get(DEVICE_COOKIE)!.split(".");
    const forged = Buffer.from(JSON.stringify({ pur: "device", tn: "clube-a", ph: ["x"] })).toString("base64url");
    h.jar.set(DEVICE_COOKIE, `${hd}.${forged}.${sig}`);
    expect(await isTrustedDeviceFor(PHONE)).toBe(false);
  });

  it("cookie de outro clube não vale aqui", async () => {
    await rememberDeviceIfOwner(PHONE, "titular@example.com");
    h.tenant = "clube-b";
    expect(await isTrustedDeviceFor(PHONE)).toBe(false);
  });

  it("lixo no cookie → não confia (sem erro)", async () => {
    h.jar.set(DEVICE_COOKIE, "nao-e-um-jwt");
    expect(await isTrustedDeviceFor(PHONE)).toBe(false);
  });
});

describe("canReuseStoredIdentity pela conta logada", () => {
  it("logado na conta dona do WhatsApp (cadastro bate) → pode", async () => {
    h.mine = { phone: PHONE, where: {} };
    expect(await canReuseStoredIdentity(PHONE)).toBe(true);
  });

  it("logado, mas com OUTRO WhatsApp → não pode (e sem cookie)", async () => {
    h.mine = { phone: "11911112222", where: {} };
    expect(await canReuseStoredIdentity(PHONE)).toBe(false);
  });

  it("logado com o WhatsApp, mas o cadastro de compras não é desta conta → não pode", async () => {
    h.mine = { phone: PHONE, where: {} };
    h.mineRow = false;
    expect(await canReuseStoredIdentity(PHONE)).toBe(false);
  });

  it("telefone inválido → não", async () => {
    expect(await canReuseStoredIdentity("123")).toBe(false);
    expect(await canReuseStoredIdentity(undefined)).toBe(false);
  });
});
