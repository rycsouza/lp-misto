import { describe, it, expect } from "vitest";
import {
  benefitsUntilIso,
  canUseValidation,
  classifyValidatorInput,
  describeCardStatus,
  memberShortCode,
  parseCarteirinhaQr,
  parseMemberShortCode,
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

const SHORT_TOKEN = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

describe("memberShortCode", () => {
  it("usa os 8 primeiros hex do token, em maiúsculas, com prefixo S-", () => {
    expect(memberShortCode(SHORT_TOKEN)).toBe("S-1A2B3C4D");
  });

  it("muda quando o token muda (gerar carteirinha nova revoga o código antigo)", () => {
    expect(memberShortCode("ffffffff-5e6f-4a7b-8c9d-0e1f2a3b4c5d")).toBe("S-FFFFFFFF");
    expect(memberShortCode(SHORT_TOKEN)).not.toBe(memberShortCode("ffffffff-5e6f-4a7b-8c9d-0e1f2a3b4c5d"));
  });

  it("token inválido ou ausente → null", () => {
    expect(memberShortCode("abc")).toBeNull();
    expect(memberShortCode(`${SHORT_TOKEN}0`)).toBeNull();
    expect(memberShortCode("")).toBeNull();
    expect(memberShortCode(undefined)).toBeNull();
    expect(memberShortCode(null)).toBeNull();
    expect(memberShortCode(42)).toBeNull();
  });

  it("o código gerado sempre passa pelo parser (ida e volta)", () => {
    const code = memberShortCode(SHORT_TOKEN);
    expect(parseMemberShortCode(code)).toBe("1a2b3c4d");
  });
});

describe("parseMemberShortCode", () => {
  it.each([
    ["forma exibida", "S-1A2B3C4D", "1a2b3c4d"],
    ["minúsculas", "s1a2b3c4d", "1a2b3c4d"],
    ["sem hífen, em minúsculas com S maiúsculo", "S1a2b3c4d", "1a2b3c4d"],
    ["com espaços", "  S 1A2B 3C4D  ", "1a2b3c4d"],
    ["com hífens extras", "s-1a-2b-3c-4d", "1a2b3c4d"],
  ])("aceita %s", (_label, input, expected) => {
    expect(parseMemberShortCode(input)).toBe(expected);
  });

  it.each([
    ["7 caracteres", "S-1A2B3C4"],
    ["9 caracteres", "S-1A2B3C4D5"],
    ["letra fora de hex", "S-1A2B3C4G"],
    ["sem o S", "1A2B3C4D"],
    ["vazio", ""],
    ["só o prefixo", "S-"],
    ["wildcard de LIKE", "S-1a2b3c4d%"],
    ["underscore de LIKE", "S-1a2b3c4_"],
    ["injeção com aspas", "S-1a2b3c4d' OR 1=1 --"],
    ["texto livre", "socios carteirinha"],
    ["UUID inteiro", SHORT_TOKEN],
    ["número", 12345678],
    ["null", null],
    ["objeto", { code: "S-1A2B3C4D" }],
  ])("recusa %s", (_label, input) => {
    expect(parseMemberShortCode(input)).toBeNull();
  });

  it("recusa texto gigante sem processar", () => {
    expect(parseMemberShortCode(`S-${"a".repeat(100)}`)).toBeNull();
  });
});

describe("classifyValidatorInput", () => {
  it("URL da carteirinha → member_url com o token", () => {
    expect(classifyValidatorInput(`https://lp.clube.com.br/socios/carteirinha?token=${SHORT_TOKEN}`)).toEqual({
      kind: "member_url",
      token: SHORT_TOKEN,
    });
  });

  it("código de sócio válido → member_code com 8 hex", () => {
    expect(classifyValidatorInput("S-1A2B3C4D")).toEqual({ kind: "member_code", code: "1a2b3c4d" });
    expect(classifyValidatorInput("  s1a2b3c4d ")).toEqual({ kind: "member_code", code: "1a2b3c4d" });
  });

  it("começa com S mas não é código válido → member_code_invalid (sem consulta)", () => {
    expect(classifyValidatorInput("S-1A2B3C4")).toEqual({ kind: "member_code_invalid" });
    expect(classifyValidatorInput("S-1a2b3c4d%")).toEqual({ kind: "member_code_invalid" });
    expect(classifyValidatorInput("S")).toEqual({ kind: "member_code_invalid" });
  });

  it("só dígitos → ticket_number (fluxo de ingresso de sempre)", () => {
    expect(classifyValidatorInput("123456")).toEqual({ kind: "ticket_number", number: "123456" });
  });

  it("8 hex sem S → other (código curto de ingresso, não de sócio)", () => {
    expect(classifyValidatorInput("1a2b3c4d")).toEqual({ kind: "other" });
  });

  it("QR de ingresso (JWT ou UUID) e texto qualquer → other (vai para o ingresso)", () => {
    expect(classifyValidatorInput("eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjF9.sig")).toEqual({ kind: "other" });
    expect(classifyValidatorInput("9f8e7d6c-5b4a-4321-8abc-def012345678")).toEqual({ kind: "other" });
    expect(classifyValidatorInput("lixo ### !!")).toEqual({ kind: "other" });
  });

  it("vazio ou só espaços → empty", () => {
    expect(classifyValidatorInput("")).toEqual({ kind: "empty" });
    expect(classifyValidatorInput("   ")).toEqual({ kind: "empty" });
  });

  it("URL da carteirinha tem prioridade sobre o código", () => {
    expect(classifyValidatorInput(`https://x.com/socios/carteirinha?token=${SHORT_TOKEN}`).kind).toBe("member_url");
  });
});

describe("classifyValidatorInput — nº do ingresso com separadores", () => {
  it("'12-34', '12 34' e '12.34' viram só dígitos", () => {
    for (const v of ["12-34", "12 34", "12.34"]) {
      expect(classifyValidatorInput(v)).toEqual({ kind: "ticket_number", number: "1234" });
    }
  });
  it("só separadores não é número", () => {
    expect(classifyValidatorInput("--").kind).not.toBe("ticket_number");
  });
});
