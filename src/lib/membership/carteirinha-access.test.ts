import { describe, it, expect } from "vitest";
import {
  benefitsUntilIso,
  canUseValidation,
  describeCardStatus,
  parseCarteirinhaQr,
} from "./carteirinha-access";

const TOKEN = "11111111-2222-4333-8444-555555555555";

describe("parseCarteirinhaQr", () => {
  it("aceita a URL do QR no domínio do clube", () => {
    expect(parseCarteirinhaQr(`https://lp.clube.com.br/socios/carteirinha?token=${TOKEN}`)).toBe(TOKEN);
  });

  it("aceita qualquer host (QR gerado em outro domínio) e http", () => {
    expect(parseCarteirinhaQr(`http://localhost:3000/socios/carteirinha?token=${TOKEN}`)).toBe(TOKEN);
    expect(parseCarteirinhaQr(`https://outro.exemplo.org/socios/carteirinha?token=${TOKEN}`)).toBe(TOKEN);
  });

  it("aceita espaços ao redor e barra final no path", () => {
    expect(parseCarteirinhaQr(`  https://x.com/socios/carteirinha/?token=${TOKEN}  `)).toBe(TOKEN);
  });

  it("aceita token em maiúsculas (UUID é case-insensitive)", () => {
    const upper = TOKEN.toUpperCase();
    expect(parseCarteirinhaQr(`https://x.com/socios/carteirinha?token=${upper}`)).toBe(upper);
  });

  it("rejeita outro path", () => {
    expect(parseCarteirinhaQr(`https://x.com/socios/carteirinha/extra?token=${TOKEN}`)).toBeNull();
    expect(parseCarteirinhaQr(`https://x.com/conta?token=${TOKEN}`)).toBeNull();
    expect(parseCarteirinhaQr(`https://x.com/SOCIOS/carteirinha?token=${TOKEN}`)).toBeNull();
  });

  it("rejeita token que não é UUID", () => {
    expect(parseCarteirinhaQr("https://x.com/socios/carteirinha?token=abc")).toBeNull();
    expect(parseCarteirinhaQr("https://x.com/socios/carteirinha?token=")).toBeNull();
    expect(parseCarteirinhaQr("https://x.com/socios/carteirinha")).toBeNull();
    expect(parseCarteirinhaQr(`https://x.com/socios/carteirinha?token=${TOKEN}0`)).toBeNull();
    expect(parseCarteirinhaQr(`https://x.com/socios/carteirinha?token=${TOKEN}%27%20OR%201=1`)).toBeNull();
  });

  it("rejeita token duplicado (ambiguidade)", () => {
    expect(parseCarteirinhaQr(`https://x.com/socios/carteirinha?token=${TOKEN}&token=${TOKEN}`)).toBeNull();
  });

  it("rejeita esquemas perigosos e não-HTTP", () => {
    expect(parseCarteirinhaQr(`javascript:alert("socios/carteirinha?token=${TOKEN}")`)).toBeNull();
    expect(parseCarteirinhaQr(`data:text/html,/socios/carteirinha?token=${TOKEN}`)).toBeNull();
    expect(parseCarteirinhaQr(`ftp://x.com/socios/carteirinha?token=${TOKEN}`)).toBeNull();
  });

  it("rejeita texto livre, UUID de ingresso puro e entradas não-string", () => {
    expect(parseCarteirinhaQr(TOKEN)).toBeNull();
    expect(parseCarteirinhaQr("123456")).toBeNull();
    expect(parseCarteirinhaQr("")).toBeNull();
    expect(parseCarteirinhaQr("   ")).toBeNull();
    expect(parseCarteirinhaQr(undefined)).toBeNull();
    expect(parseCarteirinhaQr(null)).toBeNull();
    expect(parseCarteirinhaQr(42)).toBeNull();
  });

  it("rejeita texto gigante sem tentar parsear", () => {
    const huge = `https://x.com/socios/carteirinha?token=${TOKEN}&pad=${"a".repeat(5000)}`;
    expect(parseCarteirinhaQr(huge)).toBeNull();
  });
});

describe("canUseValidation (mesma regra da rota /admin/validacao)", () => {
  it("sem sessão → não", () => {
    expect(canUseValidation(null)).toBe(false);
    expect(canUseValidation(undefined)).toBe(false);
  });

  it("admin do clube ou admin do sistema operando o clube → sim", () => {
    expect(canUseValidation({ role: "admin", permissions: {} })).toBe(true);
  });

  it("editor com permissão validacao → sim", () => {
    expect(canUseValidation({ role: "editor", permissions: { validacao: true } })).toBe(true);
  });

  it("editor sem a permissão, ou com outra permissão → não", () => {
    expect(canUseValidation({ role: "editor", permissions: {} })).toBe(false);
    expect(canUseValidation({ role: "editor", permissions: { socios: true, jogos: true } })).toBe(false);
    expect(canUseValidation({ role: "editor" })).toBe(false);
  });

  it("permissão validacao explicitamente falsa → não", () => {
    expect(canUseValidation({ role: "editor", permissions: { validacao: false } })).toBe(false);
  });
});

describe("benefitsUntilIso", () => {
  const next = new Date("2026-11-10T12:00:00Z");

  it("só existe para cancelado com benefício vigente", () => {
    expect(benefitsUntilIso("cancelled", true, next)).toBe(next.toISOString());
    expect(benefitsUntilIso("cancelled", false, next)).toBeNull();
    expect(benefitsUntilIso("cancelled", true, null)).toBeNull();
    expect(benefitsUntilIso("active", true, next)).toBeNull();
    expect(benefitsUntilIso("suspended", false, next)).toBeNull();
  });
});

describe("describeCardStatus", () => {
  it("ativo → verde 'SÓCIO ATIVO'", () => {
    expect(describeCardStatus({ status: "active", hasBenefits: true, benefitsUntil: null })).toEqual({
      tone: "ok",
      headline: "SÓCIO ATIVO",
    });
  });

  it("cancelado com benefício até a data → âmbar com a data", () => {
    const r = describeCardStatus({
      status: "cancelled",
      hasBenefits: true,
      benefitsUntil: "2026-11-10T12:00:00.000Z",
    });
    expect(r.tone).toBe("warn");
    expect(r.headline).toMatch(/^BENEFÍCIOS ATÉ \d{2}\/\d{2}\/\d{4}$/);
  });

  it("suspenso, pendente e cancelado sem benefício → vermelho", () => {
    expect(describeCardStatus({ status: "suspended", hasBenefits: false, benefitsUntil: null })).toEqual({
      tone: "bad",
      headline: "SUSPENSO",
    });
    expect(describeCardStatus({ status: "pending", hasBenefits: false, benefitsUntil: null })).toEqual({
      tone: "bad",
      headline: "PENDENTE",
    });
    expect(describeCardStatus({ status: "cancelled", hasBenefits: false, benefitsUntil: null })).toEqual({
      tone: "bad",
      headline: "CANCELADO",
    });
  });
});
