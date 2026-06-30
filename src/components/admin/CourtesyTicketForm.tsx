"use client";

import { useState, useTransition } from "react";
import { createCourtesyTickets } from "@/app/actions/courtesy-tickets";
import type { CourtesyGameOption, CourtesyTypeOption, CourtesySponsorOption } from "@/app/actions/courtesy-tickets";
import { Ticket, CheckCircle2, Loader2, AlertCircle, Gift, Printer } from "lucide-react";

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

type Result = { tickets: { id: string; qrToken: string }[]; orderId: string; recipientName: string; typeName: string };

export function CourtesyTicketForm({ games, globalTypes, sponsors, siteName }: Props) {
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [typeCode, setTypeCode] = useState(globalTypes[0]?.code ?? "inteira");
  const [quantity, setQuantity] = useState(1);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sponsorId, setSponsorId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedGame = games.find((g) => g.id === gameId);
  const selectedType = globalTypes.find((t) => t.code === typeCode) ?? globalTypes[0];

  function reset() {
    setResult(null);
    setError(null);
    setRecipientName("");
    setRecipientEmail("");
    setQuantity(1);
    setSponsorId("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createCourtesyTickets({
        gameId,
        typeCode,
        typeName: selectedType?.name ?? typeCode,
        quantity,
        recipientName,
        recipientEmail,
        sponsorId: sponsorId || null,
      });
      if (res.ok) {
        setResult({
          tickets: res.tickets,
          orderId: res.orderId,
          recipientName,
          typeName: selectedType?.name ?? typeCode,
        });
      } else {
        setError(res.error);
      }
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
            <p className="text-sm text-muted-foreground">{result.typeName}</p>
            {result.recipientName && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Gift size={12} className="text-primary" /> {result.recipientName}
              </p>
            )}
            <p className="text-xs text-muted-foreground/60 font-mono mt-1">
              Pedido {result.orderId.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-3 justify-start flex-wrap">
          <a
            href={`/admin/imprimir-ingresso-a4?tickets=${ticketUrl}`}
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

      {/* Type + Quantity */}
      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">Tipo</label>
          <select
            value={typeCode}
            onChange={(e) => setTypeCode(e.target.value)}
            className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {globalTypes.map((t) => (
              <option key={t.code} value={t.code}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="w-24 flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">Qtd</label>
          <input
            type="number"
            min={1}
            max={500}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(500, Number(e.target.value))))}
            className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring text-center"
          />
        </div>
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

      {/* Patrocinador */}
      {sponsors.length > 0 && (
        <div className="border-t border-border pt-4 flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">
            Patrocinador <span className="text-muted-foreground/50">(opcional)</span>
          </label>
          <select
            value={sponsorId}
            onChange={(e) => setSponsorId(e.target.value)}
            className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Sem patrocinador</option>
            {sponsors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Se escolhido, a logo do patrocinador aparece na impressão A4 do ingresso.
          </p>
        </div>
      )}

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
          <><Ticket size={16} /> Gerar ingresso de cortesia</>
        )}
      </button>
    </form>
  );
}
