import type { ShippingOption } from "./types";

export interface ShippingItem {
  id: string;
  width: number;   // cm
  height: number;  // cm
  length: number;  // cm
  weight: number;  // kg
  insurance_value: number; // R$ (float)
  quantity: number;
}

type MEResponseItem = {
  id?: unknown;
  name?: unknown;
  price?: unknown;
  error?: unknown;
  company?: { name?: unknown };
  delivery_range?: { min?: unknown; max?: unknown };
};

export async function calculateShipping(
  fromCep: string,
  toCep: string,
  items: ShippingItem[]
): Promise<ShippingOption[]> {
  const token = process.env.MELHOR_ENVIO_TOKEN;
  if (!token) {
    console.error("[melhorenvio] MELHOR_ENVIO_TOKEN não configurado");
    return [];
  }
  console.log("[melhorenvio] token length:", token.length, "| starts with:", token.slice(0, 10));

  const isSandbox = process.env.MELHOR_ENVIO_SANDBOX === "true";
  const baseUrl = isSandbox
    ? "https://sandbox.melhorenvio.com.br"
    : "https://melhorenvio.com.br";

  const body = {
    from: { postal_code: fromCep.replace(/\D/g, "") },
    to: { postal_code: toCep.replace(/\D/g, "") },
    products: items,
    options: { receipt: false, own_hand: false },
    services: "1,2,17,18", // PAC, SEDEX, Jadlog .Package, Jadlog .Com
  };

  try {
    const res = await fetch(`${baseUrl}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "MistoEC/1.0 (contato@mistoec.com.br)",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[melhorenvio] API retornou", res.status, text.slice(0, 300));
      return [];
    }
    const data = await res.json();
    console.log("[melhorenvio] resposta:", JSON.stringify(data).slice(0, 500));
    if (!Array.isArray(data)) return [];

    return (data as MEResponseItem[])
      .filter((opt) => !opt.error && opt.price)
      .map((opt) => ({
        id: String(opt.id ?? ""),
        name: String(opt.name ?? ""),
        company: String(opt.company?.name ?? ""),
        priceCents: Math.round(Number(opt.price) * 100),
        deliveryMin: Number(opt.delivery_range?.min ?? 0),
        deliveryMax: Number(opt.delivery_range?.max ?? 0),
      }))
      .sort((a, b) => a.priceCents - b.priceCents);
  } catch (err) {
    console.error("[melhorenvio] erro na chamada:", err);
    return [];
  }
}
