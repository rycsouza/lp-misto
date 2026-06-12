"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import {
  boardMembers,
  legends,
  personalities,
  timelineEvents,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface BoardMemberRow {
  id: string;
  name: string;
  role: string;
  profession: string | null;
  photoUrl: string | null;
  group: string;
  fiscalType: string | null;
  order: number;
  active: boolean;
}

export interface BoardMemberInput {
  name: string;
  role: string;
  profession?: string | null;
  photoUrl?: string | null;
  group: string;
  fiscalType?: string | null;
  order?: number;
  active: boolean;
}

export interface LegendRow {
  id: string;
  name: string;
  photoUrl: string | null;
  position: string | null;
  active: boolean;
  order: number;
}

export interface LegendInput {
  name: string;
  photoUrl?: string | null;
  position?: string | null;
  active: boolean;
  order?: number;
}

export interface PersonalityRow {
  id: string;
  name: string;
  photoUrl: string | null;
  role: string | null;
  category: string;
  active: boolean;
  order: number;
}

export interface PersonalityInput {
  name: string;
  photoUrl?: string | null;
  role?: string | null;
  category: string;
  active: boolean;
  order?: number;
}

export interface TimelineEventRow {
  id: string;
  year: string;
  title: string;
  description: string;
  order: number;
}

export interface TimelineEventInput {
  year: string;
  title: string;
  description: string;
  order?: number;
}

// ─── BOARD MEMBERS ──────────────────────────────────────────────────────────

export async function getAdminBoardMembers(): Promise<BoardMemberRow[]> {
  return db
    .select({
      id: boardMembers.id,
      name: boardMembers.name,
      role: boardMembers.role,
      profession: boardMembers.profession,
      photoUrl: boardMembers.photoUrl,
      group: boardMembers.group,
      fiscalType: boardMembers.fiscalType,
      order: boardMembers.order,
      active: boardMembers.active,
    })
    .from(boardMembers)
    .orderBy(asc(boardMembers.group), asc(boardMembers.order));
}

export async function getAdminBoardMemberById(
  id: string
): Promise<typeof boardMembers.$inferSelect | null> {
  const rows = await db
    .select()
    .from(boardMembers)
    .where(eq(boardMembers.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createBoardMember(
  data: BoardMemberInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const [row] = await db
      .insert(boardMembers)
      .values({
        name: data.name,
        role: data.role,
        profession: data.profession ?? null,
        photoUrl: data.photoUrl ?? null,
        group: data.group as "executive" | "fiscal",
        fiscalType:
          data.group === "fiscal"
            ? ((data.fiscalType ?? null) as "titular" | "suplente" | null)
            : null,
        order: data.order ?? 0,
        active: data.active,
      })
      .returning({ id: boardMembers.id });

    revalidatePath("/admin/diretoria");
    return { success: true, id: row.id };
  } catch (err) {
    console.error("createBoardMember error:", err);
    return { success: false, error: "Erro ao criar membro da diretoria" };
  }
}

export async function updateBoardMember(
  id: string,
  data: Partial<BoardMemberInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Partial<typeof boardMembers.$inferInsert> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.profession !== undefined) updateData.profession = data.profession;
    if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl;
    if (data.group !== undefined)
      updateData.group = data.group as "executive" | "fiscal";
    if (data.fiscalType !== undefined)
      updateData.fiscalType =
        data.group === "fiscal"
          ? ((data.fiscalType ?? null) as "titular" | "suplente" | null)
          : null;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.active !== undefined) updateData.active = data.active;

    await db.update(boardMembers).set(updateData).where(eq(boardMembers.id, id));

    revalidatePath("/admin/diretoria");
    return { success: true };
  } catch (err) {
    console.error("updateBoardMember error:", err);
    return { success: false, error: "Erro ao atualizar membro da diretoria" };
  }
}

export async function toggleBoardMemberActive(
  id: string,
  active: boolean
): Promise<void> {
  await db.update(boardMembers).set({ active }).where(eq(boardMembers.id, id));
  revalidatePath("/admin/diretoria");
}

export async function deleteBoardMember(
  id: string
): Promise<{ success: boolean }> {
  await db.update(boardMembers).set({ active: false }).where(eq(boardMembers.id, id));
  revalidatePath("/admin/diretoria");
  return { success: true };
}

export async function updateBoardMemberOrder(
  id: string,
  order: number
): Promise<void> {
  await db.update(boardMembers).set({ order }).where(eq(boardMembers.id, id));
  revalidatePath("/admin/diretoria");
}

// ─── LEGENDS ────────────────────────────────────────────────────────────────

export async function getAdminLegends(): Promise<LegendRow[]> {
  return db
    .select({
      id: legends.id,
      name: legends.name,
      photoUrl: legends.photoUrl,
      position: legends.position,
      active: legends.active,
      order: legends.order,
    })
    .from(legends)
    .orderBy(asc(legends.order));
}

export async function getAdminLegendById(
  id: string
): Promise<typeof legends.$inferSelect | null> {
  const rows = await db.select().from(legends).where(eq(legends.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createLegend(
  data: LegendInput
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.insert(legends).values({
      name: data.name,
      photoUrl: data.photoUrl ?? null,
      position: data.position ?? null,
      active: data.active,
      order: data.order ?? 0,
    });

    revalidatePath("/admin/lendas");
    return { success: true };
  } catch (err) {
    console.error("createLegend error:", err);
    return { success: false, error: "Erro ao criar lenda" };
  }
}

export async function updateLegend(
  id: string,
  data: Partial<LegendInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Partial<typeof legends.$inferInsert> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.order !== undefined) updateData.order = data.order;

    await db.update(legends).set(updateData).where(eq(legends.id, id));

    revalidatePath("/admin/lendas");
    return { success: true };
  } catch (err) {
    console.error("updateLegend error:", err);
    return { success: false, error: "Erro ao atualizar lenda" };
  }
}

export async function toggleLegendActive(
  id: string,
  active: boolean
): Promise<void> {
  await db.update(legends).set({ active }).where(eq(legends.id, id));
  revalidatePath("/admin/lendas");
}

export async function deleteLegend(id: string): Promise<{ success: boolean }> {
  await db.update(legends).set({ active: false }).where(eq(legends.id, id));
  revalidatePath("/admin/lendas");
  return { success: true };
}

// ─── PERSONALITIES ──────────────────────────────────────────────────────────

export async function getAdminPersonalities(
  category?: string
): Promise<PersonalityRow[]> {
  const whereClause =
    category && category !== "all"
      ? eq(
          personalities.category,
          category as "medicos" | "dirigentes" | "tecnicos" | "voluntarios"
        )
      : undefined;

  return db
    .select({
      id: personalities.id,
      name: personalities.name,
      photoUrl: personalities.photoUrl,
      role: personalities.role,
      category: personalities.category,
      active: personalities.active,
      order: personalities.order,
    })
    .from(personalities)
    .where(whereClause)
    .orderBy(asc(personalities.order));
}

export async function getAdminPersonalityById(
  id: string
): Promise<typeof personalities.$inferSelect | null> {
  const rows = await db
    .select()
    .from(personalities)
    .where(eq(personalities.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createPersonality(
  data: PersonalityInput
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.insert(personalities).values({
      name: data.name,
      photoUrl: data.photoUrl ?? null,
      role: data.role ?? null,
      category: data.category as
        | "medicos"
        | "dirigentes"
        | "tecnicos"
        | "voluntarios",
      active: data.active,
      order: data.order ?? 0,
    });

    revalidatePath("/admin/personalidades");
    return { success: true };
  } catch (err) {
    console.error("createPersonality error:", err);
    return { success: false, error: "Erro ao criar personalidade" };
  }
}

export async function updatePersonality(
  id: string,
  data: Partial<PersonalityInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Partial<typeof personalities.$inferInsert> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.category !== undefined)
      updateData.category = data.category as
        | "medicos"
        | "dirigentes"
        | "tecnicos"
        | "voluntarios";
    if (data.active !== undefined) updateData.active = data.active;
    if (data.order !== undefined) updateData.order = data.order;

    await db.update(personalities).set(updateData).where(eq(personalities.id, id));

    revalidatePath("/admin/personalidades");
    return { success: true };
  } catch (err) {
    console.error("updatePersonality error:", err);
    return { success: false, error: "Erro ao atualizar personalidade" };
  }
}

export async function togglePersonalityActive(
  id: string,
  active: boolean
): Promise<void> {
  await db.update(personalities).set({ active }).where(eq(personalities.id, id));
  revalidatePath("/admin/personalidades");
}

export async function deletePersonality(
  id: string
): Promise<{ success: boolean }> {
  await db.update(personalities).set({ active: false }).where(eq(personalities.id, id));
  revalidatePath("/admin/personalidades");
  return { success: true };
}

// ─── TIMELINE EVENTS ────────────────────────────────────────────────────────

export async function getAdminTimelineEvents(): Promise<TimelineEventRow[]> {
  return db
    .select({
      id: timelineEvents.id,
      year: timelineEvents.year,
      title: timelineEvents.title,
      description: timelineEvents.description,
      order: timelineEvents.order,
    })
    .from(timelineEvents)
    .orderBy(asc(timelineEvents.order));
}

export async function getAdminTimelineEventById(
  id: string
): Promise<typeof timelineEvents.$inferSelect | null> {
  const rows = await db
    .select()
    .from(timelineEvents)
    .where(eq(timelineEvents.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createTimelineEvent(
  data: TimelineEventInput
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.insert(timelineEvents).values({
      year: data.year,
      title: data.title,
      description: data.description,
      order: data.order ?? 0,
    });

    revalidatePath("/admin/historia");
    return { success: true };
  } catch (err) {
    console.error("createTimelineEvent error:", err);
    return { success: false, error: "Erro ao criar evento" };
  }
}

export async function updateTimelineEvent(
  id: string,
  data: Partial<TimelineEventInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Partial<typeof timelineEvents.$inferInsert> = {};
    if (data.year !== undefined) updateData.year = data.year;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.order !== undefined) updateData.order = data.order;

    await db.update(timelineEvents).set(updateData).where(eq(timelineEvents.id, id));

    revalidatePath("/admin/historia");
    return { success: true };
  } catch (err) {
    console.error("updateTimelineEvent error:", err);
    return { success: false, error: "Erro ao atualizar evento" };
  }
}

export async function deleteTimelineEvent(
  id: string
): Promise<{ success: boolean }> {
  // Hard delete — no relationships
  await db.delete(timelineEvents).where(eq(timelineEvents.id, id));
  revalidatePath("/admin/historia");
  return { success: true };
}
