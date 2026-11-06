import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getTableConfig } from "drizzle-orm/pg-core";
import { members } from "./schema";
import { TENANT_SCHEMA_STATEMENTS } from "./tenant-schema";

/** Migração 0037 (Pix Automático do sócio): idempotente, rollback e DDL de clube novo iguais ao schema. */
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const migration = read("./migrations/0037_member_pix_automatic.sql");
const rollback = read("./migrations/0037_member_pix_automatic.rollback.sql");

describe("migração 0037 (Pix Automático)", () => {
  it("é idempotente: colunas e índice único com IF NOT EXISTS", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "payment_method" text;/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "pix_automatic_authorization_id" text;/);
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "members_pix_automatic_authorization_id_idx"/);
    // Troca de plano em andamento: nova autorização (única) e o plano dela (FK, some se o plano for apagado).
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "pix_automatic_pending_authorization_id" text;/);
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS "pix_automatic_pending_plan_id" uuid REFERENCES "membership_plans"\("id"\) ON DELETE SET NULL;/
    );
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "members_pix_automatic_pending_authorization_id_idx"/);
  });

  it("rollback remove índice e colunas, com aviso", () => {
    expect(rollback).toMatch(/DROP INDEX IF EXISTS "members_pix_automatic_authorization_id_idx"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "pix_automatic_authorization_id"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "payment_method"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "pix_automatic_pending_authorization_id"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "pix_automatic_pending_plan_id"/);
    expect(rollback).toMatch(/ATENÇÃO/);
  });

  it("DDL de clube novo inclui as colunas e o índice", () => {
    const sql = TENANT_SCHEMA_STATEMENTS.join("\n");
    expect(sql).toContain(`ADD COLUMN IF NOT EXISTS "payment_method" text`);
    expect(sql).toContain(`ADD COLUMN IF NOT EXISTS "pix_automatic_authorization_id" text`);
    expect(sql).toContain(`"members_pix_automatic_authorization_id_idx"`);
  });

  it("schema Drizzle: colunas opcionais e índice único", () => {
    const cfg = getTableConfig(members);
    expect(cfg.columns.find((c) => c.name === "payment_method")?.notNull).toBe(false);
    expect(cfg.columns.find((c) => c.name === "pix_automatic_authorization_id")?.notNull).toBe(false);
    const idx = cfg.indexes.find((i) => i.config.name === "members_pix_automatic_authorization_id_idx");
    expect(idx?.config.unique).toBe(true);
  });
});
