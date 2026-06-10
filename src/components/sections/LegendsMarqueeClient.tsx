"use client";

import dynamic from "next/dynamic";

const LegendsMarquee = dynamic(
  () => import("./LegendsMarquee").then((m) => m.LegendsMarquee),
  { ssr: false }
);

interface Legend {
  id: string;
  name: string;
  photoUrl?: string | null;
  position?: string | null;
}

export function LegendsMarqueeClient({ legends }: { legends: Legend[] }) {
  return <LegendsMarquee legends={legends} />;
}
