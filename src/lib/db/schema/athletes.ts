import { date, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const athleteApplications = pgTable("athlete_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  fullName: text("full_name").notNull(),
  whatsapp: text("whatsapp").notNull(),
  email: text("email").notNull(),
  cpf: text("cpf").notNull(),
  rg: text("rg").notNull(),
  birthDate: date("birth_date").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  nickname: text("nickname"),
  position: text("position").notNull(),
  dominantFoot: text("dominant_foot").notNull(),
  weightKg: text("weight_kg").notNull(),
  heightCm: text("height_cm").notNull(),
  pixKey: text("pix_key"),
  contractStart: date("contract_start"),
  salaryBrl: text("salary_brl"),
  rejectionReason: text("rejection_reason"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
