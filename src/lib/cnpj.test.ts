import { describe, expect, it } from "vitest";
import { formatCNPJ, formatCNPJInput, normalizeCNPJ, validateCNPJ } from "./cnpj";

describe("validateCNPJ", () => {
  it.each([
    "11.222.333/0001-81",
    "11222333000181",
    "11.444.777/0001-61",
    "00.360.305/0001-04", // CNPJ público (Banco do Brasil)
  ])("aceita CNPJ com dígitos verificadores corretos: %s", (cnpj) => {
    expect(validateCNPJ(cnpj)).toBe(true);
  });

  it.each([
    ["dígito verificador errado (último)", "11.222.333/0001-82"],
    ["dígito verificador errado (penúltimo)", "11.222.333/0001-71"],
    ["tamanho curto", "11.222.333/0001-8"],
    ["tamanho longo", "11.222.333/0001-811"],
    ["vazio", ""],
    ["sequência repetida 0", "00.000.000/0000-00"],
    ["sequência repetida 1", "11111111111111"],
    ["CPF de 11 dígitos", "529.982.247-25"],
    ["letras", "11.222.333/000A-81"],
  ])("recusa: %s", (_label, cnpj) => {
    expect(validateCNPJ(cnpj)).toBe(false);
  });

  it("ignora máscara e espaços (aceita formatado ou só dígitos)", () => {
    expect(validateCNPJ(" 11.222.333/0001-81 ")).toBe(true);
    expect(validateCNPJ("11222333000181")).toBe(true);
  });
});

describe("normalizeCNPJ / formatCNPJ", () => {
  it("normaliza para letras/números em maiúsculas (sem máscara)", () => {
    expect(normalizeCNPJ("11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizeCNPJ("12.abc.345/01de-35")).toBe("12ABC34501DE35");
  });

  it("formata com a máscara 00.000.000/0000-00 quando tem 14 dígitos", () => {
    expect(formatCNPJ("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("devolve o texto original quando não tem 14 dígitos", () => {
    expect(formatCNPJ("1122")).toBe("1122");
  });
});

describe("formatCNPJInput (máscara enquanto digita)", () => {
  it("vai formando a máscara 00.000.000/0000-00 e corta em 14 dígitos", () => {
    expect(formatCNPJInput("1")).toBe("1");
    expect(formatCNPJInput("112")).toBe("11.2");
    expect(formatCNPJInput("11222")).toBe("11.222");
    expect(formatCNPJInput("112223")).toBe("11.222.3");
    expect(formatCNPJInput("11222333")).toBe("11.222.333");
    expect(formatCNPJInput("112223330001")).toBe("11.222.333/0001");
    expect(formatCNPJInput("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCNPJInput("11222333000181999")).toBe("11.222.333/0001-81");
  });

  it("aceita letras nas 12 primeiras posições (CNPJ alfanumérico) e só dígitos nas 2 finais", () => {
    expect(formatCNPJInput("12abc34501de35")).toBe("12.ABC.345/01DE-35");
    expect(formatCNPJInput("12ABC34501DEXY35")).toBe("12.ABC.345/01DE-35");
    expect(formatCNPJInput("11.#222")).toBe("11.222");
    expect(formatCNPJInput("")).toBe("");
  });
});

describe("CNPJ alfanumérico (Receita, a partir de jul/2026)", () => {
  it("valida o exemplo oficial e recusa verificador errado", () => {
    expect(validateCNPJ("12.ABC.345/01DE-35")).toBe(true);
    expect(validateCNPJ("12abc34501de35")).toBe(true);
    expect(validateCNPJ("12.ABC.345/01DE-36")).toBe(false);
  });
  it("letras nas posições dos verificadores são recusadas", () => {
    expect(validateCNPJ("12ABC34501DEAB")).toBe(false);
  });
  it("o numérico antigo continua válido", () => {
    expect(validateCNPJ("11.222.333/0001-81")).toBe(true);
  });
  it("sequência repetida (inclusive de letras) é recusada", () => {
    expect(validateCNPJ("AAAAAAAAAAAAAA")).toBe(false);
  });
});
