"use client";

import Link from "next/link";
import { Crown, Plus } from "lucide-react";
import { type CSSProperties, type FocusEvent, type MouseEvent, type PointerEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isRenderableMemberPhotoSrc, memberInitials } from "@/lib/membership/member-photo";
import {
  arrangeWall,
  sortByTier,
  WALL_BOB_MAX_PX,
  WALL_DY_MAX_PX,
  WALL_VAGA_SIZE,
  wallCardFill,
  wallMinSlotPx,
  wallRank,
  wallRingPx,
  wallSizeAt,
  wallTierCount,
  wallTileLook,
  type WallRank,
  type WallTileLook,
} from "@/lib/membership/wall-tier";
import type { WallCard } from "@/lib/membership/wall";

/**
 * Mural dos Sócios: campo de bolhas orgânico. Cada sócio é um círculo (foto ou iniciais na cor do
 * plano) com o primeiro nome embaixo. O tamanho segue o nível (o plano mais caro é o maior); cada
 * bolha tem deslocamento vertical, margem, leve variação de tamanho e ritmo de flutuação próprios
 * (determinísticos, ver wall-tier.ts). Ao tocar, clicar ou focar uma bolha, abre um balão com nome,
 * plano e data.
 *
 * Dois modos, escolhidos no servidor (SSR) só pelo nº de sócios e pelas larguras mínimas, sem medir
 * o DOM (não pisca na hidratação). A largura usada na decisão é MOSAIC_VISIBLE_MAX_PX (o teto):
 * - ESTÁTICO (poucos sócios): todas as bolhas numa grade centralizada, com quebra de linha, sem
 *   marquee e sem cópias. Completa com vagas "Seu lugar" até MOSAIC_STATIC_TARGET_TILES. Vale quando a
 *   soma das larguras mínimas de todos os sócios + as vagas-alvo cabe em MOSAIC_VISIBLE_MAX_PX.
 * - CARROSSEL (muitos sócios): duas fileiras em marquee. Cada fileira precisa cumprir a regra
 *   anti-repetição (mosaicRuleHolds) na largura visível. Vagas entram só para cumprir essa regra, até
 *   MOSAIC_CAROUSEL_MAX_VACANCIES_PER_ROW por fileira. Se faltar mais que isso, o mural fica estático
 *   (com os sócios que tem, sem encher de vagas).
 * - Vagas "Seu lugar" são links para /socios/adesao, não são pessoas. As cópias do loop são
 *   aria-hidden e sem foco. Movimento: CSS (globals.css, bloco "Mural dos Sócios"). Com
 *   prefers-reduced-motion, as fileiras ficam estáticas (sem marquee e sem flutuação) e quebram linha.
 */

/** Fileiras em marquee (modo carrossel). */
export const MOSAIC_ROWS = 2;

/**
 * Largura visível do mural: max-w-6xl (72 rem = 1152 px). Teto da regra anti-repetição: com ele, a
 * sequência de cada fileira passa da tela em qualquer largura menor também.
 */
export const MOSAIC_VISIBLE_MAX_PX = 72 * 16;
export const MOSAIC_VISIBLE_CLASS = "max-w-6xl";

/** Maior largura visível no celular: abaixo de sm (640 px), com 16 px de margem de cada lado. */
export const MOSAIC_PHONE_VISIBLE_MAX_PX = 639 - 2 * 16;

/** Bolhas-alvo do modo estático (sócios + vagas): com poucos sócios, completa com vagas até aqui. */
export const MOSAIC_STATIC_TARGET_TILES = 12;

/** Vagas extras que uma fileira do carrossel aceita para cumprir a regra anti-repetição. */
export const MOSAIC_CAROUSEL_MAX_VACANCIES_PER_ROW = 4;

/** Quanto o brilho do topo (box-shadow 0 0 12px 2px) se estende para fora da bolha. */
export const MOSAIC_GLOW_PX = 14;

/**
 * Padding vertical de cada fileira (e do modo estático): cabe o deslocamento (até WALL_DY_MAX_PX para
 * cima ou para baixo), a flutuação (até WALL_BOB_MAX_PX, só para cima) e o brilho do topo. Assim nada
 * é cortado em cima nem embaixo.
 */
export const MOSAIC_PAD_PX = WALL_DY_MAX_PX + WALL_BOB_MAX_PX + MOSAIC_GLOW_PX;

/**
 * Espaço vertical entre duas linhas de bolhas (no modo estático e no movimento reduzido). É o que
 * impede a bolha de cima (descendo o máximo) de encostar na de baixo (subindo o máximo).
 */
export const MOSAIC_LINE_GAP_PX = 2 * WALL_DY_MAX_PX + WALL_BOB_MAX_PX;

/**
 * Encaixe entre fileiras (margem negativa): de forma que o espaço entre as bolhas de duas fileiras
 * seja MOSAIC_LINE_GAP_PX, no pior caso de deslocamento.
 */
export const MOSAIC_ROW_OVERLAP_PX = 2 * MOSAIC_PAD_PX - MOSAIC_LINE_GAP_PX;

/** Altura reservada embaixo de cada bolha para o nome (gap de 2 px + 10 px de texto). */
export const MOSAIC_LABEL_ZONE_PX = 12;

/** Cópias mínimas da sequência em cada fileira. */
const MOSAIC_MIN_SETS = 3;

/** Segundos por tile que passa pelo ponto fixo: cada fileira tem ritmo levemente diferente. */
const ROW_SECONDS_PER_TILE = [3.2, 2.7, 3.6, 2.9, 3.4, 2.6, 3.1, 3.8] as const;

const POPOVER_WIDTH_PX = 208;
const POPOVER_GAP_PX = 8;
/** Abaixo desta altura do topo da tela, o balão abre por baixo do tile (senão, por cima). */
const POPOVER_ABOVE_MIN_TOP_PX = 120;

const VAGA_HREF = "/socios/adesao";

/** Um tile do mosaico: sócio (com nível) ou vaga. `look` traz tamanho, posição e flutuação. */
export type MosaicTile =
  | { kind: "socio"; card: WallCard; rank: WallRank; look: WallTileLook }
  | { kind: "vaga"; look: WallTileLook };

/** Espaço mínimo que um item ocupa na fileira, por tela (ver wallMinSlotPx). */
export interface MinSlots {
  desktop: number;
  mobile: number;
}

/** Modo do mural: estático (grade com quebra de linha) ou carrossel (fileiras em marquee). */
export type MosaicMode = "static" | "carousel";

export interface MosaicLayout {
  mode: MosaicMode;
  /** Estático: uma lista só. Carrossel: uma por fileira. */
  rows: MosaicTile[][];
}

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
 * Largura mínima de uma fileira (soma, tile a tile, da margem mais o diâmetro mínimo), numa tela.
 * É o pior caso: tamanhos e margens mínimos.
 */
export function mosaicRowMinWidthPx(tiles: readonly MosaicTile[], screen: "mobile" | "desktop"): number {
  return tiles.reduce(
    (sum, tile) => sum + (screen === "mobile" ? tile.look.minSlotMobilePx : tile.look.minSlotDesktopPx),
    0
  );
}

/**
 * Regra anti-repetição de uma fileira, com os espaços MÍNIMOS de cada item: a soma de todos, menos a
 * maior bolha, tem de passar da área visível (no desktop e no celular). Assim, o mesmo sócio nunca
 * aparece duas vezes na tela, qualquer que seja o tamanho real (que nunca fica abaixo do mínimo).
 */
export function mosaicRuleHolds(slots: readonly MinSlots[]): boolean {
  if (slots.length === 0) return false;
  const holds = (widths: number[], visible: number) =>
    widths.reduce((sum, w) => sum + w, 0) - Math.max(...widths) >= visible;
  return (
    holds(slots.map((s) => s.desktop), MOSAIC_VISIBLE_MAX_PX) &&
    holds(slots.map((s) => s.mobile), MOSAIC_PHONE_VISIBLE_MAX_PX)
  );
}

/**
 * Cópias (sets) de uma fileira. Com (sets - 1) sequências, a área visível fica coberta sem ponta:
 * o marquee anda uma sequência por vez. Usa a largura MÍNIMA (a mais curta), então sobram cópias.
 */
export function mosaicRowSets(minRowWidthPx: number): number {
  return Math.max(MOSAIC_MIN_SETS, Math.ceil(MOSAIC_VISIBLE_MAX_PX / Math.max(1, minRowWidthPx)) + 1);
}

/** Altura de uma fileira (sem o padding): o maior tile com o nome embaixo. */
export function mosaicRowPitchPx(maxBubblePx: number): number {
  const content = maxBubblePx + MOSAIC_LABEL_ZONE_PX;
  return content + 2 * MOSAIC_PAD_PX - MOSAIC_ROW_OVERLAP_PX;
}

function socioMinSlots(tier: number, tierCount: number): MinSlots {
  const size = wallSizeAt(tier, tierCount);
  return { desktop: wallMinSlotPx(size.desktop), mobile: wallMinSlotPx(size.mobile) };
}

const VAGA_MIN_SLOTS: MinSlots = {
  desktop: wallMinSlotPx(WALL_VAGA_SIZE.desktop),
  mobile: wallMinSlotPx(WALL_VAGA_SIZE.mobile),
};

function socioTile(card: WallCard, tierCount: number, key: string): MosaicTile {
  return {
    kind: "socio",
    card,
    rank: wallRank(card.tier, tierCount),
    look: wallTileLook(key, wallSizeAt(card.tier, tierCount)),
  };
}

function vagaTile(key: string): MosaicTile {
  return { kind: "vaga", look: wallTileLook(key, WALL_VAGA_SIZE) };
}

/** Modo estático: todos os sócios, com vagas até MOSAIC_STATIC_TARGET_TILES (espalhadas entre eles). */
function staticTiles(socios: readonly WallCard[], tierCount: number): MosaicTile[] {
  const tiles = socios.map((card, i) => socioTile(card, tierCount, `socio|s|${i}|${card.name}|${card.planName}`));
  const vagas = Math.max(0, MOSAIC_STATIC_TARGET_TILES - socios.length);
  return interleaveVacancies(tiles, vagas).map((tile, i) => tile ?? vagaTile(`vaga|s|${i}`));
}

/**
 * Modo carrossel: cada fileira recebe a sua fatia dos sócios e, se faltar, vagas (no máximo
 * MOSAIC_CAROUSEL_MAX_VACANCIES_PER_ROW) até cumprir a regra anti-repetição. Se uma fileira não
 * cumprir a regra dentro desse limite, devolve null (o mural fica estático).
 */
function carouselRows(socios: readonly WallCard[], tierCount: number): MosaicTile[][] | null {
  const out: MosaicTile[][] = [];
  const split = splitMosaicRows(socios, MOSAIC_ROWS);
  for (let r = 0; r < split.length; r++) {
    const items = split[r];
    const slots = items.map((card) => socioMinSlots(card.tier, tierCount));
    let vagas = 0;
    while (!mosaicRuleHolds([...slots, ...Array.from({ length: vagas }, () => VAGA_MIN_SLOTS)])) {
      vagas++;
      if (vagas > MOSAIC_CAROUSEL_MAX_VACANCIES_PER_ROW) return null;
    }
    const tiles = items.map((card, i) => socioTile(card, tierCount, `socio|${r}|${i}|${card.name}|${card.planName}`));
    out.push(interleaveVacancies(tiles, vagas).map((tile, i) => tile ?? vagaTile(`vaga|${r}|${i}`)));
  }
  return out;
}

/**
 * Monta o mural: escolhe o modo (estático ou carrossel) e as posições de cada tile. Determinístico:
 * a mesma lista de sócios gera o mesmo layout, no servidor e no cliente.
 */
export function buildMosaic(cards: readonly WallCard[]): MosaicLayout {
  const tierCount = wallTierCount(cards.map((card) => card.tier));
  // Ordem por nível (estável), com o topo espalhado (ver arrangeWall).
  const socios = sortByTier(arrangeWall(cards));
  const sociosWidth = socios.reduce((sum, card) => sum + socioMinSlots(card.tier, tierCount).desktop, 0);
  const staticVagas = Math.max(0, MOSAIC_STATIC_TARGET_TILES - socios.length);
  if (sociosWidth + staticVagas * VAGA_MIN_SLOTS.desktop <= MOSAIC_VISIBLE_MAX_PX) {
    return { mode: "static", rows: [staticTiles(socios, tierCount)] };
  }
  const rows = carouselRows(socios, tierCount);
  return rows ? { mode: "carousel", rows } : { mode: "static", rows: [staticTiles(socios, tierCount)] };
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

/** Variáveis CSS do tile (lidas por globals.css): tamanhos por tela, posição, margem e flutuação. */
function tileStyle(look: WallTileLook): CSSProperties {
  return {
    "--tile-m": `${look.mobilePx}px`,
    "--tile-d": `${look.desktopPx}px`,
    "--dy": `${look.dyPx}px`,
    "--mx": `${look.marginPx}px`,
    "--bob-amp": `${look.bobAmpPx}px`,
    "--bob-dur": `${look.bobSec}s`,
    "--bob-delay": `${look.bobDelaySec}s`,
  } as CSSProperties;
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
  const ringPx = wallRingPx(rank);
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
 * Bolha interativa (só na lista real). Abre o balão com clique/toque, com foco pelo teclado (Tab)
 * e com o ponteiro do mouse parado sobre ela. Fecha com Esc, clique fora, rolagem ou saída do foco.
 */
function WallSocioButton({ card, rank }: { card: WallCard; rank: WallRank }) {
  const id = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState<PopoverPosition | null>(null);
  const open = pinned || hovered;

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
        className="mural-face mural-bob relative flex shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
function SocioTile({
  card,
  rank,
  look,
  interactive,
}: {
  card: WallCard;
  rank: WallRank;
  look: WallTileLook;
  interactive: boolean;
}) {
  return (
    <li className="mural-tile" style={tileStyle(look)}>
      {interactive ? (
        <WallSocioButton card={card} rank={rank} />
      ) : (
        <span aria-hidden="true" className="mural-face mural-bob relative flex shrink-0 items-center justify-center rounded-full">
          <SocioFace card={card} rank={rank} />
        </span>
      )}
      <span aria-hidden="true" className="block w-full truncate text-center text-[10px] leading-none text-foreground">
        {firstName(card.name)}
      </span>
    </li>
  );
}

const VAGA_FACE_CLASS =
  "mural-face mural-bob flex items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/60 text-muted-foreground";

/** Vaga "Seu lugar": link real para a adesão (na lista real), ou só visual nas cópias. */
function VagaTile({ look, interactive }: { look: WallTileLook; interactive: boolean }) {
  const icon = <Plus aria-hidden="true" className="size-5" strokeWidth={2} />;
  return (
    <li className="mural-tile" style={tileStyle(look)}>
      {interactive ? (
        <Link
          href={VAGA_HREF}
          aria-label="Seja sócio — seu lugar no mural"
          className={`${VAGA_FACE_CLASS} outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
        >
          {icon}
        </Link>
      ) : (
        <span aria-hidden="true" className={VAGA_FACE_CLASS}>
          {icon}
        </span>
      )}
      {/* No celular a vaga é pequena demais para o rótulo: o link já tem o nome acessível. */}
      <span aria-hidden="true" className="hidden w-full truncate text-center text-[10px] leading-none text-primary sm:block">
        Seu lugar
      </span>
    </li>
  );
}

/** Um tile (sócio ou vaga) com a sua chave de lista. */
function renderTile(tile: MosaicTile, interactive: boolean, key: string) {
  return tile.kind === "vaga" ? (
    <VagaTile key={key} look={tile.look} interactive={interactive} />
  ) : (
    <SocioTile key={key} card={tile.card} rank={tile.rank} look={tile.look} interactive={interactive} />
  );
}

/** Modo carrossel: uma fileira em marquee, com a lista real (lida uma vez) e as cópias do loop. */
function MosaicRow({ tiles, index }: { tiles: MosaicTile[]; index: number }) {
  const sets = mosaicRowSets(mosaicRowMinWidthPx(tiles, "mobile"));
  const duration = tiles.length * ROW_SECONDS_PER_TILE[index % ROW_SECONDS_PER_TILE.length];
  const reverse = index % 2 === 1;

  const renderSet = (interactive: boolean, key: string) => (
    <ul
      key={key}
      aria-hidden={interactive ? undefined : "true"}
      className={interactive ? "mural-set" : "mural-set mural-clone"}
    >
      {tiles.map((tile, i) => renderTile(tile, interactive, `${tile.kind}-${i}`))}
    </ul>
  );

  return (
    <div
      className="mural-row"
      style={{
        // Espaço vertical para a bolha deslocada (sem cortar) e encaixe com a fileira de cima.
        paddingBlock: MOSAIC_PAD_PX,
        marginTop: index > 0 ? -MOSAIC_ROW_OVERLAP_PX : undefined,
      }}
    >
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

/** Modo estático: todas as bolhas numa grade centralizada, com quebra de linha. Sem marquee e sem cópias. */
function MosaicStatic({ tiles }: { tiles: MosaicTile[] }) {
  return (
    <ul
      className="mural-static"
      style={{ paddingBlock: MOSAIC_PAD_PX, rowGap: MOSAIC_LINE_GAP_PX }}
    >
      {tiles.map((tile, i) => renderTile(tile, true, `${tile.kind}-${i}`))}
    </ul>
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
  const layout = buildMosaic(cards);

  return (
    <div className="flex flex-col gap-6">
      <WallLegend cards={cards} tierCount={tierCount} />
      {/* Largura visível (max-w-6xl, centro): ver MOSAIC_VISIBLE_MAX_PX. O carrossel tem fade nas bordas. */}
      <div role="region" aria-label={label} className={`mx-auto flex w-full ${MOSAIC_VISIBLE_CLASS} flex-col`}>
        {layout.mode === "static" ? (
          <MosaicStatic tiles={layout.rows[0]} />
        ) : (
          layout.rows.map((tiles, r) => <MosaicRow key={r} tiles={tiles} index={r} />)
        )}
      </div>
    </div>
  );
}
