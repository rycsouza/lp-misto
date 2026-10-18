import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Regressão: as exportações CSV de sócios e leads neutralizam células que começam
 * com = + - @ (injeção de fórmula). Nome e e-mail são digitados por terceiros.
 */
const h = vi.hoisted(() => ({ rows: [] as unknown[] }));

function chain(): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    leftJoin: () => c,
    where: () => c,
    orderBy: () => c,
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve(h.rows).then(resolve, reject),
  };
  return c;
}

vi.mock("@/lib/db/client", () => ({
  getDb: async () => ({ select: () => chain() }),
}));
vi.mock("@/lib/admin/auth-guard", () => ({
  requireModule: async () => ({ userId: "u", role: "admin", permissions: {} }),
}));

import { exportMembersCSV, exportLeadsCSV } from "./admin-growth";

const CREATED = new Date("2026-10-01T15:00:00Z");

beforeEach(() => {
  h.rows = [];
});

describe("exportMembersCSV", () => {
  it("neutraliza nome e plano que começam com fórmula", async () => {
    h.rows = [
      {
        name: "=HYPERLINK(\"http://x\")",
        email: "a@b.test",
        whatsapp: "+5511999999999",
        status: "active",
        planName: "@SUM(A1)",
        createdAt: CREATED,
      },
    ];
    const csv = await exportMembersCSV();
    const [header, line] = csv.split("\n");
    expect(header).toBe('"Nome","Email","WhatsApp","Status","Plano","Data"');
    expect(line.startsWith(`"'=HYPERLINK`)).toBe(true);
    expect(line).toContain(`"'+5511999999999"`);
    expect(line).toContain(`"'@SUM(A1)"`);
  });

  it("linha normal sai entre aspas, com aspas internas escapadas", async () => {
    h.rows = [
      { name: 'Maria "M" S.', email: "m@x.test", whatsapp: null, status: "pending", planName: null, createdAt: CREATED },
    ];
    const [, line] = (await exportMembersCSV()).split("\n");
    expect(line.startsWith('"Maria ""M"" S.","m@x.test"')).toBe(true);
  });
});

describe("exportLeadsCSV", () => {
  it("neutraliza nome e e-mail de lead que começam com fórmula", async () => {
    h.rows = [
      { name: "-2+3", email: "=cmd@x.test", whatsapp: null, source: "newsletter", createdAt: CREATED },
    ];
    const [, line] = (await exportLeadsCSV()).split("\n");
    expect(line.startsWith(`"'-2+3","'=cmd@x.test"`)).toBe(true);
  });
});
