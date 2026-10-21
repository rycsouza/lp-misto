import type { CSSProperties } from "react";
import { safeCardColor } from "@/lib/membership/plan-benefits";
import { cardTextColor } from "@/lib/membership/card-visual";
import { isRenderableMemberPhotoSrc, memberInitials } from "@/lib/membership/member-photo";
import type { WallCard } from "@/lib/membership/wall";

/**
 * Carrossel do Mural dos Sócios: um só, com todos os planos misturados. Cada cartão mostra
 * a foto (ou o avatar com as iniciais na cor do plano), a etiqueta do plano, o nome curto e
 * a data de adesão. Só CSS (sem JS no cliente): os keyframes e o reduced-motion estão em
 * globals.css (bloco "Mural dos Sócios").
 *
 * Servidor-puro: a decisão de animar depende só da quantidade (conhecida aqui).
 */

/** Abaixo disso não há faixa: os cartões ficam centralizados, sem movimento. */
export const WALL_MARQUEE_MIN = 6;

/** Cópias mínimas da sequência em cada faixa (a faixa curta ganha mais, ver wallRowSets). */
export const WALL_MARQUEE_SETS = 3;

/** Largura de tela usada para dimensionar a faixa (cobre notebooks e monitores comuns). */
const VIEWPORT_MAX_PX = 1440;

/**
 * Passo mínimo de um cartão na faixa: menor largura (w-36 = 144 px) + margem (12 px). Usar o
 * mínimo garante que a faixa é sempre larga o bastante para a tela (ver wallRowSets).
 */
const CARD_STEP_PX = 156;

/** Segundos por cartão que passa pelo ponto fixo (velocidade igual em todas as faixas). */
const SECONDS_PER_CARD = 4.5;

/** Inclinação leve, em graus, escolhida pelo índice do cartão (determinística). */
const TILTS_DEG = [-2, 1.5, -1, 2, -1.5, 0.5] as const;

/** Formato da foto: altura variada entre os cartões. Classes literais para o Tailwind gerar. */
const PHOTO_SHAPES = ["aspect-square", "aspect-[4/5]", "aspect-[5/6]"] as const;

/** Faixas: 2 até 11 sócios, 3 a partir de 12. */
export function wallRowCount(n: number): number {
  if (n < WALL_MARQUEE_MIN) return 1;
  return n >= 12 ? 3 : 2;
}

export function wallMarqueePlan(count: number): { animate: boolean; rows: number } {
  return { animate: count >= WALL_MARQUEE_MIN, rows: wallRowCount(count) };
}

/**
 * Cópias (sets) de uma faixa. Para não aparecer o fim da faixa, `(sets - 1) * larguraDoSet`
 * precisa cobrir a tela: faixa curta recebe mais cópias. Mínimo: WALL_MARQUEE_SETS.
 */
export function wallRowSets(cardsInRow: number): number {
  return Math.max(WALL_MARQUEE_SETS, Math.ceil(VIEWPORT_MAX_PX / (cardsInRow * CARD_STEP_PX)) + 1);
}

/**
 * Distribui os cartões nas faixas em rodízio: cada sócio aparece em UMA faixa só (sem repetir
 * nome na mesma faixa nem na leitura de tela).
 */
export function splitWallRows<T>(items: T[], rows: number): T[][] {
  const out: T[][] = Array.from({ length: rows }, () => []);
  items.forEach((item, i) => out[i % rows].push(item));
  return out;
}

type IndexedCard = { card: WallCard; index: number };

function WallCardItem({ card, index }: IndexedCard) {
  const color = safeCardColor(card.cardColor);
  // Defesa em profundidade: só a URL de entrega de foto de sócio chega a <img src>.
  const photo = isRenderableMemberPhotoSrc(card.photoUrl) ? card.photoUrl : null;
  const shape = PHOTO_SHAPES[index % PHOTO_SHAPES.length];
  const tilt = TILTS_DEG[index % TILTS_DEG.length];
  // Flutuar: cada cartão com duração e fase próprias, para não subirem todos juntos.
  const floatStyle: CSSProperties = {
    animationDuration: `${5 + (index % 3) * 0.7}s`,
    animationDelay: `${-((index * 0.9) % 5)}s`,
  };
  // Texto da etiqueta/iniciais com contraste calculado sobre a cor do plano (cor clara → texto escuro).
  const tagStyle: CSSProperties | undefined = color ? { backgroundColor: color, color: cardTextColor(color) } : undefined;

  return (
    <li className="relative w-36 shrink-0 sm:w-40" style={{ rotate: `${tilt}deg` }}>
      <div
        className="mural-float flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-md"
        style={floatStyle}
      >
        <div className={`relative w-full overflow-hidden bg-muted ${shape}`}>
          {photo ? (
            // Foto decorativa: o nome logo abaixo já identifica o sócio, então alt vazio evita
            // a leitura duplicada. A imagem já vem otimizada do Cloudinary (q_auto, f_auto).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              width={512}
              height={512}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className={`flex h-full w-full items-center justify-center text-3xl font-bold ${
                color ? "" : "text-muted-foreground"
              }`}
              style={tagStyle}
            >
              {memberInitials(card.name)}
            </span>
          )}
          <span
            className={`absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              color ? "" : "bg-secondary text-foreground"
            }`}
            style={tagStyle}
          >
            {card.planName}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5 p-2.5 text-center">
          <span className="line-clamp-2 break-words text-balance text-sm font-semibold leading-tight text-foreground">
            {card.name}
          </span>
          <span className="text-[11px] text-muted-foreground">{`Sócio desde ${card.since}`}</span>
        </div>
      </div>
    </li>
  );
}

function WallRow({ label, items, reverse }: { label: string; items: IndexedCard[]; reverse: boolean }) {
  const sets = wallRowSets(items.length);
  const duration = items.length * SECONDS_PER_CARD;
  const renderSet = (hidden: boolean, key: string) => (
    <ul key={key} aria-hidden={hidden ? "true" : undefined} className={hidden ? "mural-set mural-clone" : "mural-set"}>
      {items.map((item) => (
        <WallCardItem key={`${item.index}-${item.card.name}`} card={item.card} index={item.index} />
      ))}
    </ul>
  );

  return (
    // Região rolável e focável: o foco pausa a animação e, sem movimento, permite rolar.
    <div role="region" aria-label={label} tabIndex={0} className="mural-row">
      <div
        className={`mural-track mural-animate ${reverse ? "mural-animate-rev" : "mural-animate-fwd"}`}
        style={
          {
            animationDuration: `${duration}s`,
            "--mural-sets": sets,
          } as CSSProperties
        }
      >
        {/* Lista real: única parte lida por leitor de tela. */}
        {renderSet(false, "real")}
        {/* Cópias de preenchimento do loop: ocultas para leitor de tela e sem foco. */}
        {Array.from({ length: sets - 1 }, (_, k) => renderSet(true, `clone-${k}`))}
      </div>
    </div>
  );
}

export function WallCarousel({
  label,
  cards,
}: {
  /** Nome acessível do mural (ex.: "Sócios do clube"). */
  label: string;
  cards: WallCard[];
}) {
  const indexed: IndexedCard[] = cards.map((card, index) => ({ card, index }));
  const plan = wallMarqueePlan(cards.length);

  if (!plan.animate) {
    return (
      <ul className="flex flex-wrap justify-center gap-4 py-2">
        {indexed.map((item) => (
          <WallCardItem key={`${item.index}-${item.card.name}`} card={item.card} index={item.index} />
        ))}
      </ul>
    );
  }

  const rows = splitWallRows(indexed, plan.rows);
  return (
    <div className="flex flex-col gap-4">
      {rows.map((items, r) => (
        <WallRow
          key={`row-${r}`}
          label={`${label}, faixa ${r + 1} de ${rows.length}`}
          items={items}
          reverse={r % 2 === 1}
        />
      ))}
    </div>
  );
}
