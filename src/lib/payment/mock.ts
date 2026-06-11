import type { PaymentGateway, CreatePaymentInput, CreatePaymentResult } from "./types";

/*
 * Gateway fictício para desenvolvimento/testes.
 * Suporta PIX (aprova na primeira verificação) e cartão (sempre "approved").
 * NÃO usar em produção.
 */
export class MockGateway implements PaymentGateway {
  readonly supportsCard = true;

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (input.method === "credit_card") {
      return {
        gatewayPaymentId: `mock_cc_${input.orderId.slice(0, 8)}`,
        method: "credit_card",
        cardStatus: "approved",
        cardStatusDetail: "accredited",
      };
    }

    return {
      gatewayPaymentId: `mock_${input.orderId.slice(0, 8)}`,
      method: "pix",
      pixQrCode:
        `00020126580014br.gov.bcb.pix0136` +
        `mock-pix-${input.orderId.slice(0, 8)}` +
        `5204000053039865802BR5913MISTO EC TEST6009TRES LAGOS62070503***6304MOCK`,
      pixQrCodeUrl: undefined,
    };
  }

  async getPaymentStatus(
    _gatewayPaymentId: string
  ): Promise<"pending" | "paid" | "failed" | "refunded"> {
    return "paid";
  }
}
