"use client";

import Link from "next/link";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Pencil, Trash2, Play, Square, ExternalLink, Copy, Check, ArchiveRestore } from "lucide-react";
import { useDragReorder } from "@/components/admin/useDragReorder";
import { useConfirm } from "@/components/admin/useConfirm";
import {
  reorderRaffles,
  setRaffleStatus,
  deleteRaffle,
  toggleRaffleActive,
  type RaffleRow,
  type RaffleStatus,
} from "@/app/actions/admin-raffles";

const STATUS_CFG: Record<RaffleStatus, { label: string; cls: string }> = {
  draft:     { label: "Rascunho",         cls: "bg-muted text-muted-foreground" },
  active:    { label: "À venda",          cls: "bg-green-500/15 text-green-600" },
  closed:    { label: "Vendas encerradas", cls: "bg-yellow-500/15 text-yellow-600" },
  drawn:     { label: "Sorteado",         cls: "bg-primary/15 text-primary" },
  cancelled: { label: "Cancelado",        cls: "bg-destructive/10 text-destructive" },
};

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function RafflesTable({ raffles }: { raffles: RaffleRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { rows, isSaving, getRowProps } = useDragReorder(raffles, reorderRaffles);
  const { confirm, dialog } = useConfirm();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function act(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  function copyLink(slug: string, id: string) {
    const url = `${window.location.origin}/rifa/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    });
  }

  if (rows.length === 0) {
    return (
      <div className="border border-border rounded-xl p-10 text-center text-muted-foreground">
        Nenhum sorteio cadastrado ainda.
      </div>
    );
  }

  return (
    <>
    <ul
      className="flex flex-col gap-3"
      style={{ opacity: isSaving || pending ? 0.6 : 1, transition: "opacity 0.15s" }}
    >
      {rows.map((r, idx) => {
        const cfg = STATUS_CFG[r.status];
        const pct = r.totalNumbers > 0 ? Math.round((r.soldCount / r.totalNumbers) * 100) : 0;
        return (
          <li
            key={r.id}
            {...getRowProps(idx)}
            className="bg-card border border-border rounded-xl p-4 flex items-start gap-3"
          >
            <span className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground pt-1 shrink-0">
              <GripVertical size={16} />
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground truncate">{r.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${cfg.cls}`}>
                  {cfg.label}
                </span>
                {!r.active && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">arquivado</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {brl(r.numberPriceCents)} / número · {r.totalNumbers.toLocaleString("pt-BR")} números
              </p>

              {/* Progresso */}
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {r.soldCount.toLocaleString("pt-BR")}/{r.totalNumbers.toLocaleString("pt-BR")} ({pct}%)
                </span>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-1 shrink-0">
              <a
                href={`/rifa/${r.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Abrir página pública"
              >
                <ExternalLink size={15} />
              </a>
              <button
                type="button"
                onClick={() => copyLink(r.slug, r.id)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title={copiedId === r.id ? "Link copiado!" : "Copiar link público"}
              >
                {copiedId === r.id ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
              </button>
              <Link
                href={`/admin/rifas/${r.id}`}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Editar"
              >
                <Pencil size={15} />
              </Link>
              {r.active ? (
                <>
                  {r.status === "draft" || r.status === "closed" ? (
                    <button
                      type="button"
                      onClick={() => act(() => setRaffleStatus(r.id, "active"))}
                      className="p-1.5 rounded-lg text-green-600 hover:bg-secondary transition-colors"
                      title="Abrir vendas"
                    >
                      <Play size={15} />
                    </button>
                  ) : r.status === "active" ? (
                    <button
                      type="button"
                      onClick={() => act(() => setRaffleStatus(r.id, "closed"))}
                      className="p-1.5 rounded-lg text-yellow-600 hover:bg-secondary transition-colors"
                      title="Encerrar vendas"
                    >
                      <Square size={15} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      confirm({
                        title: `Arquivar o sorteio "${r.name}"?`,
                        description: "Ele deixa de aparecer no site. Os números e pedidos são preservados.",
                        confirmLabel: "Arquivar",
                        onConfirm: () => act(() => deleteRaffle(r.id)),
                      })
                    }
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
                    title="Arquivar"
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => act(() => toggleRaffleActive(r.id, true))}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  title="Restaurar (desarquivar)"
                >
                  <ArchiveRestore size={15} />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
    {dialog}
    </>
  );
}
