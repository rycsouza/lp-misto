"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cancelExpiredAndGetOldestPending } from "@/app/actions/admin";

const LS_KEY = "misto_oldest_pending_ts";
const THIRTY_MIN_MS = 30 * 60 * 1000;

export function OrderExpiryWatcher() {
  const router = useRouter();

  useEffect(() => {
    const cached = localStorage.getItem(LS_KEY);

    if (cached) {
      const age = Date.now() - new Date(cached).getTime();
      if (age < THIRTY_MIN_MS) return; // oldest pending is still fresh — skip
    }

    cancelExpiredAndGetOldestPending().then(({ oldestPendingCreatedAt }) => {
      if (oldestPendingCreatedAt) {
        localStorage.setItem(LS_KEY, oldestPendingCreatedAt);
      } else {
        localStorage.removeItem(LS_KEY);
      }
      router.refresh();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
