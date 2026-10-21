import type { CSSProperties } from "react";
import { Crown } from "lucide-react";
import { isRenderableMemberPhotoSrc, memberInitials } from "@/lib/membership/member-photo";
import {
  sortByTier,
  wallCardFill,
  wallCardSizeClass,
  wallRank,
  wallTierCount,
} from "@/lib/membership/wall-tier";
import type { WallCard } from "@/lib/membership/wall";

/**
 * Mural dos Sócios: um só, com todos os planos misturados e hierarquia pelo preço.
 *
 * - Poucos sócios (abaixo de WALL_MARQUEE_MIN): "palco". O topo (plano mais caro) fica numa
 *   fileira própria, centralizada e maior; os demais vêm abaixo. No celular, tudo vira uma
 *   fileira horizontal com encaixe por cartão (scroll-snap), topo primeiro.
 * - Muitos sócios: faixas animadas, uma por linha, com os cartões do topo maiores. No celular,
 *   a animação e as cópias somem e cada faixa vira uma fileira rolável com encaixe.
 *
 * Cada cartão mostra a foto (ou o avatar com as iniciais), a etiqueta do plano, o nome curto e
 * a data de adesão. Só CSS no cliente (sem JS): keyframes, encaixe e reduced-motion estão em
 * globals.css (bloco "Mural dos Sócios").
 *
 * Servidor-puro: a decisão de animar depende só da quantidade (conhecida aqui).
 */

/** Abaixo disso é o palco (sem faixa). A partir daqui, faixas animadas. */
export const WALL_MARQUEE_MIN = 10;

/** Cópias mínimas da sequência em cada faixa (a faixa curta ganha mais, ver wallRowSets). */
export const WALL_MARQUEE_SETS = 3;

/** Largura de tela usada para dimensionar a faixa (cobre notebooks e monitores comuns). */
const VIEWPORT_MAX_PX = 1440;

/**
 * Passo mínimo de um cartão na faixa: menor largura (w-36 = 144 px) + margem (12 px). Os cartões
 * maiores só alargam a faixa, então o mínimo continua garantindo a cobertura da tela.
 */
const CARD_STEP_PX = 156;

/** Segundos por cartão que passa pelo ponto fixo (velocidade igual em todas as faixas). */
const SECONDS_PER_CARD = 4.5;

/** Inclinação leve, em graus, escolhida pelo índice do cartão (determinística). Topo sem inclinação. */
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
 * nome na mesma faixa nem na leitura de tela). Com a lista já ordenada por nível, cada faixa
 * começa pelos cartões do topo.
 */
export function splitWallRows<T>(items: T[], rows: number): T[][] {
  const out: T[][] = Array.from({ length: rows }, () => []);
  items.forEach((item, i) => out[i % rows].push(item));
  return out;
}

type IndexedCard = { card: WallCard; index: number };

function WallCardItem({ card, index, tierCount }: IndexedCard & { tierCount: number }) {
  const rank = wallRank(card.tier, tierCount);
  const isTop = rank === "top";
  const fill = wallCardFill(card.cardColor, card.tier);
  // Defesa em profundidade: só a URL de entrega de foto de sócio chega a <img src>.
  const photo = isRenderableMemberPhotoSrc(card.photoUrl) ? card.photoUrl : null;
  const shape = PHOTO_SHAPES[index % PHOTO_SHAPES.length];
  const tilt = isTop ? 0 : TILTS_DEG[index % TILTS_DEG.length];
  // Flutuar: cada cartão com duração e fase próprias, para não subirem todos juntos.
  const floatStyle: CSSProperties = {
    animationDuration: `${5 + (index % 3) * 0.7}s`,
    animationDelay: `${-((index * 0.9) % 5)}s`,
  };
  // Topo: anel e brilho na cor de destaque do plano (ou do ouro de reserva).
  const topStyle: CSSProperties | undefined = isTop
    ? {
        borderColor: fill.accent,
        boxShadow: `0 0 0 2px ${fill.accent}, 0 16px 36px -12px ${fill.accent}aa`,
      }
    : undefined;

  return (
    <li
      className={`relative shrink-0 ${wallCardSizeClass(card.tier, tierCount)}`}
      style={{ rotate: `${tilt}deg` }}
    >
      <div
        className="mural-float flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-md"
        style={{ ...floatStyle, ...topStyle }}
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
              className={`flex h-full w-full items-center justify-center font-bold ${
                isTop ? "text-4xl" : "text-3xl"
              }`}
              style={{ background: fill.background, color: fill.text }}
            >
              {memberInitials(card.name)}
            </span>
          )}
          {isTop && (
            <span aria-hidden="true" className="mural-shine pointer-events-none absolute inset-0" />
          )}
          <span
            className="absolute left-2 top-2 z-10 inline-flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shadow-sm"
            style={{ background: fill.background, color: fill.text }}
          >
            {isTop && <Crown aria-hidden="true" className="size-3 shrink-0" strokeWidth={2.5} />}
            <span className="truncate">{card.planName}</span>
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5 p-2.5 text-center">
          <span
            className={`line-clamp-2 break-words text-balance font-semibold leading-tight text-foreground ${
              isTop ? "text-base" : "text-sm"
            }`}
          >
            {card.name}
          </span>
          <span className="text-[11px] text-muted-foreground">{`Sócio desde ${card.since}`}</span>
        </div>
      </div>
    </li>
  );
}

/** Legenda dos planos, do mais caro ao mais barato, com a contagem de sócios em cada um. */
function WallLegend({ cards, tierCount }: { cards: WallCard[]; tierCount: number }) {
  const chips = new Map<string, { name: string; tier: number; count: number; cardColor: string | null }>();
  for (const card of cards) {
    const key = `${card.tier}|${card.planName}`;
    const chip = chips.get(key);
    if (chip) chip.count++;
    else chips.set(key, { name: card.planName, tier: card.tier, count: 1, cardColor: card.cardColor });
  }
  const list = [...chips.values()].sort(
    (a, b) => a.tier - b.tier || a.name.localeCompare(b.name, "pt-BR")
  );

  return (
    <ul aria-label="Planos do mural, do mais caro ao mais barato" className="flex flex-wrap justify-center gap-2">
      {list.map((chip) => {
        const fill = wallCardFill(chip.cardColor, chip.tier);
        const isTop = wallRank(chip.tier, tierCount) === "top";
        return (
          <li
            key={`${chip.tier}|${chip.name}`}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground"
          >
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: fill.accent }} />
            {isTop && <Crown aria-hidden="true" className="size-3 shrink-0" strokeWidth={2.5} />}
            <span className="font-semibold">{chip.name}</span>
            <span className="text-muted-foreground">{`${chip.count} ${chip.count === 1 ? "sócio" : "sócios"}`}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Palco (poucos sócios): topo numa fileira própria no centro; no celular, uma fileira com encaixe. */
function WallStage({ label, items, tierCount }: { label: string; items: IndexedCard[]; tierCount: number }) {
  const isTop = (item: IndexedCard) => wallRank(item.card.tier, tierCount) === "top";
  const top = items.filter(isTop);
  const rest = items.filter((item) => !isTop(item));
  const renderItem = (item: IndexedCard) => (
    <WallCardItem key={`${item.index}-${item.card.name}`} card={item.card} index={item.index} tierCount={tierCount} />
  );

  return (
    // Região rolável no celular (encaixe): focável para o teclado rolar.
    <div role="region" aria-label={label} tabIndex={0} className="mural-stage">
      {top.length > 0 && <ul className="mural-stage-top">{top.map(renderItem)}</ul>}
      {rest.length > 0 && <ul className="mural-stage-rest">{rest.map(renderItem)}</ul>}
    </div>
  );
}

function WallRow({
  label,
  items,
  reverse,
  tierCount,
}: {
  label: string;
  items: IndexedCard[];
  reverse: boolean;
  tierCount: number;
}) {
  const sets = wallRowSets(items.length);
  const duration = items.length * SECONDS_PER_CARD;
  const renderSet = (hidden: boolean, key: string) => (
    <ul key={key} aria-hidden={hidden ? "true" : undefined} className={hidden ? "mural-set mural-clone" : "mural-set"}>
      {items.map((item) => (
        <WallCardItem
          key={`${item.index}-${item.card.name}`}
          card={item.card}
          index={item.index}
          tierCount={tierCount}
        />
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
  const ordered = sortByTier(cards);
  const tierCount = wallTierCount(ordered.map((card) => card.tier));
  const indexed: IndexedCard[] = ordered.map((card, index) => ({ card, index }));
  const plan = wallMarqueePlan(cards.length);

  return (
    <div className="flex flex-col gap-8">
      <WallLegend cards={ordered} tierCount={tierCount} />
      {plan.animate ? (
        <div className="flex flex-col gap-4">
          {splitWallRows(indexed, plan.rows).map((items, r, rows) => (
            <WallRow
              key={`row-${r}`}
              label={`${label}, faixa ${r + 1} de ${rows.length}`}
              items={items}
              reverse={r % 2 === 1}
              tierCount={tierCount}
            />
          ))}
        </div>
      ) : (
        <WallStage label={label} items={indexed} tierCount={tierCount} />
      )}
    </div>
  );
}
