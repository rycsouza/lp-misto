import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./customers";

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  category: text("category", {
    enum: ["camisa_oficial", "camisa_torcedor"],
  }).notNull(),
  priceCents: integer("price_cents").notNull(),
  salePriceCents: integer("sale_price_cents"),
  saleEndsAt: timestamp("sale_ends_at", { withTimezone: true }),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
  stock: integer("stock"), // null = ilimitado
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const productVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  color: text("color"), // ex: "Branca", "Preta", "Rosa" — null = sem variante de cor
  colorImageUrl: text("color_image_url"), // imagem específica da cor (sobrepõe product.imageUrl)
  size: text("size").notNull(), // PP | P | M | G | GG | XGG | Único
  stock: integer("stock"), // null = ilimitado
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerWhatsapp: text("customer_whatsapp").notNull(),
  status: text("status", {
    enum: ["pending", "paid", "cancelled", "refunded"],
  })
    .notNull()
    .default("pending"),
  totalCents: integer("total_cents").notNull(),
  pickupInfo: text("pickup_info"), // null = entrega (futuro) | texto = local de retirada
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["ticket", "product", "raffle"] }).notNull(),
  // FK polimórfica: aponta para games.id (ticket) ou products.id (product)
  // Integridade enforçada na aplicação via Drizzle
  referenceId: uuid("reference_id"),
  quantity: integer("quantity").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull(), // snapshot do preço no momento da compra
  metadata: jsonb("metadata"), // dados extras: tipo ingresso, nº da sorte, etc.
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  gatewaySlug: text("gateway_slug").notNull(),
  gatewayPaymentId: text("gateway_payment_id"),
  status: text("status", {
    enum: ["pending", "paid", "failed", "refunded"],
  })
    .notNull()
    .default("pending"),
  amountCents: integer("amount_cents").notNull(),
  pixQrCode: text("pix_qr_code"), // payload EMV BR Code
  pixQrCodeUrl: text("pix_qr_code_url"), // URL da imagem do QR Code
  pixExpiresAt: timestamp("pix_expires_at", { withTimezone: true }), // quando o PIX expira (30min)
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
