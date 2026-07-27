"use client";

import { useState } from "react";
import { Users, ChevronLeft, ChevronRight } from "lucide-react";
import { RaffleBuyersExportButton } from "@/components/admin/RaffleBuyersExportButton";
import type { RaffleReportBuyer } from "@/app/actions/admin-raffles";

const PAGE_SIZE = 5;

function brl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function num(n: number): string {
  return n.toLocaleString("pt-BR");
}
function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/** Formata o WhatsApp brasileiro: (67) 99999-9999. Remove o DDI 55 se presente. */
function fmtWhatsApp(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw; // formato inesperado → mostra como está
}
function toWaLink(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return `https://wa.me/${d.startsWith("55") ? d : `55${d}`}`;
}

interface Props {
  raffleId: string;
  participants: number;
  buyers: RaffleReportBuyer[];
  truncated: boolean;
}

export function RaffleBuyersTable({ raffleId, participants, buyers, truncated }: Props) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(buyers.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const visible = buyers.slice(start, start + PAGE_SIZE);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Users size={16} className="text-primary" /> Compradores
          {buyers.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground tabular-nums">({num(participants)})</span>
          )}
        </h3>
        {buyers.length > 0 && <RaffleBuyersExportButton raffleId={raffleId} />}
      </div>

      {buyers.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground text-center">Nenhum comprador ainda.</p>
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="sm:hidden divide-y divide-border/50">
            {visible.map((b, i) => (
              <li key={`${b.whatsapp}-${start + i}`} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{b.name}</p>
                  <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">{brl(b.amountCents)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums mt-1">
                  <span>{num(b.numbers)} {b.numbers === 1 ? "número" : "números"}</span>
                  {b.whatsapp && (
                    <a href={toWaLink(b.whatsapp)} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:underline">
                      {fmtWhatsApp(b.whatsapp)}
                    </a>
                  )}
                  <span>{fmtDate(b.lastAt)}</span>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: tabela */}
          <table className="hidden sm:table w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-2 font-medium">Comprador</th>
                <th className="px-5 py-2 font-medium">WhatsApp</th>
                <th className="px-5 py-2 font-medium text-right">Números</th>
                <th className="px-5 py-2 font-medium text-right">Valor</th>
                <th className="px-5 py-2 font-medium text-right">Última compra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {visible.map((b, i) => (
                <tr key={`${b.whatsapp}-${start + i}`}>
                  <td className="px-5 py-2.5 text-foreground">{b.name}</td>
                  <td className="px-5 py-2.5">
                    {b.whatsapp ? (
                      <a href={toWaLink(b.whatsapp)} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:underline tabular-nums">
                        {fmtWhatsApp(b.whatsapp)}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">{num(b.numbers)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-foreground">{brl(b.amountCents)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">{fmtDate(b.lastAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Paginação */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={15} /> Anterior
              </button>
              <span className="text-xs text-muted-foreground tabular-nums">
                Página {safePage + 1} de {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Próxima <ChevronRight size={15} />
              </button>
            </div>
          )}

          {truncated && (
            <p className="px-5 py-3 text-xs text-muted-foreground border-t border-border">
              Mostrando os {num(buyers.length)} maiores compradores. Use o CSV para a lista completa.
            </p>
          )}
        </>
      )}
    </div>
  );
}
