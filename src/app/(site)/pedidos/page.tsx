"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Package, Search, RefreshCw } from "lucide-react";
import Link from "next/link";
import {
  verifyOrdersCaptcha,
  getOrdersSession, startOrdersSession, clearOrdersSession,
} from "@/app/actions/checkout";
import { usePhoneSession } from "@/hooks/usePhoneSession";
import {
  OrderCard,
  TABS,
  matchesTab,
  isPixStillActive,
  formatWhatsApp,
  type OrderData,
  type TabKey,
} from "@/components/orders/OrderCards";

// Turnstile (captcha invisível) — carregado dinamicamente quando há site key.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const USE_CAPTCHA = !!TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

// ─── Main content ─────────────────────────────────────────────────────────────

function PedidosContent() {
  const searchParams = useSearchParams();
  const [whatsapp, setWhatsapp] = useState("");
  const [orders, setOrders] = useState<OrderData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("todos");
  const [accessError, setAccessError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const { phone: savedPhone, setPhone: savePhone } = usePhoneSession();
  const didAutoSearch = useRef(false);
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  // Prefill do número (não dispara busca) assim que o storage carrega.
  useEffect(() => {
    if (savedPhone && !whatsapp) setWhatsapp(savedPhone);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPhone]);

  // Auto-carrega a sessão: token de link mágico (?t=) OU cookie de sessão já
  // gravado neste dispositivo. Com sessão válida a página abre direto os pedidos
  // — o input do telefone nem aparece. Número cru nunca carrega sozinho.
  useEffect(() => {
    if (didAutoSearch.current) return;
    didAutoSearch.current = true;

    const urlToken = searchParams.get("t");
    setLoading(true);
    const run = urlToken ? startOrdersSession(urlToken) : getOrdersSession();
    run.then((res) => {
      setLoading(false);
      if (!res.active || res.orders.length === 0) return; // sem sessão → mostra o formulário
      setOrders(res.orders);
      setSearched(true);
      const tel = (res.orders[0] as { customerWhatsapp?: string } | undefined)?.customerWhatsapp;
      if (tel) { const f = formatWhatsApp(tel); setWhatsapp(f); savePhone(f); }
      // Remove o ?t= da URL: evita o token no histórico e em compartilhamentos.
      if (urlToken) { try { window.history.replaceState(null, "", "/pedidos"); } catch { /* ignore */ } }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Acesso manual: digita o WhatsApp e vê os pedidos. Sem OTP. Se o Turnstile
  // estiver configurado, envia o token do captcha invisível; senão, vai direto.
  async function handleLookup() {
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length < 10) return;
    if (USE_CAPTCHA && !captchaToken) {
      setAccessError("Verificação de segurança carregando. Aguarde um instante e tente de novo.");
      return;
    }
    savePhone(whatsapp);
    setAccessError(null);
    setLoading(true);
    const r = await verifyOrdersCaptcha(digits, captchaToken ?? "");
    setLoading(false);
    if (USE_CAPTCHA) {
      // Token do Turnstile é de uso único → reseta o widget p/ obter um novo.
      try { if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current); } catch { /* ignore */ }
      setCaptchaToken(null);
    }
    if (!r.ok) {
      setAccessError(
        r.error === "rate_limited"
          ? "Muitas consultas em pouco tempo. Aguarde alguns minutos e tente novamente."
          : r.error === "invalid_phone"
          ? "Número de WhatsApp inválido."
          : "Não foi possível concluir a consulta. Tente novamente."
      );
      return;
    }
    setOrders(r.orders);
    setSearched(true);
  }

  // Encerra a sessão: apaga o cookie e volta ao formulário de acesso.
  async function handleExit() {
    await clearOrdersSession();
    setOrders(null);
    setSearched(false);
    setAccessError(null);
    setCaptchaToken(null);
    widgetId.current = null; // permite re-renderizar o widget no formulário
  }

  // Sort: paid first, then pending active, then refunded, then expired
  const sortedOrders = orders
    ? [...orders].sort((a, b) => {
        const priority = (o: OrderData) => {
          if (o.status === "paid") return 0;
          if (o.status === "pending" && isPixStillActive(o)) return 1;
          if (o.status === "refunded") return 2;
          return 3;
        };
        return priority(a) - priority(b);
      })
    : null;

  const allVisible = sortedOrders?.filter((o) => o.status !== "cancelled") ?? null;

  const tabCounts = allVisible
    ? {
        todos: allVisible.length,
        pagos: allVisible.filter((o) => matchesTab(o, "pagos")).length,
        aguardando: allVisible.filter((o) => matchesTab(o, "aguardando")).length,
        historico: allVisible.filter((o) => matchesTab(o, "historico")).length,
      }
    : null;

  const visibleOrders = allVisible?.filter((o) => matchesTab(o, activeTab)) ?? null;

  // Nome do clube vindo dos pedidos (config injetada pelo server action), quando disponível.
  // Sem nome → componentes degradam graciosamente (sem rótulo do mandante).
  const siteName =
    (orders?.map((o) => (o as { siteName?: string | null }).siteName).find((n) => n?.trim()) ?? null);

  // Já autenticado e vendo pedidos → não faz sentido mostrar o formulário de acesso.
  const viewingOrders = searched && !!allVisible && allVisible.length > 0;
  const showAccessForm = !viewingOrders;

  // Renderiza o widget do Turnstile no formulário (modo captcha). O script é
  // injetado pelo nosso bundle já confiável — o 'strict-dynamic' do CSP o cobre.
  // 'interaction-only': fica invisível, só aparece se um desafio for necessário.
  useEffect(() => {
    if (!USE_CAPTCHA || !showAccessForm) return;
    let cancelled = false;

    function renderWidget() {
      if (cancelled || !captchaRef.current || widgetId.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(captchaRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: "interaction-only",
        callback: (t: string) => { setCaptchaToken(t); setAccessError(null); },
        "error-callback": () => setCaptchaToken(null),
        "expired-callback": () => setCaptchaToken(null),
      });
    }

    if (window.turnstile) { renderWidget(); return () => { cancelled = true; }; }

    const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    let script = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
    if (!script) {
      script = document.createElement("script");
      script.src = SRC;
      script.async = true;
      script.defer = true;
      script.dataset.turnstile = "1";
      script.addEventListener("load", renderWidget);
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", renderWidget);
      renderWidget();
    }
    return () => { cancelled = true; };
  }, [showAccessForm]);

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          ← Voltar ao início
        </Link>

        {siteName && (
          <p className="text-primary text-xs font-semibold tracking-widest uppercase mb-1">{siteName}</p>
        )}
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground mb-8">
          Meus Pedidos
        </h1>

        {/* Acesso. Some quando já estou vendo os pedidos (sessão ativa). */}
        {viewingOrders ? (
          <div className="mb-6 flex justify-end">
            <button
              onClick={handleExit}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Não é você? Sair
            </button>
          </div>
        ) : (
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="tel"
                value={whatsapp}
                placeholder="(67) 99999-9999"
                onChange={(e) => setWhatsapp(formatWhatsApp(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                className="flex-1 px-4 py-3 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={handleLookup}
                disabled={loading || whatsapp.replace(/\D/g, "").length < 10}
                className="px-5 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold text-sm whitespace-nowrap"
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                  : <Search size={16} />
                }
                Ver meus pedidos
              </button>
            </div>
            {/* Container do captcha invisível (Turnstile), só quando configurado. */}
            {USE_CAPTCHA && <div ref={captchaRef} className="mt-3" />}
            <p className="text-xs text-muted-foreground mt-2">
              Informe o WhatsApp usado na compra para ver seus pedidos e ingressos.
            </p>
            {accessError && (
              <p className="text-destructive text-xs mt-2">{accessError}</p>
            )}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
            <RefreshCw size={16} className="animate-spin" />
            Buscando pedidos...
          </div>
        )}

        {/* Tabs — only after search */}
        {!loading && searched && allVisible !== null && allVisible.length > 0 && (
          <div className="flex gap-1 mb-5 bg-secondary/40 rounded-lg p-1">
            {TABS.map((tab) => {
              const count = tabCounts?.[tab.key] ?? 0;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Empty state — no orders at all */}
        {!loading && searched && allVisible !== null && allVisible.length === 0 && (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">Nenhum pedido encontrado para este número.</p>
          </div>
        )}

        {/* Empty state — tab has no results */}
        {!loading && visibleOrders !== null && visibleOrders.length === 0 && allVisible !== null && allVisible.length > 0 && (
          <div className="text-center py-10">
            <p className="text-muted-foreground text-sm">Nenhum pedido nesta categoria.</p>
          </div>
        )}

        {/* Orders */}
        {!loading && visibleOrders && visibleOrders.length > 0 && (
          <div className="flex flex-col gap-4">
            {visibleOrders.map((order) => (
              <OrderCard key={order.id} order={order} siteName={siteName} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function PedidosPage() {
  return (
    <Suspense fallback={null}>
      <PedidosContent />
    </Suspense>
  );
}
