import { afterEach, describe, expect, it } from "vitest";
import type { MemberCardData } from "./card-data";
import {
  OFFLINE_CARD_KEY,
  OFFLINE_CARD_MAX_AGE_MS,
  buildOfflineRecord,
  clearOfflineCard,
  parseOfflineRecord,
  readOfflineCardRaw,
  saveOfflineCard,
} from "./offline-card";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-17T15:00:00.000Z");
const QR = "https://clube.test/socios/carteirinha?token=11111111-2222-4333-8444-555555555555";

const card: MemberCardData = {
  name: "Ana Torcedora",
  planName: "Carcará",
  programName: "Sócio-Torcedor",
  status: "active",
  memberSince: "2026-03-01T12:00:00.000Z",
  nextBillingDate: "2026-11-10T12:00:00.000Z",
  cardColor: "#1E3A8A",
  clubColor: "#123456",
  clubLogoUrl: "https://res.cloudinary.com/clube/logo.png",
  background: null,
  benefits: [{ key: "ticket", text: "10% de desconto em ingressos", automatic: true }],
  hasDiscounts: true,
  hasBenefits: true,
  qrValue: QR,
  memberCode: "S-1A2B3C4D",
};

/** Armazenamento em memória com a mesma forma do localStorage. */
function fakeStorage(opts: { failSet?: boolean } = {}) {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      if (opts.failSet) throw new Error("QuotaExceededError");
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  };
  return { storage: storage as unknown as Storage, map };
}

function useStorage(storage: Storage | (() => Storage)) {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get: typeof storage === "function" ? storage : () => storage,
  });
}

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

/** JSON de um registro válido, com ajustes no cartão ou no topo para cada caso. */
function rawWith(cardOverrides: Record<string, unknown> = {}, top: Record<string, unknown> = {}): string {
  const base = buildOfflineRecord(card, "Clube Teste", NOW)!;
  return JSON.stringify({ ...base, ...top, card: { ...base.card, ...cardOverrides } });
}

describe("buildOfflineRecord", () => {
  it("sem benefício não gera registro", () => {
    expect(buildOfflineRecord({ ...card, hasBenefits: false }, "Clube Teste", NOW)).toBeNull();
  });

  it("guarda só a allowlist: sem e-mail, CPF, telefone, fundo nem logo", () => {
    const extra = {
      ...card,
      email: "ana@clube.test",
      cpf: "123.456.789-00",
      phone: "11999990000",
      background: { url: "https://res.cloudinary.com/clube/bg.png", fit: "cover", opacity: 40, blend: "normal" },
    } as unknown as MemberCardData;
    const record = buildOfflineRecord(extra, "Clube Teste", NOW)!;
    const json = JSON.stringify(record);

    expect(json).not.toContain("ana@clube.test");
    expect(json).not.toContain("123.456.789-00");
    expect(json).not.toContain("11999990000");
    expect(json).not.toContain("res.cloudinary.com");
    expect(Object.keys(record.card).sort()).toEqual(
      [
        "benefits",
        "clubColor",
        "cardColor",
        "hasBenefits",
        "hasDiscounts",
        "memberCode",
        "memberSince",
        "name",
        "nextBillingDate",
        "planName",
        "programName",
        "qrValue",
        "status",
      ].sort()
    );
    expect(record.savedAt).toBe(NOW.toISOString());
    expect(record.siteName).toBe("Clube Teste");
  });
});

describe("saveOfflineCard, readOfflineCardRaw e clearOfflineCard", () => {
  it("salva e lê de volta o que o MemberCard precisa", () => {
    const { storage, map } = fakeStorage();
    useStorage(storage);

    saveOfflineCard(card, "Clube Teste", NOW);

    expect(map.has(OFFLINE_CARD_KEY)).toBe(true);
    const parsed = parseOfflineRecord(readOfflineCardRaw(), NOW);
    expect(parsed?.card.name).toBe("Ana Torcedora");
    expect(parsed?.card.qrValue).toBe(QR);
    expect(parsed?.siteName).toBe("Clube Teste");
    expect(parsed?.savedAt.toISOString()).toBe(NOW.toISOString());
  });

  it("sobrescreve a carteirinha anterior (ex.: após gerar uma nova)", () => {
    const { storage, map } = fakeStorage();
    useStorage(storage);

    saveOfflineCard(card, "Clube Teste", NOW);
    saveOfflineCard({ ...card, name: "Bia Nova", qrValue: `${QR}&v=2` }, "Clube Teste", NOW);

    expect(map.size).toBe(1);
    const parsed = parseOfflineRecord(readOfflineCardRaw(), NOW);
    expect(parsed?.card.name).toBe("Bia Nova");
    expect(parsed?.card.qrValue).toBe(`${QR}&v=2`);
  });

  it("sem benefício remove a carteirinha que estava salva", () => {
    const { storage, map } = fakeStorage();
    useStorage(storage);

    saveOfflineCard(card, "Clube Teste", NOW);
    saveOfflineCard({ ...card, hasBenefits: false, status: "suspended" }, "Clube Teste", NOW);

    expect(map.has(OFFLINE_CARD_KEY)).toBe(false);
    expect(readOfflineCardRaw()).toBeNull();
  });

  it("clearOfflineCard remove a carteirinha (logout)", () => {
    const { storage, map } = fakeStorage();
    useStorage(storage);

    saveOfflineCard(card, "Clube Teste", NOW);
    clearOfflineCard();

    expect(map.has(OFFLINE_CARD_KEY)).toBe(false);
  });

  it("localStorage que lança (acesso bloqueado) não derruba nada", () => {
    useStorage(() => {
      throw new Error("SecurityError");
    });

    expect(() => saveOfflineCard(card, "Clube Teste", NOW)).not.toThrow();
    expect(() => clearOfflineCard()).not.toThrow();
    expect(readOfflineCardRaw()).toBeNull();
  });

  it("falha de gravação (cota cheia) é ignorada", () => {
    const { storage } = fakeStorage({ failSet: true });
    useStorage(storage);

    expect(() => saveOfflineCard(card, "Clube Teste", NOW)).not.toThrow();
  });
});

describe("parseOfflineRecord", () => {
  it("aceita registro válido", () => {
    const parsed = parseOfflineRecord(rawWith(), NOW);
    expect(parsed).not.toBeNull();
    expect(parsed!.card.planName).toBe("Carcará");
    expect(parsed!.card.benefits).toEqual([{ key: "ticket", text: "10% de desconto em ingressos", automatic: true }]);
    expect(parsed!.card.hasBenefits).toBe(true);
    // Logo e fundo nunca voltam do armazenamento.
    expect(parsed!.card.clubLogoUrl).toBeNull();
    expect(parsed!.card.background).toBeNull();
  });

  it("aceita até 35 dias e descarta depois disso (expiração)", () => {
    const at35 = new Date(NOW.getTime() - OFFLINE_CARD_MAX_AGE_MS);
    const at35PlusOne = new Date(at35.getTime() - 1);
    const at34 = new Date(NOW.getTime() - 34 * DAY);

    expect(parseOfflineRecord(rawWith({}, { savedAt: at34.toISOString() }), NOW)).not.toBeNull();
    expect(parseOfflineRecord(rawWith({}, { savedAt: at35.toISOString() }), NOW)).not.toBeNull();
    expect(parseOfflineRecord(rawWith({}, { savedAt: at35PlusOne.toISOString() }), NOW)).toBeNull();
  });

  it("descarta data de salvamento no futuro (além da folga de 5 min)", () => {
    const future = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString();
    const slightly = new Date(NOW.getTime() + 2 * 60 * 1000).toISOString();

    expect(parseOfflineRecord(rawWith({}, { savedAt: future }), NOW)).toBeNull();
    expect(parseOfflineRecord(rawWith({}, { savedAt: slightly }), NOW)).not.toBeNull();
  });

  it("descarta texto que não é um registro", () => {
    expect(parseOfflineRecord(null, NOW)).toBeNull();
    expect(parseOfflineRecord("", NOW)).toBeNull();
    expect(parseOfflineRecord("{não é json", NOW)).toBeNull();
    expect(parseOfflineRecord("[]", NOW)).toBeNull();
    expect(parseOfflineRecord("null", NOW)).toBeNull();
    expect(parseOfflineRecord("x".repeat(64 * 1024 + 1), NOW)).toBeNull();
  });

  it("descarta status fora do conjunto conhecido", () => {
    expect(parseOfflineRecord(rawWith({ status: "admin" }), NOW)).toBeNull();
  });

  it("descarta registro sem benefício (hasBenefits diferente de true)", () => {
    expect(parseOfflineRecord(rawWith({ hasBenefits: false }), NOW)).toBeNull();
    expect(parseOfflineRecord(rawWith({ hasBenefits: "true" }), NOW)).toBeNull();
  });

  it("descarta QR que não é http(s)", () => {
    expect(parseOfflineRecord(rawWith({ qrValue: "javascript:alert(1)" }), NOW)).toBeNull();
    expect(parseOfflineRecord(rawWith({ qrValue: "não é url" }), NOW)).toBeNull();
    expect(parseOfflineRecord(rawWith({ qrValue: "" }), NOW)).toBeNull();
    expect(parseOfflineRecord(rawWith({ qrValue: `https://a.test/${"a".repeat(2100)}` }), NOW)).toBeNull();
  });

  it("código curto fora do formato vira null, sem derrubar o registro", () => {
    // O código é opcional: formato errado vira null, sem derrubar o registro.
    const parsed = parseOfflineRecord(rawWith({ memberCode: "<img src=x>" }), NOW);
    expect(parsed).not.toBeNull();
    expect(parsed!.card.memberCode).toBeNull();
  });

  it("cor inválida vira o padrão, sem descartar o registro", () => {
    const parsed = parseOfflineRecord(rawWith({ cardColor: "red; background:url(x)" }), NOW);
    expect(parsed).not.toBeNull();
    expect(parsed!.card.cardColor).toBeNull();
  });

  it("descarta benefícios com formato errado ou em excesso", () => {
    expect(parseOfflineRecord(rawWith({ benefits: [{ key: "a" }] }), NOW)).toBeNull();
    expect(parseOfflineRecord(rawWith({ benefits: "x" }), NOW)).toBeNull();
    const many = Array.from({ length: 51 }, (_, i) => ({ key: `k${i}`, text: "t", automatic: false }));
    expect(parseOfflineRecord(rawWith({ benefits: many }), NOW)).toBeNull();
  });

  it("descarta data inválida e nome vazio", () => {
    expect(parseOfflineRecord(rawWith({ memberSince: "não é data" }), NOW)).toBeNull();
    expect(parseOfflineRecord(rawWith({ name: "" }), NOW)).toBeNull();
    expect(parseOfflineRecord(rawWith({ name: "x".repeat(121) }), NOW)).toBeNull();
  });

  it("descarta quando hasDiscounts falta ou não é booleano", () => {
    expect(parseOfflineRecord(rawWith({ hasDiscounts: "sim" }), NOW)).toBeNull();
  });

  it("descarta siteName com tipo errado", () => {
    expect(parseOfflineRecord(rawWith({}, { siteName: 42 }), NOW)).toBeNull();
  });

  it("ignora campos extras guardados à mão (e-mail, CPF) e não os devolve", () => {
    const tampered = rawWith({ email: "ana@clube.test", cpf: "123" });
    const parsed = parseOfflineRecord(tampered, NOW);
    expect(parsed).not.toBeNull();
    expect(parsed!.card).not.toHaveProperty("email");
    expect(parsed!.card).not.toHaveProperty("cpf");
    expect(JSON.stringify(parsed)).not.toContain("ana@clube.test");
  });
});

describe("nome do programa de sócio no cache offline", () => {
  it("guarda o nome do programa e devolve o mesmo nome ao ler", () => {
    const withName: MemberCardData = { ...card, programName: "Sócio Premium" };
    const record = buildOfflineRecord(withName, "Clube", NOW);
    expect(record).not.toBeNull();
    const parsed = parseOfflineRecord(JSON.stringify(record), NOW);
    expect(parsed?.card.programName).toBe("Sócio Premium");
  });

  it("registro salvo antes do campo existir: não é descartado, usa o padrão", () => {
    const record = buildOfflineRecord(card, "Clube", NOW);
    const old = JSON.parse(JSON.stringify(record));
    delete old.card.programName;
    const parsed = parseOfflineRecord(JSON.stringify(old), NOW);
    expect(parsed).not.toBeNull();
    expect(parsed?.card.programName).toBe("Sócio-Torcedor");
  });

  it("nome gravado à mão com HTML: cai no padrão", () => {
    const record = JSON.parse(JSON.stringify(buildOfflineRecord(card, "Clube", NOW)));
    record.card.programName = "<img src=x onerror=alert(1)>";
    const parsed = parseOfflineRecord(JSON.stringify(record), NOW);
    expect(parsed?.card.programName).toBe("Sócio-Torcedor");
  });
});
