import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "editor"] }).notNull().default("editor"),
  // JSONB: { pedidos: true, jogos: false, noticias: true, ... }
  // Para role='admin': ignorado (tem acesso total)
  // Para role='editor': define quais módulos pode acessar
  permissions: jsonb("permissions").notNull().default({}),
  invitedBy: uuid("invited_by"), // sem FK para evitar circular
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const adminInvites = pgTable("admin_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "editor"] }).notNull().default("editor"),
  permissions: jsonb("permissions").notNull().default({}),
  invitedBy: uuid("invited_by").notNull(), // id do admin que convidou
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type AdminInvite = typeof adminInvites.$inferSelect;
export type AdminPermissions = Record<string, boolean>;
