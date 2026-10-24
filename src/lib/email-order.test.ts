import { describe, it, expect, beforeEach, vi } from "vitest";
import { orders, orderItems } from "@/lib/db/schema";

/**
 * Confirmação de pedido: endereço e nome do serviço de frete vêm do comprador
 * (checkout público, destinatário escolhido por ele) — nunca podem virar HTML
 * dentro do e-mail enviado com a identidade do clube.
 */
const h = vi.hoisted(() => ({
  sent: [] as { to: string; html: string }[],
  order: null as unknown,
  items: [] as unknown[],
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: async (m: { to: string; html: string }) => {
        h.sent.push(m);
      },
    }),
  },
}));
vi.mock("@/lib/db/client", () => {
  const rows = (r: unknown[]) => Object.assign(Promise.resolve(r), { limit: async () => r, orderBy: async () => r });
  return {
    getDb: async () => ({
      select: () => ({
        from: (t: unknown) => ({ where: () => rows(t === orders ? [h.order] : t === orderItems ? h.items : []) }),
      }),
    }),
  };
});
vi.mock("@/lib/config", () => ({
  getSiteConfig: async () => ({ siteName: "Clube Exemplo", primaryColor: "#c19a5a", whatsapp: "", email: "", clubLogoUrl: "", city: "" }),
}));
vi.mock("@/lib/base-url", () => ({ getAppBaseUrl: async () => "https://clube.example" }));
vi.mock("@/lib/tickets/token", () => ({ signTicketToken: async () => "tok" }));

import { sendOrderConfirmation } from "./email";

const LINK = '<a href="https://attacker.invalid/x" style="background:#c19a5a">CLIQUE</a>';
const SVC = "<b>SEDEX</b>";

beforeEach(() => {
  h.sent = [];
  process.env.MAILTRAP_HOST = "smtp.test";
  process.env.MAILTRAP_USER = "u";
  process.env.MAILTRAP_PASS = "p";
  h.order = {
    id: "0d0d0d0d-0000-4000-8000-000000000001",
    customerName: "Fulano",
    customerEmail: "destino@example.test",
    shippingAddress: { cep: "01001000", logradouro: LINK, numero: "1", complemento: "<i>c</i>", bairro: "B", cidade: "C", estado: "SP" },
    shippingServiceName: SVC,
    shippingCostCents: 2000,
    totalCents: 3000,
  };
  h.items = [{ type: "product", referenceId: "p1", quantity: 1, unitPriceCents: 1000, metadata: { name: "Camisa", size: null } }];
});

describe("sendOrderConfirmation — campos do comprador escapados", () => {
  it("endereço e serviço de frete não viram HTML", async () => {
    await sendOrderConfirmation("0d0d0d0d-0000-4000-8000-000000000001");
    expect(h.sent).toHaveLength(1);
    const html = h.sent[0].html;
    expect(html).not.toContain(LINK);
    expect(html).not.toContain(SVC);
    expect(html).not.toContain("<i>c</i>");
    expect(html).toContain("&lt;a href=&quot;https://attacker.invalid/x&quot;");
    expect(html).toContain("&lt;b&gt;SEDEX&lt;/b&gt;");
  });
});
