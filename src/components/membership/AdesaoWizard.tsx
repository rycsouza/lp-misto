"use client";

import { useState, useTransition } from "react";
import { Check, ChevronRight, Loader2, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import type { PublicPlan } from "@/app/actions/membership";
import { signupMember } from "@/app/actions/membership";
import { validateCPF } from "@/lib/membership/utils";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";

type Step = "plan" | "data" | "payment" | "done";

interface AdesaoWizardProps {
  plans: PublicPlan[];
  initialPlanSlug?: string;
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

export function AdesaoWizard({ plans, initialPlanSlug }: AdesaoWizardProps) {
  const defaultPlan = plans.find((p) => p.slug === initialPlanSlug) ?? plans[0] ?? null;

  const [step, setStep] = useState<Step>(defaultPlan ? "data" : "plan");
  const [selectedPlan, setSelectedPlan] = useState<PublicPlan | null>(defaultPlan);
  const [form, setForm] = useState({ name: "", email: "", whatsapp: "", cpf: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  // Payment step
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const inputClass =
    "w-full bg-input border border-border rounded-md px-3 py-2.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground";

  function validateForm() {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 3) e.name = "Nome muito curto";
    if (!form.email.includes("@")) e.email = "E-mail inválido";
    if (form.whatsapp.replace(/\D/g, "").length < 10) e.whatsapp = "WhatsApp inválido";
    if (!validateCPF(form.cpf)) e.cpf = "CPF inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!selectedPlan) return;
    if (!validateForm()) return;

    setSubmitError(null);
    startTransition(async () => {
      const result = await signupMember({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        whatsapp: form.whatsapp.replace(/\D/g, ""),
        cpf: form.cpf.replace(/\D/g, ""),
        planId: selectedPlan.id,
      });

      if (!result.success) {
        setSubmitError(result.error ?? "Erro ao processar cadastro.");
        return;
      }

      setMemberId(result.memberId ?? null);
      if (result.pixQrCode) {
        setPixQrCode(result.pixQrCode);
        setPixQrCodeUrl(result.pixQrCodeUrl ?? null);
        setStep("payment");
      } else {
        // Manual activation mode (no gateway configured)
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
                <p className="text-primary font-bold text-lg mt-1">{formatBRL(plan.priceCents)}<span className="text-muted-foreground font-normal text-xs">/mês</span></p>
              </div>
              <ul className="flex flex-col gap-1.5 flex-1">
                {plan.benefits.slice(0, 4).map((b) => (
                  <li key={b.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check size={12} className="text-primary shrink-0" />{b.label}
                  </li>
                ))}
                {plan.benefits.length > 4 && (
                  <li className="text-xs text-muted-foreground pl-4">+ {plan.benefits.length - 4} benefícios</li>
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
        {/* Selected plan summary */}
        {selectedPlan && (
          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
            <div>
              <p className="text-foreground font-semibold text-sm">Plano {selectedPlan.name}</p>
              <p className="text-primary font-bold">{formatBRL(selectedPlan.priceCents)}<span className="text-muted-foreground font-normal text-xs">/mês</span></p>
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
            <label className="block text-sm text-muted-foreground mb-1">Nome completo *</label>
            <input
              className={inputClass}
              placeholder="João da Silva"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            {errors.name && <p className="text-destructive text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">E-mail *</label>
            <input
              type="email"
              className={inputClass}
              placeholder="joao@email.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            {errors.email && <p className="text-destructive text-xs mt-1">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">WhatsApp *</label>
              <input
                type="tel"
                className={inputClass}
                placeholder="(67) 99999-0000"
                value={form.whatsapp}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
              />
              {errors.whatsapp && <p className="text-destructive text-xs mt-1">{errors.whatsapp}</p>}
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">CPF *</label>
              <input
                className={inputClass}
                placeholder="000.000.000-00"
                value={form.cpf}
                onChange={(e) => setForm((f) => ({ ...f, cpf: formatCPFInput(e.target.value) }))}
                maxLength={14}
              />
              {errors.cpf && <p className="text-destructive text-xs mt-1">{errors.cpf}</p>}
            </div>
          </div>
        </div>

        {submitError && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
            <AlertCircle size={16} className="shrink-0" />
            {submitError}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg px-6 py-3 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {isPending ? (
            <><Loader2 size={16} className="animate-spin" /> Processando...</>
          ) : (
            <>Continuar para pagamento <ChevronRight size={16} /></>
          )}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Ao continuar, você aceita os termos de adesão ao programa Sócio-Torcedor.
        </p>
      </div>
    );
  }

  // ── STEP: PAYMENT ─────────────────────────────────────────────────────────
  if (step === "payment") {
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

        <div className="text-sm text-muted-foreground max-w-xs">
          <p>Após o pagamento, sua assinatura será ativada automaticamente em alguns minutos.</p>
        </div>

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
          Cadastro realizado!
        </h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          {pixQrCode
            ? "Após a confirmação do pagamento, sua assinatura será ativada e você receberá sua carteirinha digital."
            : "Seu cadastro foi recebido. Nossa equipe irá ativar sua assinatura em breve."}
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
