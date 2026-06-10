"use client";

import dynamic from "next/dynamic";

const SponsorsMarquee = dynamic(
  () => import("./SponsorsMarquee").then((m) => m.SponsorsMarquee),
  { ssr: false }
);

interface Sponsor {
  id: string;
  name: string;
  logoUrl: string;
  logoTone: "light" | "dark";
  instagramUrl?: string | null;
}

export function SponsorsMarqueeClient({ sponsors }: { sponsors: Sponsor[] }) {
  return <SponsorsMarquee sponsors={sponsors} />;
}
