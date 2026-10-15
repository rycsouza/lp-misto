import { describe, it, expect } from "vitest";
import {
  isRenderableBackgroundSrc,
  isValidMemberCardConfigValue,
  memberCardBackgroundInputSchema,
  normalizeCardBackgroundBlend,
  normalizeCardBackgroundFit,
  normalizeCardBackgroundOpacity,
  parseMemberCardBackground,
  safeCardBackgroundUrl,
} from "./card-background";

const CLOUD = "misto-test";
const OK_URL = "https://res.cloudinary.com/misto-test/image/upload/v1/misto/fundo-carteirinha.png";

describe("safeCardBackgroundUrl — destino de upload do projeto", () => {
  it("aceita https do próprio bucket de upload (o que o /api/upload devolve)", () => {
    expect(safeCardBackgroundUrl(OK_URL, CLOUD)).toBe(OK_URL);
    expect(safeCardBackgroundUrl(`  ${OK_URL}  `, CLOUD)).toBe(OK_URL);
  });

  it("recusa https de outro host, mesmo com o caminho do bucket", () => {
    expect(safeCardBackgroundUrl("https://evil.example/misto-test/image/upload/a.png", CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl("https://res.cloudinary.com.evil.example/misto-test/image/upload/a.png", CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl("https://cdn.exemplo.com.br/fundo.png", CLOUD)).toBeNull();
  });

  it("recusa outro bucket (cloud name diferente) e caminho fora do upload", () => {
    expect(safeCardBackgroundUrl("https://res.cloudinary.com/outro-clube/image/upload/a.png", CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl("https://res.cloudinary.com/misto-test/video/upload/a.png", CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl("https://res.cloudinary.com/misto-test/image/upload/../../outro/a.png", CLOUD)).toBeNull();
  });

  it("sem cloud name configurado, nenhuma URL https passa (fail closed)", () => {
    expect(safeCardBackgroundUrl(OK_URL, null)).toBeNull();
    expect(safeCardBackgroundUrl(OK_URL, undefined)).toBeNull();
    expect(safeCardBackgroundUrl(OK_URL, "")).toBeNull();
    expect(safeCardBackgroundUrl(OK_URL, "x/../y")).toBeNull();
  });
});

describe("safeCardBackgroundUrl — esquemas e formas perigosas", () => {
  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:image/png;base64,iVBORw0KGgo=",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "blob:https://res.cloudinary.com/abc",
  ])("recusa o esquema %s", (v) => {
    expect(safeCardBackgroundUrl(v, CLOUD)).toBeNull();
  });

  it("recusa http (sem TLS), mesmo no bucket certo", () => {
    expect(safeCardBackgroundUrl(OK_URL.replace("https://", "http://"), CLOUD)).toBeNull();
  });

  it("recusa credenciais, porta e protocolo-relativo", () => {
    expect(safeCardBackgroundUrl(OK_URL.replace("https://", "https://u:p@"), CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl(OK_URL.replace("res.cloudinary.com", "res.cloudinary.com:8443"), CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl("//evil.example/x.png", CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl("/\\evil.example/x.png", CLOUD)).toBeNull();
  });

  it("recusa quebra de atributo, espaço e caracteres de controle", () => {
    expect(safeCardBackgroundUrl(`${OK_URL}"><script>alert(1)</script>`, CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl(`${OK_URL}' onerror='x`, CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl(`${OK_URL} x`, CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl(`${OK_URL}\n`, CLOUD)).toBe(OK_URL); // aparado
    expect(safeCardBackgroundUrl(`${OK_URL}\u0007`, CLOUD)).toBeNull();
  });

  it("recusa vazio, não-string, e URL acima do limite", () => {
    expect(safeCardBackgroundUrl("", CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl("   ", CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl(null, CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl(42, CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl({ url: OK_URL }, CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl(`https://res.cloudinary.com/${CLOUD}/image/upload/${"a".repeat(2100)}.png`, CLOUD)).toBeNull();
  });
});

describe("safeCardBackgroundUrl — caminho relativo do próprio site", () => {
  it("aceita caminho relativo simples", () => {
    expect(safeCardBackgroundUrl("/fundos/carteirinha.png", CLOUD)).toBe("/fundos/carteirinha.png");
    expect(safeCardBackgroundUrl("/fundo.webp", null)).toBe("/fundo.webp");
  });

  it("recusa caminho relativo com '..', protocolo-relativo ou barra invertida", () => {
    expect(safeCardBackgroundUrl("/../segredo.png", CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl("/a/../../b.png", CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl("//evil.example/x.png", CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl("/\\evil.example", CLOUD)).toBeNull();
    expect(safeCardBackgroundUrl("/x\"y.png", CLOUD)).toBeNull();
  });
});

describe("isRenderableBackgroundSrc (defesa na tela)", () => {
  it("aceita https absoluta e caminho relativo seguro", () => {
    expect(isRenderableBackgroundSrc(OK_URL)).toBe(true);
    expect(isRenderableBackgroundSrc("/fundo.png")).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "http://res.cloudinary.com/x.png",
    "//evil.example/x.png",
    `https://a.example/x.png" onerror="alert(1)`,
    "https://a.example/<img>",
    "https://a.example/x\\y.png",
    "/../x.png",
    "",
  ])("recusa %s", (v) => {
    expect(isRenderableBackgroundSrc(v)).toBe(false);
  });
});

describe("fit e opacidade", () => {
  it("fit: só 'contain' vira contain; qualquer outra coisa vira cover", () => {
    expect(normalizeCardBackgroundFit("contain")).toBe("contain");
    expect(normalizeCardBackgroundFit("cover")).toBe("cover");
    expect(normalizeCardBackgroundFit("stretch")).toBe("cover");
    expect(normalizeCardBackgroundFit(undefined)).toBe("cover");
  });

  it("opacidade: inteiro de 10 a 100; fora disso vira 100", () => {
    expect(normalizeCardBackgroundOpacity(10)).toBe(10);
    expect(normalizeCardBackgroundOpacity("55")).toBe(55);
    expect(normalizeCardBackgroundOpacity(100)).toBe(100);
    expect(normalizeCardBackgroundOpacity(9)).toBe(100);
    expect(normalizeCardBackgroundOpacity(101)).toBe(100);
    expect(normalizeCardBackgroundOpacity(55.5)).toBe(100);
    expect(normalizeCardBackgroundOpacity("")).toBe(100);
    expect(normalizeCardBackgroundOpacity("abc")).toBe(100);
    expect(normalizeCardBackgroundOpacity(undefined)).toBe(100);
  });
});

describe("parseMemberCardBackground", () => {
  it("sem URL segura não há fundo (null), mesmo com fit e opacidade válidos", () => {
    expect(parseMemberCardBackground({ url: "", fit: "contain", opacity: 50 }, CLOUD)).toBeNull();
    expect(parseMemberCardBackground({ url: "javascript:1", fit: "contain", opacity: 50 }, CLOUD)).toBeNull();
    expect(parseMemberCardBackground(null, CLOUD)).toBeNull();
    expect(parseMemberCardBackground(undefined, CLOUD)).toBeNull();
  });

  it("com URL segura, devolve o fundo com fit e opacidade normalizados", () => {
    expect(parseMemberCardBackground({ url: OK_URL, fit: "contain", opacity: "40", blend: "normal" }, CLOUD)).toEqual({
      url: OK_URL,
      fit: "contain",
      opacity: 40,
      blend: "normal",
    });
    expect(parseMemberCardBackground({ url: OK_URL, fit: "x", opacity: 0 }, CLOUD)).toEqual({
      url: OK_URL,
      fit: "cover",
      opacity: 100,
      blend: "multiply",
    });
  });
});

describe("memberCardBackgroundInputSchema (entrada da action)", () => {
  const valid = { url: OK_URL, fit: "cover", opacity: 100, blend: "multiply" };

  it("aceita o formato certo e aceita URL vazia (remover)", () => {
    expect(memberCardBackgroundInputSchema.safeParse(valid).success).toBe(true);
    expect(memberCardBackgroundInputSchema.safeParse({ ...valid, blend: "normal" }).success).toBe(true);
    expect(memberCardBackgroundInputSchema.safeParse({ url: "", fit: "contain", opacity: 10, blend: "normal" }).success).toBe(true);
  });

  it("mescla é obrigatória e só aceita multiply ou normal", () => {
    expect(memberCardBackgroundInputSchema.safeParse({ url: OK_URL, fit: "cover", opacity: 100 }).success).toBe(false);
    expect(memberCardBackgroundInputSchema.safeParse({ ...valid, blend: "screen" }).success).toBe(false);
    expect(memberCardBackgroundInputSchema.safeParse({ ...valid, blend: "" }).success).toBe(false);
    expect(memberCardBackgroundInputSchema.safeParse({ ...valid, blend: null }).success).toBe(false);
  });

  it("recusa campo extra (mass assignment), fit fora do enum e opacidade fora da faixa", () => {
    expect(memberCardBackgroundInputSchema.safeParse({ ...valid, clubLogoUrl: "x" }).success).toBe(false);
    expect(memberCardBackgroundInputSchema.safeParse({ ...valid, cardColor: "#000000" }).success).toBe(false);
    expect(memberCardBackgroundInputSchema.safeParse({ ...valid, fit: "stretch" }).success).toBe(false);
    expect(memberCardBackgroundInputSchema.safeParse({ ...valid, opacity: 9 }).success).toBe(false);
    expect(memberCardBackgroundInputSchema.safeParse({ ...valid, opacity: 101 }).success).toBe(false);
    expect(memberCardBackgroundInputSchema.safeParse({ ...valid, opacity: 50.5 }).success).toBe(false);
    expect(memberCardBackgroundInputSchema.safeParse({ ...valid, opacity: "50" }).success).toBe(false);
    expect(memberCardBackgroundInputSchema.safeParse({ url: OK_URL, fit: "cover" }).success).toBe(false);
    expect(memberCardBackgroundInputSchema.safeParse(null).success).toBe(false);
  });
});

describe("isValidMemberCardConfigValue (valor de chave gravada por updateConfigValues)", () => {
  it("URL: vazia ou do destino de upload passam; javascript:, data:, http: e outro host não", () => {
    const k = "memberCardBackgroundUrl";
    expect(isValidMemberCardConfigValue(k, "", CLOUD)).toBe(true);
    expect(isValidMemberCardConfigValue(k, OK_URL, CLOUD)).toBe(true);
    expect(isValidMemberCardConfigValue(k, "javascript:alert(1)", CLOUD)).toBe(false);
    expect(isValidMemberCardConfigValue(k, "data:image/png;base64,AA", CLOUD)).toBe(false);
    expect(isValidMemberCardConfigValue(k, OK_URL.replace("https://", "http://"), CLOUD)).toBe(false);
    expect(isValidMemberCardConfigValue(k, "https://evil.example/a.png", CLOUD)).toBe(false);
  });

  it("fit: enum; opacidade: inteiro 10 a 100 como texto", () => {
    expect(isValidMemberCardConfigValue("memberCardBackgroundFit", "contain", CLOUD)).toBe(true);
    expect(isValidMemberCardConfigValue("memberCardBackgroundFit", "fill", CLOUD)).toBe(false);
    expect(isValidMemberCardConfigValue("memberCardBackgroundOpacity", "10", CLOUD)).toBe(true);
    expect(isValidMemberCardConfigValue("memberCardBackgroundOpacity", "100", CLOUD)).toBe(true);
    expect(isValidMemberCardConfigValue("memberCardBackgroundOpacity", "9", CLOUD)).toBe(false);
    expect(isValidMemberCardConfigValue("memberCardBackgroundOpacity", "101", CLOUD)).toBe(false);
    expect(isValidMemberCardConfigValue("memberCardBackgroundOpacity", "050", CLOUD)).toBe(false);
    expect(isValidMemberCardConfigValue("memberCardBackgroundOpacity", "1e2", CLOUD)).toBe(false);
  });

  it("mescla: multiply ou normal (ou vazio) passam; outro valor é recusado", () => {
    const k = "memberCardBackgroundBlend";
    expect(isValidMemberCardConfigValue(k, "multiply", CLOUD)).toBe(true);
    expect(isValidMemberCardConfigValue(k, "normal", CLOUD)).toBe(true);
    expect(isValidMemberCardConfigValue(k, "", CLOUD)).toBe(true);
    for (const bad of ["screen", "Multiply", "multiply ", "overlay", "<img>"]) {
      expect(isValidMemberCardConfigValue(k, bad, CLOUD)).toBe(false);
    }
  });

  it("normalizeCardBackgroundBlend: só 'normal' fica normal; o resto vira multiply", () => {
    expect(normalizeCardBackgroundBlend("normal")).toBe("normal");
    expect(normalizeCardBackgroundBlend("multiply")).toBe("multiply");
    expect(normalizeCardBackgroundBlend("screen")).toBe("multiply");
    expect(normalizeCardBackgroundBlend(undefined)).toBe("multiply");
  });

  it("chaves que não são do fundo passam sem regra extra", () => {
    expect(isValidMemberCardConfigValue("siteName", "qualquer coisa", CLOUD)).toBe(true);
  });
});
