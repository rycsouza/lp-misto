"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { news, players, sponsors } from "@/lib/db/schema";
import { eq, desc, asc, ilike, and, or, sql, count } from "drizzle-orm";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface NewsRow {
  id: string;
  title: string;
  category: string;
  featured: boolean;
  active: boolean;
  publishedAt: string | null;
  source: string | null;
  createdAt: Date;
}

export interface NewsInput {
  title: string;
  summary: string;
  category: string;
  imageUrl?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  featured: boolean;
  publishedAt?: string | null;
  active: boolean;
}

export interface PlayerRow {
  id: string;
  name: string;
  number: number | null;
  position: string;
  season: number;
  active: boolean;
  photoUrl: string | null;
}

export interface PlayerInput {
  name: string;
  number?: number | null;
  position: string;
  photoUrl?: string | null;
  season: number;
  active: boolean;
}

export interface SponsorRow {
  id: string;
  name: string;
  logoUrl: string;
  logoTone: string;
  tier: string;
  instagramUrl: string | null;
  active: boolean;
  order: number;
}

export interface SponsorInput {
  name: string;
  logoUrl: string;
  logoTone: string;
  tier: string;
  instagramUrl?: string | null;
  active: boolean;
  order?: number;
}

// ─── NEWS ───────────────────────────────────────────────────────────────────

export async function getAdminNews(params: {
  page: number;
  category?: string;
  search?: string;
}): Promise<{ rows: NewsRow[]; total: number }> {
  const { page, category, search } = params;
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (category && category !== "all") {
    conditions.push(
      eq(
        news.category,
        category as
          | "futebol_profissional"
          | "base"
          | "institucional"
          | "socio_torcedor"
          | "patrocinadores"
      )
    );
  }

  if (search && search.trim()) {
    conditions.push(ilike(news.title, `%${search.trim()}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ total: count() })
    .from(news)
    .where(whereClause);

  const rows = await db
    .select({
      id: news.id,
      title: news.title,
      category: news.category,
      featured: news.featured,
      active: news.active,
      publishedAt: news.publishedAt,
      source: news.source,
      createdAt: news.createdAt,
    })
    .from(news)
    .where(whereClause)
    .orderBy(desc(news.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    rows,
    total: Number(totalRow.total),
  };
}

export async function getAdminNewsById(
  id: string
): Promise<typeof news.$inferSelect | null> {
  const rows = await db.select().from(news).where(eq(news.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createNews(
  data: NewsInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const [row] = await db
      .insert(news)
      .values({
        title: data.title,
        summary: data.summary,
        category: data.category as
          | "futebol_profissional"
          | "base"
          | "institucional"
          | "socio_torcedor"
          | "patrocinadores",
        imageUrl: data.imageUrl ?? null,
        source: data.source ?? null,
        sourceUrl: data.sourceUrl ?? null,
        featured: data.featured,
        publishedAt: data.publishedAt ?? null,
        active: data.active,
      })
      .returning({ id: news.id });

    revalidatePath("/admin/noticias");
    return { success: true, id: row.id };
  } catch (err) {
    console.error("createNews error:", err);
    return { success: false, error: "Erro ao criar notícia" };
  }
}

export async function updateNews(
  id: string,
  data: Partial<NewsInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Partial<typeof news.$inferInsert> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.summary !== undefined) updateData.summary = data.summary;
    if (data.category !== undefined)
      updateData.category = data.category as
        | "futebol_profissional"
        | "base"
        | "institucional"
        | "socio_torcedor"
        | "patrocinadores";
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.source !== undefined) updateData.source = data.source;
    if (data.sourceUrl !== undefined) updateData.sourceUrl = data.sourceUrl;
    if (data.featured !== undefined) updateData.featured = data.featured;
    if (data.publishedAt !== undefined) updateData.publishedAt = data.publishedAt;
    if (data.active !== undefined) updateData.active = data.active;

    await db.update(news).set(updateData).where(eq(news.id, id));

    revalidatePath("/admin/noticias");
    return { success: true };
  } catch (err) {
    console.error("updateNews error:", err);
    return { success: false, error: "Erro ao atualizar notícia" };
  }
}

export async function toggleNewsActive(
  id: string,
  active: boolean
): Promise<void> {
  await db.update(news).set({ active }).where(eq(news.id, id));
  revalidatePath("/admin/noticias");
}

export async function toggleNewsFeatured(
  id: string,
  featured: boolean
): Promise<void> {
  if (featured) {
    // Disable featured on all others first
    await db.update(news).set({ featured: false });
  }
  await db.update(news).set({ featured }).where(eq(news.id, id));
  revalidatePath("/admin/noticias");
}

export async function deleteNews(id: string): Promise<{ success: boolean }> {
  await db.update(news).set({ active: false }).where(eq(news.id, id));
  revalidatePath("/admin/noticias");
  return { success: true };
}

// ─── PLAYERS ────────────────────────────────────────────────────────────────

export async function getAdminPlayers(params: {
  season?: number;
  position?: string;
  search?: string;
}): Promise<PlayerRow[]> {
  const { season, position, search } = params;

  const conditions = [];

  if (season) {
    conditions.push(eq(players.season, season));
  }

  if (position && position !== "all") {
    conditions.push(
      eq(
        players.position,
        position as
          | "goleiro"
          | "zagueiro"
          | "lateral"
          | "volante"
          | "meia"
          | "atacante"
      )
    );
  }

  if (search && search.trim()) {
    conditions.push(ilike(players.name, `%${search.trim()}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select({
      id: players.id,
      name: players.name,
      number: players.number,
      position: players.position,
      season: players.season,
      active: players.active,
      photoUrl: players.photoUrl,
    })
    .from(players)
    .where(whereClause)
    .orderBy(asc(players.number));
}

export async function getAdminPlayerById(
  id: string
): Promise<typeof players.$inferSelect | null> {
  const rows = await db.select().from(players).where(eq(players.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createPlayer(
  data: PlayerInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const [row] = await db
      .insert(players)
      .values({
        name: data.name,
        number: data.number ?? null,
        position: data.position as
          | "goleiro"
          | "zagueiro"
          | "lateral"
          | "volante"
          | "meia"
          | "atacante",
        photoUrl: data.photoUrl ?? null,
        season: data.season,
        active: data.active,
      })
      .returning({ id: players.id });

    revalidatePath("/admin/elenco");
    return { success: true, id: row.id };
  } catch (err) {
    console.error("createPlayer error:", err);
    return { success: false, error: "Erro ao criar jogador" };
  }
}

export async function updatePlayer(
  id: string,
  data: Partial<PlayerInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Partial<typeof players.$inferInsert> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.number !== undefined) updateData.number = data.number;
    if (data.position !== undefined)
      updateData.position = data.position as
        | "goleiro"
        | "zagueiro"
        | "lateral"
        | "volante"
        | "meia"
        | "atacante";
    if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl;
    if (data.season !== undefined) updateData.season = data.season;
    if (data.active !== undefined) updateData.active = data.active;

    await db.update(players).set(updateData).where(eq(players.id, id));

    revalidatePath("/admin/elenco");
    return { success: true };
  } catch (err) {
    console.error("updatePlayer error:", err);
    return { success: false, error: "Erro ao atualizar jogador" };
  }
}

export async function togglePlayerActive(
  id: string,
  active: boolean
): Promise<void> {
  await db.update(players).set({ active }).where(eq(players.id, id));
  revalidatePath("/admin/elenco");
}

export async function deletePlayer(id: string): Promise<{ success: boolean }> {
  await db.update(players).set({ active: false }).where(eq(players.id, id));
  revalidatePath("/admin/elenco");
  return { success: true };
}

export async function getCurrentSeason(): Promise<number> {
  const [row] = await db
    .select({ maxSeason: sql<number>`coalesce(max(${players.season}), ${new Date().getFullYear()})` })
    .from(players);
  return Number(row.maxSeason);
}

// ─── SPONSORS ───────────────────────────────────────────────────────────────

export async function getAdminSponsors(): Promise<SponsorRow[]> {
  return db
    .select({
      id: sponsors.id,
      name: sponsors.name,
      logoUrl: sponsors.logoUrl,
      logoTone: sponsors.logoTone,
      tier: sponsors.tier,
      instagramUrl: sponsors.instagramUrl,
      active: sponsors.active,
      order: sponsors.order,
    })
    .from(sponsors)
    .orderBy(asc(sponsors.tier), asc(sponsors.order));
}

export async function getAdminSponsorById(
  id: string
): Promise<typeof sponsors.$inferSelect | null> {
  const rows = await db.select().from(sponsors).where(eq(sponsors.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createSponsor(
  data: SponsorInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const [row] = await db
      .insert(sponsors)
      .values({
        name: data.name,
        logoUrl: data.logoUrl,
        logoTone: data.logoTone as "light" | "dark",
        tier: data.tier as "diamante" | "ouro" | "prata" | "bronze",
        instagramUrl: data.instagramUrl ?? null,
        active: data.active,
        order: data.order ?? 0,
      })
      .returning({ id: sponsors.id });

    revalidatePath("/admin/patrocinadores");
    return { success: true, id: row.id };
  } catch (err) {
    console.error("createSponsor error:", err);
    return { success: false, error: "Erro ao criar patrocinador" };
  }
}

export async function updateSponsor(
  id: string,
  data: Partial<SponsorInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Partial<typeof sponsors.$inferInsert> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.logoTone !== undefined) updateData.logoTone = data.logoTone as "light" | "dark";
    if (data.tier !== undefined) updateData.tier = data.tier as "diamante" | "ouro" | "prata" | "bronze";
    if (data.instagramUrl !== undefined) updateData.instagramUrl = data.instagramUrl;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.order !== undefined) updateData.order = data.order;

    await db.update(sponsors).set(updateData).where(eq(sponsors.id, id));

    revalidatePath("/admin/patrocinadores");
    return { success: true };
  } catch (err) {
    console.error("updateSponsor error:", err);
    return { success: false, error: "Erro ao atualizar patrocinador" };
  }
}

export async function toggleSponsorActive(
  id: string,
  active: boolean
): Promise<void> {
  await db.update(sponsors).set({ active }).where(eq(sponsors.id, id));
  revalidatePath("/admin/patrocinadores");
}

export async function deleteSponsor(id: string): Promise<{ success: boolean }> {
  await db.update(sponsors).set({ active: false }).where(eq(sponsors.id, id));
  revalidatePath("/admin/patrocinadores");
  return { success: true };
}

export async function updateSponsorOrder(
  id: string,
  order: number
): Promise<void> {
  await db.update(sponsors).set({ order }).where(eq(sponsors.id, id));
  revalidatePath("/admin/patrocinadores");
}
