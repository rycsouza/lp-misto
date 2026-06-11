"use client";

import { useState, useEffect, useCallback } from "react";

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  priceCents: number;
  variantId: string | null;
  color: string | null;
  size: string | null;
  quantity: number;
}

const STORAGE_KEY = "misto_cart";
const CART_EVENT = "misto_cart_updated";

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(CART_EVENT));
  } catch { /* ignore */ }
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(readCart());
    const sync = () => setItems(readCart());
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const addItem = useCallback((item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
    const current = readCart();
    const key = `${item.productId}__${item.variantId ?? ""}`;
    const existing = current.find(
      (i) => `${i.productId}__${i.variantId ?? ""}` === key
    );
    let updated: CartItem[];
    if (existing) {
      updated = current.map((i) =>
        `${i.productId}__${i.variantId ?? ""}` === key
          ? { ...i, quantity: i.quantity + (item.quantity ?? 1) }
          : i
      );
    } else {
      updated = [...current, { ...item, quantity: item.quantity ?? 1 }];
    }
    writeCart(updated);
    setItems(updated);
  }, []);

  const removeItem = useCallback((productId: string, variantId: string | null) => {
    const updated = readCart().filter(
      (i) => !(i.productId === productId && i.variantId === variantId)
    );
    writeCart(updated);
    setItems(updated);
  }, []);

  const updateQuantity = useCallback(
    (productId: string, variantId: string | null, quantity: number) => {
      const current = readCart();
      const updated =
        quantity <= 0
          ? current.filter(
              (i) => !(i.productId === productId && i.variantId === variantId)
            )
          : current.map((i) =>
              i.productId === productId && i.variantId === variantId
                ? { ...i, quantity }
                : i
            );
      writeCart(updated);
      setItems(updated);
    },
    []
  );

  const clearCart = useCallback(() => {
    writeCart([]);
    setItems([]);
  }, []);

  const totalCents = items.reduce((acc, i) => acc + i.priceCents * i.quantity, 0);
  const totalItems = items.reduce((acc, i) => acc + i.quantity, 0);

  return { items, addItem, removeItem, updateQuantity, clearCart, totalCents, totalItems };
}
