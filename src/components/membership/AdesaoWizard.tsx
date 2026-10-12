"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import {
  Check,
  ChevronRight,
  Loader2,
  Copy,
  CheckCircle2,
  UserPlus,
  CreditCard,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import type { PublicPlan } from "@/app/actions/membership";
import { useScrollToTopOnChange } from "@/hooks/useScrollToTopOnChange";
import { signupMember } from "@/app/actions/membership";
import { lookupCustomer } from "@/app/actions/checkout";
import { validateCPF } from "@/lib/membership/utils";
import { usePhoneSession } from "@/hooks/usePhoneSession";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";

// Lazy-load MP SDK only when needed (avoids loading on every page)
let mpInitialized = false;
async function ensureMpInitialized(publicKey: string) {
  if (mpInitialized) return;
  const { initMercadoPago } = await import("@mercadopago/sdk-react");
  initMercadoPago(publicKey, { locale: "pt-BR" });
  mpInitialized = true;
}

type Step = "plan" | "data" | "payment" | "pix_pending" | "done";
type LookupState = "idle" | "loading" | "found" | "not-found";
type PaymentTab = "card" | "pix";
type CardPhase = "method-select" | "cc-form";

interface AdesaoWizardProps {
  plans: PublicPlan[];
  initialPlanSlug?: string;
  gatewaySlug: string | null;
  mpPublicKey: string | null;
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCPFInput(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatWhatsApp(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function AdesaoWizard({ plans, initialPlanSlug, gatewaySlug, mpPublicKey }: AdesaoWizardProps) {
  const defaultPlan = plans.find((p) => p.slug === initialPlanSlug) ?? plans[0] ?? null;
  const isMercadoPago = gatewaySlug === "mercadopago";

  const [step, setStep] = useState<Step>(defaultPlan ? "data" : "plan");
  useScrollToTopOnChange(step); // trocar de passo começa no topo
  const [selectedPlan, setSelectedPlan] = useState<PublicPlan | null>(defaultPlan);

  // Member data
  const [whatsapp, setWhatsapp] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");

  // Lookup
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [maskedName, setMaskedName] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const lastLookedUp = useRef("");

  const { phone: savedPhone, setPhone: savePhone } = usePhoneSession();

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  // Payment
  const [paymentTab, setPaymentTab] = useState<PaymentTab>("card");
  const [cardPhase, setCardPhase] = useState<CardPhase>("method-select");
  const [cardBrickReady, setCardBrickReady] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // PIX result
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inputClass =
    "w-full bg-input border border-border rounded-md px-3 py-2.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground";

  // Pre-fill WhatsApp from session
  useEffect(() => {
    if (savedPhone && !whatsapp) setWhatsapp(savedPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPhone]);

  // Lookup on WhatsApp complete
  useEffect(() => {
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length !== 11) return;
    if (lastLookedUp.current === digits) return;
    lastLookedUp.current = digits;

    setLookupState("loading");
    lookupCustomer(digits).then((result) => {
      if (result.found && result.name && result.email) {
        setMaskedName(result.maskedName ?? result.name);
        setMaskedEmail(result.maskedEmail ?? result.email);
        setName(result.name);
        setEmail(result.email);
        setLookupState("found");
      } else {
        setLookupState("not-found");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatsapp]);

  function handleWhatsAppChange(raw: string) {
    const formatted = formatWhatsApp(raw);
    savePhone(formatted);
    setWhatsapp(formatted);
    setName("");
    setEmail("");
    setCpf("");
    setLookupState("idle");
    setMaskedName("");
    setMaskedEmail("");
    setErrors({});
    lastLookedUp.current = "";
  }

  function validateData() {
    const e: Record<string, string> = {};
    if (whatsapp.replace(/\D/g, "").length < 11) e.whatsapp = "WhatsApp inválido";
    if (lookupState !== "found") {
      if (!name.trim() || name.trim().length < 3) e.name = "Nome muito curto";
      if (!email.includes("@")) e.email = "E-mail inválido";
    }
    if (!validateCPF(cpf)) e.cpf = "CPF inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleDataNext() {
    if (!validateData()) return;
    setSubmitError(null);
    setCardPhase("method-select");
    setStep("payment");
    // Pre-init MP SDK when entering payment step
    if (isMercadoPago && mpPublicKey) {
      ensureMpInitialized(mpPublicKey).then(() => setCardBrickReady(true));
    }
  }

  // Called by MP CardPayment Brick on submit
  const handleCardSubmit = useCallback(async (formData: { token: string }) => {
    if (!selectedPlan) return;
    setSubmitError(null);

    startTransition(async () => {
      const result = await signupMember({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        whatsapp: whatsapp.replace(/\D/g, ""),
        cpf: cpf.replace(/\D/g, ""),
        planId: selectedPlan.id,
        cardTokenId: formData.token,
      });

      if (!result.success) {
        setSubmitError(result.error ?? "Erro ao processar assinatura.");
        return;
      }

      setMemberId(result.memberId ?? null);
      setStep("done");
    });
  }, [selectedPlan, name, email, whatsapp, cpf, startTransition]);

  // Called by AsaasCardForm on submit
  const handleAsaasCardSubmit = useCallback(async (cardData: {
    holderName: string; number: string; expiryMonth: string;
    expiryYear: string; ccv: string; postalCode: string; addressNumber: string;
  }) => {
    if (!selectedPlan) return;
    setSubmitError(null);

    startTransition(async () => {
      const result = await signupMember({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        whatsapp: whatsapp.replace(/\D/g, ""),
        cpf: cpf.replace(/\D/g, ""),
        planId: selectedPlan.id,
        asaasCardData: cardData,
      });

      if (!result.success) {
        setSubmitError(result.error ?? "Erro ao processar assinatura.");
        return;
      }

      setMemberId(result.memberId ?? null);
      setStep("done");
    });
  }, [selectedPlan, name, email, whatsapp, cpf, startTransition]);

  async function handlePixSubmit() {
    if (!selectedPlan) return;
    setSubmitError(null);

    startTransition(async () => {
      const result = await signupMember({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        whatsapp: whatsapp.replace(/\D/g, ""),
        cpf: cpf.replace(/\D/g, ""),
        planId: selectedPlan.id,
      });

      if (!result.success) {
        setSubmitError(result.error ?? "Erro ao processar cadastro.");
        return;
      }

      setMemberId(result.memberId ?? null);

      if (result.paymentMethod === "pix" && result.pixQrCode) {
        setPixQrCode(result.pixQrCode);
        setPixQrCodeUrl(result.pixQrCodeUrl ?? null);
        setStep("pix_pending");
      } else {
        setStep("done");
      }
    });
  }

  function copyPix() {
    if (!pixQrCode) return;
    navigator.clipboard.writeText(pixQrCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  const whatsappComplete = whatsapp.replace(/\D/g, "").length === 11;

  // ── STEP: PLAN SELECTION ──────────────────────────────────────────────────
  if (step === "plan") {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => { setSelectedPlan(plan); setStep("data"); }}
              className={`relative text-left bg-card border rounded-xl p-5 flex flex-col transition-all hover:border-primary/60 ${
                plan.highlight ? "border-primary shadow-[0_0_15px_rgba(193,154,90,0.2)]" : "border-border"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-2.5 left-4 bg-primary text-primary-foreground text-xs font-bold px-3 py-0.5 rounded-full">
                  MAIS POPULAR
                </span>
              )}
              <div className="mb-3">
                <p className="font-[family-name:var(--font-bebas-neue)] text-xl text-foreground">
                  {plan.name}
                </p>
                {plan.description && (
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                )}
                <p className="text-primary font-bold text-lg mt-1">
                  {formatBRL(plan.priceCents)}
                  <span className="text-muted-foreground font-normal text-xs">/mês</span>
                </p>
              </div>
              <ul className="flex flex-col gap-1.5 flex-1">
                {plan.benefits.slice(0, 4).map((b) => (
                  <li key={b.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check size={12} className="text-primary shrink-0" />{b.label}
                  </li>
                ))}
                {plan.benefits.length > 4 && (
                  <li className="text-xs text-muted-foreground pl-4">
                    + {plan.benefits.length - 4} benefícios
                  </li>
                )}
              </ul>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-primary text-sm font-semibold">Selecionar</span>
                <ChevronRight size={16} className="text-primary" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── STEP: PERSONAL DATA ───────────────────────────────────────────────────
  if (step === "data") {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-5">
        {selectedPlan && (
          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
            <div>
              <p className="text-foreground font-semibold text-sm">Plano {selectedPlan.name}</p>
              <p className="text-primary font-bold">
                {formatBRL(selectedPlan.priceCents)}
                <span className="text-muted-foreground font-normal text-xs">/mês</span>
              </p>
            </div>
            <button
              onClick={() => { setSelectedPlan(null); setStep("plan"); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
            >
              Trocar
            </button>
          </div>
        )}

        <h2 className="text-foreground font-semibold">Seus dados</h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">WhatsApp *</label>
            <div className="relative">
              <input
                type="tel"
                className={inputClass}
                placeholder="(67) 99999-0000"
                value={whatsapp}
                onChange={(e) => handleWhatsAppChange(e.target.value)}
              />
              {lookupState === "loading" && (
                <Loader2 size={16} className="absolute right-3 top-3 text-muted-foreground animate-spin" />
              )}
              {lookupState === "found" && (
                <CheckCircle2 size={16} className="absolute right-3 top-3 text-green-500" />
              )}
              {lookupState === "not-found" && whatsappComplete && (
                <UserPlus size={16} className="absolute right-3 top-3 text-muted-foreground" />
              )}
            </div>
            {errors.whatsapp && <p className="text-destructive text-xs mt-1">{errors.whatsapp}</p>}
          </div>

          {lookupState === "found" && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <p className="text-xs text-green-400 font-semibold mb-2 uppercase tracking-wide">
                Cadastro encontrado
              </p>
              <p className="text-sm text-foreground">{maskedName}</p>
              <p className="text-sm text-muted-foreground">{maskedEmail}</p>
              <button
                onClick={() => { setLookupState("not-found"); setName(""); setEmail(""); }}
                className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
              >
                Usar outros dados
              </button>
            </div>
          )}

          {lookupState === "not-found" && whatsappComplete && (
            <>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Nome completo *</label>
                <input
                  className={inputClass}
                  placeholder="João da Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {errors.name && <p className="text-destructive text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">E-mail *</label>
                <input
                  type="email"
                  className={inputClass}
                  placeholder="joao@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {errors.email && <p className="text-destructive text-xs mt-1">{errors.email}</p>}
              </div>
            </>
          )}

          {whatsappComplete && lookupState !== "loading" && lookupState !== "idle" && (
            <div>
              <label className="block text-sm text-muted-foreground mb-1">CPF *</label>
              <input
                className={inputClass}
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(formatCPFInput(e.target.value))}
                maxLength={14}
              />
              {errors.cpf && <p className="text-destructive text-xs mt-1">{errors.cpf}</p>}
            </div>
          )}
        </div>

        <button
          onClick={handleDataNext}
          disabled={!whatsappComplete || lookupState === "loading" || lookupState === "idle"}
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg px-6 py-3 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          Continuar para pagamento <ChevronRight size={16} />
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Ao continuar, você aceita os termos de adesão ao programa Sócio-Torcedor.
        </p>
      </div>
    );
  }

  // ── STEP: PAYMENT ─────────────────────────────────────────────────────────
  // Mesmo fluxo/visual do checkout da loja (PaymentMethodStep): pílulas de
  // método → resumo + CTA → formulário do cartão em tela própria.
  if (step === "payment") {
    const amountCents = selectedPlan?.priceCents ?? 0;
    const isAsaas = gatewaySlug === "asaas";
    const cardAvailable = isAsaas || (isMercadoPago && !!mpPublicKey);

    // Formulário do cartão
    if (paymentTab === "card" && cardPhase === "cc-form") {
      if (isMercadoPago && mpPublicKey) {
        return (
          <div>
            <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">
              Dados do Cartão
            </h2>
            <p className="text-3xl font-bold text-primary mb-6">
              {formatBRL(amountCents)}
              <span className="text-muted-foreground font-normal text-base">/mês</span>
            </p>
            {submitError && (
              <p className="p-3 mb-4 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
                {submitError}
              </p>
            )}
            <CardBrick
              publicKey={mpPublicKey}
              amountCents={amountCents}
              onSubmit={handleCardSubmit}
              isPending={isPending}
              onReady={() => setCardBrickReady(true)}
            />
            <button
              onClick={() => { setCardPhase("method-select"); setSubmitError(null); }}
              disabled={isPending}
              className="mt-4 w-full py-3 bg-secondary text-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-secondary/80 transition-colors disabled:opacity-40"
            >
              Voltar
            </button>
          </div>
        );
      }
      return (
        <AsaasCardForm
          amountCents={amountCents}
          onSubmit={handleAsaasCardSubmit}
          onBack={() => { setCardPhase("method-select"); setSubmitError(null); }}
          isPending={isPending}
          error={submitError}
        />
      );
    }

    // Seleção de método
    return (
      <div>
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-6">
          Pagamento
        </h2>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setPaymentTab("pix"); setSubmitError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
              paymentTab === "pix"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            <QrCode size={16} />
            PIX
          </button>
          {cardAvailable && (
            <button
              onClick={() => { setPaymentTab("card"); setSubmitError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                paymentTab === "card"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              <CreditCard size={16} />
              Cartão
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 mb-5 text-xs text-muted-foreground">
          <ShieldCheck size={14} className="text-primary shrink-0" />
          <span>Pagamento processado com segurança. Seus dados são criptografados e não ficam salvos no site.</span>
        </div>

        {/* Resumo do plano */}
        {selectedPlan && (
          <div className="p-4 bg-card border border-border rounded-xl mb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Plano {selectedPlan.name}</p>
                <p className="text-3xl font-bold text-primary">
                  {formatBRL(amountCents)}
                  <span className="text-muted-foreground font-normal text-base">/mês</span>
                </p>
              </div>
              <button
                onClick={() => setStep("data")}
                className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
              >
                Editar dados
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {paymentTab === "card" && cardAvailable
                ? "Renovação automática todo mês no cartão. Cancele quando quiser."
                : "Após o pagamento, sua assinatura é ativada. A renovação pelo PIX é manual, todo mês."}
            </p>
          </div>
        )}

        {submitError && (
          <p className="p-3 mb-4 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
            {submitError}
          </p>
        )}

        <div className="space-y-2">
          {paymentTab === "card" && cardAvailable ? (
            <button
              onClick={() => { setCardPhase("cc-form"); setSubmitError(null); }}
              className="w-full py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors"
            >
              Preencher Dados do Cartão
            </button>
          ) : (
            <button
              onClick={handlePixSubmit}
              disabled={isPending}
              className="w-full py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Gerando PIX...
                </span>
              ) : (
                "Gerar QR Code PIX"
              )}
            </button>
          )}
          <button
            onClick={() => setStep("data")}
            disabled={isPending}
            className="w-full py-2.5 bg-secondary text-foreground text-sm font-semibold rounded-md hover:bg-secondary/80 transition-colors disabled:opacity-40"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // ── STEP: PIX PENDING ─────────────────────────────────────────────────────
  if (step === "pix_pending") {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-6 text-center">
        <div>
          <p className="text-foreground font-semibold mb-1">Pague com PIX</p>
          <p className="text-muted-foreground text-sm">
            Escaneie o QR Code ou copie o código PIX para ativar sua assinatura.
          </p>
        </div>
        {pixQrCodeUrl ? (
          <img src={pixQrCodeUrl} alt="QR Code PIX" className="w-48 h-48 rounded-lg" />
        ) : pixQrCode ? (
          <QRCodeSVG value={pixQrCode} size={192} className="rounded-lg" />
        ) : null}
        {pixQrCode && (
          <button
            onClick={copyPix}
            className="flex items-center gap-2 px-6 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-secondary transition-colors"
          >
            {copied ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
            {copied ? "Copiado!" : "Copiar código PIX"}
          </button>
        )}
        <p className="text-sm text-muted-foreground max-w-xs">
          Após o pagamento, sua assinatura será ativada automaticamente em alguns minutos.
        </p>
        <button
          onClick={() => setStep("done")}
          className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
        >
          Já paguei, ver minha carteirinha
        </button>
      </div>
    );
  }

  // ── STEP: DONE ────────────────────────────────────────────────────────────
  return (
    <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center gap-6 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
        <CheckCircle2 size={32} className="text-primary" />
      </div>
      <div>
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">
          Assinatura confirmada!
        </h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Sua assinatura está ativa. Aproveite todos os benefícios do programa Sócio-Torcedor.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Link
          href="/"
          className="flex-1 text-center px-4 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-secondary transition-colors"
        >
          Voltar ao site
        </Link>
        {memberId && (
          <Link
            href={`/socios/carteirinha?id=${memberId}`}
            className="flex-1 text-center px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Ver carteirinha
          </Link>
        )}
      </div>
    </div>
  );
}

// ── ASAAS CARD FORM ───────────────────────────────────────────────────────────
// Asaas não tem SDK no browser: os campos ficam no nosso formulário e o cartão
// vai direto na criação da assinatura (servidor). Visual igual ao da loja.

interface AsaasCardFormProps {
  amountCents: number;
  onSubmit: (data: {
    holderName: string; number: string; expiryMonth: string;
    expiryYear: string; ccv: string; postalCode: string; addressNumber: string;
  }) => void;
  onBack: () => void;
  isPending: boolean;
  error: string | null;
}

function formatCardNumber(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

function formatCEP(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function AsaasCardForm({ amountCents, onSubmit, onBack, isPending, error }: AsaasCardFormProps) {
  const [number, setNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [ccv, setCcv] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const inputCls =
    "w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60";

  function validate() {
    const e: Record<string, string> = {};
    if (number.replace(/\D/g, "").length < 13) e.number = "Número inválido";
    if (holderName.trim().length < 3) e.holderName = "Obrigatório";
    const mm = Number(expiry.slice(0, 2));
    if (expiry.replace(/\D/g, "").length !== 4 || mm < 1 || mm > 12) e.expiry = "Formato inválido (MM/AA)";
    if (ccv.length < 3) e.ccv = "CVV inválido";
    if (postalCode.replace(/\D/g, "").length !== 8) e.postalCode = "CEP inválido";
    if (!addressNumber.trim()) e.addressNumber = "Obrigatório";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending || !validate()) return;
    const digits = expiry.replace(/\D/g, "");
    onSubmit({
      holderName: holderName.trim(),
      number: number.replace(/\D/g, ""),
      expiryMonth: digits.slice(0, 2),
      expiryYear: `20${digits.slice(2)}`,
      ccv,
      postalCode: postalCode.replace(/\D/g, ""),
      addressNumber: addressNumber.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">
        Dados do Cartão
      </h2>
      <p className="text-3xl font-bold text-primary mb-6">
        {formatBRL(amountCents)}
        <span className="text-muted-foreground font-normal text-base">/mês</span>
      </p>

      {/* fieldset desabilitado durante o envio: mantém os dados se der erro */}
      <fieldset disabled={isPending} className="space-y-4">
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Número do cartão *</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0000 0000 0000 0000"
            value={number}
            onChange={(e) => setNumber(formatCardNumber(e.target.value))}
            autoComplete="cc-number"
            className={inputCls}
          />
          {errors.number && <p className="text-destructive text-xs mt-1">{errors.number}</p>}
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Nome no cartão *</label>
          <input
            type="text"
            placeholder="Como aparece no cartão"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            autoComplete="cc-name"
            className={inputCls}
          />
          {errors.holderName && <p className="text-destructive text-xs mt-1">{errors.holderName}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Validade *</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="MM/AA"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              autoComplete="cc-exp"
              className={inputCls}
            />
            {errors.expiry && <p className="text-destructive text-xs mt-1">{errors.expiry}</p>}
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">CVV *</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="123"
              value={ccv}
              onChange={(e) => setCcv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              autoComplete="cc-csc"
              className={inputCls}
            />
            {errors.ccv && <p className="text-destructive text-xs mt-1">{errors.ccv}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">CEP *</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="00000-000"
              value={postalCode}
              onChange={(e) => setPostalCode(formatCEP(e.target.value))}
              autoComplete="billing postal-code"
              className={inputCls}
            />
            {errors.postalCode && <p className="text-destructive text-xs mt-1">{errors.postalCode}</p>}
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
            {errors.addressNumber && <p className="text-destructive text-xs mt-1">{errors.addressNumber}</p>}
          </div>
        </div>

        {error && (
          <p className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
            {error}
          </p>
        )}
      </fieldset>

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onBack}
          disabled={isPending}
          className="flex-1 py-3 bg-secondary text-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-secondary/80 transition-colors disabled:opacity-40"
        >
          Voltar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Processando...
            </span>
          ) : (
            "Assinar"
          )}
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Dados criptografados - não armazenamos dados do cartão
      </p>
    </form>
  );
}

// ── MP CARD BRICK ─────────────────────────────────────────────────────────────
// Isolated component so the dynamic import only runs when this renders

interface CardBrickProps {
  publicKey: string;
  amountCents: number;
  onSubmit: (formData: { token: string }) => void;
  isPending: boolean;
  onReady: () => void;
}

function CardBrick({ publicKey, amountCents, onSubmit, isPending, onReady }: CardBrickProps) {
  const [loaded, setLoaded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [CardPayment, setCardPayment] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      await ensureMpInitialized(publicKey);
      const mod = await import("@mercadopago/sdk-react");
      if (!cancelled) {
        setCardPayment(mod.CardPayment);
        setLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [publicKey]);

  if (!loaded || !CardPayment) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
        <Loader2 size={16} className="animate-spin" />
        Carregando formulário...
      </div>
    );
  }

  return (
    <div className={isPending ? "opacity-50 pointer-events-none" : ""}>
      <CardPayment
        initialization={{ amount: amountCents / 100 }}
        onSubmit={async ({ formData }: { formData: { token: string } }) => {
          onSubmit({ token: formData.token });
        }}
        onReady={onReady}
        onError={(err: unknown) => console.error("[MP Brick]", err)}
        customization={{
          paymentMethods: { minInstallments: 1, maxInstallments: 1 },
          visual: { hideFormTitle: true },
        }}
      />
      {isPending && (
        <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          Processando assinatura...
        </div>
      )}
    </div>
  );
}
