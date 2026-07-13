"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, ArrowRight, Rocket } from "lucide-react";
import type { OnboardingStatus } from "@/app/actions/onboarding";

export function OnboardingChecklist({ status }: { status: OnboardingStatus }) {
  const [collapsed, setCollapsed] = useState(false);

  function toggle() {
    setCollapsed((c) => !c);
  }

  const pct = Math.round((status.completed / status.total) * 100);

  return (
    <div className="bg-card border border-primary/30 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/20 transition-colors"
      >
        <span className="shrink-0 w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
          <Rocket size={17} className="text-primary" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-display text-lg text-foreground tracking-wide leading-none">
            CONFIGURE SEU CLUBE
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {status.completed} de {status.total} passos concluídos · deixe a bilheteria pronta
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <div className="w-28 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-semibold text-primary tabular-nums w-9 text-right">{pct}%</span>
        </div>
        {collapsed ? (
          <ChevronDown size={18} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronUp size={18} className="text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Steps */}
      {!collapsed && (
        <ul className="divide-y divide-border/50 border-t border-border">
          {status.steps.map((step) => (
            <li key={step.key}>
              {step.done ? (
                <div className="flex items-center gap-3 px-4 py-3">
                  <CheckCircle2 size={20} className="text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground line-through decoration-muted-foreground/40">
                      {step.label}
                    </p>
                  </div>
                  <span className="text-[11px] text-primary font-medium shrink-0">Feito</span>
                </div>
              ) : (
                <Link
                  href={step.href}
                  className="group flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors"
                >
                  <Circle size={20} className="text-muted-foreground/50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium">{step.label}</p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-primary font-semibold shrink-0 group-hover:gap-1.5 transition-all">
                    Configurar
                    <ArrowRight size={14} />
                  </span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
