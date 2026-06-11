"use client";

import Image from "next/image";

interface Sponsor {
  id: string;
  name: string;
  logoUrl: string;
  logoTone: "light" | "dark";
  instagramUrl?: string | null;
}

interface SponsorsMarqueeProps {
  sponsors: Sponsor[];
}

function SponsorLogo({ sponsor }: { sponsor: Sponsor }) {
  const bg = sponsor.logoTone === "dark" ? "bg-white" : "bg-secondary";
  const logo = (
    <div
      className={`relative w-32 h-16 rounded-lg ${bg} flex items-center justify-center p-2 shrink-0`}
    >
      {sponsor.logoUrl ? (
        <Image
          src={sponsor.logoUrl}
          alt={sponsor.name}
          fill
          sizes="128px"
          className="object-contain p-2"
        />
      ) : (
        <span className="text-xs font-semibold text-center text-foreground/70 leading-tight px-1">
          {sponsor.name}
        </span>
      )}
    </div>
  );

  if (sponsor.instagramUrl) {
    return (
      <a
        href={sponsor.instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={sponsor.name}
        className="hover:opacity-80 transition-opacity"
      >
        {logo}
      </a>
    );
  }
  return logo;
}

function MarqueeRow({ items, reverse = false }: { items: Sponsor[]; reverse?: boolean }) {
  // We need enough copies to guarantee the track always fills the viewport.
  // Rule: use an EVEN number of copies → animate to -50% is always seamless
  // because the second half of the track is identical to the first half.
  const MIN_ITEMS = 10; // target at least ~10 logos visible before the loop point
  const copiesNeeded = Math.max(2, Math.ceil(MIN_ITEMS / items.length));
  const copies = copiesNeeded % 2 === 0 ? copiesNeeded : copiesNeeded + 1;
  const track = Array.from({ length: copies }, () => items).flat();

  // Speed = 1 original set per (items.length * 5) seconds → consistent regardless of count.
  const duration = Math.max(15, (copies / 2) * items.length * 5);

  return (
    <div
      className="overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
      }}
    >
      <div
        className="flex gap-6 py-2"
        style={{
          width: "max-content",
          willChange: "transform",
          animation: `${reverse ? "marquee-rev" : "marquee-fwd"} ${duration}s linear infinite`,
        }}
      >
        {track.map((s, i) => (
          <SponsorLogo key={`${s.id}-${i}`} sponsor={s} />
        ))}
      </div>
    </div>
  );
}

export function SponsorsMarquee({ sponsors }: SponsorsMarqueeProps) {
  if (sponsors.length === 0) return null;

  const mid = Math.ceil(sponsors.length / 2);
  const row1 = sponsors.slice(0, mid);
  const row2 = sponsors.slice(mid);

  return (
    <div className="space-y-4">
      <MarqueeRow items={row1} />
      {row2.length > 0 && <MarqueeRow items={row2} reverse />}
    </div>
  );
}
