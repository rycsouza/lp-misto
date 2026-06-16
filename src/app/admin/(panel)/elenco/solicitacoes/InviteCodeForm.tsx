"use client";

import { useState, useTransition } from "react";
import { setAthleteInviteCode } from "@/app/actions/athletes";
import { Check, Loader2 } from "lucide-react";

export function InviteCodeForm({ current }: { current: string }) {
  const [code, setCode] = useState(current);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await setAthleteInviteCode(code);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <form onSubmit={handleSave} className="flex gap-2 items-center">
      <input
        className="bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring w-48"
        placeholder="Código de acesso"
        value={code}
        onChange={(e) => { setCode(e.target.value); setSaved(false); }}
      />
      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
        {saved ? "Salvo!" : "Salvar"}
      </button>
    </form>
  );
}
