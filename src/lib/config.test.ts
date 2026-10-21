import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * getSiteConfig expõe membershipProgramName: padrão "Sócio-Torcedor" quando a chave
 * está vazia, ausente ou inválida no banco; o nome configurado quando é válido.
 */
const h = vi.hoisted(() => ({
  rows: [] as { key: string; value: string; type: string }[],
  fail: false,
}));

vi.mock("@/lib/db/queries", () => ({
  getAllSiteConfig: async () => {
    if (h.fail) throw new Error("banco indisponível");
    return h.rows;
  },
}));

import { getSiteConfig } from "./config";

beforeEach(() => {
  h.rows = [];
  h.fail = false;
});

describe("getSiteConfig: nome do programa de sócio", () => {
  it("sem a chave no banco: usa Sócio-Torcedor", async () => {
    const config = await getSiteConfig();
    expect(config.membershipProgramName).toBe("Sócio-Torcedor");
  });

  it("chave gravada vazia: usa Sócio-Torcedor", async () => {
    h.rows = [{ key: "membershipProgramName", value: "", type: "string" }];
    expect((await getSiteConfig()).membershipProgramName).toBe("Sócio-Torcedor");
  });

  it("nome válido gravado: devolve o nome configurado", async () => {
    h.rows = [{ key: "membershipProgramName", value: "Sócio Premium", type: "string" }];
    expect((await getSiteConfig()).membershipProgramName).toBe("Sócio Premium");
  });

  it("valor inválido no banco (ex.: HTML, linha antiga): cai no padrão, sem vazar o valor", async () => {
    h.rows = [{ key: "membershipProgramName", value: "<img src=x onerror=alert(1)>", type: "string" }];
    const config = await getSiteConfig();
    expect(config.membershipProgramName).toBe("Sócio-Torcedor");
    expect(JSON.stringify(config)).not.toContain("onerror");
  });

  it("falha de leitura do banco: devolve o padrão sem lançar", async () => {
    h.fail = true;
    expect((await getSiteConfig()).membershipProgramName).toBe("Sócio-Torcedor");
  });
});
