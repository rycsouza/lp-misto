import { randomUUID } from "crypto";
import type { SubscriptionGateway, SubscriptionCreateInput, SubscriptionCreateResult } from "./subscription-types";

export class MockSubscriptionClient implements SubscriptionGateway {
  async createSubscription(input: SubscriptionCreateInput): Promise<SubscriptionCreateResult> {
    void input;
    return {
      subscriptionId: `mock_sub_${randomUUID()}`,
      paymentMethod: "immediate",
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    void subscriptionId;
    return true;
  }

  async getSubscriptionStatus(subscriptionId: string): Promise<string> {
    void subscriptionId;
    return "ACTIVE";
  }
}
