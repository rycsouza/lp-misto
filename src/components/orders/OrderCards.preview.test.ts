import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrderCard, type OrderData } from "./OrderCards";

/** Pedido pago de retirada com ingresso, como sai de enrichOrders SEM credenciais. */
function order(over: Record<string, unknown> = {}): OrderData {
  return {
    id: "a1b2c3d4-0000-4000-8000-000000000001",
    status: "paid",
    createdAt: new Date("2026-10-30T15:00:00-03:00"),
    totalCents: 12990,
    fulfillmentStatus: "pending",
    deliveredAt: null,
    payment: null,
    clubLogoUrl: null,
    siteName: "Clube A",
    items: [
      {
        id: "i1",
        type: "product",
        quantity: 1,
        unitPriceCents: 9990,
        referenceId: "p1",
        metadata: { name: "Camisa Oficial", size: "G", color: "Preta" },
        game: null,
      },
      {
        id: "i2",
        type: "ticket",
        quantity: 1,
        unitPriceCents: 3000,
        referenceId: "g1",
        metadata: { ticketType: "inteira", typeName: "Inteira" },
        game: null,
      },
    ],
    tickets: [
      { id: "oculto-a1b2c3d4-0", gameId: "g1", typeCode: "inteira", typeName: "Inteira", status: "valid", serialNo: null, validatedAt: null, qrToken: undefined },
    ],
    pickupCode: null,
    raffleNumbers: [],
    credentialsHidden: true,
    pickupHidden: true,
    ...over,
  } as unknown as OrderData;
}

describe("OrderCard: prévia do admin (visão do cliente)", () => {
  it("mostra itens, QR e código de retirada como marcadores, sem o aviso de 'só no link'", () => {
    const html = renderToStaticMarkup(createElement(OrderCard, { order: order(), siteName: "Clube A", preview: true }));
    expect(html).toContain("Camisa Oficial");
    expect(html).toContain("Preta · G");
    expect(html).toContain("QR do cliente");
    expect(html).toContain("Código de retirada");
    expect(html).toContain("••••");
    expect(html).not.toContain("Por segurança");
    // Nenhum QR desenhado (qrcode.react usa crispEdges) nem id de ingresso chega à prévia.
    expect(html).not.toContain("crispEdges");
    expect(html).not.toContain("oculto-");
  });

  it("sem prévia, o mesmo pedido sem credenciais segue com o aviso de segurança", () => {
    const html = renderToStaticMarkup(createElement(OrderCard, { order: order(), siteName: "Clube A" }));
    expect(html).toContain("Por segurança");
    expect(html).not.toContain("QR do cliente");
  });
});
