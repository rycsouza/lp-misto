import { describe, it, expect, beforeEach } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import { renewSessionToken, signAccountToken, verifyAccountToken } from "./tokens";
import { normalizeAccountPhone, maskEmail } from "./identity";

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

describe("sessão sem fim (renovação deslizante)", () => {
  const DAY = 86_400_000;

  it("token de sessão com mais de 1 dia → renovado com os MESMOS claims e clube", async () => {
    const t = await signAccountToken("session", { aid: AID, pwv: 77 }, "clube-a");
    const renewed = await renewSessionToken(t!, Date.now() + 2 * DAY);
    expect(renewed).toBeTruthy();
    expect(await verifyAccountToken("session", renewed!, "clube-a")).toEqual({ aid: AID, pwv: 77 });
    expect(await verifyAccountToken("session", renewed!, "clube-b")).toBeNull();
  });

  it("token recente não é reescrito (no máx. 1x por dia)", async () => {
    const t = await signAccountToken("session", { aid: AID, pwv: 1 }, "clube-a");
    expect(await renewSessionToken(t!)).toBeNull();
  });

  it("só renova SESSÃO válida: outro uso, adulterado ou lixo → null", async () => {
    const reset = await signAccountToken("reset", { aid: AID, pwv: 1 }, "clube-a");
    expect(await renewSessionToken(reset!, Date.now() + 2 * DAY)).toBeNull();
    const t = await signAccountToken("session", { aid: AID, pwv: 1 }, "clube-a");
    expect(await renewSessionToken(t!.slice(0, -3) + "abc", Date.now() + 2 * DAY)).toBeNull();
    expect(await renewSessionToken("lixo", Date.now() + 2 * DAY)).toBeNull();
  });
});

describe("WhatsApp da conta", () => {
  it("normaliza para DDD + número (11), aceita DDI 55, recusa o resto", () => {
    expect(normalizeAccountPhone("(67) 99999-8888")).toBe("67999998888");
    expect(normalizeAccountPhone("+55 67 99999-8888")).toBe("67999998888");
    expect(normalizeAccountPhone("6799998888")).toBeNull(); // fixo/sem 9
    expect(normalizeAccountPhone("abc")).toBeNull();
    expect(normalizeAccountPhone(undefined)).toBeNull();
  });

  it("máscara de e-mail", () => {
    expect(maskEmail("joao.silva@gmail.com")).toBe("joao***@gmail.com");
  });
});
