import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPair, exportPKCS8, jwtVerify } from "jose";
import {
  type WalletEnv,
  buildGoogleWalletSaveUrl,
  buildWalletPassPayload,
  getGoogleWalletConfig,
  isGoogleWalletConfigured,
  walletClassId,
  walletIdPart,
  walletLogoUrl,
  walletObjectId,
} from "./google";
import type { MemberCardData } from "@/lib/membership/card-data";
import { FALLBACK_CARD_COLOR } from "@/lib/membership/card-visual";

const ISSUER = "3388000000012345678";
const SA = "wallet-socios@clube-teste.iam.gserviceaccount.com";
const MEMBER = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const SAVE_PREFIX = "https://pay.google.com/gp/v/save/";

function card(over: Partial<MemberCardData> = {}): MemberCardData {
  return {
    name: "Ana Torcedora",
    planName: "Carcará",
    status: "active",
    memberSince: "2026-03-01T15:00:00.000Z",
    nextBillingDate: "2026-11-10T15:00:00.000Z",
    cardColor: "#1e3a8a",
    clubColor: "#c19a5a",
    clubLogoUrl: "https://cdn.exemplo.com.br/logo.png",
    benefits: [],
    hasDiscounts: true,
    hasBenefits: true,
    qrValue: `https://clube.example/socios/carteirinha?token=${MEMBER}`,
    ...over,
  };
}

const INPUT = {
  tenantSlug: "clube-a",
  clubName: "Clube A",
  baseUrl: "https://clube.example",
  memberId: MEMBER,
  card: card(),
};

function content(over: Partial<typeof INPUT> = {}, issuerId = ISSUER) {
  return buildWalletPassPayload({ issuerId, ...INPUT, ...over });
}

let privateKeyPem = "";
let publicKey: CryptoKey;
let otherPublicKey: CryptoKey;
let env: WalletEnv;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { modulusLength: 2048, extractable: true });
  privateKeyPem = await exportPKCS8(pair.privateKey);
  publicKey = pair.publicKey;
  otherPublicKey = (await generateKeyPair("RS256", { modulusLength: 2048 })).publicKey;
  // Como a Vercel guarda: uma linha, "\n" escapado.
  env = {
    GOOGLE_WALLET_ISSUER_ID: ISSUER,
    GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: SA,
    GOOGLE_WALLET_PRIVATE_KEY: privateKeyPem.replace(/\n/g, "\\n"),
  };
});

describe("configuração (variáveis de ambiente)", () => {
  it("sem as variáveis → recurso desligado", () => {
    expect(getGoogleWalletConfig({})).toBeNull();
    expect(isGoogleWalletConfigured({})).toBe(false);
  });

  it("sem uma das três → desligado", () => {
    const noIssuer: WalletEnv = { ...env, GOOGLE_WALLET_ISSUER_ID: undefined };
    const noEmail: WalletEnv = { ...env, GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: undefined };
    expect(getGoogleWalletConfig(noIssuer)).toBeNull();
    expect(getGoogleWalletConfig(noEmail)).toBeNull();
  });

  it("formato inválido (issuer não numérico, e-mail ou chave que não é PEM) → desligado", () => {
    expect(getGoogleWalletConfig({ ...env, GOOGLE_WALLET_ISSUER_ID: "abc" })).toBeNull();
    expect(getGoogleWalletConfig({ ...env, GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: "nao-e-email" })).toBeNull();
    expect(getGoogleWalletConfig({ ...env, GOOGLE_WALLET_PRIVATE_KEY: "segredo-qualquer" })).toBeNull();
  });

  it("chave entre aspas e com \\n escapado vira PEM válido", () => {
    const cfg = getGoogleWalletConfig({ ...env, GOOGLE_WALLET_PRIVATE_KEY: `"${env.GOOGLE_WALLET_PRIVATE_KEY}"` });
    expect(cfg?.privateKeyPem).toBe(privateKeyPem);
    expect(cfg?.issuerId).toBe(ISSUER);
  });
});

describe("ids saneados", () => {
  it("só [A-Za-z0-9._-]; o resto vira _", () => {
    expect(walletIdPart("clube a/../b?x=1")).toBe("clube_a_.._b_x_1");
  });

  it("classe e objeto seguem o padrão emissor.socio_clube_socio", () => {
    expect(walletClassId(ISSUER, "clube-a")).toBe(`${ISSUER}.socio_clube-a`);
    expect(walletObjectId(ISSUER, "Clube A", "id x/y")).toBe(`${ISSUER}.socio_Clube_A_id_x_y`);
  });

  it("objeto muda quando a carteirinha é trocada (QR novo), sem expor o token no id", () => {
    const a = walletObjectId(ISSUER, "clube-a", "m1", "https://c/socios/carteirinha?token=aaaa");
    const b = walletObjectId(ISSUER, "clube-a", "m1", "https://c/socios/carteirinha?token=bbbb");
    expect(a).not.toBe(b);
    expect(a).toMatch(new RegExp(`^${ISSUER.replace(/\./g, "\\.")}\\.socio_clube-a_m1_[0-9a-f]{12}$`));
    expect(a).not.toContain("aaaa");
    expect(walletObjectId(ISSUER, "clube-a", "m1", "https://c/socios/carteirinha?token=aaaa")).toBe(a);
  });

  it("o objeto aponta para a classe do clube", () => {
    const out = content();
    const [klass] = out.payload.genericClasses;
    const [obj] = out.payload.genericObjects;
    expect(klass.id).toBe(`${ISSUER}.socio_clube-a`);
    expect(obj.classId).toBe(klass.id);
    expect(obj.id).toMatch(new RegExp(`^${ISSUER}\\.socio_clube-a_${MEMBER}_[0-9a-f]{12}$`));
  });

  it("tenant vazio → erro (não monta id sem clube)", () => {
    expect(() => content({ tenantSlug: "   " })).toThrow();
  });
});

describe("conteúdo do passe", () => {
  it("cardTitle = clube, header = sócio, subheader fixo, QR = link de verificação", () => {
    const [obj] = content().payload.genericObjects;
    expect(obj).toMatchObject({
      state: "ACTIVE",
      cardTitle: { defaultValue: { language: "pt-BR", value: "Clube A" } },
      header: { defaultValue: { language: "pt-BR", value: "Ana Torcedora" } },
      subheader: { defaultValue: { language: "pt-BR", value: "Sócio-torcedor" } },
      barcode: { type: "QR_CODE", value: card().qrValue },
    });
  });

  it("plano e mês/ano de adesão (fuso de São Paulo) nos campos de texto", () => {
    const [obj] = content().payload.genericObjects;
    expect(obj.textModulesData).toEqual([
      { id: "plano", header: "Plano", body: "Carcará" },
      { id: "socio_desde", header: "Sócio desde", body: "03/2026" },
    ]);
  });

  it("não leva dados de contato (e-mail, CPF ou telefone)", () => {
    const json = JSON.stringify(content());
    expect(json).not.toMatch(/@/);
    expect(json).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  });

  it("cor do cartão; sem cor do plano usa a do clube; sem nenhuma usa a de reserva", () => {
    expect(content().payload.genericObjects[0].hexBackgroundColor).toBe("#1e3a8a");
    const semPlano = content({ card: card({ cardColor: null }) });
    expect(semPlano.payload.genericObjects[0].hexBackgroundColor).toBe("#c19a5a");
    const semNada = content({ card: card({ cardColor: null, clubColor: null }) });
    expect(semNada.payload.genericObjects[0].hexBackgroundColor).toBe(FALLBACK_CARD_COLOR);
  });

  it("origins = origem https do clube; sem https, lista vazia", () => {
    expect(content().origins).toEqual(["https://clube.example"]);
    expect(content({ baseUrl: "http://localhost:3000" }).origins).toEqual([]);
  });
});

describe("logo do clube", () => {
  it("relativo vira absoluto com a origem do clube", () => {
    expect(walletLogoUrl("/img/logo.png", "https://clube.example")).toBe("https://clube.example/img/logo.png");
  });

  it("http, data:, javascript: e protocolo-relativo são omitidos", () => {
    expect(walletLogoUrl("http://cdn.exemplo.com.br/logo.png", "https://clube.example")).toBeNull();
    expect(walletLogoUrl("data:image/png;base64,AAAA", "https://clube.example")).toBeNull();
    expect(walletLogoUrl("javascript:alert(1)", "https://clube.example")).toBeNull();
    expect(walletLogoUrl("//evil.example/logo.png", "https://clube.example")).toBeNull();
  });

  it("relativo sem base https → omitido", () => {
    expect(walletLogoUrl("/logo.png", null)).toBeNull();
    expect(walletLogoUrl("/logo.png", "http://localhost:3000")).toBeNull();
  });

  it("sem logo válido, o campo logo não vai ao passe", () => {
    const [obj] = content({ card: card({ clubLogoUrl: "http://inseguro.example/logo.png" }) }).payload.genericObjects;
    expect(obj).not.toHaveProperty("logo");
  });

  it("logo https absoluto entra no passe", () => {
    const [obj] = content().payload.genericObjects;
    expect(obj.logo).toEqual({ sourceUri: { uri: "https://cdn.exemplo.com.br/logo.png" } });
  });
});

describe("assinatura do link", () => {
  it("link https://pay.google.com/gp/v/save/<JWT> com claims verificáveis", async () => {
    const url = await buildGoogleWalletSaveUrl(INPUT, env);
    expect(url?.startsWith(SAVE_PREFIX)).toBe(true);
    const { payload, protectedHeader } = await jwtVerify(url!.slice(SAVE_PREFIX.length), publicKey, {
      issuer: SA,
      audience: "google",
      algorithms: ["RS256"],
    });
    expect(protectedHeader.alg).toBe("RS256");
    expect(payload.typ).toBe("savetowallet");
    expect(payload.origins).toEqual(["https://clube.example"]);
    const inner = payload.payload as { genericClasses: { id: string }[]; genericObjects: { id: string }[] };
    expect(inner.genericObjects[0].id).toMatch(new RegExp(`^${ISSUER}\\.socio_clube-a_${MEMBER}_[0-9a-f]{12}$`));
    expect(inner.genericClasses[0].id).toBe(`${ISSUER}.socio_clube-a`);
  });

  it("JWT assinado com outra chave é recusado", async () => {
    const url = await buildGoogleWalletSaveUrl(INPUT, env);
    await expect(
      jwtVerify(url!.slice(SAVE_PREFIX.length), otherPublicKey, { issuer: SA, audience: "google", algorithms: ["RS256"] })
    ).rejects.toThrow();
  });

  it("sem configuração → null (nada é assinado)", async () => {
    expect(await buildGoogleWalletSaveUrl(INPUT, {})).toBeNull();
  });
});
