import { describe, it, expect } from "vitest";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { TENANT_SCHEMA_STATEMENTS } from "./tenant-schema";

/**
 * Regressão: clube NOVO é criado só com TENANT_SCHEMA_STATEMENTS. Se o schema
 * do código ganhar tabela/coluna e este arquivo não, o clube nasce quebrado
 * (aconteceu com cantina, rifa, prestação de contas, serial do ingresso...).
 * Ao criar uma migração, acrescente o mesmo DDL (idempotente) ao tenant-schema.
 */
const sql = TENANT_SCHEMA_STATEMENTS.join("\n");

function tenantColumns(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS "([a-z_]+)" \(([\s\S]*?)\n\s*\)/g)) {
    const cols = new Set<string>();
    for (const line of m[2].split("\n")) {
      const c = line.trim().match(/^"([a-z_0-9]+)"/);
      if (c) cols.add(c[1]);
    }
    out.set(m[1], cols);
  }
  for (const m of sql.matchAll(/ALTER TABLE "([a-z_]+)" ADD COLUMN IF NOT EXISTS "([a-z_0-9]+)"/g)) {
    if (!out.has(m[1])) out.set(m[1], new Set());
    out.get(m[1])!.add(m[2]);
  }
  return out;
}

const tables = (Object.values(schema) as unknown[]).filter((v): v is PgTable => v instanceof PgTable);

describe("tenant-schema (clubes novos) cobre o schema do código", () => {
  const tenant = tenantColumns();

  it("tem todas as tabelas", () => {
    const missing = tables.map((t) => getTableConfig(t).name).filter((n) => !tenant.has(n));
    expect(missing).toEqual([]);
  });

  it("tem todas as colunas", () => {
    const missing: string[] = [];
    for (const t of tables) {
      const cfg = getTableConfig(t);
      for (const col of cfg.columns) {
        if (!tenant.get(cfg.name)?.has(col.name)) missing.push(`${cfg.name}.${col.name}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("mantém os índices que só existem nas migrações (idempotência, serial)", () => {
    expect(sql).toContain('"orders_idempotency_key_idx" ON "orders" ("idempotency_key")');
    expect(sql).toContain('"tickets_serial_no_idx" ON "tickets" ("serial_no")');
  });

  it("é idempotente (re-execução do provisionamento não quebra)", () => {
    for (const s of TENANT_SCHEMA_STATEMENTS) {
      const head = s.trim().slice(0, 60).toUpperCase();
      const ok =
        head.startsWith("CREATE TABLE IF NOT EXISTS") ||
        head.startsWith("CREATE INDEX IF NOT EXISTS") ||
        head.startsWith("CREATE UNIQUE INDEX IF NOT EXISTS") ||
        /^ALTER TABLE "[A-Z_]+" ADD COLUMN IF NOT EXISTS/.test(head) ||
        (head.startsWith("DO $$") && s.includes("duplicate_object"));
      expect(ok, s.slice(0, 80)).toBe(true);
    }
  });
});
