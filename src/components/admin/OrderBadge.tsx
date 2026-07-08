"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const LS_KEY = "lastSeenOrdersAt";
const POLL_MS = 60_000;

export function OrderBadge({ className }: { className?: string }) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/admin/pedidos")) {
      localStorage.setItem(LS_KEY, new Date().toISOString());
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCount(0);
    }
  }, [pathname]);

  useEffect(() => {
    let active = true;

    async function check() {
      // Aba em segundo plano → não consulta (economiza invocação de função na Vercel).
      if (document.hidden) return;
      try {
        const since = localStorage.getItem(LS_KEY) ?? new Date(0).toISOString();
        const res = await fetch(`/api/admin/orders/new-count?since=${encodeURIComponent(since)}`);
        if (!res.ok || !active) return;
        const data = await res.json();
        setCount(data.count ?? 0);
      } catch {
        // silently ignore polling errors
      }
    }

    check();
    const id = setInterval(check, POLL_MS);
    const onVisible = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (count === 0) return null;

  return (
    <span className={className ?? "ml-auto min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-1"}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
