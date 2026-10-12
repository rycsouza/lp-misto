import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Conta do cliente (área logada /conta). Separada de `customers` (chaveada por
 * WhatsApp, NÃO verificado): a conta é chaveada pelo e-mail CONFIRMADO, que é o
 * que liga pedidos (orders.customer_email) e sócio (members.email) a ela.
 */
export const customerAccounts = pgTable("customer_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Sempre minúsculo.
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  whatsapp: text("whatsapp"),
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  // Versão da senha: trocar a senha invalida sessões e links de redefinição antigos.
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
