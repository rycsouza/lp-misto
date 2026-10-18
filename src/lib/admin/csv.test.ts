import { describe, it, expect } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell (neutralização de injeção de fórmula)", () => {
  it.each(["=HYPERLINK(\"http://x\")", "+cmd", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"])(
    "prefixa com apóstrofo quando começa com %j",
    (v) => {
      const out = csvCell(v);
      expect(out.startsWith(`"'`)).toBe(true);
    }
  );

  it("texto comum vai entre aspas, sem prefixo", () => {
    expect(csvCell("Maria S.")).toBe('"Maria S."');
  });

  it("aspas internas são duplicadas", () => {
    expect(csvCell('Plano "Ouro"')).toBe('"Plano ""Ouro"""');
  });

  it("nulo e indefinido viram célula vazia", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("número não é prefixado (são valores calculados pelo servidor)", () => {
    expect(csvCell(-10)).toBe("-10");
    expect(csvCell(12)).toBe("12");
    expect(csvCell(Number.NaN)).toBe("");
  });

  it("texto com vírgula e quebra de linha fica protegido pelas aspas", () => {
    expect(csvCell("a,b\nc")).toBe('"a,b\nc"');
  });
});

describe("toCsv", () => {
  it("junta linhas com quebra de linha e células com vírgula", () => {
    expect(toCsv([["Nome", "Valor"], ["=cmd", 3]])).toBe('"Nome","Valor"\n"\'=cmd",3');
  });
});
