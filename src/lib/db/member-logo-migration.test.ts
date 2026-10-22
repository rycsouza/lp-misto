import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getTableConfig } from "drizzle-orm/pg-core";
import { members } from "./schema";
import { TENANT_SCHEMA_STATEMENTS } from "./tenant-schema";

/**
 * Migração 0036 (logo da empresa do sócio): SQL idempotente, rollback remove as colunas,
 * schema Drizzle e DDL de clube novo têm as mesmas colunas.
 */
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const migration = read("./migrations/0036_member_logo.sql");
const rollback = read("./migrations/0036_member_logo.rollback.sql");

describe("migração 0036 (logo do sócio PJ)", () => {
  it("é idempotente: ADD COLUMN IF NOT EXISTS para logo_url e logo_public_id", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "logo_url" text/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "logo_public_id" text/);
  });

  it("rollback remove as duas colunas", () => {
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "logo_url"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "logo_public_id"/);
    expect(rollback).toMatch(/ATENÇÃO/);
  });

  it("DDL de clube novo (tenant-schema) inclui as colunas", () => {
    const sql = TENANT_SCHEMA_STATEMENTS.join("\n");
    expect(sql).toContain(`ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "logo_url" text`);
    expect(sql).toContain(`ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "logo_public_id" text`);
  });

  it("schema Drizzle: logo opcional em members", () => {
    const cfg = getTableConfig(members);
    expect(cfg.columns.find((c) => c.name === "logo_url")?.notNull).toBe(false);
    expect(cfg.columns.find((c) => c.name === "logo_public_id")?.notNull).toBe(false);
  });
});
