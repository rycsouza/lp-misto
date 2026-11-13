import { z } from "zod";

/**
 * Dados de cartão do Mercado Pago (Brick) vindos do cliente. Só estes quatro campos entram no
 * pagamento: o objeto do cliente NUNCA é espalhado inteiro no CreatePaymentInput — um campo extra
 * como `amountCents`, `method` ou `orderId` sobrescreveria o valor cobrado no gateway
 * (auditoria run-2: checkout/createPayment/cardData-spread-overrides-amountCents).
 */
export const cardPaymentDataSchema = z
  .object({
    cardToken: z.string().min(1).max(200),
    installments: z.number().int().min(1).max(12),
    paymentMethodId: z.string().max(40),
    identificationNumber: z.string().max(20),
  })
  .strict();

export type CardPaymentFields = z.infer<typeof cardPaymentDataSchema>;

/**
 * Valida os dados de cartão do cliente. Ausente → {} (Pix ou cartão Asaas). Presente e inválido
 * (inclusive com qualquer campo a mais) → null: quem chama recusa o pedido antes de cobrar.
 */
export function parseCardPaymentData(raw: unknown): Partial<CardPaymentFields> | null {
  if (raw === undefined || raw === null) return {};
  const parsed = cardPaymentDataSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export const INVALID_CARD_DATA_ERROR = "Dados do cartão inválidos. Confira e tente novamente.";
