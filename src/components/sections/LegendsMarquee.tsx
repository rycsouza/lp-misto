"use client";

import { Avatar } from "@/components/ui/avatar";

interface Legend {
  id: string;
  name: string;
  photoUrl?: string | null;
  position?: string | null;
}

interface LegendsMarqueeProps {
  legends: Legend[];
}

function MarqueeRow({
  items,
  reverse = false,
}: {
  items: Legend[];
  reverse?: boolean;
}) {
  // Use enough even copies so the row is always filled and the -50% loop is seamless.
  // Even N copies → -50% shifts exactly N/2 sets → second half == first half → no visible reset.
  const MIN_ITEMS = 10;
  const copiesNeeded = Math.max(2, Math.ceil(MIN_ITEMS / items.length));
  const copies = copiesNeeded % 2 === 0 ? copiesNeeded : copiesNeeded + 1;
  const track = Array.from({ length: copies }, () => items).flat();

  // Speed = 1 original set per (items.length * 5) seconds → consistent regardless of count.
  const duration = Math.max(15, (copies / 2) * items.length * 5);

  return (
    <div
      className="overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
      }}
    >
      <div
        className="flex gap-8 py-2"
        style={{
          width: "max-content",
          willChange: "transform",
          animation: `${reverse ? "marquee-rev" : "marquee-fwd"} ${duration}s linear infinite`,
        }}
      >
        {track.map((legend, i) => (
          <div
            key={`${legend.id}-${i}`}
            className="flex flex-col items-center gap-2 shrink-0"
          >
            <Avatar name={legend.name} photoUrl={legend.photoUrl} size={80} />
            <p className="text-xs text-foreground font-semibold whitespace-nowrap">
              {legend.name}
            </p>
            {legend.position && (
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                {legend.position}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LegendsMarquee({ legends }: LegendsMarqueeProps) {
  if (legends.length === 0) return null;

  const mid = Math.ceil(legends.length / 2);
  const row1 = legends.slice(0, mid);
  const row2 = legends.slice(mid);

  return (
    <div className="space-y-4">
      <MarqueeRow items={row1} />
      {row2.length > 0 && <MarqueeRow items={row2} reverse />}
    </div>
  );
}
