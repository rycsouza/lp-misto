import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * GET /.well-known/assetlinks.json: resposta por tenant, sem login.
 * O banco é simulado pelo mock de getAllSiteConfig (as linhas de siteConfig do tenant).
 */
const h = vi.hoisted(() => ({
  rows: [] as { key: string; value: string }[],
  fail: false,
}));

vi.mock("@/lib/db/queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/queries")>()),
  getAllSiteConfig: async () => {
    if (h.fail) throw new Error("connection refused: postgres://user:senha@host/db");
    return h.rows;
  },
}));

import { GET } from "./route";

const PKG = "com.misto.app";
const FP_A = Array.from({ length: 32 }, (_, i) => ((0x0a + i * 7) & 0xff).toString(16).toUpperCase().padStart(2, "0")).join(":");
const FP_B = Array.from({ length: 32 }, (_, i) => ((0x1b + i * 7) & 0xff).toString(16).toUpperCase().padStart(2, "0")).join(":");

const CONFIGURADO = [
  { key: "siteName", value: "Misto EC" },
  { key: "androidPackageName", value: PKG },
  { key: "androidCertFingerprints", value: JSON.stringify([FP_A, FP_B]) },
];

beforeEach(() => {
  h.rows = [];
  h.fail = false;
});

describe("GET /.well-known/assetlinks.json", () => {
  it("clube sem app configurado: 404 com [] e cache curto", async () => {
    h.rows = [{ key: "siteName", value: "Misto EC" }];
    const res = await GET();
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    expect(res.headers.get("vary")).toBe("Host");
    expect(await res.json()).toEqual([]);
  });

  it("clube com app configurado: 200 com o JSON exigido pelo Android", async () => {
    h.rows = CONFIGURADO;
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    expect(await res.json()).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: PKG,
          sha256_cert_fingerprints: [FP_A, FP_B],
        },
      },
    ]);
  });

  it("impressões gravadas em minúsculas saem normalizadas (maiúsculas)", async () => {
    h.rows = [
      { key: "androidPackageName", value: PKG },
      { key: "androidCertFingerprints", value: JSON.stringify([FP_A.toLowerCase()]) },
    ];
    const body = await (await GET()).json();
    expect(body[0].target.sha256_cert_fingerprints).toEqual([FP_A]);
  });

  it("valores inválidos no banco nunca aparecem na resposta", async () => {
    h.rows = [
      { key: "androidPackageName", value: PKG },
      {
        key: "androidCertFingerprints",
        value: JSON.stringify(["<img src=x onerror=alert(1)>", FP_A, "abc", 7, { x: 1 }]),
      },
    ];
    const res = await GET();
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toContain("<img");
    expect(text).not.toContain("onerror");
    expect(JSON.parse(text)[0].target.sha256_cert_fingerprints).toEqual([FP_A]);
  });

  it("pacote inválido no banco: 404 e nada do valor sai na resposta", async () => {
    h.rows = [
      { key: "androidPackageName", value: 'com.x"}],"evil":"<script>' },
      { key: "androidCertFingerprints", value: JSON.stringify([FP_A]) },
    ];
    const res = await GET();
    const text = await res.text();
    expect(res.status).toBe(404);
    expect(text).toBe("[]");
  });

  it("só impressões inválidas no banco: 404", async () => {
    h.rows = [
      { key: "androidPackageName", value: PKG },
      { key: "androidCertFingerprints", value: JSON.stringify(["nope"]) },
    ];
    expect((await GET()).status).toBe(404);
  });

  it("não expõe outras chaves da configuração do clube", async () => {
    h.rows = [...CONFIGURADO, { key: "ticketPriceInteiraCents", value: "2000" }];
    const text = await (await GET()).text();
    expect(text).not.toContain("Misto EC");
    expect(text).not.toContain("ticketPrice");
  });

  it("falha de leitura: 404 sem cache e sem detalhe do erro", async () => {
    h.fail = true;
    const res = await GET();
    const text = await res.text();
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(text).toBe("[]");
    expect(text).not.toContain("postgres");
  });
});
