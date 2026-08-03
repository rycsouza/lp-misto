import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { orderSearchCondition } from "./search";

/**
 * Prova que a busca de pedidos encontra por telefone mesmo quando o WhatsApp é
 * gravado FORMATADO. Compilamos o SQL gerado (sem tocar no banco) e conferimos
 * que a coluna é normalizada (regexp_replace) e comparada só pelos dígitos.
 */
function compile(term: string): { sql: string; params: unknown[] } | null {
  const cond = orderSearchCondition(term);
  if (!cond) return null;
  return new PgDialect().sqlToQuery(cond);
}

describe("orderSearchCondition — busca de pedidos por telefone", () => {
  it("termo vazio → undefined (sem filtro)", () => {
    expect(orderSearchCondition("   ")).toBeUndefined();
  });

  it("dígitos puros → compara a coluna NORMALIZADA por dígitos", () => {
    const q = compile("992119358")!;
    expect(q.sql).toContain("regexp_replace");
    expect(q.params).toContain("%992119358%");
  });

  it("telefone FORMATADO → normaliza para só dígitos", () => {
    const q = compile("(67) 99211-9358")!;
    expect(q.params).toContain("%67992119358%");
    expect(q.sql).toContain("regexp_replace");
  });

  it("com DDI → mantém os dígitos como digitados", () => {
    const q = compile("55 67 99211-9358")!;
    expect(q.params).toContain("%5567992119358%");
  });

  it("nome (sem dígitos) → só ILIKE, sem cláusula de telefone normalizado", () => {
    const q = compile("João Silva")!;
    expect(q.sql).not.toContain("regexp_replace");
    expect(q.params).toContain("%João Silva%");
  });

  it("menos de 3 dígitos → não aciona a normalização", () => {
    const q = compile("AB")!;
    expect(q.sql).not.toContain("regexp_replace");
  });

  it("sempre inclui nome, e-mail e whatsapp no ILIKE", () => {
    const q = compile("992119358")!;
    // 3 ILIKE (%992119358%) + 1 LIKE normalizado (%992119358%) = 4 params iguais
    expect(q.params.filter((p) => p === "%992119358%")).toHaveLength(4);
  });
});
