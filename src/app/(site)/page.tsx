// Page is dynamic so section enabled/order changes in DB take effect immediately.
// Individual section data (news, games, etc.) is still cached via unstable_cache.
export const dynamic = "force-dynamic";

import HeroSection from "@/components/sections/HeroSection";
import TicketHighlight from "@/components/sections/TicketHighlight";
import NewsSection from "@/components/sections/NewsSection";
import SquadSection from "@/components/sections/SquadSection";
import BoardSection from "@/components/sections/BoardSection";
import HistorySection from "@/components/sections/HistorySection";
import MembershipSection from "@/components/sections/MembershipSection";
import SponsorsSection from "@/components/sections/SponsorsSection";
import ShopSection from "@/components/sections/ShopSection";
import { getAllSectionMeta } from "@/lib/config";
import { headers } from "next/headers";
import { getPublicDisabledFeatures, publicDisabledSectionKeys } from "@/lib/platform/features";

const SECTION_KEYS = [
  "hero",
  "ticket_highlight",
  "news",
  "squad",
  "board",
  "history",
  "membership",
  "sponsors",
  "shop",
] as const;

type SectionKey = (typeof SECTION_KEYS)[number];

const SECTION_COMPONENTS: Record<SectionKey, React.ComponentType> = {
  hero: HeroSection,
  ticket_highlight: TicketHighlight,
  news: NewsSection,
  squad: SquadSection,
  board: BoardSection,
  history: HistorySection,
  membership: MembershipSection,
  sponsors: SponsorsSection,
  shop: ShopSection,
};

export default async function Home() {
  const h = await headers();
  const [meta, publicDisabled] = await Promise.all([
    getAllSectionMeta([...SECTION_KEYS]),
    getPublicDisabledFeatures(h.get("x-org-id")),
  ]);

  // Kill-switch com reflexo público: esconde a seção da home também.
  const hiddenSections = publicDisabledSectionKeys(publicDisabled);

  // Sort by order — SectionWrapper inside each component handles enabled/disabled.
  const sorted = [...SECTION_KEYS]
    .filter((key) => !hiddenSections.has(key))
    .sort((a, b) => (meta[a]?.order ?? 99) - (meta[b]?.order ?? 99));

  return (
    <>
      {sorted.map((key) => {
        const Component = SECTION_COMPONENTS[key];
        return <Component key={key} />;
      })}
    </>
  );
}
