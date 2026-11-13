import { describe, it, expect } from "vitest";
import { parseCardPaymentData } from "./card-input";

describe("parseCardPaymentData", () => {
  const valid = { cardToken: "tok_1", installments: 3, paymentMethodId: "visa", identificationNumber: "52998224725" };

  it("ausente → {} (Pix ou cartão Asaas); válido → só os 4 campos", () => {
    expect(parseCardPaymentData(undefined)).toEqual({});
    expect(parseCardPaymentData(null)).toEqual({});
    expect(parseCardPaymentData(valid)).toEqual(valid);
  });

  it("qualquer campo extra (valor, método, pedido) → null", () => {
    for (const extra of [{ amountCents: 1 }, { method: "credit_card" }, { orderId: "x" }, { customerEmail: "a@b.c" }]) {
      expect(parseCardPaymentData({ ...valid, ...extra })).toBeNull();
    }
  });

  it("tipos e limites errados → null", () => {
    for (const bad of [
      { ...valid, installments: 0 },
      { ...valid, installments: 13 },
      { ...valid, installments: 1.5 },
      { ...valid, cardToken: "" },
      { ...valid, cardToken: "x".repeat(201) },
      "texto",
      [valid],
    ]) {
      expect(parseCardPaymentData(bad)).toBeNull();
    }
  });
});
