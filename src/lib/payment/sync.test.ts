import { describe, it, expect } from "vitest";
import { isTransitionAllowed, type PaymentStatus } from "./sync";

const ALL: PaymentStatus[] = ["pending", "paid", "failed", "refunded"];

describe("isTransitionAllowed — máquina de estados de pagamento", () => {
  it("paid só é aceito a partir de pending ou failed (não de paid/refunded)", () => {
    expect(isTransitionAllowed("pending", "paid")).toBe(true);
    expect(isTransitionAllowed("failed", "paid")).toBe(true); // reconciliação
    expect(isTransitionAllowed("paid", "paid")).toBe(false); // idempotente: não re-dispara
    expect(isTransitionAllowed("refunded", "paid")).toBe(false);
  });

  it("nunca rebaixa um pagamento confirmado/estornado para failed", () => {
    expect(isTransitionAllowed("paid", "failed")).toBe(false);
    expect(isTransitionAllowed("refunded", "failed")).toBe(false);
    expect(isTransitionAllowed("pending", "failed")).toBe(true);
    expect(isTransitionAllowed("failed", "failed")).toBe(false);
  });

  it("refunded é aceito a partir de pending ou paid", () => {
    expect(isTransitionAllowed("pending", "refunded")).toBe(true);
    expect(isTransitionAllowed("paid", "refunded")).toBe(true);
    expect(isTransitionAllowed("failed", "refunded")).toBe(false);
    expect(isTransitionAllowed("refunded", "refunded")).toBe(false);
  });

  it("pending nunca é destino (nenhuma origem transiciona para pending)", () => {
    for (const from of ALL) {
      expect(isTransitionAllowed(from, "pending")).toBe(false);
    }
  });

  it("nenhum estado terminal transiciona para si mesmo (efeito único)", () => {
    expect(isTransitionAllowed("paid", "paid")).toBe(false);
    expect(isTransitionAllowed("refunded", "refunded")).toBe(false);
    expect(isTransitionAllowed("failed", "failed")).toBe(false);
  });
});
