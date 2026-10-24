import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Campanhas é módulo adminOnly: exportar destinatários (nome, e-mail, WhatsApp
 * de clientes) exige role admin — editor não pode, mesmo com sessão válida.
 */
const h = vi.hoisted(() => ({ session: null as unknown, dbCalls: 0 }));

vi.mock("@/app/actions/admin-auth", () => ({ getAdminSession: async () => h.session }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));
vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "innerJoin", "leftJoin", "orderBy"]) chain[m] = () => chain;
  chain.limit = async () => [];
  return {
    getDb: async () => {
      h.dbCalls++;
      return chain;
    },
  };
});

import { getCampaignRecipients } from "./campaigns";

beforeEach(() => {
  h.session = null;
  h.dbCalls = 0;
});

describe("getCampaignRecipients — somente admin", () => {
  it("anônimo → [] sem tocar no banco", async () => {
    expect(await getCampaignRecipients({})).toEqual([]);
    expect(h.dbCalls).toBe(0);
  });

  it("editor → [] sem tocar no banco", async () => {
    h.session = { userId: "e1", role: "editor", permissions: { pedidos: true } };
    expect(await getCampaignRecipients({})).toEqual([]);
    expect(h.dbCalls).toBe(0);
  });

  it("admin → consulta", async () => {
    h.session = { userId: "a1", role: "admin", permissions: {} };
    await getCampaignRecipients({});
    expect(h.dbCalls).toBe(1);
  });
});
