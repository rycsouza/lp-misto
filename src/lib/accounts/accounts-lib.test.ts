import { describe, it, expect, beforeEach } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import { signAccountToken, verifyAccountToken } from "./tokens";

const AID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";

beforeEach(() => {
  process.env.TICKET_SIGNING_SECRET = "segredo-de-teste-com-tamanho-suficiente";
  delete process.env.CUSTOMER_AUTH_SECRET;
});

describe("senha", () => {
  it("regras: mínimo, máximo de 72 bytes, diferente do e-mail", () => {
    expect(passwordProblem("curta")).toMatch(/8 caracteres/);
    expect(passwordProblem("á".repeat(40))).toMatch(/longa/); // 80 bytes
    expect(passwordProblem("fan@example.com", "FAN@example.com")).toMatch(/igual ao e-mail/);
    expect(passwordProblem("uma-senha-boa")).toBeNull();
  });

  it("hash/compare; sem conta (hash ausente) nunca autentica", async () => {
    const h = await hashPassword("uma-senha-boa");
    expect(await verifyPassword("uma-senha-boa", h)).toBe(true);
    expect(await verifyPassword("outra-senha", h)).toBe(false);
    expect(await verifyPassword("uma-senha-boa", null)).toBe(false);
  });
});

describe("tokens da conta", () => {
  it("round-trip no mesmo uso e clube", async () => {
    const t = await signAccountToken("session", { aid: AID, pwv: 123 }, "clube-a");
    expect(await verifyAccountToken("session", t!, "clube-a")).toEqual({ aid: AID, pwv: 123 });
  });

  it("uso diferente é recusado (sessão não redefine senha, etc.)", async () => {
    const t = await signAccountToken("verify", { aid: AID, pwv: 1 }, "clube-a");
    expect(await verifyAccountToken("reset", t!, "clube-a")).toBeNull();
    expect(await verifyAccountToken("session", t!, "clube-a")).toBeNull();
  });

  it("outro clube ou token adulterado é recusado", async () => {
    const t = await signAccountToken("session", { aid: AID, pwv: 1 }, "clube-a");
    expect(await verifyAccountToken("session", t!, "clube-b")).toBeNull();
    expect(await verifyAccountToken("session", t!.slice(0, -3) + "abc", "clube-a")).toBeNull();
  });

  it("chave dedicada CUSTOMER_AUTH_SECRET tem prioridade", async () => {
    process.env.CUSTOMER_AUTH_SECRET = "outra-chave-dedicada-bem-longa-123";
    const t = await signAccountToken("session", { aid: AID, pwv: 1 }, "clube-a");
    delete process.env.CUSTOMER_AUTH_SECRET;
    expect(await verifyAccountToken("session", t!, "clube-a")).toBeNull();
  });
});
