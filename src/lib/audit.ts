import { db } from "@/lib/db/client";
import { adminAuditLog } from "@/lib/db/schema";
import { getAdminSession } from "@/app/actions/admin-auth";

export async function logAudit(
  action: string,
  entity: string,
  entityId?: string | null,
  meta?: Record<string, unknown> | null
) {
  try {
    const session = await getAdminSession();
    await db.insert(adminAuditLog).values({
      userId: session?.userId ?? null,
      userEmail: session?.email ?? null,
      action,
      entity,
      entityId: entityId ?? null,
      meta: meta ?? null,
    });
  } catch {
    // Não deixar erro de log derrubar a action principal
  }
}
