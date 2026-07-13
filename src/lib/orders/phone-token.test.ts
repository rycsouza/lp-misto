import { describe, it, expect, beforeEach } from "vitest";
import { signPhoneToken, verifyPhoneToken } from "./phone-token";

const SECRET = "test-secret-do-not-use-in-prod";

describe("phone-token", () => {
  beforeEach(() => {
    process.env.TICKET_SIGNING_SECRET = SECRET;
  });

  it("faz round-trip do número de telefone", async () => {
    const token = await signPhoneToken("5567999990000");
    expect(token).toBeTruthy();
    expect(await verifyPhoneToken(token!)).toBe("5567999990000");
  });

  it("remove não-dígitos ao assinar", async () => {
    const token = await signPhoneToken("(67) 99999-0000");
    expect(await verifyPhoneToken(token!)).toBe("67999990000");
  });

  it("retorna null para telefone com menos de 10 dígitos", async () => {
    expect(await signPhoneToken("12345")).toBeNull();
  });

  it("rejeita token malformado", async () => {
    expect(await verifyPhoneToken("nao-e-um-jwt")).toBeNull();
  });

  it("rejeita token assinado com outra chave (não forjável)", async () => {
    const token = await signPhoneToken("5567999990000");
    expect(token).toBeTruthy();
    process.env.TICKET_SIGNING_SECRET = "chave-diferente-do-atacante";
    expect(await verifyPhoneToken(token!)).toBeNull();
  });

  it("sem TICKET_SIGNING_SECRET, assinar e verificar retornam null (fail-closed)", async () => {
    delete process.env.TICKET_SIGNING_SECRET;
    expect(await signPhoneToken("5567999990000")).toBeNull();
    expect(await verifyPhoneToken("qualquer-coisa")).toBeNull();
  });
});
