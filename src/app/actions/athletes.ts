"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { athleteApplications, siteConfig } from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { fmtDate } from "@/lib/date";

// ─── INVITE CODE ─────────────────────────────────────────────────────────────

export async function getAthleteInviteCode(): Promise<string> {
  const db = await getDb();
  const [row] = await db
    .select({ value: siteConfig.value })
    .from(siteConfig)
    .where(eq(siteConfig.key, "athlete_invite_code"))
    .limit(1);
  return row?.value ?? "";
}

export async function setAthleteInviteCode(
  code: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  try {
    const trimmed = code.trim();
    await db
      .insert(siteConfig)
      .values({ key: "athlete_invite_code", value: trimmed, type: "string", description: "Código de convite para cadastro de atletas" })
      .onConflictDoUpdate({ target: siteConfig.key, set: { value: trimmed } });
    revalidatePath("/admin/elenco/solicitacoes");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao salvar código." };
  }
}

// ─── PUBLIC SUBMISSION ───────────────────────────────────────────────────────

export async function verifyAthleteInviteCode(
  code: string
): Promise<{ valid: boolean }> {
  const storedCode = await getAthleteInviteCode();
  if (!storedCode) return { valid: true };
  return { valid: code.trim().toLowerCase() === storedCode.toLowerCase() };
}

const applicationSchema = z.object({
  inviteCode: z.string(),
  fullName: z.string().min(3, "Nome muito curto"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
  email: z.email("E-mail inválido"),
  cpf: z.string().min(11, "CPF inválido"),
  rg: z.string().min(5, "RG inválido"),
  birthDate: z.string().min(1, "Data de nascimento obrigatória"),
  city: z.string().min(2, "Cidade obrigatória"),
  state: z.string().length(2, "Estado inválido"),
  nickname: z.string().optional(),
  position: z.string().min(1, "Posição obrigatória"),
  dominantFoot: z.string().min(1, "Pé dominante obrigatório"),
  weightKg: z.string().min(1, "Peso obrigatório"),
  heightCm: z.string().min(1, "Altura obrigatória"),
  photoUrl: z.string().optional(),
  pixKey: z.string().optional(),
  contractStart: z.string().optional(),
  salaryBrl: z.string().optional(),
  _hp: z.string().optional(),
});

export type AthleteApplicationInput = z.infer<typeof applicationSchema>;

export async function submitAthleteApplication(
  input: AthleteApplicationInput
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (input._hp) return { success: false, error: "Bot detectado." };

  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { inviteCode, ...data } = parsed.data;

  // Re-validate invite code server-side (defensive check)
  const storedCode = await getAthleteInviteCode();
  if (storedCode && inviteCode.trim().toLowerCase() !== storedCode.toLowerCase()) {
    return { success: false, error: "Código de acesso inválido." };
  }

  await db.insert(athleteApplications).values({
    fullName: data.fullName.trim(),
    whatsapp: data.whatsapp.replace(/\D/g, ""),
    email: data.email.toLowerCase().trim(),
    cpf: data.cpf.replace(/\D/g, ""),
    rg: data.rg.trim(),
    birthDate: data.birthDate,
    city: data.city.trim(),
    state: data.state.toUpperCase(),
    photoUrl: data.photoUrl || null,
    nickname: data.nickname?.trim() || null,
    position: data.position,
    dominantFoot: data.dominantFoot,
    weightKg: data.weightKg,
    heightCm: data.heightCm,
    pixKey: data.pixKey?.trim() || null,
    contractStart: data.contractStart || null,
    salaryBrl: data.salaryBrl?.trim() || null,
  });

  revalidatePath("/admin/elenco/solicitacoes");
  return { success: true };
}

// ─── ADMIN ───────────────────────────────────────────────────────────────────

export interface AthleteApplicationRow {
  id: string;
  status: "pending" | "approved" | "rejected";
  fullName: string;
  whatsapp: string;
  email: string;
  cpf: string;
  rg: string;
  birthDate: string;
  city: string;
  state: string;
  photoUrl: string | null;
  nickname: string | null;
  position: string;
  dominantFoot: string;
  weightKg: string;
  heightCm: string;
  pixKey: string | null;
  contractStart: string | null;
  salaryBrl: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export async function getAthleteApplications(
  status?: "pending" | "approved" | "rejected"
): Promise<AthleteApplicationRow[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(athleteApplications)
    .where(status ? eq(athleteApplications.status, status) : undefined)
    .orderBy(desc(athleteApplications.createdAt));

  return rows.map((r) => ({
    id: r.id,
    status: r.status as "pending" | "approved" | "rejected",
    fullName: r.fullName,
    whatsapp: r.whatsapp,
    email: r.email,
    cpf: r.cpf,
    rg: r.rg,
    birthDate: r.birthDate,
    city: r.city,
    state: r.state,
    photoUrl: r.photoUrl,
    nickname: r.nickname,
    position: r.position,
    dominantFoot: r.dominantFoot,
    weightKg: r.weightKg,
    heightCm: r.heightCm,
    pixKey: r.pixKey,
    contractStart: r.contractStart,
    salaryBrl: r.salaryBrl,
    rejectionReason: r.rejectionReason,
    reviewedAt: r.reviewedAt ? fmtDate(r.reviewedAt) : null,
    createdAt: fmtDate(r.createdAt),
  }));
}

export async function getPendingAthleteCount(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ c: count() })
    .from(athleteApplications)
    .where(eq(athleteApplications.status, "pending"));
  return Number(row?.c ?? 0);
}

export async function approveAthleteApplication(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  try {
    await db
      .update(athleteApplications)
      .set({ status: "approved", reviewedAt: new Date() })
      .where(eq(athleteApplications.id, id));
    await logAudit("approve_athlete_application", "athlete_application", id);
    revalidatePath("/admin/elenco/solicitacoes");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao aprovar." };
  }
}

export async function rejectAthleteApplication(
  id: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  try {
    await db
      .update(athleteApplications)
      .set({ status: "rejected", rejectionReason: reason ?? null, reviewedAt: new Date() })
      .where(eq(athleteApplications.id, id));
    await logAudit("reject_athlete_application", "athlete_application", id);
    revalidatePath("/admin/elenco/solicitacoes");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao rejeitar." };
  }
}
