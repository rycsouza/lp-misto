"use client";

import { useRef, useEffect } from "react";
import { MODULE_GROUPS } from "@/lib/admin-modules";

interface PermissionsPickerProps {
  permissions: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}

/** Checkbox que suporta estado "indeterminado" (parcial) via ref. */
function TriStateCheckbox({
  checked,
  indeterminate,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  className?: string;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      className={className}
    />
  );
}

/**
 * Seletor de permissões agrupado, espelhando a sidebar (MODULE_GROUPS, derivado de nav.ts).
 * Cada grupo tem um "selecionar tudo"; cada módulo mostra as telas que libera.
 */
export function PermissionsPicker({ permissions, onChange }: PermissionsPickerProps) {
  function toggle(key: string) {
    onChange({ ...permissions, [key]: !permissions[key] });
  }

  function setGroup(keys: string[], value: boolean) {
    const next = { ...permissions };
    for (const k of keys) next[k] = value;
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-5">
      {MODULE_GROUPS.map((group) => {
        const keys = group.modules.map((m) => m.key);
        const selected = keys.filter((k) => permissions[k]).length;
        const allOn = selected === keys.length;
        const someOn = selected > 0;

        return (
          <div key={group.title} className="rounded-lg border border-border bg-secondary/20">
            {/* Cabeçalho do grupo — selecionar tudo */}
            <label className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-border/60 cursor-pointer select-none">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {selected}/{keys.length}
                </span>
                <TriStateCheckbox
                  checked={allOn}
                  indeterminate={someOn}
                  onChange={() => setGroup(keys, !allOn)}
                  aria-label={`Selecionar todos em ${group.title}`}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
              </span>
            </label>

            {/* Módulos do grupo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 p-3">
              {group.modules.map((module) => (
                <label
                  key={module.key}
                  className="flex items-start gap-2.5 py-1.5 cursor-pointer rounded-md px-1 hover:bg-secondary/40 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={!!permissions[module.key]}
                    onChange={() => toggle(module.key)}
                    className="w-4 h-4 mt-0.5 accent-primary shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground leading-tight">
                      {module.label}
                    </span>
                    {module.pages.length > 1 && (
                      <span className="block text-xs text-muted-foreground leading-tight mt-0.5">
                        {module.pages.join(" · ")}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
