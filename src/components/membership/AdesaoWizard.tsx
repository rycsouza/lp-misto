"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import {
  Check,
  ChevronRight,
  Loader2,
  CheckCircle2,
  UserPlus,
  ShieldCheck,
} from "lucide-react";
import type { PublicPlan } from "@/app/actions/membership";
import { useScrollToTopOnChange } from "@/hooks/useScrollToTopOnChange";
import { signupMember, getMembershipStatus } from "@/app/actions/membership";
import { lookupCustomer } from "@/app/actions/checkout";
import { validateCPF } from "@/lib/membership/utils";
import { usePhoneSession } from "@/hooks/usePhoneSession";
import { useAccountIdentity } from "@/hooks/useAccountIdentity";
import Link from "next/link";
import { AsaasCardForm } from "@/components/membership/AsaasCardForm";
import { publicPlanToCardData } from "@/components/membership/PlanCard";
import { highlightLabelOf, safeCardColor } from "@/lib/membership/plan-benefits";
import { addOneMonthBrasilia, promoAppliesToGateway } from "@/lib/membership/promo";
import { wallNameProblem } from "@/lib/membership/wall-name";
import { todayBrasilia } from "@/lib/date";

// Lazy-load MP SDK only when needed (avoids loading on every page)
let mpInitialized = false;
async function ensureMpInitialized(publicKey: string) {
  if (mpInitialized) return;
  const { initMercadoPago } = await import("@mercadopago/sdk-react");
  initMercadoPago(publicKey, { locale: "pt-BR" });
  mpInitialized = true;
}

type Step = "plan" | "data" | "payment" | "done";
type LookupState = "idle" | "loading" | "found" | "not-found";

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

/** "AAAA-MM-DD" → "dd/mm". */
function formatDayMonth(dateOnly: string): string {
  const [, m, d] = dateOnly.split("-");
  return `${d}/${m}`;
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
  // Cliente recorrente com CPF salvo: o campo some e o servidor reutiliza o CPF
  // do cadastro (o valor nunca vem para o client), salvo se ele informar outro.
  const [customerHasCpf, setCustomerHasCpf] = useState(false);
  const [overrideCpf, setOverrideCpf] = useState(false);
  // Mural dos sócios (opt-in): desmarcado por padrão. O nome que aparece é o do cadastro.
  const [wallOptIn, setWallOptIn] = useState(false);

  // Lookup
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [maskedName, setMaskedName] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const lastLookedUp = useRef("");

  const { phone: savedPhone, setPhone: savePhone } = usePhoneSession();

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  // Payment (só cartão)
  const [cardBrickReady, setCardBrickReady] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Token da carteirinha (segredo do sócio) + status real, consultado no servidor.
  const [cardToken, setCardToken] = useState<string | null>(null);
  const [memberStatus, setMemberStatus] = useState<"pending" | "active">("pending");
  const [pollExpired, setPollExpired] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);

  // 1º mês grátis (só cartão Asaas): aviso de "já usada" → cobrança cheia só com confirmação.
  const [promoUnavailable, setPromoUnavailable] = useState(false);
  const [fullPriceAfterUse, setFullPriceAfterUse] = useState(false);
  const [promoDone, setPromoDone] = useState<{ firstChargeDate: string; last4: string; amountCents: number } | null>(null);
  const promoHere = promoAppliesToGateway(gatewaySlug);

  const inputClass =
    "w-full bg-input border border-border rounded-md px-3 py-2.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground";

  // Logado: identifica pela conta (o sócio fica no e-mail da conta → carteirinha nela).
  const account = useAccountIdentity();
  const [useAccount, setUseAccount] = useState(true);
  const accountMode = !!account && useAccount;
  // Dados efetivos do assinante: os da conta, ou os digitados.
  const buyerName = accountMode ? account.name : name;
  const buyerEmail = accountMode ? account.email : email;
  const buyerWhatsapp = accountMode ? formatWhatsApp(account.whatsapp) : whatsapp;
  const hasStoredCpf = accountMode ? account.hasCpf : lookupState === "found" && customerHasCpf;

  // Pre-fill WhatsApp from session
  useEffect(() => {
    if (account) return;
    if (savedPhone && !whatsapp) setWhatsapp(savedPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPhone, account]);

  // Lookup on WhatsApp complete
  useEffect(() => {
    if (accountMode) return;
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length !== 11) return;
    if (lastLookedUp.current === digits) return;
    lastLookedUp.current = digits;

    setLookupState("loading");
    lookupCustomer(digits).then((result) => {
      if (result.found) {
        // Lookup só devolve dados mascarados (LGPD): o servidor completa nome/e-mail.
        setMaskedName(result.maskedName ?? "");
        setMaskedEmail(result.maskedEmail ?? "");
        setName("");
        setEmail("");
        setCustomerHasCpf(!!result.hasCpf);
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
    setCustomerHasCpf(false);
    setOverrideCpf(false);
    setWallOptIn(false);
    setLookupState("idle");
    setMaskedName("");
    setMaskedEmail("");
    setErrors({});
    lastLookedUp.current = "";
  }

  const usingStoredCpf = hasStoredCpf && !overrideCpf;

  function validateData() {
    const e: Record<string, string> = {};
    if (buyerWhatsapp.replace(/\D/g, "").length < 11) e.whatsapp = "WhatsApp inválido";
    if (lookupState !== "found" && !accountMode) {
      if (!name.trim() || name.trim().length < 3) e.name = "Nome muito curto";
      if (!email.includes("@")) e.email = "E-mail inválido";
    }
    if (!usingStoredCpf && !validateCPF(cpf)) e.cpf = "CPF inválido";
    // Nome que vai ao mural: o do cadastro. Quando já é conhecido aqui (conta logada
    // ou cadastro digitado), confere já; no cadastro reconhecido pelo WhatsApp o
    // servidor confere com o nome guardado.
    if (wallOptIn && buyerName.trim()) {
      const problem = wallNameProblem(buyerName);
      if (problem) e.wallName = `Seu nome não pode aparecer no mural. ${problem} Desmarque a opção para continuar.`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleDataNext() {
    if (!validateData()) return;
    setSubmitError(null);
    setStep("payment");
    // Pre-init MP SDK when entering payment step
    if (isMercadoPago && mpPublicKey) {
      ensureMpInitialized(mpPublicKey).then(() => setCardBrickReady(true));
    }
  }

  type SignupOutcome = Awaited<ReturnType<typeof signupMember>>;

  /** Trata o retorno do signup; devolve false se falhou (erro já exibido). */
  const applySignupResult = useCallback((result: SignupOutcome, fallbackError: string): boolean => {
    if (!result.success) {
      setAlreadyMember(result.code === "already_member");
      setSubmitError(result.error ?? fallbackError);
      return false;
    }
    setAlreadyMember(false);
    setCardToken(result.cardToken ?? null);
    // Mês grátis: ativo na hora (a 1ª cobrança é só daqui a um mês).
    setMemberStatus(result.paymentMethod === "immediate" || result.promo === "applied" ? "active" : "pending");
    setPollExpired(false);
    setFullPriceAfterUse(result.promo === "full_price_after_use");
    return true;
  }, []);

  // Enquanto pendente, acompanha a confirmação do pagamento (a cada 5s, até 3min).
  // Ao confirmar, a tela avança sozinha para o sucesso.
  useEffect(() => {
    if (!cardToken || memberStatus !== "pending") return;
    if (step !== "done") return;
    let attempts = 0;
    const id = setInterval(async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      attempts++;
      const r = await getMembershipStatus(cardToken).catch(() => null);
      if (r?.status === "active") {
        clearInterval(id);
        setMemberStatus("active");
        setStep("done");
      } else if (attempts >= 36) {
        clearInterval(id);
        setPollExpired(true);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [cardToken, memberStatus, step]);

  // Called by MP CardPayment Brick on submit
  const handleCardSubmit = useCallback(async (formData: { token: string }) => {
    if (!selectedPlan) return;
    setSubmitError(null);

    startTransition(async () => {
      const result = await signupMember({
        name: buyerName.trim(),
        email: buyerEmail.trim().toLowerCase(),
        whatsapp: buyerWhatsapp.replace(/\D/g, ""),
        cpf: usingStoredCpf ? undefined : cpf.replace(/\D/g, ""),
        planId: selectedPlan.id,
        cardTokenId: formData.token,
        wallOptIn,
      });

      if (!applySignupResult(result, "Erro ao processar assinatura.")) return;
      setStep("done");
    });
  }, [selectedPlan, buyerName, buyerEmail, buyerWhatsapp, cpf, usingStoredCpf, wallOptIn, startTransition, applySignupResult]);

  // Called by AsaasCardForm on submit
  const handleAsaasCardSubmit = useCallback(async (cardData: {
    holderName: string; number: string; expiryMonth: string;
    expiryYear: string; ccv: string; postalCode: string; addressNumber: string;
  }) => {
    if (!selectedPlan) return;
    setSubmitError(null);
    // Cobrança cheia (promoção já usada) só depois que o cliente viu o aviso e reenviou.
    const acceptFullPrice = promoUnavailable;

    startTransition(async () => {
      const result = await signupMember({
        name: buyerName.trim(),
        email: buyerEmail.trim().toLowerCase(),
        whatsapp: buyerWhatsapp.replace(/\D/g, ""),
        cpf: usingStoredCpf ? undefined : cpf.replace(/\D/g, ""),
        planId: selectedPlan.id,
        asaasCardData: cardData,
        acceptFullPriceIfPromoUnavailable: acceptFullPrice,
        wallOptIn,
      });

      if (!result.success && result.code === "promo_unavailable") setPromoUnavailable(true);
      if (!applySignupResult(result, "Erro ao processar assinatura.")) return;
      if (result.promo === "applied" && result.firstChargeDate) {
        setPromoDone({
          firstChargeDate: result.firstChargeDate,
          last4: cardData.number.slice(-4),
          amountCents: selectedPlan.priceCents,
        });
      }
      setPromoUnavailable(false);
      setStep("done");
    });
  }, [selectedPlan, buyerName, buyerEmail, buyerWhatsapp, cpf, usingStoredCpf, promoUnavailable, wallOptIn, startTransition, applySignupResult]);

  const whatsappComplete = whatsapp.replace(/\D/g, "").length === 11;
  // Pronto para seguir: logado, ou WhatsApp completo com o lookup resolvido.
  const identified = accountMode || (whatsappComplete && lookupState !== "loading" && lookupState !== "idle");

  // ── STEP: PLAN SELECTION ──────────────────────────────────────────────────
  if (step === "plan") {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const card = publicPlanToCardData(plan);
            const color = safeCardColor(plan.cardColor);
            return (
              <button
                key={plan.id}
                onClick={() => { setSelectedPlan(plan); setPromoUnavailable(false); setStep("data"); }}
                style={color ? { borderColor: color } : undefined}
                className={`relative text-left bg-card rounded-xl p-5 flex flex-col transition-all hover:border-primary/60 ${
                  plan.highlight
                    ? "border-2 border-primary shadow-[0_0_20px_rgba(193,154,90,0.3)] md:scale-[1.03] z-10"
                    : "border border-border"
                }`}
              >
                {plan.highlight && (
                  <span
                    className="absolute -top-3 left-4 bg-primary text-primary-foreground text-xs font-bold px-3 py-0.5 rounded-full"
                    style={color ? { backgroundColor: color } : undefined}
                  >
                    {highlightLabelOf(plan.highlightLabel)}
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
                  {card.promoFirstMonthFree && promoHere && (
                    <span className="inline-flex mt-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600">
                      1º mês grátis no cartão{card.promoUntil ? ` · ${card.promoUntil}` : ""}
                    </span>
                  )}
                </div>
                <ul className="flex flex-col gap-1.5 flex-1">
                  {card.benefitLines.slice(0, 5).map((line) => (
                    <li key={line.key} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check size={12} className="text-primary shrink-0" />{line.text}
                    </li>
                  ))}
                  {card.benefitLines.length > 5 && (
                    <li className="text-xs text-muted-foreground pl-4">
                      + {card.benefitLines.length - 5} benefícios
                    </li>
                  )}
                </ul>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-primary text-sm font-semibold">Selecionar</span>
                  <ChevronRight size={16} className="text-primary" />
                </div>
              </button>
            );
          })}
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
              onClick={() => { setSelectedPlan(null); setPromoUnavailable(false); setStep("plan"); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
            >
              Trocar
            </button>
          </div>
        )}

        <h2 className="text-foreground font-semibold">Seus dados</h2>

        <div className="flex flex-col gap-4">
          {accountMode && account && (
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl">
              <p className="text-xs text-primary font-semibold mb-2 uppercase tracking-wide">Assinando com a sua conta</p>
              <p className="text-sm text-foreground">{account.name}</p>
              <p className="text-sm text-muted-foreground">{account.email}</p>
              <p className="text-sm text-muted-foreground">{buyerWhatsapp}</p>
              <button
                type="button"
                onClick={() => { setUseAccount(false); handleWhatsAppChange(""); }}
                className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
              >
                Assinar para outra pessoa
              </button>
            </div>
          )}

          {!accountMode && (
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
          )}

          {!accountMode && lookupState === "found" && (
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

          {!accountMode && lookupState === "not-found" && whatsappComplete && (
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

          {identified && usingStoredCpf && (
            <div className="flex items-center justify-between gap-3 p-3 bg-card border border-border rounded-xl text-sm">
              <span className="text-muted-foreground">Usaremos o CPF do seu cadastro.</span>
              <button
                type="button"
                onClick={() => setOverrideCpf(true)}
                className="text-primary underline underline-offset-2 shrink-0"
              >
                Informar outro
              </button>
            </div>
          )}

          {identified && !usingStoredCpf && (
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

          {identified && (
            <div className="flex flex-col gap-3 p-4 bg-secondary/30 rounded-xl">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={wallOptIn}
                  onChange={(e) => setWallOptIn(e.target.checked)}
                />
                <span className="text-sm text-foreground">Quero meu nome no Mural dos Sócios</span>
              </label>
              <p className="text-xs text-muted-foreground">
                {accountMode && buyerName.trim() ? (
                  <>Seu nome será o da sua conta: <strong className="text-foreground">{buyerName.trim()}</strong>. </>
                ) : (
                  <>Seu nome será o do seu cadastro. </>
                )}
                Aparecem seu primeiro nome com a inicial do sobrenome (ex.: "Maria S.") e a data em que você se tornou sócio, junto do seu plano. Você pode sair do mural quando quiser, na sua conta.
              </p>
              {errors.wallName && <p className="text-destructive text-xs">{errors.wallName}</p>}
            </div>
          )}
        </div>

        <button
          onClick={handleDataNext}
          disabled={!identified}
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

  // ── STEP: PAYMENT (só cartão) ─────────────────────────────────────────────
  // Sem tela de escolha de método: a adesão vai direto para o formulário do cartão
  // do gateway ativo (Mercado Pago: Brick; Asaas: formulário próprio).
  if (step === "payment") {
    const amountCents = selectedPlan?.priceCents ?? 0;
    const mpCard = isMercadoPago && !!mpPublicKey;
    // "mock" = gateway de dev/teste: aceita o mesmo formulário do Asaas.
    const asaasCard = !!gatewaySlug && (gatewaySlug.startsWith("asaas") || gatewaySlug === "mock");
    // Mês grátis: o servidor decide (uma vez por pessoa); aqui só mostramos o que vale no cartão.
    const promoOnCard = promoHere && !!selectedPlan?.promoFirstMonthFree;
    const cardNote = promoUnavailable
      ? "A promoção de 1º mês grátis já foi usada. A cobrança é de hoje."
      : promoOnCard
      ? `1º mês grátis: a 1ª cobrança será em ${formatDayMonth(addOneMonthBrasilia(todayBrasilia()))}. Uma vez por pessoa.`
      : selectedPlan
      ? `Plano ${selectedPlan.name}. Renovação automática todo mês no cartão. Cancele quando quiser.`
      : undefined;

    if (mpCard) {
      return (
        <div>
          <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">
            Dados do Cartão
          </h2>
          <p className="text-3xl font-bold text-primary mb-2">
            {formatBRL(amountCents)}
            <span className="text-muted-foreground font-normal text-base">/mês</span>
          </p>
          {cardNote && <p className="text-xs text-muted-foreground mb-4">{cardNote}</p>}
          <div className="flex items-center gap-2 mb-5 text-xs text-muted-foreground">
            <ShieldCheck size={14} className="text-primary shrink-0" />
            <span>Pagamento processado com segurança. Seus dados são criptografados e não ficam salvos no site.</span>
          </div>
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
            onClick={() => { setSubmitError(null); setPromoUnavailable(false); setStep("data"); }}
            disabled={isPending}
            className="mt-4 w-full py-3 bg-secondary text-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-secondary/80 transition-colors disabled:opacity-40"
          >
            Voltar
          </button>
        </div>
      );
    }

    if (asaasCard) {
      return (
        <AsaasCardForm
          amountCents={amountCents}
          onSubmit={handleAsaasCardSubmit}
          onBack={() => { setSubmitError(null); setPromoUnavailable(false); setStep("data"); }}
          isPending={isPending}
          error={submitError}
          submitLabel={promoUnavailable ? `Confirmar e pagar ${formatBRL(amountCents)} hoje` : undefined}
          note={cardNote}
          errorAction={alreadyMember ? (
            <Link href="/conta?aba=socio" className="underline font-semibold">Minha conta</Link>
          ) : null}
        />
      );
    }

    // Nenhum gateway de cartão ativo: a adesão não pode ser concluída online.
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4 text-center">
        <p className="text-foreground font-semibold">Adesão indisponível no momento</p>
        <p className="text-sm text-muted-foreground">
          Não é possível assinar online agora. Tente mais tarde ou fale com o clube.
        </p>
        <button
          onClick={() => setStep("data")}
          className="w-full py-2.5 bg-secondary text-foreground text-sm font-semibold rounded-md hover:bg-secondary/80 transition-colors"
        >
          Voltar
        </button>
      </div>
    );
  }

  // ── STEP: DONE ────────────────────────────────────────────────────────────
  // Mostra o status REAL: ativo só depois que o gateway confirma o pagamento.
  const isActive = memberStatus === "active";
  const loggedIn = !!account && useAccount;
  return (
    <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center gap-6 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
        {isActive ? (
          <CheckCircle2 size={32} className="text-primary" />
        ) : (
          <Loader2 size={32} className="text-primary animate-spin" />
        )}
      </div>
      <div>
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">
          {isActive ? "Você é sócio!" : "Confirmando seu pagamento"}
        </h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          {isActive && promoDone
            ? `1º mês grátis: a 1ª cobrança de ${formatBRL(promoDone.amountCents)} será em ${formatDayMonth(promoDone.firstChargeDate)} no cartão final ${promoDone.last4}. Sua carteirinha já está na sua conta.`
            : isActive
            ? "Pagamento confirmado. Sua carteirinha, com QR Code e benefícios, fica na sua conta."
            : pollExpired
            ? "A confirmação está demorando mais que o normal. Assim que o pagamento for confirmado, sua carteirinha é liberada na sua conta."
            : "Isso costuma levar poucos segundos. Assim que confirmar, sua carteirinha fica ativa na sua conta."}
        </p>
        {fullPriceAfterUse && (
          <p className="text-sm text-foreground max-w-sm mx-auto">
            Promoção já utilizada anteriormente — sua assinatura foi iniciada com a cobrança de hoje.
          </p>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Link
          href="/"
          className="flex-1 text-center px-4 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-secondary transition-colors"
        >
          Voltar ao site
        </Link>
        {cardToken && (
          <Link
            href={loggedIn ? "/conta?aba=socio" : "/conta?criar=1"}
            className="flex-1 text-center px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {loggedIn ? "Ver carteirinha" : "Criar conta"}
          </Link>
        )}
      </div>
      {!loggedIn && (
        <p className="text-xs text-muted-foreground max-w-xs">
          Crie sua conta com este WhatsApp para ver a carteirinha, mensalidades, trocar de plano ou cancelar quando quiser.
          Já tem conta? <Link href="/conta?aba=socio" className="text-primary underline underline-offset-2">Entrar</Link>.
        </p>
      )}
    </div>
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
