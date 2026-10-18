import { describe, it, expect } from "vitest";
import {
  ANDROID_FINGERPRINTS_MAX,
  buildAssetLinkStatements,
  fingerprintsFromInput,
  fingerprintsToInputText,
  isValidAndroidAppConfigValue,
  isValidAndroidPackageName,
  normalizeSha256Fingerprint,
  parseStoredFingerprints,
  readStoredFingerprints,
} from "./assetlinks";

/** SHA-256 válido (32 pares hex em maiúsculas separados por dois-pontos), por semente. */
const fp = (seed: number) =>
  Array.from({ length: 32 }, (_, i) => ((seed + i * 7) & 0xff).toString(16).toUpperCase().padStart(2, "0")).join(":");
const FP_A = fp(0x0a);
const FP_B = fp(0x1b);
const FP_C = fp(0x2c);
const FP_D = fp(0x3d);
const FP_E = fp(0x4e);
const FP_F = fp(0x5f);

describe("isValidAndroidPackageName", () => {
  it.each(["com.misto.app", "br.com.clube_x.app1", "a.b", "Com.Clube.App"])("aceita %s", (v) => {
    expect(isValidAndroidPackageName(v)).toBe(true);
  });

  it.each([
    ["vazio", ""],
    ["sem ponto", "comapp"],
    ["começa com número", "1com.app"],
    ["ponto duplo", "com..app"],
    ["ponto no fim", "com.app."],
    ["ponto no início", ".com.app"],
    ["hífen", "com.app-x"],
    ["espaço", "com.app x"],
    ["quebra de linha", "com.app\n"],
    ["aspas e tag", 'com.app"><script>'],
    ["segmento começa com underscore", "com._app"],
  ])("recusa %s", (_label, v) => {
    expect(isValidAndroidPackageName(v)).toBe(false);
  });

  it("aceita exatamente 100 caracteres e recusa 101", () => {
    const ok = "a." + "b".repeat(98);
    expect(ok.length).toBe(100);
    expect(isValidAndroidPackageName(ok)).toBe(true);
    expect(isValidAndroidPackageName(ok + "c")).toBe(false);
  });
});

describe("normalizeSha256Fingerprint", () => {
  it("normaliza para maiúsculas e aceita bordas com espaço", () => {
    expect(normalizeSha256Fingerprint("  " + FP_A.toLowerCase() + "  ")).toBe(FP_A);
  });

  it.each([
    ["sem dois-pontos", FP_A.replace(/:/g, "")],
    ["31 pares", FP_A.split(":").slice(0, 31).join(":")],
    ["33 pares", FP_A + ":AA"],
    ["caractere não hex", FP_A.replace("0A", "GZ")],
    ["espaço interno", FP_A.replace(":", " :")],
    ["vazio", ""],
    ["script", "<script>alert(1)</script>"],
  ])("recusa %s", (_label, v) => {
    expect(normalizeSha256Fingerprint(v)).toBeNull();
  });
});

describe("parseStoredFingerprints (valor gravado, formato canônico)", () => {
  it("aceita lista JSON canônica de 1 a 5 impressões", () => {
    expect(parseStoredFingerprints(JSON.stringify([FP_A]))).toEqual([FP_A]);
    expect(parseStoredFingerprints(JSON.stringify([FP_A, FP_B, FP_C, FP_D, FP_E]))).toHaveLength(5);
  });

  it.each([
    ["não é JSON", "AA:BB"],
    ["objeto", JSON.stringify({ a: FP_A })],
    ["lista vazia", "[]"],
    ["seis impressões", JSON.stringify([FP_A, FP_B, FP_C, FP_D, FP_E, FP_F])],
    ["repetida", JSON.stringify([FP_A, FP_A])],
    ["minúscula (não canônica)", JSON.stringify([FP_A.toLowerCase()])],
    ["número", JSON.stringify([1])],
    ["formato inválido", JSON.stringify(["abc"])],
  ])("recusa %s", (_label, raw) => {
    expect(parseStoredFingerprints(raw)).toBeNull();
  });
});

describe("readStoredFingerprints (leitura tolerante do que já está no banco)", () => {
  it("descarta o inválido, normaliza, remove repetida e limita a 5", () => {
    const raw = JSON.stringify([
      "<img src=x onerror=alert(1)>",
      FP_A.toLowerCase(),
      FP_A,
      42,
      FP_B,
      FP_C,
      FP_D,
      FP_E,
      FP_F,
    ]);
    const out = readStoredFingerprints(raw);
    expect(out).toEqual([FP_A, FP_B, FP_C, FP_D, FP_E]);
    expect(out.length).toBeLessThanOrEqual(ANDROID_FINGERPRINTS_MAX);
  });

  it("nunca lança: vazio, nulo, JSON quebrado e não-lista viram []", () => {
    expect(readStoredFingerprints(null)).toEqual([]);
    expect(readStoredFingerprints(undefined)).toEqual([]);
    expect(readStoredFingerprints("")).toEqual([]);
    expect(readStoredFingerprints("{não json")).toEqual([]);
    expect(readStoredFingerprints('"' + FP_A + '"')).toEqual([]);
  });
});

describe("isValidAndroidAppConfigValue", () => {
  it("vazio remove e é sempre aceito", () => {
    expect(isValidAndroidAppConfigValue("androidPackageName", "")).toBe(true);
    expect(isValidAndroidAppConfigValue("androidCertFingerprints", "")).toBe(true);
  });

  it("valida o pacote", () => {
    expect(isValidAndroidAppConfigValue("androidPackageName", "com.misto.app")).toBe(true);
    expect(isValidAndroidAppConfigValue("androidPackageName", "com misto")).toBe(false);
  });

  it("valida a lista de impressões gravada", () => {
    expect(isValidAndroidAppConfigValue("androidCertFingerprints", JSON.stringify([FP_A, FP_B]))).toBe(true);
    expect(isValidAndroidAppConfigValue("androidCertFingerprints", "[]")).toBe(false);
    expect(isValidAndroidAppConfigValue("androidCertFingerprints", FP_A)).toBe(false);
  });

  it("chave de outro módulo não é julgada aqui", () => {
    expect(isValidAndroidAppConfigValue("siteName", "qualquer coisa")).toBe(true);
  });
});

describe("fingerprintsFromInput (texto do formulário)", () => {
  it("texto vazio vira value vazio (remove)", () => {
    expect(fingerprintsFromInput("  \n \n")).toEqual({ ok: true, list: [], value: "" });
  });

  it("aceita uma por linha, com CRLF, espaços e minúsculas; grava JSON canônico", () => {
    const text = `  ${FP_A.toLowerCase()} \r\n\r\n${FP_B}\n`;
    const r = fingerprintsFromInput(text);
    expect(r).toEqual({ ok: true, list: [FP_A, FP_B], value: JSON.stringify([FP_A, FP_B]) });
  });

  it("recusa a sexta impressão", () => {
    const r = fingerprintsFromInput([FP_A, FP_B, FP_C, FP_D, FP_E, FP_F].join("\n"));
    expect(r.ok).toBe(false);
  });

  it("recusa linha inválida apontando o número da linha", () => {
    const r = fingerprintsFromInput(`${FP_A}\nisso-nao-e-hash`);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toContain("Linha 2");
  });

  it("recusa repetida", () => {
    const r = fingerprintsFromInput(`${FP_A}\n${FP_A.toLowerCase()}`);
    expect(r.ok).toBe(false);
  });

  it("o value gerado passa na validação do servidor", () => {
    const r = fingerprintsFromInput(`${FP_A}\n${FP_B}`);
    if (!r.ok) throw new Error("esperado ok");
    expect(isValidAndroidAppConfigValue("androidCertFingerprints", r.value)).toBe(true);
  });
});

describe("fingerprintsToInputText", () => {
  it("devolve uma impressão por linha a partir do valor gravado", () => {
    expect(fingerprintsToInputText(JSON.stringify([FP_A, FP_B]))).toBe(`${FP_A}\n${FP_B}`);
    expect(fingerprintsToInputText(null)).toBe("");
  });
});

describe("buildAssetLinkStatements (corpo de /.well-known/assetlinks.json)", () => {
  const PKG = "com.misto.app";

  it("sem pacote ou sem impressão: null (sem app configurado)", () => {
    expect(buildAssetLinkStatements([])).toBeNull();
    expect(buildAssetLinkStatements([{ key: "androidPackageName", value: PKG }])).toBeNull();
    expect(
      buildAssetLinkStatements([{ key: "androidCertFingerprints", value: JSON.stringify([FP_A]) }]),
    ).toBeNull();
    expect(
      buildAssetLinkStatements([
        { key: "androidPackageName", value: "" },
        { key: "androidCertFingerprints", value: JSON.stringify([FP_A]) },
      ]),
    ).toBeNull();
  });

  it("com pacote e impressões válidos: JSON exato da Google", () => {
    const out = buildAssetLinkStatements([
      { key: "androidPackageName", value: PKG },
      { key: "androidCertFingerprints", value: JSON.stringify([FP_A, FP_B]) },
    ]);
    expect(out).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: PKG,
          sha256_cert_fingerprints: [FP_A, FP_B],
        },
      },
    ]);
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });

  it("pacote inválido no banco: null, nada vai para a resposta", () => {
    const out = buildAssetLinkStatements([
      { key: "androidPackageName", value: 'com.x"><script>alert(1)</script>' },
      { key: "androidCertFingerprints", value: JSON.stringify([FP_A]) },
    ]);
    expect(out).toBeNull();
  });

  it("impressões inválidas são descartadas; sobra só o válido", () => {
    const out = buildAssetLinkStatements([
      { key: "androidPackageName", value: PKG },
      { key: "androidCertFingerprints", value: JSON.stringify(["<b>x</b>", FP_A.toLowerCase(), "zz"]) },
    ]);
    expect(out?.[0].target.sha256_cert_fingerprints).toEqual([FP_A]);
    expect(JSON.stringify(out)).not.toContain("<b>");
  });

  it("só impressões inválidas: null", () => {
    const out = buildAssetLinkStatements([
      { key: "androidPackageName", value: PKG },
      { key: "androidCertFingerprints", value: JSON.stringify(["nope"]) },
    ]);
    expect(out).toBeNull();
  });

  it("lê as chaves por nome: outras chaves do tenant são ignoradas", () => {
    const out = buildAssetLinkStatements([
      { key: "siteName", value: PKG },
      { key: "androidPackageName", value: PKG },
      { key: "androidCertFingerprints", value: JSON.stringify([FP_A]) },
    ]);
    expect(out?.[0].target.package_name).toBe(PKG);
  });
});
