import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Regressão de autorização dos GATEWAYS de pagamento. Só o admin do SISTEMA
 * (sessão de plataforma, `isPlatform`) pode ler ou alterar gateways — admin de
 * tenant trocando a chave do gateway desviaria os recebimentos do clube.
 * getDb é mockado para LANÇAR: quem não pode deve ser barrado ANTES do banco, e o
 * admin do sistema chega no banco (prova que a guarda deixa passar).
 */
const h = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("@/app/actions/admin-auth", () => ({
  getAdminSession: async () => h.session,
}));
vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    throw new Error("DB_NAO_DEVE_SER_CHAMADO_SEM_AUTORIZACAO");
  },
}));

import {
  getAdminGateways,
  getAdminGatewayById,
  createGateway,
  updateGateway,
  deleteGateway,
  setActiveGateway,
} from "./admin";

const GW_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const validCreate = {
  name: "Asaas",
  slug: "asaas",
  active: true,
  paymentMethods: ["pix", "credit_card"],
  credentials: { apiKey: "x", webhookToken: "y", sandbox: "true" },
};

const ACTIONS = [
  { name: "getAdminGateways", fn: () => getAdminGateways() },
  { name: "getAdminGatewayById", fn: () => getAdminGatewayById(GW_ID) },
  { name: "createGateway", fn: () => createGateway(validCreate) },
  { name: "updateGateway", fn: () => updateGateway(GW_ID, { paymentMethods: ["pix", "credit_card"] }) },
  { name: "deleteGateway", fn: () => deleteGateway(GW_ID) },
  { name: "setActiveGateway", fn: () => setActiveGateway(GW_ID) },
];

const PLATFORM = { role: "admin", permissions: {}, isPlatform: true };

beforeEach(() => {
  h.session = null;
});

describe("authz dos gateways (só admin do sistema)", () => {
  for (const [label, session] of [
    ["sessão ausente", null],
    ["editor", { role: "editor", permissions: { configuracoes: true } }],
    ["admin do tenant (sem isPlatform)", { role: "admin", permissions: {} }],
    ["admin do tenant com isPlatform=false", { role: "admin", permissions: {}, isPlatform: false }],
  ] as const) {
    for (const { name, fn } of ACTIONS) {
      it(`${name} bloqueia ${label}`, async () => {
        h.session = session;
        await expect(fn()).rejects.toThrow("Não autorizado");
      });
    }
  }

  for (const { name, fn } of ACTIONS) {
    it(`${name} deixa o admin do sistema passar da guarda`, async () => {
      h.session = PLATFORM;
      // Chega no banco (mockado para lançar) — ou cai no try/catch da action.
      const outcome = await fn().then(
        (r) => r,
        (e: Error) => e.message
      );
      expect(outcome).not.toBe("Não autorizado");
    });
  }
});

describe("validação de payload dos gateways", () => {
  beforeEach(() => {
    h.session = PLATFORM;
  });

  it("createGateway rejeita slug desconhecido sem tocar o banco", async () => {
    const r = await createGateway({ ...validCreate, slug: "gateway-malicioso" });
    expect(r.success).toBe(false);
  });

  it("createGateway rejeita método de pagamento desconhecido", async () => {
    const r = await createGateway({ ...validCreate, paymentMethods: ["pix", "boleto_fake"] });
    expect(r.success).toBe(false);
  });

  it("createGateway rejeita lista de métodos vazia", async () => {
    const r = await createGateway({ ...validCreate, paymentMethods: [] });
    expect(r.success).toBe(false);
  });

  it("updateGateway rejeita id que não é UUID", async () => {
    const r = await updateGateway("../../etc", { paymentMethods: ["pix"] });
    expect(r.success).toBe(false);
  });

  it("updateGateway rejeita método desconhecido", async () => {
    const r = await updateGateway(GW_ID, { paymentMethods: ["credit_card", "x"] });
    expect(r.success).toBe(false);
  });
});
