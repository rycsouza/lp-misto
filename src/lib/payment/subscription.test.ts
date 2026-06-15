import { describe, it, expect } from "vitest";
import { MockSubscriptionClient } from "./mock-subscription";

const baseInput = {
  memberName: "João Silva",
  memberEmail: "joao@test.com",
  memberPhone: "5567999990000",
  cpf: "52998224725",
  externalRef: "member-uuid-123",
  planName: "Plano Ouro",
  amountCents: 2990,
};

describe("MockSubscriptionClient", () => {
  it("returns paymentMethod=immediate", async () => {
    const client = new MockSubscriptionClient();
    const result = await client.createSubscription(baseInput);
    expect(result.paymentMethod).toBe("immediate");
  });

  it("returns a subscriptionId with mock_ prefix", async () => {
    const client = new MockSubscriptionClient();
    const result = await client.createSubscription(baseInput);
    expect(result.subscriptionId).toMatch(/^mock_sub_/);
  });

  it("generates unique subscriptionIds per call", async () => {
    const client = new MockSubscriptionClient();
    const r1 = await client.createSubscription(baseInput);
    const r2 = await client.createSubscription(baseInput);
    expect(r1.subscriptionId).not.toBe(r2.subscriptionId);
  });

  it("cancelSubscription returns true", async () => {
    const client = new MockSubscriptionClient();
    const result = await client.cancelSubscription("any-id");
    expect(result).toBe(true);
  });

  it("getSubscriptionStatus returns ACTIVE", async () => {
    const client = new MockSubscriptionClient();
    const status = await client.getSubscriptionStatus("any-id");
    expect(status).toBe("ACTIVE");
  });

  it("does not return pixQrCode or initPoint", async () => {
    const client = new MockSubscriptionClient();
    const result = await client.createSubscription(baseInput);
    expect(result.pixQrCode).toBeUndefined();
    expect(result.pixQrCodeUrl).toBeUndefined();
    expect(result.initPoint).toBeUndefined();
  });
});
