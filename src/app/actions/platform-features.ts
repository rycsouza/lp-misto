"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getPlatformDb } from "@/lib/db/platform/client";
import { platformFeatureFlags, platformFeatureOverrides } from "@/lib/db/platform/schema";
import { getPlatformSession } from "@/app/actions/platform-auth";
import { FEATURES } from "@/lib/platform/features";

const VALID_KEYS = new Set(FEATURES.map((f) => f.key));

export interface FeatureFlagsState {
  global: Record<string, boolean>; // key -> enabled (default true se ausente)
  overrides: Record<string, Record<string, boolean>>; // orgId -> key -> enabled
}

/** Estado atual dos flags para a UI do console. Só admin do sistema. */
export async function getFeatureFlagsState(): Promise<FeatureFlagsState> {
  const session = await getPlatformSession();
  if (!session) throw new Error("Não autorizado");

  const db = getPlatformDb();
  const [globals, overrides] = await Promise.all([
    db.select().from(platformFeatureFlags),
    db.select().from(platformFeatureOverrides),
  ]);

  const global: Record<string, boolean> = {};
  for (const g of globals) global[g.key] = g.enabled;

  const byOrg: Record<string, Record<string, boolean>> = {};
  for (const o of overrides) {
    (byOrg[o.orgId] ??= {})[o.key] = o.enabled;
  }

  return { global, overrides: byOrg };
}

/** Liga/desliga uma feature GLOBALMENTE (todos os clubes). */
export async function setGlobalFeatureFlag(key: string, enabled: boolean): Promise<{ success: boolean }> {
  const session = await getPlatformSession();
  if (!session) throw new Error("Não autorizado");
  if (!VALID_KEYS.has(key)) throw new Error("Feature inválida");

  await getPlatformDb()
    .insert(platformFeatureFlags)
    .values({ key, enabled, updatedBy: session.email })
    .onConflictDoUpdate({
      target: platformFeatureFlags.key,
      set: { enabled, updatedAt: new Date(), updatedBy: session.email },
    });

  revalidatePath("/admin/sistema/features");
  return { success: true };
}

/**
 * Define a exceção de uma feature para um clube. mode:
 * - "inherit": remove o override (volta a seguir o global);
 * - "on"/"off": força ligado/desligado só nesse clube.
 */
export async function setOrgFeatureOverride(
  orgId: string,
  key: string,
  mode: "inherit" | "on" | "off"
): Promise<{ success: boolean }> {
  const session = await getPlatformSession();
  if (!session) throw new Error("Não autorizado");
  if (!VALID_KEYS.has(key)) throw new Error("Feature inválida");

  const db = getPlatformDb();
  if (mode === "inherit") {
    await db
      .delete(platformFeatureOverrides)
      .where(and(eq(platformFeatureOverrides.orgId, orgId), eq(platformFeatureOverrides.key, key)));
  } else {
    const enabled = mode === "on";
    await db
      .insert(platformFeatureOverrides)
      .values({ orgId, key, enabled, updatedBy: session.email })
      .onConflictDoUpdate({
        target: [platformFeatureOverrides.orgId, platformFeatureOverrides.key],
        set: { enabled, updatedAt: new Date(), updatedBy: session.email },
      });
  }

  revalidatePath("/admin/sistema/features");
  return { success: true };
}
