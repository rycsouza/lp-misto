"use client";

import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";

interface ConfirmationStepProps {
  success: boolean;
  orderId?: string;
  successMessage?: string;
  onRetry?: () => void;
  whatsapp?: string;
}

export function ConfirmationStep({ success, orderId, successMessage, onRetry, whatsapp }: ConfirmationStepProps) {
  if (success) {
    return (
      <div className="text-center py-8">
        <CheckCircle size={64} className="text-primary mx-auto mb-4" />
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground mb-2">
          Pagamento Confirmado!
        </h2>
        <p className="text-muted-foreground text-sm mb-4">
          {successMessage ?? "Seu ingresso foi gerado com sucesso. Você receberá uma confirmação no seu e-mail."}
        </p>
        {orderId && (
          <p className="text-xs text-muted-foreground mb-6">
            Pedido: <span className="font-mono text-foreground">{orderId.slice(0, 8).toUpperCase()}</span>
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/pedidos"
            className="inline-block px-8 py-3 border border-primary text-primary font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/10 transition-colors"
          >
            Meus Pedidos
          </Link>
          <Link
            href="/"
            className="inline-block px-8 py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-8">
      <XCircle size={64} className="text-destructive mx-auto mb-4" />
      <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground mb-2">
        Pagamento não confirmado
      </h2>
      <p className="text-muted-foreground text-sm mb-6">
        Não conseguimos confirmar seu pagamento. Tente novamente ou entre em contato.
      </p>
      <div className="flex gap-3 justify-center">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-lg rounded-md hover:bg-primary/90 transition-colors"
          >
            Tentar Novamente
          </button>
        )}
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-secondary text-foreground font-[family-name:var(--font-bebas-neue)] text-lg rounded-md hover:bg-secondary/80 transition-colors"
          >
            Falar no WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
