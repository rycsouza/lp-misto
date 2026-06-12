import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const adminAuditLog = pgTable("admin_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"), // null se não autenticado (raro)
  userEmail: text("user_email"),
  action: text("action").notNull(), // ex: "create_news", "delete_player"
  entity: text("entity").notNull(), // ex: "news", "player", "order"
  entityId: text("entity_id"),      // id do registro afetado
  meta: jsonb("meta"),              // dados extras (ex: { title: "..." })
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminAuditLogEntry = typeof adminAuditLog.$inferSelect;
