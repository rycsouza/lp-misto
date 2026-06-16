"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Check, BellRing, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/hooks/useCart";
import { joinWaitlist } from "@/app/actions/waitlist";

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );
}

function formatWhatsApp(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

interface ColorVariant {
  color: string | null;
  colorImageUrl: string | null;
}

interface ShopProductCardProps {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  priceCents: number;
  salePriceCents?: number | null;
  onSale?: boolean;
  variantCount: number;
  colorVariants: ColorVariant[];
  comingSoon?: boolean;
}

// ─── Waitlist inline form ────────────────────────────────────────────────────

function WaitlistForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await joinWaitlist({ productId, name, email, whatsapp: whatsapp.replace(/\D/g, "") });
    setLoading(false);
    if (result.success) {
      onDone();
    } else {
      setError(result.error ?? "Erro ao entrar na lista.");
    }
  }

  const inputCls = "w-full bg-background border border-border rounded-md px-2.5 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 px-4 pb-4 pt-2 border-t border-border bg-secondary/20">
      <p className="text-[11px] text-muted-foreground">Avise-me quando lançar:</p>
      <input
        type="text"
        placeholder="Seu nome"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className={inputCls}
      />
      <input
        type="email"
        placeholder="E-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className={inputCls}
      />
      <input
        type="tel"
        placeholder="WhatsApp"
        value={whatsapp}
        onChange={(e) => setWhatsapp(formatWhatsApp(e.target.value))}
        required
        className={inputCls}
      />
      {error && <p className="text-[10px] text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : null}
        Entrar na lista
      </button>
    </form>
  );
}

// ─── Main card ───────────────────────────────────────────────────────────────

export function ShopProductCard({
  id,
  slug,
  name,
  imageUrl,
  salePriceCents,
  onSale,
  priceCents,
  variantCount,
  colorVariants,
  comingSoon = false,
}: ShopProductCardProps) {
  const [added, setAdded] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistDone, setWaitlistDone] = useState(false);
  const { addItem } = useCart();
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const carouselImages: string[] = colorVariants
    .map((v) => v.colorImageUrl)
    .filter((url): url is string => !!url);
  if (carouselImages.length === 0 && imageUrl) carouselImages.push(imageUrl);

  const hasCarousel = carouselImages.length > 1;

  useEffect(() => {
    if (!hasCarousel || paused) return;
    intervalRef.current = setInterval(() => {
      setActiveIdx((i) => (i + 1) % carouselImages.length);
    }, 2500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [hasCarousel, paused, carouselImages.length]);

  function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault();
    if (comingSoon) return;
    if (variantCount > 0) {
      router.push(`/loja/${slug}`);
      return;
    }
    addItem({
      productId: id,
      slug,
      name,
      imageUrl: activeImage ?? imageUrl,
      priceCents,
      variantId: null,
      color: null,
      size: null,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  const activeImage = carouselImages[activeIdx] ?? null;

  return (
    <article className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-[0_0_15px_rgba(193,154,90,0.4)] transition-all group">
      <Link
        href={comingSoon ? "#" : `/loja/${slug}`}
        className="block relative h-48 bg-secondary overflow-hidden"
        aria-label={name}
        onClick={comingSoon ? (e) => e.preventDefault() : undefined}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {carouselImages.length > 0 ? (
          <>
            {carouselImages.map((src, i) => (
              <Image
                key={src}
                src={src}
                alt={i === 0 ? name : `${name} — variante ${i + 1}`}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className={`object-cover absolute inset-0 transition-opacity duration-700 ease-in-out ${comingSoon ? "opacity-50" : ""}`}
                style={{ opacity: i === activeIdx ? (comingSoon ? 0.5 : 1) : 0 }}
              />
            ))}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="font-[family-name:var(--font-bebas-neue)] text-4xl text-muted-foreground">
              MEC
            </span>
          </div>
        )}

        {/* Dot indicators */}
        {hasCarousel && !comingSoon && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 pointer-events-none">
            {carouselImages.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === activeIdx ? "bg-white scale-125" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        )}

        {/* Coming soon badge */}
        {comingSoon && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-card/90 backdrop-blur-sm text-foreground text-sm font-bold px-4 py-1.5 rounded-full border border-border uppercase tracking-widest">
              Em Breve
            </span>
          </div>
        )}

        {/* Sale badge */}
        {onSale && !comingSoon && (
          <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
            Promoção
          </span>
        )}

        {/* Quick-add button — hidden when coming soon */}
        {!comingSoon && (
          <button
            onClick={handleQuickAdd}
            aria-label={variantCount > 0 ? "Selecionar opções" : "Adicionar ao carrinho"}
            className="absolute bottom-2 right-2 w-9 h-9 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
          >
            {added ? <Check size={16} /> : <ShoppingCart size={16} />}
          </button>
        )}
      </Link>

      <div className="p-4">
        <h3 className="font-semibold text-sm text-foreground mb-1 line-clamp-2">{name}</h3>

        {/* Color dots */}
        {colorVariants.length > 1 && (
          <div className="flex gap-1 mb-2 flex-wrap">
            {colorVariants.map((v, i) => (
              <span
                key={i}
                title={v.color ?? undefined}
                className="text-[10px] text-muted-foreground border border-border rounded px-1 leading-4"
              >
                {v.color ?? "—"}
              </span>
            ))}
          </div>
        )}

        {onSale && salePriceCents && !comingSoon ? (
          <div className="flex flex-col mb-3">
            <p className="text-muted-foreground text-xs line-through leading-tight">{formatPrice(priceCents)}</p>
            <p className="text-primary font-bold text-lg leading-tight">{formatPrice(salePriceCents)}</p>
          </div>
        ) : (
          <p className={`font-bold text-lg mb-3 ${comingSoon ? "text-muted-foreground" : "text-primary"}`}>
            {formatPrice(priceCents)}
          </p>
        )}

        {comingSoon ? (
          <button
            onClick={() => setWaitlistOpen((v) => !v)}
            className="block w-full text-center py-2 bg-secondary border border-border text-foreground text-sm font-semibold rounded-md hover:bg-secondary/80 transition-colors flex items-center justify-center gap-1.5"
          >
            <BellRing size={14} />
            Avise-me
            {waitlistOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        ) : (
          <Link
            href={`/loja/${slug}`}
            className="block w-full text-center py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors"
          >
            Comprar
          </Link>
        )}
      </div>

      {/* Waitlist form — expands below the card body */}
      {comingSoon && waitlistOpen && (
        waitlistDone ? (
          <div className="px-4 pb-4 pt-2 border-t border-border bg-secondary/20 flex items-center gap-2">
            <Check size={14} className="text-green-500 shrink-0" />
            <p className="text-xs text-green-500 font-medium">Você está na lista! Entraremos em contato quando lançar.</p>
          </div>
        ) : (
          <WaitlistForm productId={id} onDone={() => setWaitlistDone(true)} />
        )
      )}
    </article>
  );
}
