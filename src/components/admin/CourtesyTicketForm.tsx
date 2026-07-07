"use client";

import { useState, useTransition } from "react";
import { createCourtesyTickets } from "@/app/actions/courtesy-tickets";
import type { CourtesyGameOption, CourtesyTypeOption, CourtesySponsorOption } from "@/app/actions/courtesy-tickets";
import { Ticket, CheckCircle2, Loader2, AlertCircle, Gift, Printer, Plus, Trash2 } from "lucide-react";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

interface Props {
  games: CourtesyGameOption[];
  globalTypes: CourtesyTypeOption[];
  sponsors: CourtesySponsorOption[];
  siteName?: string;
}

type TicketLine = { typeCode: string; quantity: number; sponsorId: string };
type Result = {
  tickets: { id: string }[];
  lines: { typeName: string; quantity: number; sponsorName: string | null }[];
  errors: string[];
};

export function CourtesyTicketForm({ games, globalTypes, sponsors, siteName }: Props) {
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const newLine = (): TicketLine => ({ typeCode: globalTypes[0]?.code ?? "inteira", quantity: 1, sponsorId: "" });
  const [lines, setLines] = useState<TicketLine[]>([newLine()]);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [a4Grid, setA4Grid] = useState<"3x3" | "3x4">("3x3");
  const [isPending, startTransition] = useTransition();

  const selectedGame = games.find((g) => g.id === gameId);
  const totalQty = lines.reduce((acc, l) => acc + (l.quantity || 0), 0);

  function updateLine(i: number, patch: Partial<TicketLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, newLine()]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  function reset() {
    setResult(null);
    setError(null);
    setRecipientName("");
    setRecipientEmail("");
    setLines([newLine()]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const allTickets: { id: string }[] = [];
      const breakdown: Result["lines"] = [];
      const errs: string[] = [];
      // Gera cada linha (uma chamada por tipo); os ingressos são agregados para
      // impressão única — getTicketsPrintData já lida com múltiplos pedidos.
      for (const line of lines) {
        const typeName = globalTypes.find((t) => t.code === line.typeCode)?.name ?? line.typeCode;
        const sponsorName = line.sponsorId ? (sponsors.find((s) => s.id === line.sponsorId)?.name ?? null) : null;
        const res = await createCourtesyTickets({
          gameId,
          typeCode: line.typeCode,
          typeName,
          quantity: line.quantity,
          recipientName,
          recipientEmail,
          sponsorId: line.sponsorId || null,
        });
        if (res.ok) {
          allTickets.push(...res.tickets.map((t) => ({ id: t.id })));
          breakdown.push({ typeName, quantity: line.quantity, sponsorName });
        } else {
          errs.push(`${typeName} (${line.quantity}): ${res.error}`);
        }
      }
      if (allTickets.length === 0) {
        setError(errs.join(" · ") || "Nenhum ingresso gerado.");
        return;
      }
      setResult({ tickets: allTickets, lines: breakdown, errors: errs });
    });
  }

  if (result) {
    const ticketUrl = result.tickets.map((t) => t.id).join(",");
    return (
      <div className="flex flex-col gap-6">
        {/* Resumo */}
        <div className="flex items-start gap-3">
          <CheckCircle2 size={20} className="shrink-0 text-green-400 mt-0.5" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-foreground">
              {result.tickets.length} ingresso{result.tickets.length > 1 ? "s" : ""} de cortesia gerado{result.tickets.length > 1 ? "s" : ""}
            </p>
            <ul className="text-sm text-muted-foreground flex flex-col gap-0.5 mt-0.5">
              {result.lines.map((l, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <span className="text-foreground/80">{l.quantity}×</span> {l.typeName}
                  {l.sponsorName && (
                    <span className="text-xs text-primary/80 flex items-center gap-1">
                      <Gift size={11} /> {l.sponsorName}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {result.errors.length > 0 && (
              <p className="text-xs text-destructive mt-1 flex items-start gap-1">
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                Algumas linhas falharam: {result.errors.join(" · ")}
              </p>
            )}
          </div>
        </div>

        {/* Grade da folha A4 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Grade A4:</span>
          {([
            { value: "3x3", label: "3×3 · 9/página" },
            { value: "3x4", label: "3×4 · 12/página" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setA4Grid(opt.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                a4Grid === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Botões */}
        <div className="flex gap-3 justify-start flex-wrap">
          <a
            href={`/admin/imprimir-ingresso-a4?tickets=${ticketUrl}&grid=${a4Grid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            <Printer size={15} /> Imprimir A4
          </a>
          <a
            href={`/admin/imprimir-ingresso?tickets=${ticketUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-border text-foreground text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-secondary/40 transition-colors"
          >
            <Printer size={15} /> Térmica 58mm
          </a>
          <button
            type="button"
            onClick={reset}
            className="text-sm text-muted-foreground hover:text-foreground border border-border px-4 py-2.5 rounded-lg transition-colors"
          >
            Gerar mais
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Game */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted-foreground">Jogo</label>
        <select
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          required
          className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.opponent}{g.competition ? ` — ${g.competition}` : ""} · {fmtDate(g.date)}
            </option>
          ))}
        </select>
        {selectedGame && (
          <p className="text-xs text-muted-foreground">{siteName ? `${siteName} vs ${selectedGame.opponent}` : selectedGame.opponent}</p>
        )}
      </div>

      {/* Linhas: tipo + quantidade + patrocinador (várias de uma vez) */}
      <div className="border-t border-border pt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Ingressos a gerar</p>
          <span className="text-xs text-muted-foreground">Total: <b className="text-foreground">{totalQty}</b></span>
        </div>

        {lines.map((line, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2 bg-secondary/20 border border-border rounded-lg p-2.5">
            <div className="flex-1 min-w-[120px] flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground">Tipo</label>
              <select
                value={line.typeCode}
                onChange={(e) => updateLine(i, { typeCode: e.target.value })}
                className="w-full bg-input border border-border rounded-md px-2.5 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {globalTypes.map((t) => (
                  <option key={t.code} value={t.code}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="w-20 flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground">Qtd</label>
              <input
                type="number"
                min={1}
                max={500}
                value={line.quantity}
                onChange={(e) => updateLine(i, { quantity: Math.max(1, Math.min(500, Number(e.target.value))) })}
                className="w-full bg-input border border-border rounded-md px-2.5 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring text-center"
              />
            </div>
            {sponsors.length > 0 && (
              <div className="flex-1 min-w-[120px] flex flex-col gap-1">
                <label className="text-[11px] text-muted-foreground">Patrocinador</label>
                <select
                  value={line.sponsorId}
                  onChange={(e) => updateLine(i, { sponsorId: e.target.value })}
                  className="w-full bg-input border border-border rounded-md px-2.5 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Sem patrocinador</option>
                  {sponsors.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={() => removeLine(i)}
              disabled={lines.length === 1}
              aria-label="Remover linha"
              className="shrink-0 p-2 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:hover:text-muted-foreground transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addLine}
          className="self-start text-sm text-primary font-semibold flex items-center gap-1.5 hover:underline"
        >
          <Plus size={15} /> Adicionar tipo
        </button>
        {sponsors.length > 0 && (
          <p className="text-xs text-muted-foreground">
            O patrocinador escolhido em cada linha aparece na impressão A4 daqueles ingressos.
          </p>
        )}
      </div>

      {/* Recipient */}
      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Beneficiário <span className="normal-case font-normal">(opcional)</span></p>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">Nome</label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Ingresso de Cortesia - Sistema"
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">E-mail <span className="text-muted-foreground/50">(para envio)</span></label>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="joao@email.com"
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">Se informado, o QR Code também será enviado por e-mail.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !gameId}
        className="bg-primary text-primary-foreground text-sm font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {isPending ? (
          <><Loader2 size={16} className="animate-spin" /> Gerando...</>
        ) : (
          <><Ticket size={16} /> Gerar {totalQty} ingresso{totalQty !== 1 ? "s" : ""} de cortesia</>
        )}
      </button>
    </form>
  );
}
