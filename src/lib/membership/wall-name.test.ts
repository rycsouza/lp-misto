import { describe, it, expect } from "vitest";
import { normalizeWallName, wallNameProblem, wallNameSchema } from "./wall-name";

describe("nome no mural — aceitos", () => {
  for (const raw of [
    "Ana",
    "Ana Maria",
    "João da Silva",
    "José Ângelo",
    "D'Ávila",
    "D’Ávila",
    "Ana-Clara",
    "Ana M. Silva",
    "Pedro 2",
    "a".repeat(40),
  ]) {
    it(`aceita "${raw}"`, () => {
      expect(wallNameProblem(raw)).toBeNull();
      expect(wallNameSchema.safeParse(raw).success).toBe(true);
    });
  }

  it("normaliza: trim, espaços colapsados e forma NFC", () => {
    expect(normalizeWallName("  Ana   Maria  ")).toBe("Ana Maria");
    // "João" escrito com o acento combinante (NFD) vira a forma composta (NFC).
    expect(normalizeWallName("João")).toBe("João");
    expect(wallNameSchema.parse("  Ana   Maria  ")).toBe("Ana Maria");
  });
});

describe("nome no mural — recusados", () => {
  const cases: [string, string][] = [
    ["vazio", ""],
    ["só espaços", "   "],
    ["um caractere", "A"],
    ["41 caracteres", "a".repeat(41)],
    ["HTML", "<script>alert(1)</script>"],
    ["tag de imagem", "Ana <img src=x>"],
    ["emoji", "😀 Ana"],
    ["emoji no meio", "Ana 🎉 Silva"],
    ["URL com protocolo", "https://ana.example"],
    ["www", "www ana"],
    ["domínio", "ana.com"],
    ["e-mail", "ana@example.com"],
    ["barra", "Ana/Silva"],
    ["comercial", "João & Maria"],
    ["aspas duplas", 'Ana "Lu"'],
    ["ponto-e-vírgula", "Ana;DROP"],
    ["hífen repetido", "Ana--Clara"],
    ["apóstrofo repetido", "D''Ávila"],
    ["começa com hífen", "-Ana"],
    ["começa com número", "2Ana"],
    ["termina com hífen", "Ana-"],
    ["caractere de controle", "Ana\u0007"],
  ];
  for (const [label, raw] of cases) {
    it(`recusa ${label}`, () => {
      expect(wallNameProblem(raw)).not.toBeNull();
      expect(wallNameSchema.safeParse(raw).success).toBe(false);
    });
  }

  it("não aceita tipo que não é texto", () => {
    expect(wallNameSchema.safeParse(123).success).toBe(false);
    expect(wallNameSchema.safeParse(null).success).toBe(false);
  });

  it("recusa payload muito grande antes de normalizar", () => {
    expect(wallNameSchema.safeParse("a".repeat(201)).success).toBe(false);
  });
});
