import { describe, it, expect, afterEach, vi } from "vitest";
import {
  AsaasSubscriptionClient,
  normalizePixAutomaticStatus,
  pixAutomaticDescription,
  safeBase64Image,
} from "./asaas-subscription";

/**
 * Pix Automático no Asaas: corpo da autorização (Jornada 3, modo SUBSCRIPTION), leitura da
 * autorização, cancelamento e a 1ª mensalidade (QR imediato, fora da assinatura).
 */
type Call = { url: string; method: string; body: Record<string, unknown> | null };

function mockFetch(responses: unknown[]) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
      const r = responses[Math.min(calls.length - 1, responses.length - 1)];
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    })
  );
  return calls;
}

const client = () => new AsaasSubscriptionClient({ apiKey: "chave-de-teste", sandbox: true });

const input = {
  memberName: "Titular Exemplo",
  memberEmail: "titular@example.com",
  memberPhone: "(11) 90000-0000",
  cpf: "52998224725",
  externalRef: "member-1",
  planName: "Ouro",
  programName: "Sócio Carcará",
  amountCents: 2990,
  contractId: "SOCIO-ABC-123",
  startDate: "2026-12-06",
  expirationSeconds: 3600,
};

afterEach(() => vi.unstubAllGlobals());

describe("createPixAutomaticAuthorization", () => {
  it("cria o cliente e a autorização mensal no modo SUBSCRIPTION, com o QR da 1ª mensalidade", async () => {
    const calls = mockFetch([
      { id: "cus_1" },
      { id: "auth_1", status: "CREATED", payload: "000201PIX", encodedImage: "iVBORw0KGgo=", immediateQrCode: { expirationDate: "2026-11-06T13:00:00Z" } },
    ]);
    const r = await client().createPixAutomaticAuthorization(input);

    expect(calls[0].url).toContain("/customers");
    expect(calls[0].body).toMatchObject({ cpfCnpj: "52998224725", mobilePhone: "11900000000" });
    expect(calls[1].url).toContain("/pix/automatic/authorizations");
    expect(calls[1].method).toBe("POST");
    expect(calls[1].body).toEqual({
      frequency: "MONTHLY",
      contractId: "SOCIO-ABC-123",
      startDate: "2026-12-06",
      value: 29.9,
      description: "Sócio Carcará — Ouro",
      customerId: "cus_1",
      paymentCreationMode: "SUBSCRIPTION",
      retryPolicy: "ALLOW_THREE_IN_SEVEN_DAYS",
      immediateQrCode: { expirationSeconds: 3600, originalValue: 29.9, description: "Sócio Carcará — Ouro" },
    });
    expect(r).toEqual({
      gatewayCustomerId: "cus_1",
      authorizationId: "auth_1",
      qrPayload: "000201PIX",
      qrImageBase64: "iVBORw0KGgo=",
      expiresAt: "2026-11-06T13:00:00Z",
    });
  });

  it("nenhum dado de cartão vai ao gateway", async () => {
    const calls = mockFetch([{ id: "cus_1" }, { id: "auth_1", payload: "x" }]);
    await client().createPixAutomaticAuthorization(input);
    const json = JSON.stringify(calls.map((c) => c.body));
    expect(json).not.toMatch(/creditCard|ccv|holderName/);
  });

  it("resposta sem id ou sem QR: lança (a adesão mostra erro, não sucesso)", async () => {
    mockFetch([{ id: "cus_1" }, { id: "auth_1" }]);
    await expect(client().createPixAutomaticAuthorization(input)).rejects.toThrow();
  });

  it("data de início inválida: lança antes de chamar o gateway", async () => {
    const calls = mockFetch([{}]);
    await expect(client().createPixAutomaticAuthorization({ ...input, startDate: "06/12/2026" })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe("getPixAutomaticAuthorization / cancel", () => {
  it("lê status, assinatura criada pelo gateway, cliente e início", async () => {
    const calls = mockFetch([{ id: "auth_1", status: "ACTIVE", subscriptionId: "sub_9", customerId: "cus_1", startDate: "2026-12-06" }]);
    const r = await client().getPixAutomaticAuthorization("auth_1");
    expect(calls[0].url).toContain("/pix/automatic/authorizations/auth_1");
    expect(r).toEqual({ id: "auth_1", status: "ACTIVE", subscriptionId: "sub_9", customerId: "cus_1", startDate: "2026-12-06" });
  });

  it("status desconhecido vira UNKNOWN; assinatura ausente vira null", async () => {
    mockFetch([{ id: "auth_1", status: "WHATEVER", subscriptionId: null }]);
    const r = await client().getPixAutomaticAuthorization("auth_1");
    expect(r.status).toBe("UNKNOWN");
    expect(r.subscriptionId).toBeNull();
  });

  it("cancelamento usa DELETE com o id codificado", async () => {
    const calls = mockFetch([{}]);
    await client().cancelPixAutomaticAuthorization("auth/1");
    expect(calls[0].method).toBe("DELETE");
    expect(calls[0].url).toContain("/pix/automatic/authorizations/auth%2F1");
  });
});

describe("findPixAutomaticFirstPayment", () => {
  it("devolve a cobrança paga SEM assinatura do cliente (o QR imediato)", async () => {
    const calls = mockFetch([
      {
        data: [
          { id: "pay_sub", subscription: "sub_9", status: "RECEIVED", value: 29.9, dueDate: "2026-12-06" },
          { id: "pay_pend", subscription: null, status: "PENDING", value: 29.9, dueDate: "2026-11-06" },
          { id: "pay_qr", subscription: null, status: "RECEIVED", value: 29.9, netValue: 29.5, dueDate: "2026-11-06", billingType: "PIX" },
        ],
      },
    ]);
    const r = await client().findPixAutomaticFirstPayment("cus_1");
    expect(calls[0].url).toContain("/payments?customer=cus_1");
    expect(r).toMatchObject({ gatewayPaymentId: "pay_qr", valueCents: 2990, netValueCents: 2950, billingType: "PIX" });
  });

  it("sem cobrança paga avulsa: null", async () => {
    mockFetch([{ data: [{ id: "p", subscription: null, status: "PENDING" }] }]);
    expect(await client().findPixAutomaticFirstPayment("cus_1")).toBeNull();
  });
});

describe("helpers", () => {
  it("normalizePixAutomaticStatus só aceita os status conhecidos", () => {
    for (const s of ["CREATED", "ACTIVE", "CANCELLED", "REFUSED", "EXPIRED"]) expect(normalizePixAutomaticStatus(s)).toBe(s);
    expect(normalizePixAutomaticStatus("active")).toBe("UNKNOWN");
    expect(normalizePixAutomaticStatus(null)).toBe("UNKNOWN");
  });

  it("descrição respeita 35 caracteres e usa o padrão sem nome de programa", () => {
    expect(pixAutomaticDescription(undefined, "Ouro")).toBe("Sócio-Torcedor — Ouro");
    const long = pixAutomaticDescription("Programa de Sócio Muito Comprido", "Plano Diamante");
    expect(long.length).toBeLessThanOrEqual(35);
    expect(long.endsWith("…")).toBe(true);
  });

  it("safeBase64Image recusa o que não é base64 (ex.: data: URL, HTML)", () => {
    expect(safeBase64Image("iVBORw0KGgo=")).toBe("iVBORw0KGgo=");
    expect(safeBase64Image("data:image/png;base64,iVBOR")).toBeNull();
    expect(safeBase64Image("<svg onload=alert(1)>")).toBeNull();
    expect(safeBase64Image("")).toBeNull();
    expect(safeBase64Image(123)).toBeNull();
  });
});
