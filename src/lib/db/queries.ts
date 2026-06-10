import { unstable_cache } from "next/cache";
import { db } from "./client";
import {
  games,
  news,
  players,
  boardMembers,
  legends,
  personalities,
  timelineEvents,
  sponsors,
  products,
  siteConfig,
} from "./schema";
import { eq, gt, asc, desc, and } from "drizzle-orm";

export const getNextHomeGame = unstable_cache(
  async () => {
    const result = await db
      .select()
      .from(games)
      .where(and(eq(games.isHome, true), eq(games.active, true), gt(games.date, new Date())))
      .orderBy(asc(games.date))
      .limit(1);
    return result[0] ?? null;
  },
  ["next-home-game"],
  { tags: ["games"], revalidate: 300 }
);

export const getNextGame = unstable_cache(
  async () => {
    const result = await db
      .select()
      .from(games)
      .where(and(eq(games.active, true), gt(games.date, new Date())))
      .orderBy(asc(games.date))
      .limit(1);
    return result[0] ?? null;
  },
  ["next-game"],
  { tags: ["games"], revalidate: 300 }
);

export const getActiveNews = unstable_cache(
  async () => {
    return db
      .select()
      .from(news)
      .where(eq(news.active, true))
      .orderBy(desc(news.featured), desc(news.publishedAt));
  },
  ["active-news"],
  { tags: ["news"], revalidate: 300 }
);

export const getActivePlayers = unstable_cache(
  async (season: number) => {
    return db
      .select()
      .from(players)
      .where(and(eq(players.active, true), eq(players.season, season)))
      .orderBy(asc(players.number));
  },
  ["active-players"],
  { tags: ["players"], revalidate: 3600 }
);

export const getActiveBoardMembers = unstable_cache(
  async () => {
    return db
      .select()
      .from(boardMembers)
      .where(eq(boardMembers.active, true))
      .orderBy(asc(boardMembers.order));
  },
  ["active-board-members"],
  { tags: ["board"], revalidate: 3600 }
);

export const getActiveLegends = unstable_cache(
  async () => {
    return db
      .select()
      .from(legends)
      .where(eq(legends.active, true))
      .orderBy(asc(legends.order));
  },
  ["active-legends"],
  { tags: ["history"], revalidate: 3600 }
);

export const getActivePersonalities = unstable_cache(
  async () => {
    return db
      .select()
      .from(personalities)
      .where(eq(personalities.active, true))
      .orderBy(asc(personalities.order));
  },
  ["active-personalities"],
  { tags: ["history"], revalidate: 3600 }
);

export const getTimelineEvents = unstable_cache(
  async () => {
    return db.select().from(timelineEvents).orderBy(asc(timelineEvents.order));
  },
  ["timeline-events"],
  { tags: ["history"], revalidate: 3600 }
);

export const getActiveSponsors = unstable_cache(
  async () => {
    return db
      .select()
      .from(sponsors)
      .where(eq(sponsors.active, true))
      .orderBy(asc(sponsors.tier), asc(sponsors.order));
  },
  ["active-sponsors"],
  { tags: ["sponsors"], revalidate: 3600 }
);

export const getActiveProducts = unstable_cache(
  async () => {
    return db.select().from(products).where(eq(products.active, true));
  },
  ["active-products"],
  { tags: ["products"], revalidate: 3600 }
);

// Not cached — config rows are few (~30) and must reflect DB changes immediately.
export async function getAllSiteConfig() {
  return db.select().from(siteConfig);
}
