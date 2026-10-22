import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getTableConfig } from "drizzle-orm/pg-core";
import { membershipPlans, members } from "./schema";
import { TENANT_SCHEMA_STATEMENTS } from "./tenant-schema";
import { SOCIO_PLANS } from "./seed-data/socios";

/**
 * Migração 0035 (plano empresarial/CNPJ): o SQL é idempotente, o rollback desfaz, o schema
 * Drizzle e o DDL de clube novo têm as mesmas colunas, e o seed/planilha marcam o Empresarial
 * como 'pj'.
 */
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const migration = read("./migrations/0035_membership_pj.sql");
const rollback = read("./migrations/0035_membership_pj.rollback.sql");
const planilha = read("../../../scripts/sql/socios-reset-planilha.sql");

describe("migração 0035 (sócio PJ)", () => {
  it("é idempotente: IF NOT EXISTS nas colunas e constraint protegida por duplicate_object", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "audience" text DEFAULT 'pf' NOT NULL/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "cnpj" text/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "company_name" text/);
    expect(migration).toMatch(/WHEN duplicate_object THEN NULL/);
    expect(migration).toContain(`CHECK ("audience" IN ('pf', 'pj'))`);
  });

  it("backfill: só o plano 'empresarial' vira 'pj', e só se ainda estiver 'pf'", () => {
    expect(migration).toMatch(/UPDATE "membership_plans" SET "audience" = 'pj'\s+WHERE "slug" = 'empresarial' AND "audience" = 'pf';/);
  });

  it("rollback remove constraint, colunas de empresa e o tipo do plano", () => {
    expect(rollback).toContain('DROP CONSTRAINT IF EXISTS "membership_plans_audience_check"');
    for (const col of ['"audience"', '"cnpj"', '"company_name"']) {
      expect(rollback).toMatch(new RegExp(`DROP COLUMN IF EXISTS ${col}`));
    }
    expect(rollback).toMatch(/ATENÇÃO/);
  });

  it("DDL de clube novo (tenant-schema) tem o mesmo tipo do plano e os campos de empresa", () => {
    const sql = TENANT_SCHEMA_STATEMENTS.join("\n");
    expect(sql).toContain(`ALTER TABLE "membership_plans" ADD COLUMN IF NOT EXISTS "audience" text DEFAULT 'pf' NOT NULL`);
    expect(sql).toContain(`CHECK ("audience" IN ('pf', 'pj'))`);
    expect(sql).toContain(`ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "cnpj" text`);
    expect(sql).toContain(`ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "company_name" text`);
  });

  it("schema Drizzle: audience (pf por padrão, NOT NULL) em membership_plans; cnpj/company_name opcionais em members", () => {
    const plans = getTableConfig(membershipPlans);
    const audience = plans.columns.find((c) => c.name === "audience");
    expect(audience).toBeDefined();
    expect(audience!.notNull).toBe(true);
    expect(audience!.default).toBe("pf");

    const mem = getTableConfig(members);
    expect(mem.columns.find((c) => c.name === "cnpj")?.notNull).toBe(false);
    expect(mem.columns.find((c) => c.name === "company_name")?.notNull).toBe(false);
  });

  it("seed e planilha: o Empresarial é 'pj' e os demais são 'pf'", () => {
    const empresarial = SOCIO_PLANS.find((p) => p.slug === "empresarial");
    expect(empresarial?.audience).toBe("pj");
    expect(SOCIO_PLANS.filter((p) => p.slug !== "empresarial").every((p) => p.audience === "pf")).toBe(true);
    // Linha do Empresarial na planilha SQL termina com o público 'pj'.
    expect(planilha).toMatch(/24900, 15, 0, 2, false, false, NULL, '#7a5c12', true, 5, 'pj'\);/);
    expect(planilha).toMatch(/'#3f6212', true, 1, 'pf'\)/);
  });
});
