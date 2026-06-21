"use server";

import { lookupCep } from "@/lib/shipping/viacep";
import { calculateShipping as calcME } from "@/lib/shipping/melhorenvio";
import type { ShippingOption, CartItemForShipping } from "@/lib/shipping/types";
import { getSiteConfig } from "@/lib/config";
import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

export async function lookupAddress(
  cep: string
): Promise<{ logradouro: string; bairro: string; cidade: string; estado: string } | null> {
  const result = await lookupCep(cep);
  if (!result) return null;
  return {
    logradouro: result.logradouro,
    bairro: result.bairro,
    cidade: result.localidade,
    estado: result.uf,
  };
}

export async function getShippingOptions(
  toCep: string,
  cartItems: CartItemForShipping[]
): Promise<ShippingOption[]> {
  const config = await getSiteConfig();
  const originCep = config.shippingOriginCep?.replace(/\D/g, "") ?? "";
  if (originCep.length !== 8) {
    console.error("[shipping] CEP de origem inválido ou não configurado:", config.shippingOriginCep);
    return [];
  }

  const productIds = [...new Set(cartItems.map((i) => i.productId))];
  const productRows =
    productIds.length > 0
      ? await db
          .select({
            id: products.id,
            weightGrams: products.weightGrams,
            widthCm: products.widthCm,
            heightCm: products.heightCm,
            lengthCm: products.lengthCm,
          })
          .from(products)
          .where(inArray(products.id, productIds))
      : [];
  const prodMap = Object.fromEntries(productRows.map((p) => [p.id, p]));

  const shippingItems = cartItems.map((item, idx) => {
    const p = prodMap[item.productId];
    return {
      id: String(idx + 1),
      width: p?.widthCm ?? 20,
      height: p?.heightCm ?? 5,
      length: p?.lengthCm ?? 30,
      weight: (p?.weightGrams ?? 500) / 1000,
      insurance_value: (item.unitPriceCents * item.quantity) / 100,
      quantity: item.quantity,
    };
  });

  return calcME(originCep, toCep, shippingItems);
}
