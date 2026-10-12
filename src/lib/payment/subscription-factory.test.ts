import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Regressão: a factory de assinatura deve usar getDb() (banco do clube,
 * multi-tenant). O `db` legado lê DATABASE_URL — inexistente em produção — e
 * fazia TODA adesão falhar com "DATABASE_URL is not set".
 */
const h = vi.hoisted(() => ({ rows: [] as unknown[], getDbCalls: 0 }));

vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where"]) chain[m] = () => chain;
  chain.limit = async () => h.rows;
  return {
    getDb: async () => {
      h.getDbCalls++;
      return chain;
    },
    db: new Proxy(
      {},
      {
        get: () => {
          throw new Error("DATABASE_URL is not set — use getDb() for tenant-aware queries");
        },
      }
    ),
  };
});
vi.mock("@/lib/payment/encryption", () => ({ decrypt: (s: string) => s }));

import { getSubscriptionGateway } from "./subscription-factory";
import { AsaasSubscriptionClient } from "./asaas-subscription";

beforeEach(() => {
  h.rows = [];
  h.getDbCalls = 0;
});

describe("getSubscriptionGateway", () => {
  it("lê o gateway ativo pelo banco do tenant (getDb), não pelo db legado", async () => {
    h.rows = [
      { slug: "asaas", active: true, credentials: JSON.stringify({ apiKey: "k", sandbox: "false" }) },
    ];
    const r = await getSubscriptionGateway();
    expect(h.getDbCalls).toBe(1);
    expect(r?.slug).toBe("asaas");
    expect(r?.gateway).toBeInstanceOf(AsaasSubscriptionClient);
  });
});
