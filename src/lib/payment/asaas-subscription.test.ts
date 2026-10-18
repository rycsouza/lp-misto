import { describe, it, expect, afterEach, vi } from "vitest";
import { AsaasSubscriptionClient } from "./asaas-subscription";

/**
 * Listagem de cobranças da assinatura no Asaas (histórico e ledger): paginação por
 * `hasMore` com teto, e mapeamento dos campos (líquido só quando o gateway informa).
 */
function mockFetch(pages: unknown[]) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    calls.push(url);
    const page = pages[Math.min(calls.length - 1, pages.length - 1)];
    return new Response(JSON.stringify(page), { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const client = () => new AsaasSubscriptionClient({ apiKey: "chave-de-teste", sandbox: true });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AsaasSubscriptionClient.listSubscriptionPayments", () => {
  it("pagina enquanto hasMore for verdadeiro e junta as cobranças", async () => {
    const calls = mockFetch([
      {
        hasMore: true,
        data: [{ id: "pay_2", dueDate: "2026-09-10", value: 99.9, status: "RECEIVED" }],
      },
      {
        hasMore: false,
        data: [{ id: "pay_1", dueDate: "2026-08-10", value: 99.9, status: "RECEIVED" }],
      },
    ]);
    const out = await client().listSubscriptionPayments("sub_1");

    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("/subscriptions/sub_1/payments?limit=100&offset=0");
    expect(calls[1]).toContain("offset=100");
    expect(out.map((p) => p.gatewayPaymentId)).toEqual(["pay_2", "pay_1"]);
  });

  it("uma página sem hasMore faz uma única chamada", async () => {
    const calls = mockFetch([{ hasMore: false, data: [] }]);
    expect(await client().listSubscriptionPayments("sub_1")).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it("teto de páginas: não pagina sem fim mesmo se o gateway disser hasMore sempre", async () => {
    const calls = mockFetch([{ hasMore: true, data: [] }]);
    await client().listSubscriptionPayments("sub_1");
    expect(calls).toHaveLength(20);
  });

  it("mapeia valor, líquido, data de pagamento e forma de pagamento", async () => {
    mockFetch([
      {
        hasMore: false,
        data: [
          {
            id: "pay_1",
            dueDate: "2026-09-10",
            value: 99.9,
            netValue: 96.5,
            status: "CONFIRMED",
            paymentDate: "2026-09-10",
            billingType: "CREDIT_CARD",
            invoiceUrl: "https://www.asaas.com/i/abc",
          },
        ],
      },
    ]);
    const [p] = await client().listSubscriptionPayments("sub_1");
    expect(p).toEqual({
      dueDate: "2026-09-10",
      valueCents: 9990,
      status: "CONFIRMED",
      invoiceUrl: "https://www.asaas.com/i/abc",
      gatewayPaymentId: "pay_1",
      netValueCents: 9650,
      paymentDate: "2026-09-10",
      billingType: "CREDIT_CARD",
    });
  });

  it("líquido ausente na resposta → null (não inventa valor)", async () => {
    mockFetch([{ hasMore: false, data: [{ id: "pay_1", value: 50, status: "PENDING" }] }]);
    const [p] = await client().listSubscriptionPayments("sub_1");
    expect(p.netValueCents).toBeNull();
    expect(p.paymentDate).toBeNull();
    expect(p.billingType).toBeNull();
  });

  it("valor inválido vira 0 e id ausente vira null (nunca NaN nem id inventado)", async () => {
    mockFetch([{ hasMore: false, data: [{ value: "abc", status: "PENDING" }] }]);
    const [p] = await client().listSubscriptionPayments("sub_1");
    expect(p.valueCents).toBe(0);
    expect(p.gatewayPaymentId).toBeNull();
  });

  it("URL de fatura fora do Asaas é descartada", async () => {
    mockFetch([{ hasMore: false, data: [{ id: "pay_1", value: 1, invoiceUrl: "https://evil.example/x" }] }]);
    const [p] = await client().listSubscriptionPayments("sub_1");
    expect(p.invoiceUrl).toBeNull();
  });
});
