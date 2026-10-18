import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Autorização da aba Sócio-torcedor e do backfill. Sem permissão a action recusa
 * ANTES de tocar o banco; com o módulo socios desligado para o clube, recusa com a
 * mensagem de módulo desativado. getDb conta as chamadas e lança se for usado.
 */
const h = vi.hoisted(() => ({
  session: null as unknown,
  dbCalls: 0,
  disabled: new Set<string>(),
  rateOk: true,
  batchCalls: 0,
}));

const DB_MSG = "DB_ALCANCADO_APOS_GUARDA";
const MEMBER = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";

vi.mock("@/app/actions/admin-auth", () => ({
  getAdminSession: async () => h.session,
}));
vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    h.dbCalls++;
    throw new Error(DB_MSG);
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-org-id": "org-a" }),
}));
vi.mock("@/app/actions/platform-tenants", () => ({
  getTenantContextSlug: async () => null,
}));
vi.mock("@/lib/platform/features", () => ({
  getDisabledFeatures: async () => new Set(h.disabled),
  getOrgIdBySlug: async () => null,
}));
vi.mock("@/lib/audit", () => ({
  logAudit: async () => undefined,
}));
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: async () => ({ ok: h.rateOk, remaining: 0 }),
}));
vi.mock("@/lib/membership/payments-ledger", () => ({
  importMembershipPaymentsBatch: async () => {
    h.batchCalls++;
    return { supported: true, processed: 0, failed: 0, nextCursor: null };
  },
}));

import {
  exportMembershipReportCSV,
  getMembershipReport,
  importMembershipPaymentsHistory,
} from "./admin-membership-reports";
import { MODULE_DISABLED_MESSAGE } from "@/lib/platform/module-gate";

const ADMIN = { userId: "u-adm", email: "adm@clube.test", name: "Adm", role: "admin", permissions: {} };
const SO_SOCIOS = { userId: "u-s", email: "s@clube.test", name: "S", role: "editor", permissions: { socios: true } };
const SO_DASH = { userId: "u-d", email: "d@clube.test", name: "D", role: "editor", permissions: { dashboard: true } };
const AMBOS = {
  userId: "u-a",
  email: "a@clube.test",
  name: "A",
  role: "editor",
  permissions: { dashboard: true, socios: true },
};

beforeEach(() => {
  h.session = null;
  h.dbCalls = 0;
  h.disabled = new Set();
  h.rateOk = true;
  h.batchCalls = 0;
  process.env.PLATFORM_DATABASE_URL = "postgres://plataforma.test/db";
});

afterEach(() => {
  delete process.env.PLATFORM_DATABASE_URL;
});

describe("relatório do sócio-torcedor: autorização", () => {
  it("sem sessão → 'Não autorizado' e o banco não é tocado", async () => {
    await expect(getMembershipReport({})).rejects.toThrow("Não autorizado");
    expect(h.dbCalls).toBe(0);
  });

  it("só permissão 'socios' (sem 'dashboard') → recusa: a aba exige os dois", async () => {
    h.session = SO_SOCIOS;
    await expect(getMembershipReport({})).rejects.toThrow("Não autorizado");
    expect(h.dbCalls).toBe(0);
  });

  it("só permissão 'dashboard' (sem 'socios') → recusa: dados de sócio exigem o módulo", async () => {
    h.session = SO_DASH;
    await expect(getMembershipReport({})).rejects.toThrow("Não autorizado");
    expect(h.dbCalls).toBe(0);
  });

  it("socios desligado para o clube → mensagem de módulo desativado, sem tocar o banco", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["socios"]);
    await expect(getMembershipReport({})).rejects.toThrow(MODULE_DISABLED_MESSAGE);
    expect(h.dbCalls).toBe(0);
  });

  it("exportação CSV segue a mesma regra", async () => {
    h.session = SO_DASH;
    await expect(exportMembershipReportCSV({})).rejects.toThrow("Não autorizado");
    h.session = ADMIN;
    h.disabled = new Set(["socios"]);
    await expect(exportMembershipReportCSV({})).rejects.toThrow(MODULE_DISABLED_MESSAGE);
    expect(h.dbCalls).toBe(0);
  });

  it("com as duas permissões a guarda passa e a consulta chega ao banco", async () => {
    h.session = AMBOS;
    await expect(getMembershipReport({})).rejects.toThrow(DB_MSG);
    expect(h.dbCalls).toBeGreaterThan(0);
  });

  it("admin passa pela guarda", async () => {
    h.session = ADMIN;
    await expect(getMembershipReport({})).rejects.toThrow(DB_MSG);
  });

  it("período inválido é recusado antes do banco (entrada validada)", async () => {
    h.session = ADMIN;
    await expect(getMembershipReport({ from: "2026-02-30" })).rejects.toThrow("Período inválido.");
    expect(h.dbCalls).toBe(0);
  });
});

describe("backfill do histórico de mensalidades: autorização e limites", () => {
  it("sem permissão de sócios → recusa e nenhum lote é processado", async () => {
    h.session = SO_DASH;
    await expect(importMembershipPaymentsHistory({})).rejects.toThrow("Não autorizado");
    expect(h.batchCalls).toBe(0);
  });

  it("socios desligado → recusa com a mensagem do módulo", async () => {
    h.session = ADMIN;
    h.disabled = new Set(["socios"]);
    await expect(importMembershipPaymentsHistory({})).rejects.toThrow(MODULE_DISABLED_MESSAGE);
    expect(h.batchCalls).toBe(0);
  });

  it("com permissão processa o lote", async () => {
    h.session = SO_SOCIOS;
    const r = await importMembershipPaymentsHistory({});
    expect(r).toMatchObject({ supported: true, nextCursor: null });
    expect(h.batchCalls).toBe(1);
  });

  it("estourou o rate limit do administrador → recusa sem processar", async () => {
    h.session = SO_SOCIOS;
    h.rateOk = false;
    await expect(importMembershipPaymentsHistory({})).rejects.toThrow("Muitas importações");
    expect(h.batchCalls).toBe(0);
  });

  it("cursor inválido (não é UUID) → recusa: entrada validada", async () => {
    h.session = SO_SOCIOS;
    await expect(importMembershipPaymentsHistory({ afterMemberId: "'; drop table members;--" })).rejects.toThrow(
      "Pedido inválido."
    );
    expect(h.batchCalls).toBe(0);
  });

  it("campo extra no pedido é recusado (entrada estrita)", async () => {
    h.session = SO_SOCIOS;
    await expect(
      importMembershipPaymentsHistory({ afterMemberId: MEMBER, gatewayStatus: "RECEIVED" } as never)
    ).rejects.toThrow("Pedido inválido.");
    expect(h.batchCalls).toBe(0);
  });
});
