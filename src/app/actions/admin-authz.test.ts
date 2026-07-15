import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Regressão de autorização: as server actions de listagem admin são endpoints
 * POST públicos e expõem dados sensíveis, então DEVEM bloquear quem não tem
 * permissão. Aqui provamos que a guarda está *plugada* em cada action.
 *
 * getAdminSession é mockado (dependência de requireModule). getDb é mockado para
 * LANÇAR se chamado: numa sessão sem permissão a guarda deve barrar ANTES de
 * tocar o banco — se alguém remover a guarda no futuro, a action tentaria o
 * getDb e falharia com outra mensagem, quebrando estes testes (regressão pega).
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

import { getAdminCoupons } from "./admin-coupons";
import { getAdminPromotions } from "./admin-promotions";
import { getAdminAffiliates, getWithdrawals } from "./admin-affiliates";
import { getAdminUpsellOffers } from "./admin-growth";

const GUARDED = [
  { name: "getAdminCoupons", fn: () => getAdminCoupons() },
  { name: "getAdminPromotions", fn: () => getAdminPromotions() },
  { name: "getAdminAffiliates", fn: () => getAdminAffiliates() },
  { name: "getWithdrawals", fn: () => getWithdrawals() },
  { name: "getAdminUpsellOffers", fn: () => getAdminUpsellOffers() },
];

beforeEach(() => {
  h.session = null;
});

describe("authz das listagens admin (módulo 'cupons'/'upsell')", () => {
  for (const { name, fn } of GUARDED) {
    it(`${name} bloqueia sessão ausente`, async () => {
      h.session = null;
      await expect(fn()).rejects.toThrow("Não autorizado");
    });

    it(`${name} bloqueia editor sem o módulo`, async () => {
      h.session = { role: "editor", permissions: { jogos: true } };
      await expect(fn()).rejects.toThrow("Não autorizado");
    });
  }
});
