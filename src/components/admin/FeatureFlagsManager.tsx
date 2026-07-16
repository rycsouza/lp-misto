"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setGlobalFeatureFlag, setOrgFeatureOverride } from "@/app/actions/platform-features";

interface Feature {
  key: string;
  label: string;
  description?: string;
}
interface Org {
  id: string;
  name: string;
  slug: string;
}
interface State {
  global: Record<string, boolean>;
  overrides: Record<string, Record<string, boolean>>;
}

export function FeatureFlagsManager({
  features,
  orgs,
  state,
}: {
  features: Feature[];
  orgs: Org[];
  state: State;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function globalEnabled(key: string): boolean {
    return state.global[key] ?? true;
  }

  function toggleGlobal(key: string) {
    startTransition(async () => {
      await setGlobalFeatureFlag(key, !globalEnabled(key));
      router.refresh();
    });
  }

  function overrideMode(orgId: string, key: string): "inherit" | "on" | "off" {
    const v = state.overrides[orgId]?.[key];
    if (v === undefined) return "inherit";
    return v ? "on" : "off";
  }

  function changeOverride(orgId: string, key: string, mode: "inherit" | "on" | "off") {
    startTransition(async () => {
      await setOrgFeatureOverride(orgId, key, mode);
      router.refresh();
    });
  }

  return (
    <div className={pending ? "opacity-60 pointer-events-none transition-opacity" : "transition-opacity"}>
      {/* Global */}
      <section className="mb-8">
        <h2 className="font-display text-lg tracking-wide text-foreground mb-1">Global</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Desligar aqui remove a feature de <strong>todos os clubes</strong> (nav + telas).
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {features.map((f) => {
            const on = globalEnabled(f.key);
            return (
              <li
                key={f.key}
                className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2.5 bg-card"
              >
                <span className="text-sm text-foreground">{f.label}</span>
                <button
                  type="button"
                  onClick={() => toggleGlobal(f.key)}
                  role="switch"
                  aria-checked={on}
                  aria-label={`${f.label}: ${on ? "ligado" : "desligado"}`}
                  className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
                    on ? "bg-primary" : "bg-destructive"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      on ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Exceções por clube */}
      <section>
        <h2 className="font-display text-lg tracking-wide text-foreground mb-1">Exceções por clube</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Sobrescreve o global só naquele clube. <em>Herdar</em> volta a seguir o global.
        </p>
        <div className="flex flex-col gap-4">
          {orgs.map((org) => (
            <details key={org.id} className="border border-border rounded-lg bg-card">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground select-none">
                {org.name} <span className="text-muted-foreground">· {org.slug}</span>
              </summary>
              <ul className="px-4 pb-4 grid gap-2 sm:grid-cols-2">
                {features.map((f) => (
                  <li key={f.key} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground truncate">{f.label}</span>
                    <select
                      value={overrideMode(org.id, f.key)}
                      onChange={(e) => changeOverride(org.id, f.key, e.target.value as "inherit" | "on" | "off")}
                      className="form-select bg-input border border-border rounded-md px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring shrink-0"
                    >
                      <option value="inherit">Herdar</option>
                      <option value="on">Ligado</option>
                      <option value="off">Desligado</option>
                    </select>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
