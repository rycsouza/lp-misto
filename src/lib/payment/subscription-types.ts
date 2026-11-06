export interface AsaasCardData {
  holderName: string;
  number: string;       // raw digits only
  expiryMonth: string;  // "01"–"12"
  expiryYear: string;   // full year "2028"
  ccv: string;
  postalCode: string;   // digits only
  addressNumber: string;
}

/**
 * Documento do pagador (só dígitos): CPF no plano de pessoa física; CNPJ + razão social
 * no plano empresarial. Um ou outro, nunca os dois.
 */
export type SubscriptionPayerDocument =
  | { cpf: string; cnpj?: undefined; companyName?: undefined }
  | { cpf?: undefined; cnpj: string; companyName: string };

interface SubscriptionCreateBase {
  /** Responsável (pessoa que assina). No plano empresarial, é o contato da empresa. */
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  externalRef: string; // memberId
  planName: string;
  /** Nome do programa de sócio do clube (descrição da cobrança no gateway). Padrão: "Sócio-Torcedor". */
  programName?: string;
  amountCents: number;
  backUrl?: string;
  /** MP: token do Brick (cartão). Obrigatório no Mercado Pago. */
  cardTokenId?: string;
  /** Asaas: cartão enviado direto na criação da assinatura. Obrigatório no Asaas. */
  asaasCardData?: AsaasCardData;
  // Buyer IP — exigido pelo ASAAS (antifraude) em cobranças com cartão
  remoteIp?: string;
  /** 1ª cobrança (AAAA-MM-DD). Padrão: hoje. Troca de plano: próximo vencimento. */
  firstDueDate?: string;
}

export type SubscriptionCreateInput = SubscriptionCreateBase & SubscriptionPayerDocument;

/**
 * Forma de pagamento da assinatura: cartão, Pix Automático (Asaas) ou "immediate" (gateway mock
 * de dev/teste).
 */
export type SubscriptionPaymentMethod = "card" | "pix_automatic" | "immediate";

export interface SubscriptionCreateResult {
  gatewayCustomerId?: string;
  subscriptionId: string;
  paymentMethod: SubscriptionPaymentMethod;
  nextDueDate?: string;
}

/**
 * Pix Automático (Jornada 3): a 1ª mensalidade é paga por um QR Code imediato e, no mesmo
 * pagamento, o pagador autoriza as próximas no app do banco. Sem dados de cartão.
 */
export type PixAutomaticCreateInput = Omit<SubscriptionCreateBase, "cardTokenId" | "asaasCardData" | "firstDueDate"> &
  SubscriptionPayerDocument & {
    /** Identificador do contrato no gateway (máx. 35 caracteres): aparece no app do banco. */
    contractId: string;
    /** Início das cobranças recorrentes (AAAA-MM-DD): a 1ª mensalidade é a do QR imediato. */
    startDate: string;
    /** Validade do QR Code da 1ª mensalidade, em segundos. */
    expirationSeconds: number;
  };

export interface PixAutomaticCreateResult {
  gatewayCustomerId: string;
  authorizationId: string;
  /** Pix copia e cola da 1ª mensalidade (com a autorização). */
  qrPayload: string;
  /** Imagem do QR Code (PNG em base64, sem o prefixo data:). NULL se o gateway não mandar. */
  qrImageBase64: string | null;
  /** Expiração do QR (ISO). NULL se o gateway não informar. */
  expiresAt: string | null;
}

/** Situação da autorização no gateway (UNKNOWN = valor que o sistema não conhece). */
export type PixAutomaticAuthorizationStatus = "CREATED" | "ACTIVE" | "CANCELLED" | "REFUSED" | "EXPIRED" | "UNKNOWN";

export interface PixAutomaticAuthorizationInfo {
  id: string;
  status: PixAutomaticAuthorizationStatus;
  /** Assinatura que o gateway cria após a ativação (gera as próximas mensalidades). */
  subscriptionId: string | null;
  /** Cliente do gateway dono da autorização. */
  customerId: string | null;
  /** Início das cobranças recorrentes (AAAA-MM-DD). */
  startDate: string | null;
}

export interface SubscriptionGateway {
  createSubscription(input: SubscriptionCreateInput): Promise<SubscriptionCreateResult>;
  /** Pix Automático: cria a autorização com o QR da 1ª mensalidade (só Asaas). */
  createPixAutomaticAuthorization?(input: PixAutomaticCreateInput): Promise<PixAutomaticCreateResult>;
  /** Pix Automático: situação atual da autorização (fonte da verdade, nunca o webhook). */
  getPixAutomaticAuthorization?(authorizationId: string): Promise<PixAutomaticAuthorizationInfo>;
  /** Pix Automático: cancela a autorização (para de cobrar). */
  cancelPixAutomaticAuthorization?(authorizationId: string): Promise<void>;
  /** Pix Automático: a 1ª mensalidade (QR imediato) já paga, fora da assinatura. */
  findPixAutomaticFirstPayment?(customerId: string): Promise<SubscriptionPaymentInfo | null>;
  cancelSubscription(subscriptionId: string): Promise<boolean>;
  getSubscriptionStatus(subscriptionId: string): Promise<string>;
  /** Mensalidades da assinatura (admin: histórico). */
  listSubscriptionPayments?(subscriptionId: string): Promise<SubscriptionPaymentInfo[]>;
  /** Situação de cobrança da assinatura (fonte da verdade para em dia/atraso). */
  getBillingState?(subscriptionId: string): Promise<SubscriptionBillingState>;
  /** Há cobrança paga nesta assinatura? (consulta o gateway — fonte da verdade) */
  hasPaidCharge?(subscriptionId: string): Promise<boolean>;
  /** Referência externa gravada na criação (id do sócio). */
  getSubscriptionExternalReference?(subscriptionId: string): Promise<string | null>;
}

export interface SubscriptionBillingState {
  /** Alguma mensalidade paga (CONFIRMED/RECEIVED). */
  hasPaid: boolean;
  /** Vencimento (AAAA-MM-DD) da mensalidade VENCIDA mais antiga, se houver. */
  oldestOverdueDueDate: string | null;
  /** Próximo vencimento da assinatura (AAAA-MM-DD). */
  nextDueDate: string | null;
  /**
   * Vencimento (AAAA-MM-DD) da mensalidade EM ABERTO (pendente/vencida) mais antiga.
   * O "pago até" do sócio não passa dela: o gateway gera a cobrança antes do
   * vencimento e o `nextDueDate` já pula para o mês seguinte, ainda não pago.
   */
  oldestOpenDueDate?: string | null;
  /** Fatura em aberto mais antiga (pendente/vencida) — página de pagamento do gateway. */
  openInvoiceUrl: string | null;
}

export interface SubscriptionPaymentInfo {
  dueDate: string | null;
  valueCents: number;
  /** Status bruto do gateway (ex.: CONFIRMED, RECEIVED, PENDING, OVERDUE, REFUNDED). */
  status: string;
  invoiceUrl: string | null;
  /** Id da cobrança no gateway (chave do ledger local). NULL se o gateway não informar. */
  gatewayPaymentId: string | null;
  /** Valor líquido após a taxa do gateway. NULL quando o gateway não informa. */
  netValueCents: number | null;
  /** Data do pagamento (AAAA-MM-DD). NULL enquanto não foi pago. */
  paymentDate: string | null;
  /** Forma de pagamento do gateway (ex.: CREDIT_CARD). */
  billingType: string | null;
}
