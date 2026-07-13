import { describe, it, expect, afterEach } from "vitest";
import { toBrazilPhone, isZapiConfigured } from "./zapi";

describe("toBrazilPhone", () => {
  it("adiciona 55 a um celular de 11 dígitos", () => {
    expect(toBrazilPhone("(67) 99999-0000")).toBe("5567999990000");
  });
  it("adiciona 55 a um número de 10 dígitos", () => {
    expect(toBrazilPhone("6733330000")).toBe("556733330000");
  });
  it("mantém um número que já vem com 55", () => {
    expect(toBrazilPhone("5567999990000")).toBe("5567999990000");
  });
  it("retorna null para entrada curta demais", () => {
    expect(toBrazilPhone("123")).toBeNull();
  });
  it("retorna null para lixo sem dígitos suficientes", () => {
    expect(toBrazilPhone("abc")).toBeNull();
  });
});

describe("isZapiConfigured", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("false quando as env vars faltam", () => {
    delete process.env.ZAPI_INSTANCE_ID;
    delete process.env.ZAPI_TOKEN;
    expect(isZapiConfigured()).toBe(false);
  });
  it("true quando instance e token estão presentes", () => {
    process.env.ZAPI_INSTANCE_ID = "inst";
    process.env.ZAPI_TOKEN = "tok";
    expect(isZapiConfigured()).toBe(true);
  });
});
