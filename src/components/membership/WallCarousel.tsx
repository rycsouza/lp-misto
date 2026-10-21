"use client";

import Link from "next/link";
import { Crown, Plus } from "lucide-react";
import { type CSSProperties, type FocusEvent, type MouseEvent, type PointerEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isRenderableMemberPhotoSrc, memberInitials } from "@/lib/membership/member-photo";
import {
  arrangeWall,
  sortByTier,
  wallCardFill,
  wallRank,
  wallTierCount,
  wallTileStyle,
  type WallRank,
} from "@/lib/membership/wall-tier";
import type { WallCard } from "@/lib/membership/wall";

/**
 * Mural dos Sócios: mosaico denso. Cada sócio é um tile pequeno (foto circular ou iniciais na
 * cor do plano) com o primeiro nome embaixo. Os tiles andam em fileiras (marquee) de sentidos
 * alternados. Ao tocar, clicar ou focar um tile, abre um balão com nome, plano e data.
 *
 * - Completa até MOSAIC_MIN_TILES com vagas "Seu lugar" (links para /socios/adesao), que não são
 *   pessoas: nunca se repete um sócio só para encher a tela.
 * - A lista real (sócios + vagas) é lida uma vez; as cópias do loop são aria-hidden e sem foco.
 * - Movimento: CSS (globals.css, bloco "Mural dos Sócios"). Com prefers-reduced-motion, a grade
 *   fica estática e os tiles quebram linha.
 */

/** Fileiras em marquee: as mesmas em todos os tamanhos de tela. */
export const MOSAIC_ROWS = 6;

/**
 * Tiles por fileira no mínimo (sócios + vagas). 16 × ~100 px (passo do desktop) ≈ 1600 px,
 * mais largo que a tela: assim a CÓPIA do loop nunca aparece ao mesmo tempo que o original —
 * o mesmo sócio não surge duas vezes na tela, mesmo com poucos sócios.
 */
export const MOSAIC_ROW_LENGTH = 16;

/** Total mínimo de tiles do mosaico (sócios + vagas). Abaixo disso, o resto vira vaga. */
export const MOSAIC_MIN_TILES = MOSAIC_ROWS * MOSAIC_ROW_LENGTH;

/** Menor passo de um tile na fileira: slot do celular (w-17 = 68 px) + espaço (4 px). */
const MOSAIC_MIN_STEP_PX = 72;

/** Cópias mínimas da sequência em cada fileira. */
const MOSAIC_MIN_SETS = 3;

/** Maior largura de tela coberta pela fileira (notebooks e monitores comuns). */
const VIEWPORT_MAX_PX = 1440;

/** Segundos por tile que passa pelo ponto fixo: cada fileira tem ritmo levemente diferente. */
const ROW_SECONDS_PER_TILE = [3.2, 2.7, 3.6, 2.9, 3.4, 2.6, 3.1, 3.8] as const;

/** Slot fixo de cada tile: o círculo maior cabe nele e o passo da fileira não muda com o nível. */
const SLOT_CLASS = "w-17 sm:w-24";

const POPOVER_WIDTH_PX = 208;
const POPOVER_GAP_PX = 8;
/** Abaixo desta altura do topo da tela, o balão abre por baixo do tile (senão, por cima). */
const POPOVER_ABOVE_MIN_TOP_PX = 120;

const VAGA_HREF = "/socios/adesao";

/**
 * Intercala as vagas (null) entre os itens, em posições espalhadas e determinísticas. As
 * posições são distintas porque o total nunca é menor que o número de vagas.
 */
export function interleaveVacancies<T>(items: readonly T[], vacancies: number): (T | null)[] {
  const total = items.length + vacancies;
  const vagaAt = new Set<number>();
  for (let k = 0; k < vacancies; k++) vagaAt.add(Math.floor(((k + 0.5) * total) / vacancies));
  let next = 0;
  return Array.from({ length: total }, (_, i) => (vagaAt.has(i) ? null : items[next++]));
}

/** Distribui os itens em rodízio entre as fileiras: a posição vira a coluna dentro da fileira. */
export function splitMosaicRows<T>(items: readonly T[], rows: number): T[][] {
  const out: T[][] = Array.from({ length: rows }, () => []);
  items.forEach((item, i) => out[i % rows].push(item));
  return out;
}

/**
 * Cópias (sets) de uma fileira. Com (sets - 1) larguras de set, a tela inteira fica coberta sem
 * ponta visível. Fileira curta recebe mais cópias.
 */
export function mosaicRowSets(tilesInRow: number): number {
  return Math.max(MOSAIC_MIN_SETS, Math.ceil(VIEWPORT_MAX_PX / (tilesInRow * MOSAIC_MIN_STEP_PX)) + 1);
}

export type MosaicTile = { kind: "socio"; card: WallCard; rank: WallRank } | { kind: "vaga" };

const VAGA_TILE: MosaicTile = { kind: "vaga" };

/**
 * Fileiras do mosaico. Os sócios são distribuídos em rodízio pelas fileiras (cada fileira recebe
 * a sua fatia da ordem de `arrangeWall`, então cada uma pega um topo quando há topos suficientes).
 * Depois, cada fileira completa até MOSAIC_ROW_LENGTH com vagas, espalhadas dentro dela. Como cada
 * fileira tem no máximo MOSAIC_ROW_LENGTH sócios quando há menos de MOSAIC_MIN_TILES, o total fica
 * em MOSAIC_MIN_TILES sem sócio repetido.
 */
export function buildMosaicRows(cards: readonly WallCard[]): MosaicTile[][] {
  const tierCount = wallTierCount(cards.map((card) => card.tier));
  // Ordem por nível (estável) + rodízio entre fileiras: os sócios do topo caem um por fileira
  // (fileiras 1, 2, 3…), depois os demais. arrangeWall espaça o topo numa lista ÚNICA; com o
  // rodízio, esse espaçamento podia coincidir com o nº de fileiras e juntar o topo em poucas.
  const socios: MosaicTile[] = sortByTier(arrangeWall(cards)).map((card) => ({
    kind: "socio",
    card,
    rank: wallRank(card.tier, tierCount),
  }));
  return splitMosaicRows(socios, MOSAIC_ROWS).map((items) =>
    interleaveVacancies(items, Math.max(0, MOSAIC_ROW_LENGTH - items.length)).map((t) => t ?? VAGA_TILE)
  );
}

export interface PopoverAnchor {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface PopoverPosition {
  left: number;
  top: number;
  above: boolean;
}

/** Posição do balão (fixa na tela): centralizado no tile, dentro da largura da tela. */
export function popoverPosition(anchor: PopoverAnchor, viewportWidth: number): PopoverPosition {
  const center = (anchor.left + anchor.right) / 2;
  const maxLeft = viewportWidth - POPOVER_WIDTH_PX - POPOVER_GAP_PX;
  const left = Math.min(Math.max(center - POPOVER_WIDTH_PX / 2, POPOVER_GAP_PX), maxLeft);
  const above = anchor.top > POPOVER_ABOVE_MIN_TOP_PX;
  return { left, top: above ? anchor.top - POPOVER_GAP_PX : anchor.bottom + POPOVER_GAP_PX, above };
}

/** Primeiro nome, para o rótulo pequeno do tile ("Maria S." vira "Maria"). */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

/** Conteúdo do balão: nome curto, plano e data de adesão. Nada além disso. */
export function WallBalloon({ id, card }: { id: string; card: WallCard }) {
  const fill = wallCardFill(card.cardColor, card.tier);
  return (
    <div
      id={id}
      role="tooltip"
      className="rounded-xl border border-border border-t-[3px] bg-card p-3 text-left shadow-lg"
      style={{ borderTopColor: fill.accent }}
    >
      <p className="break-words text-sm font-semibold text-foreground">{card.name}</p>
      <p className="text-xs font-semibold text-foreground">{card.planName}</p>
      <p className="text-xs text-muted-foreground">{`Sócio desde ${card.since}`}</p>
    </div>
  );
}

/** Círculo do sócio: foto (validada) ou iniciais na cor do plano, com anel e coroa no topo. */
function SocioFace({ card, rank }: { card: WallCard; rank: WallRank }) {
  const fill = wallCardFill(card.cardColor, card.tier);
  const { ringPx } = wallTileStyle(rank);
  const isTop = rank === "top";
  // Defesa em profundidade: só a URL de entrega de foto de sócio chega a <img src>.
  const photo = isRenderableMemberPhotoSrc(card.photoUrl) ? card.photoUrl : null;
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden rounded-full border-solid bg-muted"
        style={{
          borderWidth: ringPx,
          borderColor: fill.accent,
          boxShadow: isTop ? `0 0 12px 2px ${fill.accent}99` : undefined,
        }}
      >
        {photo ? (
          // Foto decorativa: o nome do tile (e o balão) já identificam o sócio, então alt vazio.
          // A imagem já vem otimizada do Cloudinary (q_auto, f_auto).
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
            className={`flex h-full w-full items-center justify-center font-bold ${isTop ? "text-base" : "text-sm"}`}
            style={{ background: fill.background, color: fill.text }}
          >
            {memberInitials(card.name)}
          </span>
        )}
      </span>
      {isTop && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 z-10 flex size-5 items-center justify-center rounded-full shadow-sm"
          style={{ background: fill.accent, color: fill.text }}
        >
          <Crown className="size-3" strokeWidth={2.5} />
        </span>
      )}
    </>
  );
}

/**
 * Tile interativo (só na lista real). Abre o balão com clique/toque, com foco pelo teclado (Tab)
 * e com o ponteiro do mouse parado sobre ele. Fecha com Esc, clique fora, rolagem ou saída do foco.
 */
function WallSocioButton({ card, rank }: { card: WallCard; rank: WallRank }) {
  const id = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState<PopoverPosition | null>(null);
  const open = pinned || hovered;
  const { size } = wallTileStyle(rank);

  // Medir o tile no evento (não no render): a posição do balão é fixa na tela.
  const place = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) {
      setPos(popoverPosition({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }, window.innerWidth));
    }
  };

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setPinned(false);
      setHovered(false);
    };
    // Esc só fecha. Não move o foco: focar de novo reabriria o balão (foco por teclado abre).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointerDown = (e: globalThis.PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    // detail 0 = clique gerado pelo teclado (Enter/Espaço): sempre abre. Mouse e toque alternam.
    if (e.detail === 0) {
      place();
      setPinned(true);
    } else if (pinned) {
      setPinned(false);
      setHovered(false);
    } else {
      place();
      setPinned(true);
    }
  };

  const onFocus = (e: FocusEvent<HTMLButtonElement>) => {
    if (e.currentTarget.matches(":focus-visible")) {
      place();
      setPinned(true);
    }
  };

  const onPointerEnter = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse") {
      place();
      setHovered(true);
    }
  };

  const onPointerLeave = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse") setHovered(false);
  };

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={`${card.name}, ${card.planName}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={onClick}
        onFocus={onFocus}
        onBlur={() => setPinned(false)}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        className={`relative flex shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${size}`}
      >
        <SocioFace card={card} rank={rank} />
      </button>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50"
            style={{
              left: pos.left,
              top: pos.top,
              width: POPOVER_WIDTH_PX,
              transform: pos.above ? "translateY(-100%)" : undefined,
            }}
          >
            <WallBalloon id={id} card={card} />
          </div>,
          document.body
        )}
    </>
  );
}

/** Tile de sócio. Interativo na lista real; nas cópias do loop, só visual (aria-hidden, sem foco). */
function SocioTile({ card, rank, interactive }: { card: WallCard; rank: WallRank; interactive: boolean }) {
  const { size } = wallTileStyle(rank);
  return (
    <li className={`flex flex-col items-center gap-1 ${SLOT_CLASS}`}>
      {interactive ? (
        <WallSocioButton card={card} rank={rank} />
      ) : (
        <span aria-hidden="true" className={`relative flex shrink-0 items-center justify-center rounded-full ${size}`}>
          <SocioFace card={card} rank={rank} />
        </span>
      )}
      <span aria-hidden="true" className="block w-full truncate text-center text-[10px] leading-none text-foreground">
        {firstName(card.name)}
      </span>
    </li>
  );
}

/** Vaga "Seu lugar": link real para a adesão (na lista real), ou só visual nas cópias. */
function VagaTile({ interactive }: { interactive: boolean }) {
  const face = (
    <span
      aria-hidden="true"
      className="flex size-14 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/60 text-muted-foreground sm:size-18"
    >
      <Plus className="size-5" strokeWidth={2} />
    </span>
  );
  return (
    <li className={`flex flex-col items-center gap-1 ${SLOT_CLASS}`}>
      {interactive ? (
        <Link
          href={VAGA_HREF}
          aria-label="Seja sócio — seu lugar no mural"
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {face}
        </Link>
      ) : (
        face
      )}
      <span aria-hidden="true" className="block w-full truncate text-center text-[10px] leading-none text-primary">
        Seu lugar
      </span>
    </li>
  );
}

/** Uma fileira: a lista real (lida uma vez) e as cópias do loop (aria-hidden, sem foco). */
function MosaicRow({ tiles, index }: { tiles: MosaicTile[]; index: number }) {
  const sets = mosaicRowSets(tiles.length);
  const duration = tiles.length * ROW_SECONDS_PER_TILE[index % ROW_SECONDS_PER_TILE.length];
  const reverse = index % 2 === 1;

  const renderSet = (interactive: boolean, key: string) => (
    <ul
      key={key}
      aria-hidden={interactive ? undefined : "true"}
      className={interactive ? "mural-set" : "mural-set mural-clone"}
    >
      {tiles.map((tile, i) =>
        tile.kind === "vaga" ? (
          <VagaTile key={`v-${i}`} interactive={interactive} />
        ) : (
          <SocioTile
            key={`s-${i}-${tile.card.name}`}
            card={tile.card}
            rank={tile.rank}
            interactive={interactive}
          />
        )
      )}
    </ul>
  );

  return (
    <div className="mural-row">
      <div
        className={`mural-track mural-animate ${reverse ? "mural-animate-rev" : "mural-animate-fwd"}`}
        style={
          {
            animationDuration: `${duration}s`,
            // Fase própria por fileira: as fileiras não começam alinhadas.
            animationDelay: `${-index * 1.7}s`,
            "--mural-sets": sets,
          } as CSSProperties
        }
      >
        {renderSet(true, "real")}
        {Array.from({ length: sets - 1 }, (_, k) => renderSet(false, `clone-${k}`))}
      </div>
    </div>
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

export function WallCarousel({
  label,
  cards,
}: {
  /** Nome acessível do mural (ex.: "Sócios do clube"). */
  label: string;
  cards: WallCard[];
}) {
  const tierCount = wallTierCount(cards.map((card) => card.tier));
  const rows = buildMosaicRows(cards);

  return (
    <div className="flex flex-col gap-6">
      <WallLegend cards={cards} tierCount={tierCount} />
      <div role="region" aria-label={label} className="flex flex-col gap-1 sm:gap-2">
        {rows.map((tiles, r) => (
          <MosaicRow key={r} tiles={tiles} index={r} />
        ))}
      </div>
    </div>
  );
}
