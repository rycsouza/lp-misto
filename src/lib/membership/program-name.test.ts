import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEMBERSHIP_PROGRAM_NAME,
  MEMBERSHIP_PROGRAM_NAME_KEY,
  isValidMembershipProgramName,
  isValidMembershipProgramNameConfigValue,
  resolveMembershipProgramName,
} from "./program-name";

describe("nome do programa de sócio: padrão", () => {
  it("o padrão é Sócio-Torcedor e a chave é membershipProgramName", () => {
    expect(DEFAULT_MEMBERSHIP_PROGRAM_NAME).toBe("Sócio-Torcedor");
    expect(MEMBERSHIP_PROGRAM_NAME_KEY).toBe("membershipProgramName");
  });
});

describe("isValidMembershipProgramName: nomes válidos", () => {
  it.each([
    "Sócio Torcedor",
    "Sócio-Torcedor",
    "Sócio Premium",
    "Torcedor VIP 2",
    "D'Ouro Sócio",
    "Sócio ’Tipográfico’",
    "Ação",
    "AB", // limite inferior: 2 caracteres
    "a".repeat(40), // limite superior: 40 caracteres
  ])("aceita %j", (name) => {
    expect(isValidMembershipProgramName(name)).toBe(true);
  });
});

describe("isValidMembershipProgramName: nomes inválidos", () => {
  it.each([
    ["vazio", ""],
    ["1 caractere", "A"],
    ["41 caracteres", "a".repeat(41)],
    ["HTML de script", "<script>alert(1)</script>"],
    ["tag simples", "<b>Sócio</b>"],
    ["aspas (atributo)", 'Sócio "VIP"'],
    ["e comercial", "Sócio & Cia"],
    ["emoji", "Sócio 🦁"],
    ["quebra de linha", "Sócio\nTorcedor"],
    ["tabulação", "Sócio\tTorcedor"],
    ["espaço na borda (início)", " Sócio"],
    ["espaço na borda (fim)", "Sócio "],
    ["espaço duplo", "Sócio  Torcedor"],
    ["só dígitos (sem letra)", "1234"],
    ["só hífens", "--"],
    ["barra", "Sócio/Torcedor"],
    ["não é string", 42 as unknown as string],
  ])("recusa %s", (_label, name) => {
    expect(isValidMembershipProgramName(name as string)).toBe(false);
  });
});

describe("isValidMembershipProgramNameConfigValue (valor gravado)", () => {
  it("vazio é aceito: volta ao padrão", () => {
    expect(isValidMembershipProgramNameConfigValue("membershipProgramName", "")).toBe(true);
  });

  it("nome válido é aceito e nome inválido recusa", () => {
    expect(isValidMembershipProgramNameConfigValue("membershipProgramName", "Sócio Premium")).toBe(true);
    expect(isValidMembershipProgramNameConfigValue("membershipProgramName", "<b>x</b>")).toBe(false);
  });

  it("outras chaves não passam por esta regra", () => {
    expect(isValidMembershipProgramNameConfigValue("siteName", "<b>x</b>")).toBe(true);
  });
});

describe("resolveMembershipProgramName: o que sai na tela", () => {
  it("valor ausente, vazio, não-texto ou inválido vira o padrão", () => {
    for (const raw of [undefined, null, "", "   ", 42, "<b>x</b>", "A", "a".repeat(41)]) {
      expect(resolveMembershipProgramName(raw)).toBe(DEFAULT_MEMBERSHIP_PROGRAM_NAME);
    }
  });

  it("nome válido volta sem as bordas", () => {
    expect(resolveMembershipProgramName("  Sócio Premium  ")).toBe("Sócio Premium");
  });
});
