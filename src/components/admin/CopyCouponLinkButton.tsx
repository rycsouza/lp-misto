"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

interface CopyCouponLinkButtonProps {
  code: string;
  appliesTo: "order" | "tickets" | "products";
}

export function CopyCouponLinkButton({ code, appliesTo }: CopyCouponLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  function getUrl() {
    const base = window.location.origin;
    const path = appliesTo === "products" ? "/checkout/produtos" : "/ingresso";
    return `${base}${path}?cupom=${encodeURIComponent(code)}`;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copiar link do cupom"
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary"
    >
      {copied ? <Check size={13} className="text-green-500" /> : <Link2 size={13} />}
      {copied ? "Copiado!" : "Copiar link"}
    </button>
  );
}
