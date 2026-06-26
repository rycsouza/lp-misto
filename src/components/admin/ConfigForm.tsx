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

export function ConfigFormBundle({
  tiers,
  types,
  selectedCodes,
}: {
  tiers: BundleTier[];
  types: { code: string; name: string }[];
  selectedCodes: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  // codes selecionados; vazio = todos os tipos elegíveis
  const [selected, setSelected] = useState<string[]>(selectedCodes);

  const pctFor = (games: number) => tiers.find((t) => t.games === games)?.pct ?? 0;

  function toggleCode(code: string) {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pct2 = Math.max(0, Math.min(100, Number(fd.get("bundlePct2")) || 0));
    const pct3 = Math.max(0, Math.min(100, Number(fd.get("bundlePct3")) || 0));

    const next: BundleTier[] = [];
    if (pct2 > 0) next.push({ games: 2, pct: pct2 });
    if (pct3 > 0) next.push({ games: 3, pct: pct3 });

    // Só guarda os códigos que ainda existem no catálogo
    const validCodes = selected.filter((c) => types.some((t) => t.code === c));

    startTransition(async () => {
      await updateConfigValues({
        ticketBundleTiers: JSON.stringify(next),
        ticketBundleTypeCodes: JSON.stringify(validCodes),
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
      {/* Tipos elegíveis ao combo */}
      <div>
        <p className="text-sm text-foreground font-medium mb-1">Aplicar o desconto em quais tipos?</p>
        <p className="text-xs text-muted-foreground mb-2">
          O combo conta os jogos e desconta apenas os tipos marcados. Ex.: marque só
          &quot;Inteira&quot; para não dar desconto na meia-entrada. Nenhum marcado = todos os tipos.
        </p>
        {types.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Cadastre os tipos de ingresso no catálogo acima primeiro.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {types.map((t) => {
              const on = selected.includes(t.code);
              return (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => toggleCode(t.code)}
                  className={`text-sm rounded-full px-3 py-1.5 border transition-colors ${
                    on
                      ? "bg-primary/15 border-primary/40 text-primary font-semibold"
                      : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Desconto por quantidade de jogos diferentes no carrinho. Deixe 0% para desativar.
        Quando há promoção ativa de ingressos, vale o maior desconto entre os dois.
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
  siteName: string;
  faviconUrl: string;
  whatsapp: string;
  email: string;
  instagram: string;
  clubLogoUrl: string;
}

export function ConfigFormContact({
  siteName,
  faviconUrl,
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
    const siteNameVal = (form.elements.namedItem("siteName") as HTMLInputElement).value.trim();
    const faviconVal = (form.elements.namedItem("faviconUrl") as HTMLInputElement).value;
    const whatsappVal = (form.elements.namedItem("whatsapp") as HTMLInputElement).value;
    const emailVal = (form.elements.namedItem("email") as HTMLInputElement).value;
    const instagramVal = (form.elements.namedItem("instagram") as HTMLInputElement).value;
    const clubLogoVal = (form.elements.namedItem("clubLogoUrl") as HTMLInputElement).value;

    startTransition(async () => {
      await updateConfigValues({
        siteName: siteNameVal,
        faviconUrl: faviconVal,
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
        <div className="sm:col-span-2">
          <label htmlFor="siteName" className="text-sm text-muted-foreground mb-1 block">
            Nome do Site
          </label>
          <input
            id="siteName"
            name="siteName"
            type="text"
            defaultValue={siteName}
            className={inputClass}
            placeholder="Misto Esporte Clube - Três Lagoas/MS"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Exibido na aba do navegador e nos metadados de compartilhamento.
          </p>
        </div>
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
        <div className="sm:col-span-2">
          <ImageUpload
            name="faviconUrl"
            defaultValue={faviconUrl}
            label="Favicon (ícone da aba)"
            folder="misto"
            aspectRatio="1:1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Ícone exibido na aba do navegador. Recomendado: PNG quadrado, mínimo 64×64px.
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

// ─── Frete ───────────────────────────────────────────────────────────────────

interface ConfigFormShippingProps {
  originCep: string;
  shippingEnabled: boolean;
  shippingFreeAboveCents: number;
}

export function ConfigFormShipping({ originCep, shippingEnabled, shippingFreeAboveCents }: ConfigFormShippingProps) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [enabled, setEnabled] = useState(shippingEnabled);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const cep = (fd.get("shippingOriginCep") as string).replace(/\D/g, "");
    const freeAbove = parseFloat((fd.get("shippingFreeAbove") as string) || "0");
    startTransition(async () => {
      await updateConfigValues({
        shippingEnabled: String(enabled),
        shippingOriginCep: cep,
        shippingFreeAboveCents: String(Math.round((freeAbove || 0) * 100)),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  function formatCep(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return digits;
  }

  const inputClass =
    "bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring w-full";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Toggle ativo/inativo */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-border"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`}
          />
        </div>
        <span className="text-sm text-foreground font-medium">
          {enabled ? "Frete habilitado" : "Frete desabilitado"}
        </span>
      </label>
      <p className="text-xs text-muted-foreground -mt-2">
        Quando desabilitado, o step de entrega é pulado no checkout e nenhuma cobrança de frete é adicionada.
      </p>

      {/* CEP de origem */}
      <div className="max-w-xs">
        <label htmlFor="shippingOriginCep" className="text-sm text-muted-foreground mb-1 block">
          CEP de origem *
        </label>
        <input
          id="shippingOriginCep"
          name="shippingOriginCep"
          type="text"
          inputMode="numeric"
          defaultValue={formatCep(originCep)}
          onChange={(e) => { e.target.value = formatCep(e.target.value); }}
          maxLength={9}
          className={inputClass}
          placeholder="79000-000"
        />
        <p className="text-xs text-muted-foreground mt-1">
          CEP de onde os produtos serão despachados. Usado para calcular o frete via Melhor Envio.
        </p>
      </div>

      {/* Frete grátis acima de */}
      <div className="max-w-xs">
        <label htmlFor="shippingFreeAbove" className="text-sm text-muted-foreground mb-1 block">
          Frete grátis acima de
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">R$</span>
          <input
            id="shippingFreeAbove"
            name="shippingFreeAbove"
            type="number"
            step="0.01"
            min="0"
            defaultValue={shippingFreeAboveCents > 0 ? (shippingFreeAboveCents / 100).toFixed(2) : ""}
            className={`${inputClass} pl-9`}
            placeholder="0,00"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Quando o subtotal do pedido atingir esse valor, a opção &quot;Frete Grátis&quot; aparece no checkout. Use 0 para desativar.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Configure também a variável <code className="bg-secondary px-1 rounded">MELHOR_ENVIO_TOKEN</code> nas
        variáveis de ambiente com o token de acesso do Melhor Envio.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Salvando..." : "Salvar Frete"}
        </button>
        {saved && <span className="text-sm text-green-600">Salvo!</span>}
      </div>
    </form>
  );
}

// ─── Retirada (pontos de retirada de produtos) ───────────────────────────────

interface PickupLocationDraft {
  id: string;
  name: string;
  address: string;
  hours: string;
}

interface ConfigFormPickupProps {
  pickupEnabled: boolean;
  locations: PickupLocationDraft[];
}

export function ConfigFormPickup({ pickupEnabled, locations }: ConfigFormPickupProps) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [enabled, setEnabled] = useState(pickupEnabled);
  const [items, setItems] = useState<PickupLocationDraft[]>(
    locations.length > 0 ? locations : []
  );

  function addLocation() {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", address: "", hours: "7h às 17h" },
    ]);
  }

  function removeLocation(id: string) {
    setItems((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLocation(id: string, field: keyof PickupLocationDraft, value: string) {
    setItems((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Só guarda locais com nome preenchido; remove espaços supérfluos
    const clean = items
      .map((l) => ({
        id: l.id,
        name: l.name.trim(),
        address: l.address.trim(),
        hours: l.hours.trim(),
      }))
      .filter((l) => l.name);

    startTransition(async () => {
      await updateConfigValues({
        pickupEnabled: String(enabled),
        pickupLocations: JSON.stringify(clean),
      });
      setItems(clean);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  const inputClass =
    "bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring w-full";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Toggle ativo/inativo */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-border"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`}
          />
        </div>
        <span className="text-sm text-foreground font-medium">
          {enabled ? "Retirada habilitada" : "Retirada desabilitada"}
        </span>
      </label>
      <p className="text-xs text-muted-foreground -mt-2">
        Quando habilitada, o aviso de retirada aparece ao final da compra de produtos e nos e-mails de retirada.
      </p>

      {/* Lista de locais */}
      <div className="flex flex-col gap-3">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum local cadastrado. Adicione ao menos um ponto de retirada.
          </p>
        )}
        {items.map((loc, idx) => (
          <div
            key={loc.id}
            className="border border-border rounded-lg p-4 flex flex-col gap-3 bg-secondary/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Local {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeLocation(loc.id)}
                className="text-xs text-destructive hover:underline"
              >
                Remover
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Nome do local *</label>
                <input
                  type="text"
                  value={loc.name}
                  onChange={(e) => updateLocation(loc.id, "name", e.target.value)}
                  className={inputClass}
                  placeholder="Ex: Sede do clube"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Horário</label>
                <input
                  type="text"
                  value={loc.hours}
                  onChange={(e) => updateLocation(loc.id, "hours", e.target.value)}
                  className={inputClass}
                  placeholder="7h às 17h"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm text-muted-foreground mb-1 block">Endereço</label>
                <input
                  type="text"
                  value={loc.address}
                  onChange={(e) => updateLocation(loc.id, "address", e.target.value)}
                  className={inputClass}
                  placeholder="Rua, número, bairro — cidade/UF"
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addLocation}
          className="self-start text-sm text-primary hover:underline font-semibold"
        >
          + Adicionar local
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Salvando..." : "Salvar Retirada"}
        </button>
        {saved && <span className="text-sm text-green-600">Salvo!</span>}
      </div>
    </form>
  );
}

// ─── Gateway ─────────────────────────────────────────────────────────────────

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
