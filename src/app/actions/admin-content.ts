"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { news, players, sponsors } from "@/lib/db/schema";
import { eq, desc, asc, ilike, and, or, sql, count } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

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
  const db = await getDb();
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
  const db = await getDb();
  const rows = await db.select().from(news).where(eq(news.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createNews(
  data: NewsInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  const db = await getDb();
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

    await logAudit("create_news", "news", row.id, { title: data.title });
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
  const db = await getDb();
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

    if (Object.keys(updateData).length === 0) return { success: false, error: "Nenhum campo para atualizar." };
    await db.update(news).set(updateData).where(eq(news.id, id));

    await logAudit("update_news", "news", id, data.title ? { title: data.title } : null);
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
  const db = await getDb();
  await db.update(news).set({ active }).where(eq(news.id, id));
  revalidatePath("/admin/noticias");
}

export async function toggleNewsFeatured(
  id: string,
  featured: boolean
): Promise<void> {
  const db = await getDb();
  if (featured) {
    // Disable featured on all others first
    await db.update(news).set({ featured: false });
  }
  await db.update(news).set({ featured }).where(eq(news.id, id));
  revalidatePath("/admin/noticias");
}

export async function deleteNews(id: string): Promise<{ success: boolean }> {
  const db = await getDb();
  await db.update(news).set({ active: false }).where(eq(news.id, id));
  await logAudit("delete_news", "news", id);
  revalidatePath("/admin/noticias");
  return { success: true };
}

// ─── PLAYERS ────────────────────────────────────────────────────────────────

export async function getAdminPlayers(params: {
  season?: number;
  position?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ rows: PlayerRow[]; total: number }> {
  const db = await getDb();
  const { season, position, search, page = 1, limit = 30 } = params;
  const offset = (page - 1) * limit;

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

  const [totalRow] = await db
    .select({ total: count() })
    .from(players)
    .where(whereClause);

  const rows = await db
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
    .orderBy(asc(players.number))
    .limit(limit)
    .offset(offset);

  return { rows, total: Number(totalRow.total) };
}

export async function getAdminPlayerById(
  id: string
): Promise<typeof players.$inferSelect | null> {
  const db = await getDb();
  const rows = await db.select().from(players).where(eq(players.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createPlayer(
  data: PlayerInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  const db = await getDb();
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

    await logAudit("create_player", "player", row.id, { name: data.name, position: data.position });
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
  const db = await getDb();
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

    if (Object.keys(updateData).length === 0) return { success: false, error: "Nenhum campo para atualizar." };
    await db.update(players).set(updateData).where(eq(players.id, id));

    await logAudit("update_player", "player", id, data.name ? { name: data.name } : null);
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
  const db = await getDb();
  await db.update(players).set({ active }).where(eq(players.id, id));
  revalidatePath("/admin/elenco");
}

export async function deletePlayer(id: string): Promise<{ success: boolean }> {
  const db = await getDb();
  await db.update(players).set({ active: false }).where(eq(players.id, id));
  await logAudit("delete_player", "player", id);
  revalidatePath("/admin/elenco");
  return { success: true };
}

export async function getCurrentSeason(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ maxSeason: sql<number>`coalesce(max(${players.season}), ${new Date().getFullYear()})` })
    .from(players);
  return Number(row.maxSeason);
}

// ─── SPONSORS ───────────────────────────────────────────────────────────────

export async function getAdminSponsors(): Promise<SponsorRow[]> {
  const db = await getDb();
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
  const db = await getDb();
  const rows = await db.select().from(sponsors).where(eq(sponsors.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createSponsor(
  data: SponsorInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  const db = await getDb();
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

    await logAudit("create_sponsor", "sponsor", row.id, { name: data.name, tier: data.tier });
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
  const db = await getDb();
  try {
    const updateData: Partial<typeof sponsors.$inferInsert> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.logoTone !== undefined) updateData.logoTone = data.logoTone as "light" | "dark";
    if (data.tier !== undefined) updateData.tier = data.tier as "diamante" | "ouro" | "prata" | "bronze";
    if (data.instagramUrl !== undefined) updateData.instagramUrl = data.instagramUrl;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.order !== undefined) updateData.order = data.order;

    if (Object.keys(updateData).length === 0) return { success: false, error: "Nenhum campo para atualizar." };
    await db.update(sponsors).set(updateData).where(eq(sponsors.id, id));

    await logAudit("update_sponsor", "sponsor", id, data.name ? { name: data.name } : null);
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
  const db = await getDb();
  await db.update(sponsors).set({ active }).where(eq(sponsors.id, id));
  revalidatePath("/admin/patrocinadores");
}

export async function deleteSponsor(id: string): Promise<{ success: boolean }> {
  const db = await getDb();
  await db.update(sponsors).set({ active: false }).where(eq(sponsors.id, id));
  await logAudit("delete_sponsor", "sponsor", id);
  revalidatePath("/admin/patrocinadores");
  return { success: true };
}

export async function updateSponsorOrder(
  id: string,
  order: number
): Promise<void> {
  const db = await getDb();
  await db.update(sponsors).set({ order }).where(eq(sponsors.id, id));
  revalidatePath("/admin/patrocinadores");
}

async function getSponsorTierSorted(id: string) {
  const db = await getDb();
  const [current] = await db
    .select({ id: sponsors.id, tier: sponsors.tier })
    .from(sponsors)
    .where(eq(sponsors.id, id))
    .limit(1);
  if (!current) return null;
  const all = await db
    .select({ id: sponsors.id })
    .from(sponsors)
    .where(eq(sponsors.tier, current.tier))
    .orderBy(asc(sponsors.order));
  return { current, all };
}

async function applySponsorOrder(ids: string[]) {
  const db = await getDb();
  await Promise.all(
    ids.map((sid, i) =>
      db.update(sponsors).set({ order: i + 1 }).where(eq(sponsors.id, sid))
    )
  );
  revalidatePath("/admin/patrocinadores");
}

export async function moveSponsorUp(id: string): Promise<void> {
  const res = await getSponsorTierSorted(id);
  if (!res) return;
  const idx = res.all.findIndex((s) => s.id === id);
  if (idx <= 0) return;
  const reordered = res.all.map((s) => s.id);
  [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
  await applySponsorOrder(reordered);
}

export async function moveSponsorDown(id: string): Promise<void> {
  const res = await getSponsorTierSorted(id);
  if (!res) return;
  const idx = res.all.findIndex((s) => s.id === id);
  if (idx < 0 || idx >= res.all.length - 1) return;
  const reordered = res.all.map((s) => s.id);
  [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
  await applySponsorOrder(reordered);
}

export async function reorderSponsors(ids: string[]): Promise<void> {
  await applySponsorOrder(ids);
}
