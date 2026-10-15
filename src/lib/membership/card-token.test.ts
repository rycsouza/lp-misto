import { describe, it, expect } from "vitest";
import { rotateMemberCardToken } from "./card-token";

const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Db falso: cada `returning()` consome o próximo item (linhas, ou erro a lançar). */
function fakeDb(outcomes: unknown[]) {
  const sets: Record<string, unknown>[] = [];
  const db = {
    update: () => ({
      set: (values: Record<string, unknown>) => {
        sets.push(values);
        return {
          where: () => ({
            returning: async () => {
              const next = outcomes.shift();
              if (next instanceof Error) throw next;
              return next ?? [];
            },
          }),
        };
      },
    }),
  };
  return { db: db as never, sets };
}

describe("rotateMemberCardToken", () => {
  it("grava um token novo (uuid) no sócio e devolve true", async () => {
    const { db, sets } = fakeDb([[{ id: MEMBER_ID }]]);
    expect(await rotateMemberCardToken(db, MEMBER_ID)).toBe(true);
    expect(sets).toHaveLength(1);
    expect(sets[0].memberCardToken).toMatch(UUID_RE);
  });

  it("cada rotação gera um token diferente", async () => {
    const { db, sets } = fakeDb([[{ id: MEMBER_ID }], [{ id: MEMBER_ID }]]);
    await rotateMemberCardToken(db, MEMBER_ID);
    await rotateMemberCardToken(db, MEMBER_ID);
    expect(sets[0].memberCardToken).not.toBe(sets[1].memberCardToken);
  });

  it("sócio inexistente (nenhuma linha afetada) → false", async () => {
    const { db } = fakeDb([[]]);
    expect(await rotateMemberCardToken(db, MEMBER_ID)).toBe(false);
  });

  it("colisão de unique na 1ª tentativa → tenta de novo com outro valor", async () => {
    const { db, sets } = fakeDb([Object.assign(new Error("duplicate key"), { code: "23505" }), [{ id: MEMBER_ID }]]);
    expect(await rotateMemberCardToken(db, MEMBER_ID)).toBe(true);
    expect(sets).toHaveLength(2);
    expect(sets[0].memberCardToken).toMatch(UUID_RE);
    expect(sets[1].memberCardToken).toMatch(UUID_RE);
    expect(sets[1].memberCardToken).not.toBe(sets[0].memberCardToken);
  });

  it("colisão duas vezes seguidas → desiste e propaga o erro (não fica em loop)", async () => {
    const dup = () => Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
    const { db, sets } = fakeDb([dup(), dup(), dup()]);
    await expect(rotateMemberCardToken(db, MEMBER_ID)).rejects.toThrow("duplicate key");
    expect(sets).toHaveLength(2);
  });

  it("erro que não é colisão → propaga na hora, sem nova tentativa", async () => {
    const { db, sets } = fakeDb([new Error("conexão perdida")]);
    await expect(rotateMemberCardToken(db, MEMBER_ID)).rejects.toThrow("conexão perdida");
    expect(sets).toHaveLength(1);
  });
});
