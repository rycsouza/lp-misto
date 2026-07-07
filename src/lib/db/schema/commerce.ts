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
import { games } from "./content";

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
  comingSoon: boolean("coming_soon").notNull().default(false),
  limitedStock: boolean("limited_stock").notNull().default(false),
  order: integer("order").notNull().default(0),
  stock: integer("stock"), // null = ilimitado
  requiresShipping: boolean("requires_shipping").notNull().default(true),
  weightGrams: integer("weight_grams"), // null = usar padrão 500g
  widthCm: integer("width_cm"),   // null = usar padrão 20cm
  heightCm: integer("height_cm"), // null = usar padrão 5cm
  lengthCm: integer("length_cm"), // null = usar padrão 30cm
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const productWaitlist = pgTable("product_waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  whatsapp: text("whatsapp").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
  // Preço próprio da variante em centavos. null = usa o preço do produto.
  priceCents: integer("price_cents"),
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
  // Bar Online: jogo ao qual a ficha está vinculada (null p/ pedidos não-bar).
  gameId: uuid("game_id").references(() => games.id, { onDelete: "set null" }),
  status: text("status", {
    enum: ["pending", "paid", "cancelled", "refunded"],
  })
    .notNull()
    .default("pending"),
  // Status de retirada/entrega — separado do status de pagamento.
  // pending: aguardando preparo · ready: pronto para retirada · delivered: retirado
  fulfillmentStatus: text("fulfillment_status", {
    enum: ["pending", "ready", "delivered"],
  })
    .notNull()
    .default("pending"),
  // Código curto digitável (6 dígitos) que o cliente informa na retirada (estilo iFood).
  // Gerado sob demanda para pedidos de retirada pagos com produto físico.
  pickupCode: text("pickup_code"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  deliveredBy: text("delivered_by"), // nome do admin que validou a retirada
  totalCents: integer("total_cents").notNull(),
  // Bar Online: taxa de serviço aplicada (null p/ pedidos não-bar). Já embutida em totalCents.
  serviceFeeCents: integer("service_fee_cents"),
  // Chave de idempotência por tentativa de checkout (gerada no client). Índice
  // único garante que retry/duplo-clique não crie pedido nem cobrança duplicados.
  idempotencyKey: text("idempotency_key"),
  affiliateCode: text("affiliate_code"),
  pickupInfo: text("pickup_info"),
  shippingAddress: jsonb("shipping_address"), // { cep, logradouro, numero, complemento, bairro, cidade, estado }
  shippingCostCents: integer("shipping_cost_cents"),
  shippingServiceName: text("shipping_service_name"), // ex: "Correios SEDEX"
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
  type: text("type", { enum: ["ticket", "product", "raffle", "bar"] }).notNull(),
  // FK polimórfica: aponta para games.id (ticket), products.id (product)
  // ou bar_menu_items.id (bar)
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
