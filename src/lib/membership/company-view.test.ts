import { describe, it, expect } from "vitest";
import { adminCompanyView } from "./company-view";

/**
 * Detalhe do sócio no admin: o bloco da empresa existe só para plano 'pj' (o público vem do
 * plano atual) e o CNPJ sai formatado, inclusive o alfanumérico.
 */
describe("adminCompanyView", () => {
  it("plano pj: nome da empresa e CNPJ formatado (só dígitos gravados)", () => {
    expect(adminCompanyView({ audience: "pj", cnpj: "11222333000181", companyName: "  Padaria Bom Pão Ltda  " })).toEqual({
      companyName: "Padaria Bom Pão Ltda",
      cnpj: "11.222.333/0001-81",
    });
  });

  it("CNPJ alfanumérico também sai formatado", () => {
    const r = adminCompanyView({ audience: "pj", cnpj: "12ABC34501DE35", companyName: "Empresa X" });
    expect(r?.cnpj).toBe("12.ABC.345/01DE-35");
  });

  it("plano pf (CPF): sem bloco de empresa, mesmo que exista CNPJ gravado", () => {
    expect(adminCompanyView({ audience: "pf", cnpj: "11222333000181", companyName: "X" })).toBeNull();
    expect(adminCompanyView({ audience: null, cnpj: null, companyName: null })).toBeNull();
  });

  it("pj sem nome ou CNPJ gravado: campos nulos, sem inventar valor", () => {
    expect(adminCompanyView({ audience: "pj", cnpj: null, companyName: "   " })).toEqual({ companyName: null, cnpj: null });
  });
});
