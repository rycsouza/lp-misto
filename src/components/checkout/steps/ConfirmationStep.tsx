"use client";

import Link from "next/link";
import { CheckCircle, XCircle, MapPin } from "lucide-react";
import type { PickupLocation } from "@/lib/config";

interface ConfirmationStepProps {
  success: boolean;
  orderId?: string;
  successMessage?: string;
  onRetry?: () => void;
  whatsapp?: string;
  pickupLocations?: PickupLocation[];
  // Links da tela de sucesso (default = comportamento do checkout de ingressos/produtos).
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function ConfirmationStep({
  success,
  orderId,
  successMessage,
  onRetry,
  whatsapp,
  pickupLocations = [],
  primaryHref = "/",
  primaryLabel = "Voltar ao início",
  secondaryHref = "/pedidos",
  secondaryLabel = "Meus Pedidos",
}: ConfirmationStepProps) {
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

        {pickupLocations.length > 0 && (
          <div className="text-left bg-secondary/40 border border-border rounded-xl p-5 mb-6 max-w-md mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={18} className="text-primary shrink-0" />
              <h3 className="font-semibold text-foreground">
                Retirada {pickupLocations.length > 1 ? "nos pontos abaixo" : "no local abaixo"}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Assim que seu pedido estiver pronto, você poderá retirá-lo apresentando o
              código de validação (disponível em <span className="text-foreground font-medium">Meus Pedidos</span>).
            </p>
            <ul className="flex flex-col gap-3">
              {pickupLocations.map((loc) => (
                <li key={loc.id} className="text-sm">
                  <span className="block text-foreground font-semibold">{loc.name}</span>
                  {loc.address && (
                    <span className="block text-muted-foreground">{loc.address}</span>
                  )}
                  {loc.hours && (
                    <span className="block text-muted-foreground">Horário: {loc.hours}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={secondaryHref}
            className="inline-block px-8 py-3 border border-primary text-primary font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/10 transition-colors"
          >
            {secondaryLabel}
          </Link>
          <Link
            href={primaryHref}
            className="inline-block px-8 py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors"
          >
            {primaryLabel}
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
