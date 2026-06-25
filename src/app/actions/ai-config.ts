"use server";

import { getDb } from "@/lib/db/client";
import { aiProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/payment/encryption";
import { revalidatePath } from "next/cache";
import type { AIProviderRow } from "@/lib/db/schema/ai";

export interface AIProviderInput {
  name: string;
  provider: string;
  model: string;
  apiKey: string;
}

export interface AIProviderPublic extends Omit<AIProviderRow, "apiKey"> {
  apiKeyMasked: string;
}

function toPublic(row: AIProviderRow): AIProviderPublic {
  const key = decrypt(row.apiKey);
  const masked = key.length > 8 ? `${key.slice(0, 4)}••••••••${key.slice(-4)}` : "••••••••";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { apiKey: _apiKey, ...rest } = row;
  return { ...rest, apiKeyMasked: masked };
}

export async function getAIProviders(): Promise<AIProviderPublic[]> {
  const db = await getDb();
  const rows = await db.select().from(aiProviders).orderBy(aiProviders.createdAt);
  return rows.map(toPublic);
}

export async function createAIProvider(data: AIProviderInput): Promise<{ success: boolean; id?: string; error?: string }> {
  const db = await getDb();
  try {
    const [row] = await db
      .insert(aiProviders)
      .values({
        name: data.name,
        provider: data.provider.toLowerCase(),
        model: data.model.trim(),
        apiKey: encrypt(data.apiKey.trim()),
        active: false,
      })
      .returning({ id: aiProviders.id });
    revalidatePath("/admin/configuracoes/assistente");
    return { success: true, id: row.id };
  } catch {
    return { success: false, error: "Erro ao criar provedor." };
  }
}

export async function updateAIProvider(
  id: string,
  data: Partial<AIProviderInput>
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  try {
    const updates: Record<string, unknown> = {};
    if (data.name) updates.name = data.name;
    if (data.provider) updates.provider = data.provider.toLowerCase();
    if (data.model) updates.model = data.model.trim();
    if (data.apiKey) updates.apiKey = encrypt(data.apiKey.trim());
    await db.update(aiProviders).set(updates).where(eq(aiProviders.id, id));
    revalidatePath("/admin/configuracoes/assistente");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao atualizar provedor." };
  }
}

export async function setActiveAIProvider(id: string): Promise<void> {
  const db = await getDb();
  await db.update(aiProviders).set({ active: false });
  await db.update(aiProviders).set({ active: true }).where(eq(aiProviders.id, id));
  revalidatePath("/admin/configuracoes/assistente");
}

export async function deleteAIProvider(id: string): Promise<{ success: boolean }> {
  const db = await getDb();
  await db.delete(aiProviders).where(eq(aiProviders.id, id));
  revalidatePath("/admin/configuracoes/assistente");
  return { success: true };
}
