import { describe, it, expect, beforeEach, vi } from "vitest";

/** CPF guardado só é reaproveitado para o dono do WhatsApp (logado ou aparelho lembrado). */
const h = vi.hoisted(() => ({ owner: true, dbCalls: 0 }));
vi.mock("./device-trust", () => ({ canReuseStoredIdentity: async () => h.owner }));
vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where"]) chain[m] = () => chain;
  chain.limit = async () => [{ cpf: "111.444.777-35" }];
  return {
    getDb: async () => {
      h.dbCalls++;
      return chain;
    },
  };
});

import { resolveCustomerCpf } from "./cpf";

beforeEach(() => {
  h.owner = true;
  h.dbCalls = 0;
});

describe("resolveCustomerCpf", () => {
  it("CPF informado e válido vence (sem consultar o banco)", async () => {
    expect(await resolveCustomerCpf("11900000000", "529.982.247-25")).toBe("52998224725");
    expect(h.dbCalls).toBe(0);
  });

  it("dono: reaproveita o CPF do cadastro", async () => {
    expect(await resolveCustomerCpf("11900000000")).toBe("11144477735");
  });

  it("quem não é o dono não recebe o CPF guardado de ninguém", async () => {
    h.owner = false;
    expect(await resolveCustomerCpf("11900000000")).toBeUndefined();
    expect(h.dbCalls).toBe(0);
  });
});
