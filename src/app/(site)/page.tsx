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
import MemberWallSection from "@/components/sections/MemberWallSection";
import SponsorsSection from "@/components/sections/SponsorsSection";
import ShopSection from "@/components/sections/ShopSection";
import RaffleSection from "@/components/sections/RaffleSection";
import { getAllSectionMeta } from "@/lib/config";
import { headers } from "next/headers";
import { getPublicDisabledFeatures, publicDisabledSectionKeys } from "@/lib/platform/features";
import { RAFFLES_ENABLED } from "@/lib/product-flags";
import {
  getSectionLabel,
  HOME_SECTION_KEYS,
  orderHomeSections,
  type HomeSectionKey,
} from "@/lib/section-meta";
import type { SectionLabelProps } from "@/components/ui/section-wrapper";

const SECTION_COMPONENTS: Record<HomeSectionKey, React.ComponentType<SectionLabelProps>> = {
  hero: HeroSection,
  ticket_highlight: TicketHighlight,
  news: NewsSection,
  squad: SquadSection,
  board: BoardSection,
  history: HistorySection,
  member_wall: MemberWallSection,
  membership: MembershipSection,
  sponsors: SponsorsSection,
  shop: ShopSection,
  raffle: RaffleSection,
};

export default async function Home() {
  const h = await headers();
  const [meta, publicDisabled] = await Promise.all([
    getAllSectionMeta(HOME_SECTION_KEYS),
    getPublicDisabledFeatures(h.get("x-org-id")),
  ]);

  // Kill-switch com reflexo público: esconde a seção da home também (ex.: módulo de sócios
  // esconde a seção de sócio e o mural).
  const hiddenSections = publicDisabledSectionKeys(publicDisabled);

  // Ordem da configuração (a checagem de "ligada" fica em cada seção, via SectionWrapper).
  const sorted = orderHomeSections(
    HOME_SECTION_KEYS.filter((key) => RAFFLES_ENABLED || key !== "raffle"),
    meta,
    hiddenSections,
  );

  return (
    <>
      {sorted.map((key) => {
        const Component = SECTION_COMPONENTS[key as HomeSectionKey];
        // Rótulo personalizado do clube; undefined = título padrão de cada componente.
        return <Component key={key} label={getSectionLabel(meta, key, undefined)} />;
      })}
    </>
  );
}
