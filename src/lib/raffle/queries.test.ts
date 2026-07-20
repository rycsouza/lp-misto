import { describe, it, expect } from "vitest";
import { maskName } from "./queries";

/**
 * Máscara de nome do ganhador (LGPD): expõe só o primeiro nome + inicial do
 * sobrenome na página pública de ganhadores. Nunca o nome completo.
 */
describe("maskName", () => {
  it("dois nomes → primeiro + inicial do último", () => {
    expect(maskName("João Silva")).toBe("João S.");
  });

  it("três+ nomes → primeiro + inicial do último", () => {
    expect(maskName("Maria Aparecida de Souza")).toBe("Maria S.");
  });

  it("nome único → não revela sobrenome", () => {
    expect(maskName("Ronaldinho")).toBe("Ronaldinho •••");
  });

  it("espaços extras são tolerados", () => {
    expect(maskName("  Ana   Beatriz  ")).toBe("Ana B.");
  });

  it("vazio → placeholder", () => {
    expect(maskName("")).toBe("—");
    expect(maskName("   ")).toBe("—");
  });

  it("inicial do sobrenome vem em maiúscula", () => {
    expect(maskName("pedro alves")).toBe("pedro A.");
  });
});
