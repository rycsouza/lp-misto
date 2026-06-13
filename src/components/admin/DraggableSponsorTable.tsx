"use client";

import { GripVertical } from "lucide-react";
import { ReorderButtons } from "@/components/admin/ReorderButtons";
import { SponsorActions } from "@/components/admin/SponsorActions";
import { useDragReorder } from "@/components/admin/useDragReorder";
import { moveSponsorUp, moveSponsorDown, reorderSponsors } from "@/app/actions/admin-content";
import type { SponsorRow } from "@/app/actions/admin-content";

const tierConfig: Record<string, { label: string; className: string }> = {
  diamante: { label: "Diamante", className: "bg-cyan-500/15 text-cyan-600" },
  ouro: { label: "Ouro", className: "bg-yellow-500/15 text-yellow-600" },
  prata: { label: "Prata", className: "bg-slate-400/15 text-slate-500" },
  bronze: { label: "Bronze", className: "bg-orange-700/15 text-orange-800" },
};

interface Props {
  sponsors: SponsorRow[];
  tier: string;
}

export function DraggableSponsorTable({ sponsors: initial, tier }: Props) {
  const { rows, isSaving, getRowProps } = useDragReorder(initial, reorderSponsors);
  const cfg = tierConfig[tier] ?? { label: tier, className: "bg-muted text-muted-foreground" };

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden"
      style={{ opacity: isSaving ? 0.6 : 1, transition: "opacity 0.15s" }}
    >

      {/* ── Mobile cards ─────────────────────────────────── */}
      <div className="md:hidden divide-y divide-border/50">
        {rows.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">Nenhum patrocinador cadastrado</p>
        )}
        {rows.map((sponsor, idx) => (
          <div key={sponsor.id} className="px-4 py-3 flex flex-col gap-1.5 hover:bg-secondary/20 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-9 rounded flex items-center justify-center overflow-hidden shrink-0 ${sponsor.logoTone === "light" ? "bg-gray-800" : "bg-gray-100"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sponsor.logoUrl} alt={sponsor.name} className="max-w-full max-h-full object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-medium text-sm">{sponsor.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.className}`}>{cfg.label}</span>
                  <span className="text-muted-foreground text-xs capitalize">{sponsor.logoTone}</span>
                </div>
              </div>
              <span className={sponsor.active
                ? "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600 shrink-0"
                : "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground shrink-0"}>
                {sponsor.active ? "Ativo" : "Inativo"}
              </span>
            </div>
            <div className="flex justify-end items-center gap-1.5">
              <ReorderButtons
                onMoveUp={moveSponsorUp.bind(null, sponsor.id)}
                onMoveDown={moveSponsorDown.bind(null, sponsor.id)}
                isFirst={idx === 0}
                isLast={idx === rows.length - 1}
              />
              <SponsorActions sponsorId={sponsor.id} isActive={sponsor.active} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop table ─────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-6 px-2 py-3" />
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Logo</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Nome</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Tier</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Tom</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Ordem</th>
              <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Ativo</th>
              <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((sponsor, idx) => (
              <tr key={sponsor.id} {...getRowProps(idx)}>
                <td className="px-2 py-3 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                  <GripVertical size={14} />
                </td>
                <td className="px-4 py-3">
                  <div className={`w-12 h-8 rounded flex items-center justify-center overflow-hidden ${sponsor.logoTone === "light" ? "bg-gray-800" : "bg-gray-100"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sponsor.logoUrl} alt={sponsor.name} className="max-w-full max-h-full object-contain" />
                  </div>
                </td>
                <td className="px-4 py-3 text-foreground font-medium">{sponsor.name}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.className}`}>
                    {cfg.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs capitalize">{sponsor.logoTone}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  <div className="flex items-center gap-2">
                    <span>{idx + 1}</span>
                    <ReorderButtons
                      onMoveUp={moveSponsorUp.bind(null, sponsor.id)}
                      onMoveDown={moveSponsorDown.bind(null, sponsor.id)}
                      isFirst={idx === 0}
                      isLast={idx === rows.length - 1}
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={sponsor.active
                    ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                    : "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"}>
                    {sponsor.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <SponsorActions sponsorId={sponsor.id} isActive={sponsor.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
