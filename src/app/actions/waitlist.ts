"use server";

import { db } from "@/lib/db/client";
import { productWaitlist } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export interface JoinWaitlistInput {
  productId: string;
  name: string;
  email: string;
  whatsapp: string;
}

export async function joinWaitlist(
  input: JoinWaitlistInput
): Promise<{ success: boolean; error?: string }> {
  const { productId, name, email, whatsapp } = input;

  if (!productId || !name.trim() || !email.trim() || !whatsapp.trim()) {
    return { success: false, error: "Preencha todos os campos." };
  }

  const digits = whatsapp.replace(/\D/g, "");
  if (digits.length < 10) {
    return { success: false, error: "WhatsApp inválido." };
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) {
    return { success: false, error: "E-mail inválido." };
  }

  // Prevent duplicate entries for same email+product
  const [existing] = await db
    .select({ id: productWaitlist.id })
    .from(productWaitlist)
    .where(and(eq(productWaitlist.productId, productId), eq(productWaitlist.email, email.toLowerCase().trim())))
    .limit(1);

  if (existing) {
    return { success: true }; // idempotent — already registered
  }

  await db.insert(productWaitlist).values({
    productId,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    whatsapp: digits,
  });

  return { success: true };
}
