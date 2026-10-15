import type { CSSProperties } from "react";
import { safeCardColor } from "@/lib/membership/plan-benefits";
import type { WallEntry } from "@/lib/membership/wall";

/**
 * Carrossel de nomes do Mural dos Sócios (um por plano). Só CSS: sem libs e sem JS.
 * Os keyframes e o reduced-motion estão em globals.css (bloco "Mural dos Sócios").
 *
 * Servidor-puro: a decisão de animar depende só da quantidade (conhecida aqui), então
 * o HTML já sai certo; o reduced-motion é tratado no CSS (vira lista rolável).
 */

/** Abaixo disso não anima: os cards ficam centralizados, sem movimento. */
export const WALL_MARQUEE_MIN = 6;

/**
 * Cópias da sequência na faixa. Com cards de ~144-160px, um set com 6+ cards já tem
 * ~900px, maior que a tela útil; 3 sets bastam para nunca mostrar o fim da faixa.
 */
export const WALL_MARQUEE_SETS = 3;

/** Velocidade constante por card (~1 card a cada 4,5 s), então a faixa maior dura mais. */
const SECONDS_PER_CARD = 4.5;

export function wallMarqueePlan(count: number): { animate: boolean; durationSec: number } {
  if (count < WALL_MARQUEE_MIN) return { animate: false, durationSec: 0 };
  return { animate: true, durationSec: count * SECONDS_PER_CARD };
}

function WallCard({ entry, color }: { entry: WallEntry; color: string | null }) {
  return (
    <li className="relative flex aspect-square w-36 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-border bg-card p-3 text-center shadow-sm sm:w-40">
      {color && (
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: color }} />
      )}
      <span className="line-clamp-2 break-words text-balance text-sm font-semibold leading-tight text-foreground">
        {entry.name}
      </span>
      <span className="text-[11px] text-muted-foreground">Sócio desde {entry.since}</span>
    </li>
  );
}

export function WallCarousel({
  label,
  entries,
  cardColor,
  reverse = false,
}: {
  /** Nome acessível da faixa (ex.: "Sócios do plano Elite"). */
  label: string;
  entries: WallEntry[];
  /** Cor do plano; só hex validado (#rrggbb) chega ao CSS. */
  cardColor: string | null;
  /** Faixas alternam o sentido para o olhar não ficar preso a um só movimento. */
  reverse?: boolean;
}) {
  const color = safeCardColor(cardColor);
  const plan = wallMarqueePlan(entries.length);

  if (!plan.animate) {
    return (
      <ul className="flex flex-wrap justify-center gap-3">
        {entries.map((entry, i) => (
          <WallCard key={`${i}-${entry.name}`} entry={entry} color={color} />
        ))}
      </ul>
    );
  }

  const extraSets = Array.from({ length: WALL_MARQUEE_SETS - 1 }, (_, i) => i);
  return (
    // Região rolável e focável: o foco pausa a animação e, sem movimento, permite rolar.
    <div role="region" aria-label={label} tabIndex={0} className="mural-row">
      <div
        className={`mural-track mural-animate ${reverse ? "mural-animate-rev" : "mural-animate-fwd"}`}
        style={
          {
            animationDuration: `${plan.durationSec}s`,
            "--mural-sets": WALL_MARQUEE_SETS,
          } as CSSProperties
        }
      >
        {/* Lista real: única parte lida por leitor de tela. */}
        <ul className="mural-set">
          {entries.map((entry, i) => (
            <WallCard key={`${i}-${entry.name}`} entry={entry} color={color} />
          ))}
        </ul>
        {/* Cópias de preenchimento do loop: ocultas para leitor de tela e sem foco. */}
        {extraSets.map((k) => (
          <ul key={`clone-${k}`} aria-hidden="true" className="mural-set mural-clone">
            {entries.map((entry, i) => (
              <WallCard key={`${i}-${entry.name}`} entry={entry} color={color} />
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
