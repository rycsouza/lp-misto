import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Paliativo de segurança: o WhatsApp não é verificado, então um cadastro
 * existente NUNCA pode ter nome/e-mail sobrescritos por uma compra (senão um
 * atacante trocaria o e-mail da vítima e receberia os próximos ingressos dela).
 */
const h = vi.hoisted(() => ({
  values: null as Record<string, unknown> | null,
  conflict: null as { target: unknown; set: Record<string, unknown> } | null,
}));

vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  chain.insert = () => chain;
  chain.values = (v: Record<string, unknown>) => {
    h.values = v;
    return chain;
  };
  chain.onConflictDoUpdate = (c: { target: unknown; set: Record<string, unknown> }) => {
    h.conflict = c;
    return chain;
  };
  chain.returning = async () => [{ id: "cust-1" }];
  return { getDb: async () => chain };
});

import { upsertCustomer } from "./upsert";

beforeEach(() => {
  h.values = null;
  h.conflict = null;
});

describe("upsertCustomer", () => {
  it("cadastro novo grava nome, e-mail, WhatsApp normalizado e CPF válido", async () => {
    const id = await upsertCustomer("Titular Exemplo", "titular@example.com", "(11) 90000-0000", "111.444.777-35");
    expect(id).toBe("cust-1");
    expect(h.values).toEqual({
      name: "Titular Exemplo",
      email: "titular@example.com",
      whatsapp: "11900000000",
      cpf: "11144477735",
    });
  });

  it("cadastro EXISTENTE não tem nome nem e-mail sobrescritos", async () => {
    await upsertCustomer("Atacante", "atacante@example.com", "11900000000");
    expect(h.conflict).not.toBeNull();
    expect(h.conflict!.set).not.toHaveProperty("name");
    expect(h.conflict!.set).not.toHaveProperty("email");
  });

  it("CPF existente não é trocado (só preenche se vazio, via coalesce)", async () => {
    await upsertCustomer("X", "x@example.com", "11900000000", "111.444.777-35");
    expect(h.conflict!.set).toHaveProperty("cpf");
    expect(h.conflict!.set).toHaveProperty("updatedAt");
    expect(Object.keys(h.conflict!.set).sort()).toEqual(["cpf", "updatedAt"]);
  });

  it("CPF inválido nunca é gravado", async () => {
    await upsertCustomer("X", "x@example.com", "11900000000", "12345678900");
    expect(h.values!.cpf).toBeNull();
  });
});
