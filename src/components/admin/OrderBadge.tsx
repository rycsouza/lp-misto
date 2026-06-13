"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const LS_KEY = "lastSeenOrdersAt";
const POLL_MS = 30_000;

export function OrderBadge({ className }: { className?: string }) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/admin/pedidos")) {
      localStorage.setItem(LS_KEY, new Date().toISOString());
      setCount(0);
    }
  }, [pathname]);

  useEffect(() => {
    let active = true;

    async function check() {
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
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (count === 0) return null;

  return (
    <span className={className ?? "ml-auto min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-1"}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
