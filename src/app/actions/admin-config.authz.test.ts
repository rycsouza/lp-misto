import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Regressão de autorização de `updateConfigValues` (chaves de configuração do site).
 *
 * Admin do CLUBE (role admin sem isPlatform) só grava as chaves das telas que vê:
 * Clube sem mídia, Retirada e Seções. Chave restrita ao sistema com valor IGUAL ao
 * atual é ignorada (hidden de mídia); com valor DIFERENTE, ou chave desconhecida,
 * recusa o lote inteiro sem gravar nada. Admin do SISTEMA grava as chaves conhecidas.
 *
 * O banco é um fake: `rows` simula o que está gravado e `writes` registra cada
 * insert/upsert. Assim provamos o que foi gravado, não só que a action não lançou.
 */
const h = vi.hoisted(() => ({
  session: null as unknown,
  rows: [] as { key: string; value: string }[],
  writes: [] as { key: string; value: string }[],
}));

vi.mock("@/app/actions/admin-auth", () => ({
  getAdminSession: async () => h.session,
}));
vi.mock("@/lib/db/client", () => ({
  getDb: async () => ({
    select: () => ({ from: () => ({ where: async () => h.rows }) }),
    insert: () => ({
      values: (v: { key: string; value: string }) => ({
        onConflictDoUpdate: async () => {
          h.writes.push({ key: v.key, value: v.value });
        },
      }),
    }),
  }),
}));
vi.mock("@/lib/db/queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/queries")>()),
  currentTenantSlug: async () => "misto",
}));
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: () => {},
  revalidatePath: () => {},
}));

import { updateConfigValues } from "./admin";

const CLUBE = { role: "admin", permissions: {} };
const CLUBE_EXPLICITO = { role: "admin", permissions: {}, isPlatform: false };
const SISTEMA = { role: "admin", permissions: {}, isPlatform: true };

/** Valores atuais do banco (simula a tabela siteConfig). */
const DB_ROWS = [
  { key: "siteName", value: "Misto" },
  { key: "clubLogoUrl", value: "/logo.png" },
  { key: "heroImageUrl", value: "" },
  { key: "sessionDurationHours", value: "24" },
  { key: "ticketPriceInteiraCents", value: "2000" },
  { key: "heroStats", value: '[{"value":"1993","label":"Fundação"}]' },
];

beforeEach(() => {
  h.session = null;
  h.rows = DB_ROWS.map((r) => ({ ...r }));
  h.writes = [];
});

describe("admin do clube: chaves permitidas", () => {
  beforeEach(() => {
    h.session = CLUBE;
  });

  it("grava dados do clube (aba Clube sem mídia)", async () => {
    await updateConfigValues({ siteName: "Misto EC", whatsapp: "5567999999999", keywords: "[]" });
    expect(h.writes).toEqual([
      { key: "siteName", value: "Misto EC" },
      { key: "whatsapp", value: "5567999999999" },
      { key: "keywords", value: "[]" },
    ]);
  });

  it("grava Retirada e Seções", async () => {
    await updateConfigValues({
      pickupEnabled: "true",
      pickupLocations: "[]",
      "section.news.enabled": "false",
      "section.hero.order": "0",
      "section.raffle.enabled": "true",
    });
    expect(h.writes.map((w) => w.key)).toEqual([
      "pickupEnabled",
      "pickupLocations",
      "section.news.enabled",
      "section.hero.order",
      "section.raffle.enabled",
    ]);
  });

  it("grava o toggle do mural dos sócios na home (só true ou false)", async () => {
    await updateConfigValues({ "section.member_wall.enabled": "false" });
    await updateConfigValues({ "section.member_wall.enabled": "true" });
    expect(h.writes).toEqual([
      { key: "section.member_wall.enabled", value: "false" },
      { key: "section.member_wall.enabled", value: "true" },
    ]);
  });

  it("aceita valor de exatamente 20.000 caracteres", async () => {
    await updateConfigValues({ description: "x".repeat(20_000) });
    expect(h.writes).toEqual([{ key: "description", value: "x".repeat(20_000) }]);
  });

  it("ignora silenciosamente os hidden de mídia com o valor atual e grava o resto", async () => {
    await updateConfigValues({
      siteName: "Misto EC",
      clubLogoUrl: "/logo.png",
      faviconUrl: "", // sem linha no banco: valor atual é vazio
      heroImageUrl: "",
    });
    expect(h.writes).toEqual([{ key: "siteName", value: "Misto EC" }]);
  });

  it("recusa mídia com valor DIFERENTE e não grava nada, nem as chaves permitidas", async () => {
    await expect(
      updateConfigValues({
        siteName: "Misto EC",
        heroImageUrl: "https://exemplo.com/outra.png",
      }),
    ).rejects.toThrow("Não autorizado.");
    expect(h.writes).toEqual([]);
  });

  it("grava os destaques do hero (heroStats é do clube)", async () => {
    const stats = '[{"value":"1993","label":"Fundação"},{"value":"Série B 2026","label":"Competição"}]';
    await updateConfigValues({ siteName: "Misto EC", heroStats: stats });
    expect(h.writes).toEqual([
      { key: "siteName", value: "Misto EC" },
      { key: "heroStats", value: stats },
    ]);
  });

  it("grava destaques vazios (esconde o bloco)", async () => {
    await updateConfigValues({ heroStats: "[]" });
    expect(h.writes).toEqual([{ key: "heroStats", value: "[]" }]);
  });

  it("recusa destaques do hero com valor inválido e não grava nada, nem as chaves permitidas", async () => {
    for (const bad of [
      "não é json",
      '{"value":"1993","label":"Fundação"}',
      '[{"value":"1993","label":"Fundação","href":"javascript:alert(1)"}]',
      '[{"value":1993,"label":"Fundação"}]',
      '[{"value":"","label":""}]',
      `[{"value":"${"9".repeat(31)}","label":"x"}]`,
      `[{"value":"1","label":"${"x".repeat(41)}"}]`,
      JSON.stringify(Array.from({ length: 7 }, (_, i) => ({ value: String(i), label: "x" }))),
    ]) {
      await expect(updateConfigValues({ siteName: "Misto EC", heroStats: bad })).rejects.toThrow(
        "Dados inválidos.",
      );
    }
    expect(h.writes).toEqual([]);
  });

  it("trata chave de mídia sem linha no banco como valor vazio (recusa valor não vazio)", async () => {
    await expect(
      updateConfigValues({ faviconUrl: "https://cdn.exemplo.com/fav.png" }),
    ).rejects.toThrow("Não autorizado.");
    expect(h.writes).toEqual([]);
  });

  it("recusa configuração do sistema com valor diferente (sessão, preço, cor)", async () => {
    const CASES: Record<string, string>[] = [
      { sessionDurationHours: "720" },
      { ticketPriceInteiraCents: "1" },
      { primaryColor: "#000000" },
      { shippingEnabled: "false" },
      { raffleNumberPriceCents: "1" },
      { meiaEligibilityLabel: "x" },
    ];
    for (const updates of CASES) {
      await expect(updateConfigValues(updates)).rejects.toThrow("Não autorizado.");
    }
    expect(h.writes).toEqual([]);
  });

  it("aceita configuração do sistema se o valor for igual ao atual (ignorada, não grava)", async () => {
    await updateConfigValues({ sessionDurationHours: "24", siteName: "Misto EC" });
    expect(h.writes).toEqual([{ key: "siteName", value: "Misto EC" }]);
  });
});

describe("mural dos sócios (member_wall) na aba Seções: valores validados", () => {
  const BAD_VALUES = ["", "yes", "1", "0", "TRUE", "False", "true ", "true\n", "false;x", "<script>"];

  for (const value of BAD_VALUES) {
    it(`recusa o valor ${JSON.stringify(value)} sem gravar nada (admin do clube e do sistema)`, async () => {
      h.session = CLUBE;
      await expect(updateConfigValues({ "section.member_wall.enabled": value })).rejects.toThrow("Dados inválidos.");
      h.session = SISTEMA;
      await expect(updateConfigValues({ "section.member_wall.enabled": value })).rejects.toThrow("Dados inválidos.");
      expect(h.writes).toEqual([]);
    });
  }

  it("a ordem do mural é gravável como a das demais seções (inteiro)", async () => {
    h.session = CLUBE;
    await updateConfigValues({ "section.member_wall.order": "6" });
    expect(h.writes).toEqual([{ key: "section.member_wall.order", value: "6" }]);
  });

  for (const value of ["-1", "1.5", "abc", "1000", ""]) {
    it(`recusa a ordem ${JSON.stringify(value)} do mural sem gravar nada`, async () => {
      h.session = CLUBE;
      await expect(updateConfigValues({ "section.member_wall.order": value })).rejects.toThrow("Dados inválidos.");
      expect(h.writes).toEqual([]);
    });
  }
});

describe("rótulo das seções (section.<key>.label): aba Seções", () => {
  it("admin do clube grava rótulos válidos, e vazio volta ao padrão", async () => {
    h.session = CLUBE;
    await updateConfigValues({
      "section.shop.label": "Loja Oficial",
      "section.news.label": "",
      "section.member_wall.label": "Torcida Sócia",
    });
    expect(h.writes).toEqual([
      { key: "section.shop.label", value: "Loja Oficial" },
      { key: "section.news.label", value: "" },
      { key: "section.member_wall.label", value: "Torcida Sócia" },
    ]);
  });

  it("admin do sistema grava o mesmo rótulo", async () => {
    h.session = SISTEMA;
    await updateConfigValues({ "section.shop.label": "Loja Oficial" });
    expect(h.writes).toEqual([{ key: "section.shop.label", value: "Loja Oficial" }]);
  });

  const BAD_LABELS = [
    "<script>alert(1)</script>",
    "<b>Loja</b>",
    "A",
    "a".repeat(41),
    "Loja 🛒",
    " Loja",
    "Loja  Oficial",
    "Loja\nOficial",
    "1234",
  ];
  for (const value of BAD_LABELS) {
    it(`recusa o rótulo ${JSON.stringify(value)} e não grava nada, nem as outras seções (clube e sistema)`, async () => {
      h.session = CLUBE;
      await expect(
        updateConfigValues({ "section.news.enabled": "false", "section.shop.label": value }),
      ).rejects.toThrow("Dados inválidos.");
      h.session = SISTEMA;
      await expect(updateConfigValues({ "section.shop.label": value })).rejects.toThrow("Dados inválidos.");
      expect(h.writes).toEqual([]);
    });
  }

  it("rótulo de seção desconhecida é recusado (não é chave permitida)", async () => {
    h.session = CLUBE;
    await expect(updateConfigValues({ "section.foo.label": "Qualquer" })).rejects.toThrow("Não autorizado.");
    h.session = SISTEMA;
    await expect(updateConfigValues({ "section.foo.label": "Qualquer" })).rejects.toThrow("Não autorizado.");
    expect(h.writes).toEqual([]);
  });
});

describe("chave desconhecida: recusada para todos", () => {
  const UNKNOWN = [
    "section.foo.order",
    "club.pix_key",
    "club.cnpj",
    "payment.enabled",
    "section.foo.enabled",
    "section.news.delete",
    "section.news",
    "constructor",
    "__proto__",
    "toString",
    "minhaChaveNova",
  ];

  for (const key of UNKNOWN) {
    it(`admin do clube recusa "${key}" sem gravar nada`, async () => {
      h.session = CLUBE;
      await expect(
        updateConfigValues({ siteName: "Misto EC", [key]: "valor" }),
      ).rejects.toThrow("Não autorizado.");
      expect(h.writes).toEqual([]);
    });

    it(`admin do sistema também recusa "${key}"`, async () => {
      h.session = SISTEMA;
      await expect(updateConfigValues({ [key]: "valor" })).rejects.toThrow("Não autorizado.");
      expect(h.writes).toEqual([]);
    });
  }
});

describe("admin do sistema", () => {
  beforeEach(() => {
    h.session = SISTEMA;
  });

  it("grava chaves restritas ao sistema (sessão, cores, frete, preço, mídia)", async () => {
    await updateConfigValues({
      sessionDurationHours: "168",
      primaryColor: "#112233",
      shippingEnabled: "false",
      ticketPriceInteiraCents: "2500",
      clubLogoUrl: "/novo-escudo.png",
    });
    expect(h.writes.map((w) => w.key)).toEqual([
      "sessionDurationHours",
      "primaryColor",
      "shippingEnabled",
      "ticketPriceInteiraCents",
      "clubLogoUrl",
    ]);
  });

  it("grava chaves do clube e de mídia juntas", async () => {
    await updateConfigValues({ siteName: "Misto EC", heroImageUrl: "" });
    expect(h.writes).toEqual([
      { key: "siteName", value: "Misto EC" },
      { key: "heroImageUrl", value: "" },
    ]);
  });
});

describe("papéis sem permissão de configuração", () => {
  for (const [label, session] of [
    ["sessão ausente", null],
    ["editor com permissão de configurações", { role: "editor", permissions: { configuracoes: true } }],
    ["editor sem permissões", { role: "editor", permissions: {} }],
  ] as const) {
    it(`bloqueia ${label}`, async () => {
      h.session = session;
      await expect(updateConfigValues({ siteName: "Misto EC" })).rejects.toThrow("Não autorizado.");
      await expect(updateConfigValues({ sessionDurationHours: "1" })).rejects.toThrow("Não autorizado.");
      expect(h.writes).toEqual([]);
    });
  }

  it("admin com isPlatform=false é tratado como admin do clube", async () => {
    h.session = CLUBE_EXPLICITO;
    await expect(updateConfigValues({ sessionDurationHours: "1" })).rejects.toThrow("Não autorizado.");
    expect(h.writes).toEqual([]);
  });
});

describe("payload inválido: recusado antes de gravar", () => {
  // Chave longa ou excesso de chaves são desconhecidas (recusadas antes do schema):
  // os limites de tamanho de chave e de quantidade estão em config-keys.test.ts.
  const INVALID: [string, unknown][] = [
    ["array no lugar do objeto", ["siteName", "Misto"]],
    ["string no lugar do objeto", "siteName=Misto"],
    ["null", null],
    ["objeto vazio", {}],
    ["valor número", { siteName: 123 }],
    ["valor booleano", { pickupEnabled: true }],
    ["valor null", { siteName: null }],
    ["valor objeto aninhado", { siteName: { a: "b" } }],
    ["valor acima de 20.000 caracteres", { siteName: "x".repeat(20_001) }],
  ];

  for (const [label, payload] of INVALID) {
    it(`admin do clube recusa ${label}`, async () => {
      h.session = CLUBE;
      await expect(
        updateConfigValues(payload as unknown as Record<string, string>),
      ).rejects.toThrow("Dados inválidos.");
      expect(h.writes).toEqual([]);
    });

    it(`admin do sistema recusa ${label}`, async () => {
      h.session = SISTEMA;
      await expect(
        updateConfigValues(payload as unknown as Record<string, string>),
      ).rejects.toThrow("Dados inválidos.");
      expect(h.writes).toEqual([]);
    });
  }
});

describe("nome do programa de sócio (membershipProgramName): aba Clube", () => {
  const BAD_NAMES = [
    "<script>alert(1)</script>",
    "<b>Sócio</b>",
    "A",
    "a".repeat(41),
    "Sócio 🦁",
    " Sócio",
    "Sócio ",
    "Sócio  Torcedor",
    "1234",
    "Sócio\nTorcedor",
  ];

  it("admin do clube grava um nome válido", async () => {
    h.session = CLUBE;
    await updateConfigValues({ membershipProgramName: "Sócio Premium" });
    expect(h.writes).toEqual([{ key: "membershipProgramName", value: "Sócio Premium" }]);
  });

  it("aceita acento, apóstrofo e hífen", async () => {
    h.session = CLUBE;
    await updateConfigValues({ membershipProgramName: "D'Ouro Sócio-Ação" });
    expect(h.writes).toEqual([{ key: "membershipProgramName", value: "D'Ouro Sócio-Ação" }]);
  });

  it("vazio é aceito (volta ao padrão Sócio-Torcedor)", async () => {
    h.session = CLUBE;
    await updateConfigValues({ membershipProgramName: "" });
    expect(h.writes).toEqual([{ key: "membershipProgramName", value: "" }]);
  });

  it("admin do sistema grava o mesmo nome", async () => {
    h.session = SISTEMA;
    await updateConfigValues({ membershipProgramName: "Sócio Premium" });
    expect(h.writes).toEqual([{ key: "membershipProgramName", value: "Sócio Premium" }]);
  });

  for (const value of BAD_NAMES) {
    it(`recusa ${JSON.stringify(value)} sem gravar nada (clube e sistema)`, async () => {
      h.session = CLUBE;
      await expect(updateConfigValues({ membershipProgramName: value })).rejects.toThrow("Dados inválidos.");
      h.session = SISTEMA;
      await expect(updateConfigValues({ membershipProgramName: value })).rejects.toThrow("Dados inválidos.");
      expect(h.writes).toEqual([]);
    });
  }

  it("nome inválido recusa o lote inteiro: nem as outras chaves do clube são gravadas", async () => {
    h.session = CLUBE;
    await expect(
      updateConfigValues({ siteName: "Misto EC", membershipProgramName: "<b>x</b>" }),
    ).rejects.toThrow("Dados inválidos.");
    expect(h.writes).toEqual([]);
  });

  it("valor acima de 20.000 caracteres não é gravado", async () => {
    h.session = CLUBE;
    await expect(updateConfigValues({ membershipProgramName: "a".repeat(20_001) })).rejects.toThrow();
    expect(h.writes).toEqual([]);
  });
});

describe("plano de sócio padrão: gravado só pela action própria (setDefaultMembershipPlan)", () => {
  const PLANO = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";

  it("admin do clube e admin do sistema são recusados e nada é gravado", async () => {
    for (const session of [CLUBE, SISTEMA]) {
      h.session = session;
      await expect(updateConfigValues({ membershipDefaultPlanId: PLANO })).rejects.toThrow("Não autorizado.");
      await expect(updateConfigValues({ membershipDefaultPlanId: "" })).rejects.toThrow("Não autorizado.");
    }
    expect(h.writes).toEqual([]);
  });

  it("recusa o lote inteiro: outras chaves do clube não são gravadas junto", async () => {
    h.session = CLUBE;
    await expect(
      updateConfigValues({ siteName: "Misto EC", membershipDefaultPlanId: PLANO }),
    ).rejects.toThrow("Não autorizado.");
    expect(h.writes).toEqual([]);
  });
});
