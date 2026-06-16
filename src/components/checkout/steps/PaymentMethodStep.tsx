"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy, Check, CreditCard, QrCode, Loader2,
  CheckCircle2, XCircle, Clock
} from "lucide-react";
import { checkPaymentStatus, getGatewayInfo } from "@/app/actions/checkout";
import type { CreateOrderResult } from "@/app/actions/checkout";
import { UpsellCard } from "@/components/checkout/UpsellCard";
import type { UpsellOfferDisplay } from "@/components/checkout/UpsellCard";
import { CouponInput } from "@/components/checkout/CouponInput";
import type { CouponValidation } from "@/app/actions/coupon";

// ─── Tipos MercadoPago.js ────────────────────────────────────────────────────

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => MPInstance;
  }
}

interface MPInstance {
  createCardToken(data: {
    cardNumber: string;
    cardholderName: string;
    cardExpirationMonth: string;
    cardExpirationYear: string;
    securityCode: string;
    identificationType: string;
    identificationNumber: string;
  }): Promise<{ id: string; error?: string }>;
  getPaymentMethods(params: { bin: string }): Promise<{
    results: Array<{ id: string; name: string; thumbnail?: string }>;
  }>;
  getInstallments(params: { amount: string; bin: string }): Promise<
    Array<{ installments: number; installment_amount: number; total_amount: number }>
  >;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );
}

function formatCardNumber(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(v: string) {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function formatCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatCEP(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

// ─── Props ───────────────────────────────────────────────────────────────────

type Method = "pix" | "credit_card";

interface AsaasCardInput {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
}

interface OnCreateOrderOpts {
  method: Method;
  // MercadoPago
  cardToken?: string;
  installments?: number;
  paymentMethodId?: string;
  identificationNumber?: string;
  // Asaas
  asaasCardData?: AsaasCardInput;
  customerCpf?: string;
}

interface Game {
  id: string;
  opponent: string;
  date: string;
}

interface PaymentMethodStepProps {
  totalCents: number;
  onCreateOrder(opts: OnCreateOrderOpts): Promise<CreateOrderResult>;
  onPaid(orderId: string): void;
  onFailed(): void;
  onBack(): void;
  upsellOffer?: UpsellOfferDisplay | null;
  upsellAccepted?: boolean;
  upsellGameId?: string;
  games?: Game[];
  onUpsellAccept?: (gameId: string) => void;
  onUpsellDecline?: () => void;
  onUpsellGameChange?: (gameId: string) => void;
  coupon?: CouponValidation | null;
  customerWhatsapp?: string;
  onCouponApply?: (coupon: CouponValidation) => void;
  onCouponRemove?: () => void;
  initialCouponCode?: string | null;
}

// ─── Fases internas ──────────────────────────────────────────────────────────

type Phase =
  | { type: "method-select" }
  | { type: "pix-loading" }
  | { type: "pix-ready"; paymentId: string; qrCode: string; qrCodeUrl?: string; orderId?: string }
  | { type: "cc-form" }
  | { type: "cc-processing" }
  | { type: "cc-result"; status: "approved" | "in_process" | "rejected"; detail?: string; orderId?: string };

// ─── Componente ──────────────────────────────────────────────────────────────

export function PaymentMethodStep({
  totalCents,
  onCreateOrder,
  onPaid,
  onFailed,
  onBack,
  upsellOffer,
  upsellAccepted,
  upsellGameId,
  games,
  onUpsellAccept,
  onUpsellDecline,
  onUpsellGameChange,
  coupon,
  customerWhatsapp = "",
  onCouponApply,
  onCouponRemove,
  initialCouponCode,
}: PaymentMethodStepProps) {
  const [method, setMethod] = useState<Method>("pix");
  const [phase, setPhase] = useState<Phase>({ type: "method-select" });
  const [error, setError] = useState<string | null>(null);

  // Gateway info (supports card + public key)
  const [supportsCard, setSupportsCard] = useState(false);
  const [gatewaySlug, setGatewaySlug] = useState<string>("mercadopago");
  const [mpPublicKey, setMpPublicKey] = useState<string | null>(null);
  const [mpReady, setMpReady] = useState(false);
  const [mpScriptError, setMpScriptError] = useState(false);
  const mpRef = useRef<MPInstance | null>(null);

  // PIX
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const [pixCpf, setPixCpf] = useState("");
  const [pixCpfError, setPixCpfError] = useState<string | null>(null);

  // Card form
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cpf, setCpf] = useState("");
  const [cep, setCep] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [installments, setInstallments] = useState(1);
  const [detectedBrand, setDetectedBrand] = useState<string | null>(null);
  const [brandThumb, setBrandThumb] = useState<string | null>(null);
  const [installmentOptions, setInstallmentOptions] = useState<
    Array<{ installments: number; installment_amount: number; total_amount: number }>
  >([]);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  // ─── Load gateway info ────────────────────────────────────────────────────

  useEffect(() => {
    getGatewayInfo().then((info) => {
      setSupportsCard(info.supportsCard);
      setGatewaySlug(info.slug);
      if (info.publicKey) setMpPublicKey(info.publicKey);
    });
  }, []);

  // ─── Carrega MP.js assim que mpPublicKey fica disponível ─────────────────

  useEffect(() => {
    if (!mpPublicKey) return;

    function initMP() {
      if (!window.MercadoPago || mpRef.current) return;
      try {
        mpRef.current = new window.MercadoPago(mpPublicKey as string, { locale: "pt-BR" });
        setMpReady(true);
      } catch (e) {
        console.error("[MP.js] init error", e);
        setMpScriptError(true);
      }
    }

    // Script já carregado anteriormente
    if (window.MercadoPago) {
      initMP();
      return;
    }

    // Evita duplicata — mas adiciona listener caso o script já esteja carregando
    const existing = document.querySelector('script[src="https://sdk.mercadopago.com/js/v2"]');
    if (existing) {
      existing.addEventListener("load", initMP);
      existing.addEventListener("error", () => setMpScriptError(true));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.onload = initMP;
    script.onerror = () => {
      console.error("[MP.js] failed to load");
      setMpScriptError(true);
    };
    document.head.appendChild(script);
  }, [mpPublicKey]);

  // ─── Detect card brand from BIN ──────────────────────────────────────────

  useEffect(() => {
    const digits = cardNumber.replace(/\s/g, "");
    if (digits.length < 6 || !mpRef.current) {
      setDetectedBrand(null);
      setBrandThumb(null);
      setInstallmentOptions([]);
      return;
    }
    const bin = digits.slice(0, 6);
    mpRef.current.getPaymentMethods({ bin }).then((res) => {
      const method = res.results[0];
      setDetectedBrand(method?.id ?? null);
      setBrandThumb(method?.thumbnail ?? null);
    }).catch(() => { setDetectedBrand(null); setBrandThumb(null); });

    mpRef.current.getInstallments({ amount: String(totalCents / 100), bin }).then((opts) => {
      setInstallmentOptions(opts ?? []);
    }).catch(() => setInstallmentOptions([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardNumber]);

  // ─── PIX polling ─────────────────────────────────────────────────────────

  const pixPhaseRef = useRef(phase);
  pixPhaseRef.current = phase;

  const poll = useCallback(async (paymentId: string, orderId?: string) => {
    const status = await checkPaymentStatus(paymentId);
    if (status === "paid") onPaid(orderId ?? "");
    else if (status === "failed" || status === "refunded") onFailed();
  }, [onPaid, onFailed]);

  useEffect(() => {
    if (phase.type !== "pix-ready") return;
    const { paymentId, orderId } = phase;

    const pollInterval = setInterval(() => poll(paymentId, orderId), 5000);
    const timerInterval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(pollInterval);
          clearInterval(timerInterval);
          onFailed();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(timerInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.type]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  async function handleConfirmPix() {
    setError(null);
    setPixCpfError(null);

    if (gatewaySlug === "asaas") {
      if (pixCpf.replace(/\D/g, "").length !== 11) {
        setPixCpfError("CPF inválido");
        return;
      }
    }

    setPhase({ type: "pix-loading" });
    const result = await onCreateOrder({
      method: "pix",
      customerCpf: gatewaySlug === "asaas" ? pixCpf.replace(/\D/g, "") : undefined,
    });
    if (!result.success || !result.pixQrCode || !result.paymentId) {
      setError(result.error ?? "Erro ao gerar PIX");
      setPhase({ type: "method-select" });
      return;
    }
    setTimeLeft(30 * 60);
    setPhase({
      type: "pix-ready",
      paymentId: result.paymentId,
      qrCode: result.pixQrCode,
      qrCodeUrl: result.pixQrCodeUrl,
      orderId: result.orderId,
    });
  }

  async function handleCopyPix() {
    if (phase.type !== "pix-ready") return;
    try {
      await navigator.clipboard.writeText(phase.qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  function validateAsaasCard(): boolean {
    const errs: Record<string, string> = {};
    const digits = cardNumber.replace(/\s/g, "");
    if (digits.length < 13) errs.cardNumber = "Número inválido";
    if (!cardName.trim()) errs.cardName = "Obrigatório";
    const expiryClean = expiry.replace("/", "");
    if (expiryClean.length !== 4) errs.expiry = "Formato inválido (MM/AA)";
    if (cvv.length < 3) errs.cvv = "CVV inválido";
    if (cpf.replace(/\D/g, "").length !== 11) errs.cpf = "CPF inválido";
    if (cep.replace(/\D/g, "").length !== 8) errs.cep = "CEP inválido";
    if (!addressNumber.trim()) errs.addressNumber = "Obrigatório";
    setCardErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateMPCard(): boolean {
    const errs: Record<string, string> = {};
    const digits = cardNumber.replace(/\s/g, "");
    if (digits.length < 13) errs.cardNumber = "Número inválido";
    if (!cardName.trim()) errs.cardName = "Obrigatório";
    const expiryClean = expiry.replace("/", "");
    if (expiryClean.length !== 4) errs.expiry = "Formato inválido (MM/AA)";
    if (cvv.length < 3) errs.cvv = "CVV inválido";
    if (cpf.replace(/\D/g, "").length !== 11) errs.cpf = "CPF inválido";
    if (mpReady && !detectedBrand) errs.cardNumber = "Bandeira não identificada";
    setCardErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handlePayCard() {
    setError(null);

    // ── Asaas: server-side tokenization, no browser SDK ─────────────────────
    if (gatewaySlug === "asaas") {
      if (!validateAsaasCard()) return;
      setPhase({ type: "cc-processing" });
      try {
        const expiryClean = expiry.replace("/", "");
        const result = await onCreateOrder({
          method: "credit_card",
          asaasCardData: {
            holderName: cardName.trim(),
            number: cardNumber.replace(/\s/g, ""),
            expiryMonth: expiryClean.slice(0, 2),
            expiryYear: `20${expiryClean.slice(2)}`,
            ccv: cvv,
            cpfCnpj: cpf.replace(/\D/g, ""),
            postalCode: cep.replace(/\D/g, ""),
            addressNumber: addressNumber.trim(),
          },
        });
        if (!result.success) {
          setError(result.error ?? "Erro ao processar pagamento");
          setPhase({ type: "cc-form" });
          return;
        }
        const status = result.cardStatus ?? "rejected";
        setPhase({ type: "cc-result", status, detail: result.cardStatusDetail, orderId: result.orderId });
        if (status === "approved") onPaid(result.orderId ?? "");
      } catch (err) {
        console.error("[CC Asaas]", err);
        setError("Erro ao processar cartão. Verifique os dados e tente novamente.");
        setPhase({ type: "cc-form" });
      }
      return;
    }

    // ── MercadoPago: browser-side tokenization ───────────────────────────────
    if (!validateMPCard()) return;
    if (!mpRef.current) {
      setError("SDK de pagamento não carregado. Verifique sua conexão, recarregue a página ou pague via PIX.");
      return;
    }

    setPhase({ type: "cc-processing" });

    try {
      const expiryClean = expiry.replace("/", "");
      const tokenResult = await mpRef.current.createCardToken({
        cardNumber: cardNumber.replace(/\s/g, ""),
        cardholderName: cardName.trim().toUpperCase(),
        cardExpirationMonth: expiryClean.slice(0, 2),
        cardExpirationYear: `20${expiryClean.slice(2)}`,
        securityCode: cvv,
        identificationType: "CPF",
        identificationNumber: cpf.replace(/\D/g, ""),
      });

      if (!tokenResult.id) throw new Error("Falha ao tokenizar cartão");

      const result = await onCreateOrder({
        method: "credit_card",
        cardToken: tokenResult.id,
        installments,
        paymentMethodId: detectedBrand ?? undefined,
        identificationNumber: cpf.replace(/\D/g, ""),
      });

      if (!result.success) {
        setError(result.error ?? "Erro ao processar pagamento");
        setPhase({ type: "cc-form" });
        return;
      }

      const status = result.cardStatus ?? "rejected";
      setPhase({ type: "cc-result", status, detail: result.cardStatusDetail, orderId: result.orderId });

      if (status === "approved") onPaid(result.orderId ?? "");
    } catch (err) {
      console.error("[CC payment]", err);
      setError("Erro ao processar cartão. Verifique os dados e tente novamente.");
      setPhase({ type: "cc-form" });
    }
  }

  // ─── Renders ─────────────────────────────────────────────────────────────

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  const methodTabs = (
    <div className="flex gap-2 mb-6">
      <button
        onClick={() => { setMethod("pix"); setError(null); }}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
          method === "pix"
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
        }`}
      >
        <QrCode size={16} />
        PIX
      </button>
      {supportsCard && (
        <button
          onClick={() => { setMethod("credit_card"); setError(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
            method === "credit_card"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
          }`}
        >
          <CreditCard size={16} />
          Cartão
        </button>
      )}
    </div>
  );

  // Seleção de método + confirmar PIX
  if (phase.type === "method-select") {
    return (
      <div>
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-6">
          Pagamento
        </h2>

        {upsellOffer && (
          <UpsellCard
            offer={upsellOffer}
            games={games ?? []}
            accepted={upsellAccepted ?? false}
            selectedGameId={upsellGameId ?? ""}
            onAccept={onUpsellAccept ?? (() => {})}
            onDecline={onUpsellDecline ?? (() => {})}
            onGameChange={onUpsellGameChange ?? (() => {})}
          />
        )}

        <div className="mb-4">
          <CouponInput
            totalCents={totalCents + (coupon ? coupon.discountCents : 0)}
            customerWhatsapp={customerWhatsapp}
            applied={coupon ?? null}
            onApply={onCouponApply ?? (() => {})}
            onRemove={onCouponRemove ?? (() => {})}
            initialCode={initialCouponCode}
          />
        </div>

        {methodTabs}

        {method === "pix" && (
          <div className="space-y-4">
            <div className="p-4 bg-card border border-border rounded-xl">
              <p className="text-sm text-muted-foreground mb-1">Total a pagar</p>
              <p className="text-3xl font-bold text-primary">{formatPrice(totalCents)}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Você receberá um QR Code para pagar via PIX. A confirmação é imediata.
            </p>
            {gatewaySlug === "asaas" && (
              <div>
                <label className="block text-sm text-muted-foreground mb-1">CPF do pagador *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={pixCpf}
                  onChange={(e) => { setPixCpf(formatCPF(e.target.value)); setPixCpfError(null); }}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {pixCpfError && (
                  <p className="text-destructive text-xs mt-1">{pixCpfError}</p>
                )}
              </div>
            )}
            {error && (
              <p className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={onBack}
                className="flex-1 py-3 bg-secondary text-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-secondary/80 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmPix}
                className="flex-1 py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors"
              >
                Gerar PIX
              </button>
            </div>
          </div>
        )}

        {method === "credit_card" && (
          <div className="space-y-2">
            <div className="p-4 bg-card border border-border rounded-xl mb-4">
              <p className="text-sm text-muted-foreground mb-1">Total a pagar</p>
              <p className="text-3xl font-bold text-primary">{formatPrice(totalCents)}</p>
            </div>
            <button
              onClick={() => {
                setPhase({ type: "cc-form" });
                setError(null);
              }}
              className="w-full py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors"
            >
              Preencher Dados do Cartão
            </button>
            <button
              onClick={onBack}
              className="w-full py-2.5 bg-secondary text-foreground text-sm font-semibold rounded-md hover:bg-secondary/80 transition-colors"
            >
              Voltar
            </button>
          </div>
        )}
      </div>
    );
  }

  // PIX carregando
  if (phase.type === "pix-loading") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 size={40} className="text-primary animate-spin" />
        <p className="text-muted-foreground text-sm">Gerando QR Code PIX...</p>
      </div>
    );
  }

  // PIX pronto — QR + polling
  if (phase.type === "pix-ready") {
    return (
      <div>
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">
          Pagamento via PIX
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          Escaneie o QR Code ou copie o código para pagar.
        </p>

        <div className="text-center mb-6">
          <p className="text-3xl font-bold text-primary mb-4">{formatPrice(totalCents)}</p>

          <div className="flex justify-center mb-4">
            <div className="bg-white rounded-xl p-3 inline-block">
              {phase.qrCodeUrl ? (
                <div className="relative w-44 h-44">
                  <Image src={phase.qrCodeUrl} alt="QR Code PIX" fill sizes="176px" className="object-contain" />
                </div>
              ) : (
                <QRCodeSVG value={phase.qrCode} size={176} />
              )}
            </div>
          </div>

          <button
            onClick={handleCopyPix}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-secondary text-foreground text-sm rounded-md hover:bg-secondary/80 transition-colors"
          >
            {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} />}
            {copied ? "Copiado!" : "Copiar código PIX"}
          </button>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl text-center mb-6">
          <p className="text-xs text-muted-foreground mb-1">Tempo restante</p>
          <p className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary">
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Aguardando confirmação...</p>
        </div>

        <div className="flex justify-center">
          <div className="flex gap-1.5 items-center text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Verificando pagamento automaticamente
          </div>
        </div>
      </div>
    );
  }

  // Formulário de cartão
  if (phase.type === "cc-form") {
    const hasInstallments = installmentOptions.length > 1;
    const isAsaas = gatewaySlug === "asaas";
    const inputCls = "w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring";

    return (
      <div>
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">
          Dados do Cartão
        </h2>
        <p className="text-3xl font-bold text-primary mb-6">{formatPrice(totalCents)}</p>

        <div className="space-y-4">
          {/* Número do cartão */}
          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Número do cartão *
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                placeholder="0000 0000 0000 0000"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                className={`${inputCls} pr-20`}
              />
              {!isAsaas && brandThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brandThumb}
                  alt={detectedBrand ?? "bandeira"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-auto object-contain"
                />
              ) : !isAsaas && detectedBrand ? (
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground uppercase font-semibold">
                  {detectedBrand}
                </span>
              ) : null}
            </div>
            {cardErrors.cardNumber && (
              <p className="text-destructive text-xs mt-1">{cardErrors.cardNumber}</p>
            )}
          </div>

          {/* Nome */}
          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Nome no cartão *
            </label>
            <input
              type="text"
              placeholder="Como aparece no cartão"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              className={inputCls}
            />
            {cardErrors.cardName && (
              <p className="text-destructive text-xs mt-1">{cardErrors.cardName}</p>
            )}
          </div>

          {/* Validade + CVV */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                Validade *
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="MM/AA"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                className={inputCls}
              />
              {cardErrors.expiry && (
                <p className="text-destructive text-xs mt-1">{cardErrors.expiry}</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">CVV *</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="123"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className={inputCls}
              />
              {cardErrors.cvv && (
                <p className="text-destructive text-xs mt-1">{cardErrors.cvv}</p>
              )}
            </div>
          </div>

          {/* CPF */}
          <div>
            <label className="block text-sm text-muted-foreground mb-1">CPF do titular *</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(formatCPF(e.target.value))}
              className={inputCls}
            />
            {cardErrors.cpf && (
              <p className="text-destructive text-xs mt-1">{cardErrors.cpf}</p>
            )}
          </div>

          {/* Asaas-specific: CEP + Número */}
          {isAsaas && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">CEP *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => setCep(formatCEP(e.target.value))}
                  className={inputCls}
                />
                {cardErrors.cep && (
                  <p className="text-destructive text-xs mt-1">{cardErrors.cep}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Número *</label>
                <input
                  type="text"
                  placeholder="Ex: 123"
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value)}
                  className={inputCls}
                />
                {cardErrors.addressNumber && (
                  <p className="text-destructive text-xs mt-1">{cardErrors.addressNumber}</p>
                )}
              </div>
            </div>
          )}

          {/* Parcelas (apenas MercadoPago) */}
          {!isAsaas && hasInstallments && (
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Parcelas</label>
              <select
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
                className={inputCls}
              >
                {installmentOptions.map((opt) => (
                  <option key={opt.installments} value={opt.installments}>
                    {opt.installments}x de {formatPrice(opt.installment_amount * 100)}
                    {opt.installments === 1 ? " (sem juros)" : ` — Total ${formatPrice(opt.total_amount * 100)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isAsaas && mpScriptError && (
            <p className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md text-sm text-yellow-600">
              Não foi possível carregar o SDK de pagamento. Verifique sua conexão e tente novamente, ou pague via PIX.
            </p>
          )}

          {error && (
            <p className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => { setPhase({ type: "method-select" }); setError(null); }}
            className="flex-1 py-3 bg-secondary text-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-secondary/80 transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={handlePayCard}
            disabled={!isAsaas && !mpReady && !!mpPublicKey && !mpScriptError}
            className="flex-1 py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {!isAsaas && !mpReady && !!mpPublicKey && !mpScriptError ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Carregando...
              </span>
            ) : (
              "Pagar"
            )}
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Dados criptografados - não armazenamos dados do cartão
        </p>
      </div>
    );
  }

  // CC processando
  if (phase.type === "cc-processing") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 size={40} className="text-primary animate-spin" />
        <p className="text-muted-foreground text-sm">Processando pagamento...</p>
      </div>
    );
  }

  // CC resultado
  if (phase.type === "cc-result") {
    const { status } = phase;

    if (status === "approved") {
      return (
        <div className="text-center py-8">
          <CheckCircle2 size={56} className="mx-auto text-green-500 mb-4" />
          <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">
            Pagamento Aprovado!
          </h2>
          <p className="text-muted-foreground text-sm">
            Seu pagamento foi processado com sucesso.
          </p>
        </div>
      );
    }

    if (status === "in_process") {
      return (
        <div className="text-center py-8">
          <Clock size={56} className="mx-auto text-yellow-500 mb-4" />
          <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">
            Pagamento em Análise
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Seu pagamento está em análise. Você receberá uma confirmação por e-mail em até 2 dias úteis.
          </p>
          <button
            onClick={() => onPaid(phase.orderId ?? "")}
            className="px-6 py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors"
          >
            Concluir
          </button>
        </div>
      );
    }

    // rejected
    return (
      <div className="text-center py-8">
        <XCircle size={56} className="mx-auto text-destructive mb-4" />
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">
          Pagamento Recusado
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          {phase.detail === "insufficient_amount"
            ? "Saldo insuficiente."
            : phase.detail === "cc_rejected_bad_filled_security_code"
            ? "CVV incorreto."
            : phase.detail === "cc_rejected_bad_filled_date"
            ? "Data de validade incorreta."
            : "O pagamento foi recusado pela operadora. Verifique os dados ou tente outro cartão."}
        </p>
        <button
          onClick={() => { setPhase({ type: "cc-form" }); setError(null); }}
          className="w-full py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors"
        >
          Tentar Novamente
        </button>
        <button
          onClick={() => { setPhase({ type: "method-select" }); setMethod("pix"); }}
          className="mt-2 w-full py-2.5 bg-secondary text-foreground text-sm font-semibold rounded-md hover:bg-secondary/80 transition-colors"
        >
          Pagar via PIX
        </button>
      </div>
    );
  }

  return null;
}
