import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Conta do cliente (área logada /conta). Login por WhatsApp + senha (o mesmo
 * identificador do checkout). O que liga pedidos (orders.customer_email) e sócio
 * (members.email) à conta é o e-mail CONFIRMADO — o WhatsApp não é verificado,
 * então sozinho não dá acesso a dados de ninguém.
 */
export const customerAccounts = pgTable("customer_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Sempre minúsculo.
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  // Só dígitos, DDD + número (11). Único: é o login. NULL = conta antiga (e-mail).
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
}, (t) => [uniqueIndex("customer_accounts_whatsapp_idx").on(t.whatsapp)]);
