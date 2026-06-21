"use server";

import { lookupCep } from "@/lib/shipping/viacep";
import { calculateShipping as calcME } from "@/lib/shipping/melhorenvio";
import type { ShippingAddress, ShippingOption, CartItemForShipping } from "@/lib/shipping/types";
import { getSiteConfig } from "@/lib/config";
import { db } from "@/lib/db/client";
import { products, customers } from "@/lib/db/schema";
import { inArray, eq } from "drizzle-orm";

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

export async function getCustomerAddresses(
  whatsapp: string
): Promise<ShippingAddress[]> {
  const normalized = whatsapp.replace(/\D/g, "");
  if (!normalized) return [];
  const [row] = await db
    .select({ addresses: customers.addresses })
    .from(customers)
    .where(eq(customers.whatsapp, normalized))
    .limit(1);
  if (!row?.addresses) return [];
  return (row.addresses as ShippingAddress[]).slice(0, 5);
}

export async function saveCustomerAddress(
  whatsapp: string,
  address: ShippingAddress
): Promise<void> {
  const normalized = whatsapp.replace(/\D/g, "");
  if (!normalized) return;
  const [row] = await db
    .select({ addresses: customers.addresses })
    .from(customers)
    .where(eq(customers.whatsapp, normalized))
    .limit(1);
  if (!row) return;

  const existing = (row.addresses as ShippingAddress[]) ?? [];
  // Deduplicação por CEP + número
  const filtered = existing.filter(
    (a) => !(a.cep === address.cep && a.numero === address.numero)
  );
  // Mais recente primeiro, máx 5
  const next = [address, ...filtered].slice(0, 5);
  await db
    .update(customers)
    .set({ addresses: next })
    .where(eq(customers.whatsapp, normalized));
}

export async function cartRequiresShipping(
  productIds: string[]
): Promise<boolean> {
  if (productIds.length === 0) return false;
  const rows = await db
    .select({ requiresShipping: products.requiresShipping })
    .from(products)
    .where(inArray(products.id, productIds));
  return rows.some((r) => r.requiresShipping);
}

export async function getShippingOptions(
  toCep: string,
  cartItems: CartItemForShipping[],
  subtotalCents: number
): Promise<ShippingOption[]> {
  const config = await getSiteConfig();
  const originCep = config.shippingOriginCep?.replace(/\D/g, "") ?? "";
  if (originCep.length !== 8) {
    console.error("[shipping] CEP de origem inválido ou não configurado:", config.shippingOriginCep);
    return [];
  }

  // Frete grátis por valor de pedido
  const freeAbove = config.shippingFreeAboveCents ?? 0;
  const hasFreeShipping = freeAbove > 0 && subtotalCents >= freeAbove;

  const productIds = [...new Set(cartItems.map((i) => i.productId))];
  const productRows =
    productIds.length > 0
      ? await db
          .select({
            id: products.id,
            requiresShipping: products.requiresShipping,
            weightGrams: products.weightGrams,
            widthCm: products.widthCm,
            heightCm: products.heightCm,
            lengthCm: products.lengthCm,
          })
          .from(products)
          .where(inArray(products.id, productIds))
      : [];
  const prodMap = Object.fromEntries(productRows.map((p) => [p.id, p]));

  // Apenas itens que requerem envio físico
  const physicalItems = cartItems.filter(
    (item) => prodMap[item.productId]?.requiresShipping !== false
  );
  if (physicalItems.length === 0) return [];

  const shippingItems = physicalItems.map((item, idx) => {
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

  const options = await calcME(originCep, toCep, shippingItems);

  if (hasFreeShipping) {
    return [
      { id: "free", name: "Frete Grátis", company: "", priceCents: 0, deliveryMin: 0, deliveryMax: 0 },
      ...options,
    ];
  }

  return options;
}
