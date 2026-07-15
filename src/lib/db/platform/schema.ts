import { pgTable, text, uuid, timestamp, boolean, primaryKey } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  databaseUrl: text("database_url").notNull(),
  status: text("status").notNull().default("active"),
  plan: text("plan").notNull().default("standard"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizationDomains = pgTable("organization_domains", {
  domain: text("domain").primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Admins do SISTEMA (plataforma) — nível acima do admin de tenant. Vivem no
 * platform DB, desacoplados de qualquer clube. Autenticam num fluxo próprio
 * (cookie/JWT de escopo "platform") e podem trocar de contexto entre tenants.
 * NÃO confundir com `adminUsers`, que é por-tenant, dentro do DB de cada clube.
 */
export const platformAdmins = pgTable("platform_admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Kill-switch global de features. Uma linha por feature (ver o registry em
 * src/lib/platform/features.ts). `enabled=false` esconde a feature de TODOS os
 * clubes e usuários (nav + rotas + actions). Ausência de linha = ligado (default).
 */
export const platformFeatureFlags = pgTable("platform_feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

/**
 * Exceção por clube ao flag global. Ex.: feature ligada globalmente mas desligada
 * só no clube X (ou vice-versa). `enabled` aqui SOBRESCREVE o global para aquele
 * org. Ausência de override = usa o valor global.
 */
export const platformFeatureOverrides = pgTable(
  "platform_feature_overrides",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    enabled: boolean("enabled").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by"),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.key] })]
);
