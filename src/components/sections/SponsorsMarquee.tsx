"use client";

import { motion } from "framer-motion";
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
  const doubled = [...items, ...items];
  return (
    <div className="overflow-hidden">
      <motion.div
        className="flex gap-6 py-2"
        animate={{ x: reverse ? ["0%", "50%"] : ["0%", "-50%"] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        {doubled.map((s, i) => (
          <SponsorLogo key={`${s.id}-${i}`} sponsor={s} />
        ))}
      </motion.div>
    </div>
  );
}

export function SponsorsMarquee({ sponsors }: SponsorsMarqueeProps) {
  const mid = Math.ceil(sponsors.length / 2);
  const row1 = sponsors.slice(0, mid);
  const row2 = sponsors.slice(mid);

  if (sponsors.length === 0) return null;

  return (
    <div className="space-y-4">
      <MarqueeRow items={row1} />
      {row2.length > 0 && <MarqueeRow items={row2} reverse />}
    </div>
  );
}
