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

// No unstable_cache — page is force-dynamic and all content is admin-managed.
// Changes in the DB reflect immediately without waiting for cache expiry.

export async function getNextHomeGame() {
  const result = await db
    .select()
    .from(games)
    .where(and(eq(games.isHome, true), eq(games.active, true), gt(games.date, new Date())))
    .orderBy(asc(games.date))
    .limit(1);
  return result[0] ?? null;
}

export async function getNextGame() {
  const result = await db
    .select()
    .from(games)
    .where(and(eq(games.active, true), gt(games.date, new Date())))
    .orderBy(asc(games.date))
    .limit(1);
  return result[0] ?? null;
}

export async function getActiveNews() {
  return db
    .select()
    .from(news)
    .where(eq(news.active, true))
    .orderBy(desc(news.featured), desc(news.publishedAt));
}

export async function getActivePlayers(season: number) {
  return db
    .select()
    .from(players)
    .where(and(eq(players.active, true), eq(players.season, season)))
    .orderBy(asc(players.number));
}

export async function getActiveBoardMembers() {
  return db
    .select()
    .from(boardMembers)
    .where(eq(boardMembers.active, true))
    .orderBy(asc(boardMembers.order));
}

export async function getActiveLegends() {
  return db
    .select()
    .from(legends)
    .where(eq(legends.active, true))
    .orderBy(asc(legends.order));
}

export async function getActivePersonalities() {
  return db
    .select()
    .from(personalities)
    .where(eq(personalities.active, true))
    .orderBy(asc(personalities.order));
}

export async function getTimelineEvents() {
  return db.select().from(timelineEvents).orderBy(asc(timelineEvents.order));
}

export async function getActiveSponsors() {
  return db
    .select()
    .from(sponsors)
    .where(eq(sponsors.active, true))
    .orderBy(asc(sponsors.tier), asc(sponsors.order));
}

export async function getActiveProducts() {
  return db.select().from(products).where(eq(products.active, true));
}

export async function getAllSiteConfig() {
  return db.select().from(siteConfig);
}
