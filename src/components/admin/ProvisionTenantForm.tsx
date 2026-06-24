"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";
import type { ProvisionJob } from "@/app/api/admin/tenants/route";

type Stage = "form" | "creating_db" | "provisioning" | "done" | "error";

const SCHEMA_STEPS = [
  "Aplicando schema do banco…",
  "Salvando tenant na plataforma…",
  "Ativando domínio…",
];

const POLL_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

export function ProvisionTenantForm() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("form");
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  function handleNameChange(value: string) {
    const auto = value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setSlug(auto);
  }

  // Rotate step labels while provisioning schema
  useEffect(() => {
    if (stage !== "provisioning") return;
    const interval = setInterval(() => {
      setStepIdx((i) => (i < SCHEMA_STEPS.length - 1 ? i + 1 : i));
    }, 5000);
    return () => clearInterval(interval);
  }, [stage]);

  // Poll job status
  useEffect(() => {
    if (!jobId || stage !== "provisioning") return;
    pollStartRef.current = Date.now();

    pollRef.current = setInterval(async () => {
      // Timeout detection
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        clearInterval(pollRef.current!);
        setError("Tempo esgotado. O processo pode ter falhado silenciosamente. Verifique os logs da Vercel.");
        setStage("error");
        return;
      }

      try {
        const res = await fetch(`/api/admin/tenants/status?jobId=${jobId}`);
        if (!res.ok) return;
        const job: ProvisionJob = await res.json();

        if (job.status === "done") {
          clearInterval(pollRef.current!);
          setStage("done");
        } else if (job.status === "error") {
          clearInterval(pollRef.current!);
          setError(job.error ?? "Erro desconhecido no provisionamento");
          setStage("error");
        }
      } catch {
        // ignore transient fetch errors
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId, stage]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const slugVal = (form.elements.namedItem("slug") as HTMLInputElement).value.trim();
    const domainVal = (form.elements.namedItem("domain") as HTMLInputElement).value.trim().toLowerCase();
    const ownerName = (form.elements.namedItem("ownerName") as HTMLInputElement).value.trim();
    const ownerEmail = (form.elements.namedItem("ownerEmail") as HTMLInputElement).value.trim().toLowerCase();

    setDomain(domainVal);
    setSlug(slugVal);

    // Phase 1: Neon project creation happens IN the API call (Edge fn, up to 30s)
    setStage("creating_db");

    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slugVal, domain: domainVal, ownerName, ownerEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao iniciar provisionamento");
        setStage("error");
        return;
      }

      // Phase 2: schema + DB in QStash, poll for completion
      setJobId(data.jobId);
      setStepIdx(0);
      setStage("provisioning");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de rede");
      setStage("error");
    }
  }

  async function copyDomain() {
    await navigator.clipboard.writeText(domain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // ── Done ──────────────────────────────────────────────────────────────────────
  if (stage === "done") {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
            <span className="text-green-400 text-lg">✓</span>
          </div>
          <div>
            <p className="text-foreground font-medium">Tenant ativo!</p>
            <p className="text-sm text-muted-foreground">
              Banco criado, schema aplicado e e-mail de acesso enviado ao responsável.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Domínio do cliente</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-secondary text-foreground text-sm rounded-md px-3 py-2.5 font-mono">
              {domain}
            </code>
            <button
              type="button"
              onClick={copyDomain}
              className="shrink-0 p-2.5 rounded-md bg-secondary hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Aponte o DNS do cliente para este projeto Vercel e o site estará no ar.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/admin/dashboard")}
          className="text-primary text-sm hover:underline self-start"
        >
          ← Voltar ao Dashboard
        </button>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
            <span className="text-destructive text-lg">✕</span>
          </div>
          <div>
            <p className="text-foreground font-medium">Provisionamento falhou</p>
            <p className="text-sm text-muted-foreground">Verifique os logs da Vercel para mais detalhes.</p>
          </div>
        </div>
        {error && (
          <code className="text-xs bg-destructive/10 text-destructive rounded-md px-3 py-2 font-mono break-all">
            {error}
          </code>
        )}
        <button
          type="button"
          onClick={() => { setStage("form"); setError(null); }}
          className="text-primary text-sm hover:underline self-start"
        >
          ← Tentar novamente
        </button>
      </div>
    );
  }

  // ── Creating DB (Phase 1 — waiting for Edge fn to create Neon project) ────────
  if (stage === "creating_db") {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
          <p className="text-foreground font-medium">Criando banco de dados…</p>
        </div>
        <p className="text-sm text-muted-foreground pl-9">
          Provisionando projeto Neon em Virginia. Isso pode levar até 20 segundos.
        </p>
      </div>
    );
  }

  // ── Provisioning (Phase 2 — QStash running schema) ───────────────────────────
  if (stage === "provisioning") {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
            <p className="text-foreground font-medium">Finalizando configuração…</p>
          </div>
          <p className="text-sm text-muted-foreground pl-9">{SCHEMA_STEPS[stepIdx]}</p>
        </div>

        <div className="flex flex-col gap-1.5 pl-9">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            <span className="text-xs text-foreground">Banco de dados criado ✓</span>
          </div>
          {SCHEMA_STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                  i < stepIdx
                    ? "bg-green-500"
                    : i === stepIdx
                    ? "bg-primary animate-pulse"
                    : "bg-border"
                }`}
              />
              <span className={`text-xs ${i <= stepIdx ? "text-foreground" : "text-muted-foreground/50"}`}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm text-muted-foreground">
          Nome do clube / cliente
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          onChange={(e) => handleNameChange(e.target.value)}
          className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="Ex: Grêmio Esportivo Santos"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="slug" className="text-sm text-muted-foreground">
          Slug <span className="text-muted-foreground/60">(identificador único)</span>
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          pattern="[a-z0-9-]+"
          className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm font-mono outline-none focus:ring-2 focus:ring-ring"
          placeholder="gremio-santos"
        />
        <p className="text-xs text-muted-foreground">Apenas letras minúsculas, números e hífens.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="domain" className="text-sm text-muted-foreground">
          Domínio principal
        </label>
        <input
          id="domain"
          name="domain"
          type="text"
          required
          className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm font-mono outline-none focus:ring-2 focus:ring-ring"
          placeholder="gremiodoesporte.com.br"
        />
        <p className="text-xs text-muted-foreground">
          Sem https:// — apenas o domínio. O DNS deve apontar para esta Vercel antes da entrega.
        </p>
      </div>

      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Responsável pelo tenant</p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="ownerName" className="text-sm text-muted-foreground">
            Nome do responsável
          </label>
          <input
            id="ownerName"
            name="ownerName"
            type="text"
            required
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="João da Silva"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="ownerEmail" className="text-sm text-muted-foreground">
            E-mail do responsável
          </label>
          <input
            id="ownerEmail"
            name="ownerEmail"
            type="email"
            required
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="joao@clube.com.br"
          />
          <p className="text-xs text-muted-foreground">
            Um link de primeiro acesso será enviado para este e-mail ao finalizar o provisionamento.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => router.push("/admin/dashboard")}
          className="flex-1 bg-secondary text-secondary-foreground text-sm font-medium py-2.5 rounded-lg hover:opacity-80 transition-opacity"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="flex-1 bg-primary text-primary-foreground text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity"
        >
          Provisionar
        </button>
      </div>
    </form>
  );
}
