"use client";

import { useTransition, useState } from "react";
import { updateConfigValues, setActiveGateway } from "@/app/actions/admin";
import { ImageUpload } from "./ImageUpload";
import type { BundleTier } from "@/lib/promotions/bundle";

interface ConfigFormPricesProps {
  inteiraCents: number;
  meiaCents: number;
  meiaEligibilityLabel: string;
}

export function ConfigFormPrices({
  inteiraCents,
  meiaCents,
  meiaEligibilityLabel,
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
    const meiaLabel = (
      form.elements.namedItem("meiaEligibilityLabel") as HTMLTextAreaElement
    ).value.trim();

    if (isNaN(inteira) || isNaN(meia)) return;

    startTransition(async () => {
      await updateConfigValues({
        ticketPriceInteiraCents: String(Math.round(inteira * 100)),
        ticketPriceMeiaCents: String(Math.round(meia * 100)),
        meiaEligibilityLabel: meiaLabel,
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
            Ingresso Inteira *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
              R$
            </span>
            <input
              id="ticketPriceInteira"
              name="ticketPriceInteira"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={(inteiraCents / 100).toFixed(2)}
              className={`${inputClass} pl-9`}
              placeholder="0,00"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="ticketPriceMeia"
            className="text-sm text-muted-foreground mb-1 block"
          >
            Ingresso Meia *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
              R$
            </span>
            <input
              id="ticketPriceMeia"
              name="ticketPriceMeia"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={(meiaCents / 100).toFixed(2)}
              className={`${inputClass} pl-9`}
              placeholder="0,00"
            />
          </div>
        </div>
      </div>

      <div>
        <label
          htmlFor="meiaEligibilityLabel"
          className="text-sm text-muted-foreground mb-1 block"
        >
          Quem tem direito à meia-entrada
        </label>
        <textarea
          id="meiaEligibilityLabel"
          name="meiaEligibilityLabel"
          rows={2}
          maxLength={300}
          defaultValue={meiaEligibilityLabel}
          className={inputClass}
          placeholder="Ex: Idosos acima de 60 anos e estudantes com carteirinha de estudante"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Exibido no checkout junto da opção de meia-entrada. Pode ser
          sobrescrito por jogo na tela de edição do jogo.
        </p>
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

// ─── Combo de jogos (desconto por nº de jogos) ───────────────────────────────

export function ConfigFormBundle({ tiers }: { tiers: BundleTier[] }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const pctFor = (games: number) => tiers.find((t) => t.games === games)?.pct ?? 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pct2 = Math.max(0, Math.min(100, Number(fd.get("bundlePct2")) || 0));
    const pct3 = Math.max(0, Math.min(100, Number(fd.get("bundlePct3")) || 0));

    const next: BundleTier[] = [];
    if (pct2 > 0) next.push({ games: 2, pct: pct2 });
    if (pct3 > 0) next.push({ games: 3, pct: pct3 });

    startTransition(async () => {
      await updateConfigValues({ ticketBundleTiers: JSON.stringify(next) });
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
          <label htmlFor="bundlePct2" className="text-sm text-muted-foreground mb-1 block">
            Comprando 2 jogos
          </label>
          <div className="relative">
            <input
              id="bundlePct2"
              name="bundlePct2"
              type="number"
              min="0"
              max="100"
              step="1"
              defaultValue={pctFor(2) || ""}
              className={`${inputClass} pr-8`}
              placeholder="0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
              %
            </span>
          </div>
        </div>
        <div>
          <label htmlFor="bundlePct3" className="text-sm text-muted-foreground mb-1 block">
            Comprando 3 ou mais jogos
          </label>
          <div className="relative">
            <input
              id="bundlePct3"
              name="bundlePct3"
              type="number"
              min="0"
              max="100"
              step="1"
              defaultValue={pctFor(3) || ""}
              className={`${inputClass} pr-8`}
              placeholder="0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
              %
            </span>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Desconto aplicado sobre o total de ingressos conforme a quantidade de jogos
        diferentes no carrinho. Deixe 0 para desativar. Quando há promoção ativa de
        ingressos, vale o maior desconto entre os dois.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Salvando..." : "Salvar Combo"}
        </button>
        {saved && <span className="text-sm text-green-600">Salvo com sucesso!</span>}
      </div>
    </form>
  );
}

interface ConfigFormContactProps {
  whatsapp: string;
  email: string;
  instagram: string;
  clubLogoUrl: string;
}

export function ConfigFormContact({
  whatsapp,
  email,
  instagram,
  clubLogoUrl,
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
    const clubLogoVal = (
      form.elements.namedItem("clubLogoUrl") as HTMLInputElement
    ).value;

    startTransition(async () => {
      await updateConfigValues({
        whatsapp: whatsappVal,
        email: emailVal,
        instagram: instagramVal,
        clubLogoUrl: clubLogoVal,
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
            type="tel"
            defaultValue={whatsapp}
            className={inputClass}
            placeholder="+5567999999999"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Com código do país, ex: +5567999990000
          </p>
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
        <div className="sm:col-span-2">
          <ImageUpload
            name="clubLogoUrl"
            defaultValue={clubLogoUrl}
            label="Escudo / Logo do Clube"
            folder="misto"
            aspectRatio="1:1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Usado no cabeçalho, rodapé, jogos, compartilhamento e em todo lugar
            que exibe o escudo do clube.
          </p>
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

// ─── Session Duration ─────────────────────────────────────────────────────────

interface ConfigFormSecurityProps {
  sessionDurationHours: number;
}

export function ConfigFormSecurity({ sessionDurationHours }: ConfigFormSecurityProps) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const hours = fd.get("sessionDurationHours") as string;
    startTransition(async () => {
      await updateConfigValues({ sessionDurationHours: hours });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  const inputClass =
    "bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring w-full";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="sessionDurationHours"
          className="text-sm text-muted-foreground mb-1 block"
        >
          Duração da sessão *
        </label>
        <select
          id="sessionDurationHours"
          name="sessionDurationHours"
          defaultValue={String(sessionDurationHours)}
          className={inputClass}
        >
          <option value="1">1 hora</option>
          <option value="8">8 horas</option>
          <option value="24">24 horas (padrão)</option>
          <option value="168">7 dias</option>
          <option value="720">30 dias</option>
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          Tempo até o token expirar e o usuário precisar fazer login novamente.
          Aplica-se apenas nos próximos logins.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Salvando..." : "Salvar Configuração"}
        </button>
        {saved && <span className="text-sm text-green-600">Salvo!</span>}
      </div>
    </form>
  );
}

// ─── Shop ─────────────────────────────────────────────────────────────────────

interface ConfigFormShopProps {
  lowStockThreshold: number;
}

export function ConfigFormShop({ lowStockThreshold }: ConfigFormShopProps) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const threshold = fd.get("shopLowStockThreshold") as string;
    startTransition(async () => {
      await updateConfigValues({ shopLowStockThreshold: threshold });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  const inputClass =
    "bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring w-full";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="shopLowStockThreshold"
          className="text-sm text-muted-foreground mb-1 block"
        >
          Limiar de estoque baixo
        </label>
        <input
          id="shopLowStockThreshold"
          name="shopLowStockThreshold"
          type="number"
          min="0"
          step="1"
          defaultValue={lowStockThreshold}
          className={inputClass}
          placeholder="0"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Produtos com estoque total ≤ esse valor exibem o badge &quot;Estoque
          limitado&quot;. Use 0 para desativar o badge.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Salvando..." : "Salvar"}
        </button>
        {saved && <span className="text-sm text-green-600">Salvo!</span>}
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
