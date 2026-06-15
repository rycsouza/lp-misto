"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

interface FlashSaleBannerProps {
  name: string;
  endsAt: string; // ISO string
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function FlashSaleBanner({ name, endsAt }: FlashSaleBannerProps) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(endsAt).getTime() - Date.now())
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
      setRemaining(ms);
      if (ms === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (remaining === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3">
      <div className="flex items-center gap-2">
        <Zap size={18} className="text-red-500 shrink-0" fill="currentColor" />
        <p className="text-foreground font-semibold text-sm">
          <span className="text-red-500">Flash Sale:</span> {name}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Termina em</span>
        <span className="font-mono font-bold text-red-500 text-sm tabular-nums">
          {formatCountdown(remaining)}
        </span>
      </div>
    </div>
  );
}
