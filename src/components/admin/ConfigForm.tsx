"use client";

import { useTransition, useState } from "react";
import { updateConfigValues, setActiveGateway } from "@/app/actions/admin";

interface ConfigFormPricesProps {
  inteiraCents: number;
  meiaCents: number;
}

export function ConfigFormPrices({
  inteiraCents,
  meiaCents,
}: ConfigFormPricesProps) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const inteira = parseFloat(
      (form.elements.namedItem("ticketPriceInteira") as HTMLInputElement).value
    );
    const meia = parseFloat(
      (form.elements.namedItem("ticketPriceMeia") as HTMLInputElement).value
    );

    if (isNaN(inteira) || isNaN(meia)) return;

    startTransition(async () => {
      await updateConfigValues({
        ticketPriceInteiraCents: String(Math.round(inteira * 100)),
        ticketPriceMeiaCents: String(Math.round(meia * 100)),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  const inputClass =
    "bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring w-full";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="ticketPriceInteira"
            className="text-sm text-muted-foreground mb-1 block"
          >
            Ingresso Inteira (R$)
          </label>
          <input
            id="ticketPriceInteira"
            name="ticketPriceInteira"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={(inteiraCents / 100).toFixed(2)}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="ticketPriceMeia"
            className="text-sm text-muted-foreground mb-1 block"
          >
            Ingresso Meia (R$)
          </label>
          <input
            id="ticketPriceMeia"
            name="ticketPriceMeia"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={(meiaCents / 100).toFixed(2)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Salvando..." : "Salvar Preços"}
        </button>
        {saved && (
          <span className="text-sm text-green-600">Salvo com sucesso!</span>
        )}
      </div>
    </form>
  );
}

interface ConfigFormContactProps {
  whatsapp: string;
  email: string;
  instagram: string;
}

export function ConfigFormContact({
  whatsapp,
  email,
  instagram,
}: ConfigFormContactProps) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const whatsappVal = (
      form.elements.namedItem("whatsapp") as HTMLInputElement
    ).value;
    const emailVal = (form.elements.namedItem("email") as HTMLInputElement)
      .value;
    const instagramVal = (
      form.elements.namedItem("instagram") as HTMLInputElement
    ).value;

    startTransition(async () => {
      await updateConfigValues({
        whatsapp: whatsappVal,
        email: emailVal,
        instagram: instagramVal,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  const inputClass =
    "bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring w-full";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="whatsapp"
            className="text-sm text-muted-foreground mb-1 block"
          >
            WhatsApp
          </label>
          <input
            id="whatsapp"
            name="whatsapp"
            type="text"
            defaultValue={whatsapp}
            className={inputClass}
            placeholder="+5567999999999"
          />
        </div>
        <div>
          <label
            htmlFor="email"
            className="text-sm text-muted-foreground mb-1 block"
          >
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={email}
            className={inputClass}
            placeholder="contato@mistoec.com.br"
          />
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="instagram"
            className="text-sm text-muted-foreground mb-1 block"
          >
            Instagram (URL)
          </label>
          <input
            id="instagram"
            name="instagram"
            type="url"
            defaultValue={instagram}
            className={inputClass}
            placeholder="https://www.instagram.com/..."
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Salvando..." : "Salvar Dados do Clube"}
        </button>
        {saved && (
          <span className="text-sm text-green-600">Salvo com sucesso!</span>
        )}
      </div>
    </form>
  );
}

interface Gateway {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

interface ConfigFormGatewayProps {
  gateways: Gateway[];
}

export function ConfigFormGateway({ gateways }: ConfigFormGatewayProps) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [selectedId, setSelectedId] = useState(
    gateways.find((g) => g.active)?.id ?? ""
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;

    startTransition(async () => {
      await setActiveGateway(selectedId);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  if (gateways.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum gateway de pagamento cadastrado.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {gateways.map((gw) => (
          <label
            key={gw.id}
            className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
          >
            <input
              type="radio"
              name="gateway"
              value={gw.id}
              checked={selectedId === gw.id}
              onChange={() => setSelectedId(gw.id)}
              className="w-4 h-4"
            />
            <span className="text-sm text-foreground font-medium">
              {gw.name}
            </span>
            <span className="text-xs text-muted-foreground uppercase ml-1">
              ({gw.slug})
            </span>
            {gw.active && (
              <span className="ml-auto text-xs bg-green-500/15 text-green-600 px-2 py-0.5 rounded-full font-semibold">
                Ativo
              </span>
            )}
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || !selectedId}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Salvando..." : "Salvar Gateway"}
        </button>
        {saved && (
          <span className="text-sm text-green-600">Salvo com sucesso!</span>
        )}
      </div>
    </form>
  );
}
