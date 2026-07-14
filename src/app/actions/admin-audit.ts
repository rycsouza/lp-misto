"use server";

import { getDb } from "@/lib/db/client";
import { adminAuditLog } from "@/lib/db/schema";
import { desc, count, ilike, and, gte, lte } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin/auth-guard";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/pagination";

export interface AuditLogRow {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta: unknown;
  createdAt: Date;
}

export async function getAdminAuditLog(params: {
  page?: number;
  search?: string;
  entity?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
} = {}): Promise<{ rows: AuditLogRow[]; total: number }> {
  await requireAdmin();
  const db = await getDb();
  const { page = 1, search, entity, dateFrom, dateTo, limit = ADMIN_PAGE_SIZE } = params;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (search?.trim()) {
    conditions.push(ilike(adminAuditLog.action, `%${search.trim()}%`));
  }

  if (entity) {
    conditions.push(ilike(adminAuditLog.entity, entity));
  }

  if (dateFrom) {
    conditions.push(gte(adminAuditLog.createdAt, new Date(dateFrom)));
  }

  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(adminAuditLog.createdAt, to));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ total: count() })
    .from(adminAuditLog)
    .where(whereClause);

  const rows = await db
    .select({
      id: adminAuditLog.id,
      userId: adminAuditLog.userId,
      userEmail: adminAuditLog.userEmail,
      action: adminAuditLog.action,
      entity: adminAuditLog.entity,
      entityId: adminAuditLog.entityId,
      meta: adminAuditLog.meta,
      createdAt: adminAuditLog.createdAt,
    })
    .from(adminAuditLog)
    .where(whereClause)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit)
    .offset(offset);

  return { rows, total: Number(totalRow.total) };
}
