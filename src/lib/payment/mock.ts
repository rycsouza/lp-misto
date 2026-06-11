import type { PaymentGateway, CreatePaymentInput, CreatePaymentResult } from "./types";

/*
 * Gateway fictício para desenvolvimento/testes.
 * Ativo automaticamente quando NODE_ENV=development e nenhum gateway real está configurado.
 * Simula aprovação PIX após ~5 s (primeiro poll do PaymentStep).
 * NÃO usar em produção — substitua configurando um gateway real na tabela payment_gateways.
 */
export class MockGateway implements PaymentGateway {
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      gatewayPaymentId: `mock_${input.orderId.slice(0, 8)}`,
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
    // Aprova na primeira verificação (PaymentStep faz poll a cada 5 s)
    return "paid";
  }
}
