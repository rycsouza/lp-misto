"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { AFFILIATE_COOKIE } from "@/lib/affiliates/utils";

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.email("E-mail inválido"),
  whatsapp: z.string().optional(),
  metadata: z.string().optional(),
  _hp: z.string().optional(),
});

type LeadSource =
  | "ticket_checkout"
  | "membership_interest"
  | "sponsorship_interest"
  | "newsletter"
  | "history_gallery";

interface ActionState {
  success: boolean;
  error?: string;
}

export async function createLead(
  source: LeadSource,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    whatsapp: (formData.get("whatsapp") as string | null) ?? undefined,
    metadata: (formData.get("metadata") as string | null) ?? undefined,
    _hp: (formData.get("_hp") as string | null) ?? undefined,
  };

  if (raw._hp) {
    return { success: true };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Dados inválidos";
    return { success: false, error: first };
  }

  let metadataJson: Record<string, unknown> | undefined;
  if (parsed.data.metadata) {
    try {
      metadataJson = JSON.parse(parsed.data.metadata);
    } catch {
      metadataJson = { raw: parsed.data.metadata };
    }
  }

  try {
    const cookieStore = await cookies();
    const affiliateCode = cookieStore.get(AFFILIATE_COOKIE)?.value ?? null;

    await db
      .insert(leads)
      .values({
        name: parsed.data.name,
        email: parsed.data.email,
        whatsapp: parsed.data.whatsapp ?? null,
        source,
        metadata: metadataJson ?? null,
        affiliateCode,
      })
      .onConflictDoNothing();

    return { success: true };
  } catch (err) {
    console.error("createLead error:", err);
    return { success: false, error: "Erro ao salvar. Tente novamente." };
  }
}
