import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Cartão no Asaas SEM tokenização: o cartão vai direto na criação da cobrança
 * (/payments) e da assinatura (/subscriptions). Em produção, /creditCard/tokenize
 * exige liberação do gerente de contas (403 sem ela) — nenhum fluxo pode chamá-lo.
 * fetch é mockado: nenhuma chamada real sai do teste.
 */
type Call = { url: string; method: string; body: Record<string, unknown> | null };
const h = vi.hoisted(() => ({
  calls: [] as { url: string; method: string; body: Record<string, unknown> | null }[],
  respond: (() => ({ status: 200, body: {} })) as (url: string) => { status: number; body: unknown },
}));

vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
  h.calls.push({
    url,
    method: init?.method ?? "GET",
    body: init?.body ? JSON.parse(String(init.body)) : null,
  });
  const r = h.respond(url);
  return new Response(JSON.stringify(r.body), { status: r.status });
});

import { AsaasGateway } from "./asaas";
import { AsaasSubscriptionClient, safeAsaasInvoiceUrl } from "./asaas-subscription";

const CARD = {
  holderName: "TITULAR EXEMPLO",
  number: "4000 0000 0000 0010",
  expiryMonth: "12",
  expiryYear: "2030",
  ccv: "123",
  cpfCnpj: "000.000.000-00",
  postalCode: "01001-000",
  addressNumber: "1",
};

function defaultRespond(url: string) {
  if (url.endsWith("/customers")) return { status: 200, body: { id: "cus_1" } };
  if (url.endsWith("/payments")) return { status: 200, body: { id: "pay_1", status: "CONFIRMED" } };
  if (url.endsWith("/subscriptions")) return { status: 200, body: { id: "sub_1" } };
  return { status: 404, body: {} };
}

const byPath = (calls: Call[], suffix: string) => calls.find((c) => c.url.endsWith(suffix));

beforeEach(() => {
  h.calls = [];
  h.respond = defaultRespond;
});

describe("AsaasGateway — cobrança com cartão direto (sem tokenização)", () => {
  const gw = new AsaasGateway({ apiKey: "test-key", sandbox: "false" });
  const input = {
    orderId: "order-1",
    amountCents: 5000,
    customerName: "Titular Exemplo",
    customerEmail: "titular@example.com",
    customerPhone: "(11) 90000-0000",
    description: "Pedido teste",
    method: "credit_card" as const,
    asaasCardData: CARD,
    remoteIp: "203.0.113.10",
  };

  it("não chama /creditCard/tokenize", async () => {
    await gw.createPayment(input);
    expect(h.calls.some((c) => c.url.includes("/creditCard/tokenize"))).toBe(false);
  });

  it("envia cartão, titular e remoteIp (na raiz) na criação da cobrança", async () => {
    const r = await gw.createPayment(input);
    const pay = byPath(h.calls, "/payments")!;
    expect(pay.method).toBe("POST");
    expect(pay.body).toMatchObject({
      customer: "cus_1",
      billingType: "CREDIT_CARD",
      value: 50,
      externalReference: "order-1",
      remoteIp: "203.0.113.10",
      creditCard: { number: "4000000000000010", expiryMonth: "12", expiryYear: "2030", ccv: "123" },
      creditCardHolderInfo: { cpfCnpj: "00000000000", postalCode: "01001000", mobilePhone: "11900000000" },
    });
    expect((pay.body!.creditCardHolderInfo as Record<string, unknown>).remoteIp).toBeUndefined();
    expect(r).toMatchObject({ gatewayPaymentId: "pay_1", method: "credit_card", cardStatus: "approved" });
  });

  it("cobrança à vista não envia installmentCount", async () => {
    await gw.createPayment(input);
    const pay = byPath(h.calls, "/payments")!;
    expect(pay.body).not.toHaveProperty("installmentCount");
    expect(pay.body).not.toHaveProperty("creditCardToken");
  });

  it("usa a API de produção quando sandbox = \"false\"", async () => {
    await gw.createPayment(input);
    expect(h.calls[0].url.startsWith("https://api.asaas.com/v3")).toBe(true);
  });

  it("cartão recusado (HTTP 400) lança — o fluxo não registra cobrança", async () => {
    h.respond = (url) =>
      url.endsWith("/payments")
        ? { status: 400, body: { errors: [{ code: "invalid_creditCard", description: "recusado" }] } }
        : defaultRespond(url);
    await expect(gw.createPayment(input)).rejects.toThrow("ASAAS 400 /payments");
  });

  it("o erro lançado não contém o número nem o CVV do cartão", async () => {
    h.respond = (url) =>
      url.endsWith("/payments") ? { status: 400, body: { errors: [{ code: "x" }] } } : defaultRespond(url);
    const msg = await gw.createPayment(input).catch((e: Error) => e.message);
    expect(msg).not.toContain("4000000000000010");
    expect(msg).not.toContain('"ccv"');
  });
});

describe("AsaasSubscriptionClient — assinatura com cartão direto (sem tokenização)", () => {
  const input = {
    memberName: "Titular Exemplo",
    memberEmail: "titular@example.com",
    memberPhone: "11900000000",
    cpf: "000.000.000-00",
    externalRef: "member-1",
    planName: "Ouro",
    amountCents: 2990,
    asaasCardData: {
      holderName: CARD.holderName,
      number: CARD.number,
      expiryMonth: CARD.expiryMonth,
      expiryYear: CARD.expiryYear,
      ccv: CARD.ccv,
      postalCode: CARD.postalCode,
      addressNumber: CARD.addressNumber,
    },
    remoteIp: "203.0.113.10",
  };

  it("cria a assinatura com cartão, titular e remoteIp, sem tokenizar", async () => {
    const client = new AsaasSubscriptionClient({ apiKey: "test-key", sandbox: "false" });
    const r = await client.createSubscription(input);

    expect(h.calls.some((c) => c.url.includes("/creditCard/tokenize"))).toBe(false);
    const sub = byPath(h.calls, "/subscriptions")!;
    expect(sub.body).toMatchObject({
      customer: "cus_1",
      billingType: "CREDIT_CARD",
      value: 29.9,
      cycle: "MONTHLY",
      externalReference: "member-1",
      remoteIp: "203.0.113.10",
      creditCard: { number: "4000000000000010", ccv: "123" },
      creditCardHolderInfo: { cpfCnpj: "00000000000", postalCode: "01001000" },
    });
    expect(sub.body).not.toHaveProperty("creditCardToken");
    expect(r).toMatchObject({ subscriptionId: "sub_1", paymentMethod: "card" });
  });

  it("descrição da cobrança usa o nome do programa do clube (padrão Sócio-Torcedor)", async () => {
    const client = new AsaasSubscriptionClient({ apiKey: "test-key", sandbox: "false" });
    await client.createSubscription({ ...input, programName: "Sócio Ouro" });
    expect(byPath(h.calls, "/subscriptions")!.body).toMatchObject({ description: `Sócio Ouro — ${input.planName}` });
    h.calls.length = 0;
    await client.createSubscription(input);
    expect(byPath(h.calls, "/subscriptions")!.body).toMatchObject({ description: `Sócio-Torcedor — ${input.planName}` });
  });

  it("sandbox = \"false\" (texto, como o formulário grava) usa a API de PRODUÇÃO", async () => {
    const client = new AsaasSubscriptionClient({ apiKey: "test-key", sandbox: "false" });
    await client.createSubscription(input);
    expect(h.calls.every((c) => c.url.startsWith("https://api.asaas.com/v3"))).toBe(true);
  });

  it("sandbox = \"true\" usa a API de sandbox", async () => {
    const client = new AsaasSubscriptionClient({ apiKey: "test-key", sandbox: "true" });
    await client.createSubscription(input);
    expect(h.calls.every((c) => c.url.startsWith("https://sandbox.asaas.com/api/v3"))).toBe(true);
  });

  it("cartão recusado (HTTP 400) lança — assinatura não é criada", async () => {
    h.respond = (url) =>
      url.endsWith("/subscriptions") ? { status: 400, body: { errors: [{ code: "invalid_creditCard" }] } } : defaultRespond(url);
    const client = new AsaasSubscriptionClient({ apiKey: "test-key", sandbox: "false" });
    await expect(client.createSubscription(input)).rejects.toThrow("ASAAS 400 /subscriptions");
  });

  it("sem dados do cartão: lança sem chamar o Asaas (nenhum cliente, assinatura ou cobrança PIX)", async () => {
    h.calls.length = 0;
    const { asaasCardData: _semCartao, ...semCartao } = input;
    void _semCartao;
    const client = new AsaasSubscriptionClient({ apiKey: "test-key", sandbox: "false" });
    await expect(client.createSubscription(semCartao)).rejects.toThrow("exige os dados do cartão");
    expect(h.calls).toEqual([]);
  });
});

describe("AsaasSubscriptionClient — consultas para sincronizar o sócio", () => {
  const client = new AsaasSubscriptionClient({ apiKey: "test-key", sandbox: "false" });

  it("hasPaidCharge: true quando alguma cobrança está CONFIRMED/RECEIVED", async () => {
    h.respond = (url) =>
      url.endsWith("/subscriptions/sub_1/payments")
        ? { status: 200, body: { data: [{ status: "PENDING" }, { status: "CONFIRMED" }] } }
        : defaultRespond(url);
    expect(await client.hasPaidCharge("sub_1")).toBe(true);
  });

  it("hasPaidCharge: false quando nada foi pago", async () => {
    h.respond = (url) =>
      url.endsWith("/subscriptions/sub_1/payments")
        ? { status: 200, body: { data: [{ status: "PENDING" }, { status: "OVERDUE" }] } }
        : defaultRespond(url);
    expect(await client.hasPaidCharge("sub_1")).toBe(false);
  });

  it("getSubscriptionExternalReference devolve o id do sócio", async () => {
    h.respond = (url) =>
      url.endsWith("/subscriptions/sub_1")
        ? { status: 200, body: { id: "sub_1", externalReference: "member-1" } }
        : defaultRespond(url);
    expect(await client.getSubscriptionExternalReference("sub_1")).toBe("member-1");
  });

  it("id da assinatura é escapado na URL", async () => {
    h.respond = () => ({ status: 200, body: { data: [] } });
    await client.hasPaidCharge("../customers");
    expect(h.calls.at(-1)!.url).toContain("/subscriptions/..%2Fcustomers/payments");
  });
});

describe("AsaasSubscriptionClient.getBillingState", () => {
  const client = new AsaasSubscriptionClient({ apiKey: "test-key", sandbox: "false" });

  it("pago, vencida mais antiga, próximo vencimento e fatura aberta mais antiga", async () => {
    h.respond = (url) => {
      if (url.endsWith("/subscriptions/sub_1")) return { status: 200, body: { nextDueDate: "2026-12-12" } };
      if (url.includes("/subscriptions/sub_1/payments"))
        return {
          status: 200,
          body: {
            data: [
              { status: "CONFIRMED", dueDate: "2026-09-12" },
              { status: "OVERDUE", dueDate: "2026-11-12", invoiceUrl: "https://www.asaas.com/i/b" },
              { status: "OVERDUE", dueDate: "2026-10-12", invoiceUrl: "https://www.asaas.com/i/a" },
            ],
          },
        };
      return defaultRespond(url);
    };
    expect(await client.getBillingState("sub_1")).toEqual({
      hasPaid: true,
      oldestOverdueDueDate: "2026-10-12",
      nextDueDate: "2026-12-12",
      openInvoiceUrl: "https://www.asaas.com/i/a",
    });
  });
});

describe("safeAsaasInvoiceUrl", () => {
  it("aceita só https do domínio do Asaas", () => {
    expect(safeAsaasInvoiceUrl("https://www.asaas.com/i/abc")).toBe("https://www.asaas.com/i/abc");
    expect(safeAsaasInvoiceUrl("https://sandbox.asaas.com/i/abc")).toBe("https://sandbox.asaas.com/i/abc");
    expect(safeAsaasInvoiceUrl("http://www.asaas.com/i/abc")).toBeNull();
    expect(safeAsaasInvoiceUrl("https://asaas.com.evil.example/i")).toBeNull();
    expect(safeAsaasInvoiceUrl("javascript:alert(1)")).toBeNull();
    expect(safeAsaasInvoiceUrl(undefined)).toBeNull();
  });
});

describe("AsaasSubscriptionClient — plano empresarial (CNPJ)", () => {
  const card = {
    holderName: CARD.holderName,
    number: CARD.number,
    expiryMonth: CARD.expiryMonth,
    expiryYear: CARD.expiryYear,
    ccv: CARD.ccv,
    postalCode: CARD.postalCode,
    addressNumber: CARD.addressNumber,
  };
  const base = {
    memberName: "Responsável Exemplo",
    memberEmail: "responsavel@example.com",
    memberPhone: "11900000000",
    externalRef: "member-2",
    planName: "Empresarial",
    amountCents: 24900,
    asaasCardData: card,
    remoteIp: "203.0.113.10",
  };

  it("cliente leva o CNPJ e a razão social; o titular do cartão usa o mesmo CNPJ (sem CPF)", async () => {
    const client = new AsaasSubscriptionClient({ apiKey: "test-key", sandbox: "false" });
    await client.createSubscription({ ...base, cnpj: "11.222.333/0001-81", companyName: "Padaria Bom Pão Ltda" });

    const customer = byPath(h.calls, "/customers")!;
    expect(customer.body).toMatchObject({ name: "Padaria Bom Pão Ltda", cpfCnpj: "11222333000181" });
    expect(customer.body).not.toHaveProperty("cpf");

    const sub = byPath(h.calls, "/subscriptions")!;
    // O formulário do cartão não pede CPF do titular: o CNPJ da empresa é o documento do titular.
    expect(sub.body).toMatchObject({
      creditCardHolderInfo: { name: "Responsável Exemplo", cpfCnpj: "11222333000181" },
    });
    expect(JSON.stringify(h.calls)).not.toContain("52998224725");
  });

  it("sem CPF nem CNPJ → lança antes de falar com o Asaas", async () => {
    const client = new AsaasSubscriptionClient({ apiKey: "test-key", sandbox: "false" });
    await expect(client.createSubscription(base as never)).rejects.toThrow("CPF ou CNPJ");
    expect(h.calls).toEqual([]);
  });

  it("plano de CPF segue igual: cliente com o nome do sócio e o CPF", async () => {
    const client = new AsaasSubscriptionClient({ apiKey: "test-key", sandbox: "false" });
    await client.createSubscription({ ...base, memberName: "Ana Torcedora", cpf: "529.982.247-25" });
    const customer = byPath(h.calls, "/customers")!;
    expect(customer.body).toMatchObject({ name: "Ana Torcedora", cpfCnpj: "52998224725" });
  });
});
