"use client";

import { useState, useTransition } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createCourtesyTickets } from "@/app/actions/courtesy-tickets";
import type { CourtesyGameOption, CourtesyTypeOption } from "@/app/actions/courtesy-tickets";
import { Ticket, CheckCircle2, Loader2, AlertCircle, Gift } from "lucide-react";

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
}

type Result = { ticketIds: string[]; orderId: string; recipientName: string; typeName: string };

export function CourtesyTicketForm({ games, globalTypes }: Props) {
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [typeCode, setTypeCode] = useState(globalTypes[0]?.code ?? "inteira");
  const [quantity, setQuantity] = useState(1);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
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
      });
      if (res.ok) {
        setResult({
          ticketIds: res.ticketIds,
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
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 text-green-400">
          <CheckCircle2 size={20} className="shrink-0" />
          <div>
            <p className="font-semibold text-foreground">
              {result.ticketIds.length} ingresso{result.ticketIds.length > 1 ? "s" : ""} de cortesia gerado{result.ticketIds.length > 1 ? "s" : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              {result.recipientName} · {result.typeName}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 justify-center">
          {result.ticketIds.map((id, i) => (
            <div key={id} className="flex flex-col items-center gap-2 border border-border rounded-xl p-4 bg-secondary/20 w-[200px]">
              <span className="text-xs font-semibold text-foreground">
                {result.typeName} <span className="text-muted-foreground">#{i + 1}</span>
              </span>
              <div className="p-3 bg-white rounded-xl">
                <QRCodeSVG value={id} size={150} />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/60 text-center break-all">{id.slice(0, 8).toUpperCase()}</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Gift size={11} className="text-primary" /> Cortesia
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Apólice 6.063.222 · Chubb Seguros Brasil S.A.
        </p>

        <button
          type="button"
          onClick={reset}
          className="self-center text-sm text-primary hover:underline"
        >
          ← Gerar mais ingressos
        </button>
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
          <p className="text-xs text-muted-foreground">Misto EC vs {selectedGame.opponent}</p>
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
            max={50}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(50, Number(e.target.value))))}
            className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring text-center"
          />
        </div>
      </div>

      {/* Recipient */}
      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Beneficiário (opcional)</p>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">Nome</label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Ex: João Silva"
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
        disabled={isPending || !gameId || !recipientName.trim()}
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
