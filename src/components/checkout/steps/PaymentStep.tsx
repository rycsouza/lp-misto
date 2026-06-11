"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check } from "lucide-react";
import { checkPaymentStatus } from "@/app/actions/checkout";

interface PaymentStepProps {
  pixQrCode: string;
  pixQrCodeUrl?: string;
  paymentId: string;
  totalCents: number;
  onPaid: () => void;
  onFailed: () => void;
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );
}

export function PaymentStep({
  pixQrCode,
  pixQrCodeUrl,
  paymentId,
  totalCents,
  onPaid,
  onFailed,
}: PaymentStepProps) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30 * 60);

  const poll = useCallback(async () => {
    const status = await checkPaymentStatus(paymentId);
    if (status === "paid") onPaid();
    else if (status === "failed" || status === "refunded") onFailed();
  }, [paymentId, onPaid, onFailed]);

  useEffect(() => {
    const pollInterval = setInterval(poll, 5000);
    const timerInterval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(pollInterval);
          clearInterval(timerInterval);
          onFailed();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      clearInterval(pollInterval);
      clearInterval(timerInterval);
    };
  }, [poll, onFailed]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(pixQrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div>
      <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">
        Pagamento via PIX
      </h2>
      <p className="text-muted-foreground text-sm mb-6">
        Escaneie o QR Code ou copie o código para pagar.
      </p>

      <div className="text-center mb-6">
        <p className="text-3xl font-bold text-primary mb-4">{formatPrice(totalCents)}</p>

        <div className="flex justify-center mb-4">
          <div className="bg-white rounded-xl p-3 inline-block">
            {pixQrCodeUrl ? (
              <div className="relative w-44 h-44">
                <Image
                  src={pixQrCodeUrl}
                  alt="QR Code PIX"
                  fill
                  sizes="176px"
                  className="object-contain"
                />
              </div>
            ) : (
              <QRCodeSVG value={pixQrCode} size={176} />
            )}
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-2 mx-auto px-4 py-2 bg-secondary text-foreground text-sm rounded-md hover:bg-secondary/80 transition-colors"
        >
          {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} />}
          {copied ? "Copiado!" : "Copiar código PIX"}
        </button>
      </div>

      <div className="p-4 bg-card border border-border rounded-xl text-center mb-6">
        <p className="text-xs text-muted-foreground mb-1">Tempo restante</p>
        <p className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary">
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Aguardando confirmação do pagamento...
        </p>
      </div>

      <div className="flex justify-center">
        <div className="flex gap-1.5 items-center text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Verificando pagamento automaticamente
        </div>
      </div>
    </div>
  );
}
