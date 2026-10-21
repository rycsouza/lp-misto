import { describe, it, expect, beforeEach, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/**
 * Plano de sócio PADRÃO (setDefaultMembershipPlan) e a limpeza do padrão quando o plano
 * é desativado ou excluído. Action é endpoint POST público: a guarda do módulo socios
 * barra ANTES do banco; entrada inválida é recusada ANTES do banco; erro de banco não
 * vaza detalhe interno; e a escrita só toca a chave membershipDefaultPlanId.
 *
 * O banco é fake. Para provar QUAL linha é apagada, renderizamos a cláusula WHERE com o
 * dialeto do Drizzle e conferimos a chave e o id do plano nos parâmetros.
 */
const UUID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";

const h = vi.hoisted(() => ({
  session: null as unknown,
  dbUsed: false,
  failDb: false,
  plans: [] as { id: string; active: boolean }[],
  writes: [] as { table: string; value: Record<string, unknown> }[],
  deletes: [] as { table: string; cond: unknown }[],
  updates: [] as { table: string; set: Record<string, unknown> }[],
  audits: [] as { action: string; meta: unknown }[],
  revalidatedPaths: [] as string[],
  revalidatedTags: [] as string[],
}));

vi.mock("@/app/actions/admin-auth", () => ({ getAdminSession: async () => h.session }));
vi.mock("@/lib/platform/module-gate", () => ({
  isModuleDisabledForClub: async () => false,
  MODULE_DISABLED_MESSAGE: "Módulo desativado para este clube.",
}));
vi.mock("@/lib/audit", () => ({
  logAudit: async (action: string, _entity: string, _id: unknown, meta: unknown) => {
    h.audits.push({ action, meta });
  },
}));
vi.mock("@/lib/db/queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/queries")>()),
  currentTenantSlug: async () => "misto",
}));
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidatePath: (p: string) => {
    h.revalidatedPaths.push(p);
  },
  revalidateTag: (t: string) => {
    h.revalidatedTags.push(t);
  },
}));

function tableName(t: unknown): string {
  // Importado abaixo: compara pela identidade do objeto da tabela.
  return t === plansTable ? "membership_plans" : t === configTable ? "site_config" : "outra";
}

vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    h.dbUsed = true;
    if (h.failDb) throw new Error("postgres://usuario:senha@host/db falhou");
    return {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => h.plans,
          }),
        }),
      }),
      insert: (t: unknown) => ({
        values: (value: Record<string, unknown>) => ({
          onConflictDoUpdate: async () => {
            h.writes.push({ table: tableName(t), value });
          },
        }),
      }),
      // where() devolve um "thenable" que também tem returning(): serve aos dois usos
      // (await direto, ou .returning() para o log de auditoria com o nome do plano).
      delete: (t: unknown) => ({
        where: (cond: unknown) => {
          h.deletes.push({ table: tableName(t), cond });
          const rows = tableName(t) === "membership_plans" ? [{ id: UUID, name: "Elite" }] : [];
          return { then: (r: (v: unknown) => void) => r(undefined), returning: async () => rows };
        },
      }),
      update: (t: unknown) => ({
        set: (set: Record<string, unknown>) => ({
          where: () => {
            h.updates.push({ table: tableName(t), set });
            const rows = tableName(t) === "membership_plans" ? [{ id: UUID, name: "Elite" }] : [];
            return { then: (r: (v: unknown) => void) => r(undefined), returning: async () => rows };
          },
        }),
      }),
    };
  },
}));

import { membershipPlans as plansTable, siteConfig as configTable } from "@/lib/db/schema";
import {
  deleteMembershipPlan,
  setDefaultMembershipPlan,
  toggleMembershipPlanActive,
} from "./admin-growth";

const EDITOR_SOCIOS = { role: "editor", permissions: { socios: true } };
const EDITOR_OUTRO = { role: "editor", permissions: { jogos: true } };
const ATIVO = [{ id: UUID, active: true }];

/** Renderiza a cláusula WHERE como SQL + parâmetros (prova o que será apagado/gravado). */
function render(cond: unknown): { sql: string; params: unknown[] } {
  const q = new PgDialect().sqlToQuery(cond as SQL);
  return { sql: q.sql, params: q.params };
}

beforeEach(() => {
  h.session = null;
  h.dbUsed = false;
  h.failDb = false;
  h.plans = [];
  h.writes = [];
  h.deletes = [];
  h.updates = [];
  h.audits = [];
  h.revalidatedPaths = [];
  h.revalidatedTags = [];
});

describe("setDefaultMembershipPlan: guarda do módulo socios", () => {
  it("sessão ausente é bloqueada antes do banco", async () => {
    await expect(setDefaultMembershipPlan(UUID)).rejects.toThrow("Não autorizado");
    expect(h.dbUsed).toBe(false);
  });

  it("editor sem o módulo socios é bloqueado antes do banco (inclusive para remover)", async () => {
    h.session = EDITOR_OUTRO;
    await expect(setDefaultMembershipPlan(UUID)).rejects.toThrow("Não autorizado");
    await expect(setDefaultMembershipPlan(null)).rejects.toThrow("Não autorizado");
    expect(h.dbUsed).toBe(false);
  });
});

describe("setDefaultMembershipPlan: entrada e regras (com permissão)", () => {
  beforeEach(() => {
    h.session = EDITOR_SOCIOS;
  });

  it("uuid inválido, texto livre, objeto (mass assignment) ou ausente são recusados antes do banco", async () => {
    const CASOS: unknown[] = ["nao-e-uuid", "", "1; DROP TABLE site_config", { id: UUID }, undefined, 42];
    for (const caso of CASOS) {
      const r = await setDefaultMembershipPlan(caso as string | null);
      expect(r, JSON.stringify(caso)).toEqual({ success: false, error: "Plano inválido." });
    }
    expect(h.dbUsed).toBe(false);
    expect(h.writes).toEqual([]);
    expect(h.deletes).toEqual([]);
  });

  it("plano inexistente é recusado e nada é gravado", async () => {
    h.plans = [];
    const r = await setDefaultMembershipPlan(UUID);
    expect(r).toEqual({ success: false, error: "Plano não encontrado." });
    expect(h.writes).toEqual([]);
    expect(h.audits).toEqual([]);
  });

  it("plano inativo não pode ser padrão", async () => {
    h.plans = [{ id: UUID, active: false }];
    const r = await setDefaultMembershipPlan(UUID);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Ative o plano antes de defini-lo como padrão.");
    expect(h.writes).toEqual([]);
    expect(h.audits).toEqual([]);
  });

  it("plano ativo é gravado na chave membershipDefaultPlanId, com auditoria e revalidação", async () => {
    h.plans = ATIVO;
    const r = await setDefaultMembershipPlan(UUID);
    expect(r).toEqual({ success: true });
    expect(h.writes).toEqual([
      {
        table: "site_config",
        value: expect.objectContaining({ key: "membershipDefaultPlanId", value: UUID, type: "string" }),
      },
    ]);
    expect(h.audits).toEqual([
      { action: "membership_default_plan", meta: { key: "membershipDefaultPlanId", planId: UUID } },
    ]);
    expect(h.revalidatedTags).toEqual(["tenant:misto"]);
    expect(h.revalidatedPaths).toEqual(
      expect.arrayContaining(["/admin/socios", "/socios/adesao", "/"]),
    );
  });

  it("null remove a chave (apaga a linha de site_config), sem gravar", async () => {
    const r = await setDefaultMembershipPlan(null);
    expect(r).toEqual({ success: true });
    expect(h.writes).toEqual([]);
    expect(h.deletes.map((d) => d.table)).toEqual(["site_config"]);
    expect(render(h.deletes[0].cond).params).toEqual(["membershipDefaultPlanId"]);
    expect(h.audits).toEqual([
      { action: "membership_default_plan", meta: { key: "membershipDefaultPlanId", planId: null } },
    ]);
  });

  it("erro de banco volta mensagem genérica, sem vazar a string de conexão nem o erro bruto", async () => {
    h.plans = ATIVO;
    h.failDb = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const r = await setDefaultMembershipPlan(UUID);
      expect(r).toEqual({ success: false, error: "Erro ao definir o plano padrão" });
      expect(JSON.stringify(r)).not.toContain("senha");
      expect(h.audits).toEqual([]);
    } finally {
      log.mockRestore();
    }
  });
});

describe("limpeza do padrão quando o plano é desativado ou excluído", () => {
  beforeEach(() => {
    h.session = EDITOR_SOCIOS;
  });

  it("desativar o plano apaga o padrão SE for este plano (chave + id no WHERE)", async () => {
    await toggleMembershipPlanActive(UUID, false);
    expect(h.updates).toEqual([{ table: "membership_plans", set: { active: false } }]);
    expect(h.deletes.map((d) => d.table)).toEqual(["site_config"]);
    const { params } = render(h.deletes[0].cond);
    expect(params).toEqual(expect.arrayContaining(["membershipDefaultPlanId", UUID]));
  });

  it("reativar o plano não mexe no padrão", async () => {
    await toggleMembershipPlanActive(UUID, true);
    expect(h.updates).toEqual([{ table: "membership_plans", set: { active: true } }]);
    expect(h.deletes).toEqual([]);
  });

  it("excluir o plano apaga o padrão SE for este plano", async () => {
    await deleteMembershipPlan(UUID);
    expect(h.deletes.map((d) => d.table)).toEqual(["membership_plans", "site_config"]);
    expect(render(h.deletes[1].cond).params).toEqual(
      expect.arrayContaining(["membershipDefaultPlanId", UUID]),
    );
  });

  it("toggle e delete continuam recusando sem permissão, sem tocar no banco", async () => {
    h.session = EDITOR_OUTRO;
    await expect(toggleMembershipPlanActive(UUID, false)).rejects.toThrow("Não autorizado");
    await expect(deleteMembershipPlan(UUID)).rejects.toThrow("Não autorizado");
    expect(h.dbUsed).toBe(false);
  });
});

describe("auditoria de desativar/reativar/excluir plano", () => {
  it("desativar e reativar registram ação própria com o nome do plano (sem dados pessoais)", async () => {
    h.session = EDITOR_SOCIOS;
    await toggleMembershipPlanActive(UUID, false);
    await toggleMembershipPlanActive(UUID, true);
    const actions = h.audits.map((a) => a.action);
    expect(actions).toContain("membership_plan_deactivate");
    expect(actions).toContain("membership_plan_activate");
    expect(h.audits.find((a) => a.action === "membership_plan_deactivate")?.meta).toEqual({ name: "Elite" });
  });

  it("excluir registra membership_plan_delete com o nome", async () => {
    h.session = EDITOR_SOCIOS;
    await deleteMembershipPlan(UUID);
    expect(h.audits).toContainEqual({ action: "membership_plan_delete", meta: { name: "Elite" } });
  });

  it("entrada inválida: erro curto, sem banco e sem auditoria", async () => {
    h.session = EDITOR_SOCIOS;
    await expect(toggleMembershipPlanActive("nao-uuid", false)).rejects.toThrow("Plano inválido.");
    await expect(deleteMembershipPlan("nao-uuid")).rejects.toThrow("Plano inválido.");
    expect(h.audits).toEqual([]);
  });
});
