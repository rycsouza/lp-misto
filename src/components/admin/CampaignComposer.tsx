"use client";

import { useState } from "react";
import { Search, Send, Loader2, CheckCircle2, AlertTriangle, Filter } from "lucide-react";
import {
  getCampaignRecipients,
  sendCampaignToOrder,
  type CampaignProduct,
  type CampaignRecipient,
} from "@/app/actions/campaigns";

function fmtBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

const inputClass =
  "bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";

type Progress = { total: number; sent: number; failed: number; skipped: number; done: boolean } | null;

export function CampaignComposer({ products }: { products: CampaignProduct[] }) {
  // Filtros
  const [include, setInclude] = useState<Set<string>>(new Set());
  const [exclude, setExclude] = useState<Set<string>>(new Set());
  const [includePending, setIncludePending] = useState(false);
  const [pickupOnly, setPickupOnly] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Destinatários
  const [recipients, setRecipients] = useState<CampaignRecipient[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Composição
  const [subject, setSubject] = useState("Seu pedido está pronto para retirada!");
  const [body, setBody] = useState(
    "Olá, {{nome}}!\n\nSeu pedido já está disponível para retirada nos seguintes locais:\n\n{{locais}}\n\nApresente seu código de retirada {{codigo}} no balcão. Te esperamos!"
  );
  const [markReady, setMarkReady] = useState(true);

  // Envio
  const [progress, setProgress] = useState<Progress>(null);
  const [sending, setSending] = useState(false);

  function toggleSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function loadRecipients() {
    setLoadingRecipients(true);
    setProgress(null);
    const result = await getCampaignRecipients({
      includeProductIds: [...include],
      excludeProductIds: [...exclude],
      statuses: includePending ? ["paid", "pending"] : ["paid"],
      pickupOnly,
      from: from || undefined,
      to: to || undefined,
    });
    setRecipients(result);
    // Pré-seleciona todos os que têm e-mail
    setSelected(new Set(result.filter((r) => r.hasEmail).map((r) => r.orderId)));
    setLoadingRecipients(false);
  }

  function toggleRecipient(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function selectAll() {
    if (!recipients) return;
    setSelected(new Set(recipients.filter((r) => r.hasEmail).map((r) => r.orderId)));
  }
  function selectNone() {
    setSelected(new Set());
  }

  async function handleSend() {
    if (!recipients) return;
    const targets = recipients.filter((r) => selected.has(r.orderId) && r.hasEmail);
    if (targets.length === 0) return;
    if (!subject.trim() || !body.trim()) return;

    setSending(true);
    let sent = 0, failed = 0, skipped = 0;
    setProgress({ total: targets.length, sent, failed, skipped, done: false });

    // Envia um pedido por vez (evita timeout no serverless) com progresso ao vivo
    for (const r of targets) {
      const res = await sendCampaignToOrder(r.orderId, { subject, body, markReady });
      if (res.success) sent++;
      else if (res.skipped) skipped++;
      else failed++;
      setProgress({ total: targets.length, sent, failed, skipped, done: false });
    }

    setProgress({ total: targets.length, sent, failed, skipped, done: true });
    setSending(false);
  }

  const selectedCount = recipients
    ? recipients.filter((r) => selected.has(r.orderId) && r.hasEmail).length
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Filtros ──────────────────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-primary" />
          <h3 className="font-semibold text-foreground">Filtros</h3>
        </div>

        {products.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1.5">Incluir quem comprou</p>
              <p className="text-xs text-muted-foreground mb-2">Vazio = qualquer produto.</p>
              <div className="flex flex-wrap gap-2">
                {products.map((p) => {
                  const on = include.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleSet(setInclude, p.id)}
                      className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                        on
                          ? "bg-primary/15 border-primary/40 text-primary font-semibold"
                          : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1.5">Excluir quem comprou</p>
              <p className="text-xs text-muted-foreground mb-2">Ex.: deixe de fora um produto específico.</p>
              <div className="flex flex-wrap gap-2">
                {products.map((p) => {
                  const on = exclude.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleSet(setExclude, p.id)}
                      className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                        on
                          ? "bg-destructive/15 border-destructive/40 text-destructive font-semibold"
                          : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">De</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Até</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer py-2">
            <input type="checkbox" checked={pickupOnly} onChange={(e) => setPickupOnly(e.target.checked)} className="w-4 h-4" />
            Somente retirada
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer py-2">
            <input type="checkbox" checked={includePending} onChange={(e) => setIncludePending(e.target.checked)} className="w-4 h-4" />
            Incluir não pagos
          </label>
        </div>

        <div>
          <button
            onClick={loadRecipients}
            disabled={loadingRecipients}
            className="bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
          >
            {loadingRecipients ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Buscar destinatários
          </button>
        </div>
      </section>

      {/* ── Destinatários ────────────────────────────────────────────────── */}
      {recipients !== null && (
        <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-foreground">
              Destinatários — {selectedCount} selecionado(s) de {recipients.length}
            </h3>
            {recipients.length > 0 && (
              <div className="flex gap-2 text-xs">
                <button onClick={selectAll} className="text-primary hover:underline">Selecionar todos</button>
                <span className="text-muted-foreground">·</span>
                <button onClick={selectNone} className="text-muted-foreground hover:underline">Limpar</button>
              </div>
            )}
          </div>

          {recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido encontrado para estes filtros.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {recipients.map((r) => (
                <label
                  key={r.orderId}
                  className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-secondary/30 ${
                    !r.hasEmail ? "opacity-50" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(r.orderId)}
                    disabled={!r.hasEmail}
                    onChange={() => toggleRecipient(r.orderId)}
                    className="w-4 h-4 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium truncate">{r.customerName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.hasEmail ? r.customerEmail : "sem e-mail"} · {r.productNames.join(", ") || "—"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{fmtDate(r.createdAt)}</span>
                  <span className="text-xs text-foreground shrink-0 w-20 text-right">{fmtBRL(r.totalCents)}</span>
                </label>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Composição ───────────────────────────────────────────────────── */}
      {recipients !== null && recipients.length > 0 && (
        <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
          <h3 className="font-semibold text-foreground">Mensagem</h3>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Assunto</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={`${inputClass} w-full`} />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Corpo</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className={`${inputClass} w-full font-mono`}
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Variáveis disponíveis:{" "}
              <code className="bg-secondary px-1 rounded">{"{{nome}}"}</code>{" "}
              <code className="bg-secondary px-1 rounded">{"{{codigo}}"}</code> (código de retirada){" "}
              <code className="bg-secondary px-1 rounded">{"{{locais}}"}</code> (pontos de retirada). Se você não
              usar <code className="bg-secondary px-1 rounded">{"{{codigo}}"}</code>, o código é adicionado
              automaticamente em destaque no fim do e-mail.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input type="checkbox" checked={markReady} onChange={(e) => setMarkReady(e.target.checked)} className="w-4 h-4" />
            Marcar pedidos como &quot;pronto para retirada&quot; ao enviar
          </label>

          {/* Progresso */}
          {progress && (
            <div className={`rounded-lg px-4 py-3 text-sm ${progress.done ? "bg-green-500/10" : "bg-secondary/40"}`}>
              {progress.done ? (
                <p className="flex items-center gap-2 text-foreground">
                  <CheckCircle2 size={16} className="text-green-500" />
                  Concluído: {progress.sent} enviado(s)
                  {progress.failed > 0 && <span className="text-destructive">· {progress.failed} falha(s)</span>}
                  {progress.skipped > 0 && <span className="text-muted-foreground">· {progress.skipped} sem e-mail</span>}
                </p>
              ) : (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" />
                  Enviando… {progress.sent + progress.failed + progress.skipped}/{progress.total}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSend}
              disabled={sending || selectedCount === 0 || !subject.trim() || !body.trim()}
              className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Enviar para {selectedCount} cliente(s)
            </button>
            {selectedCount === 0 && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle size={13} /> Selecione ao menos um destinatário com e-mail.
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
