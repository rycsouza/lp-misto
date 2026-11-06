import { describe, it, expect } from "vitest";
import {
  isPixAutomaticEnabledValue,
  isValidPixAutomaticAuthorizationId,
  isValidPixAutomaticConfigValue,
  PIX_AUTOMATIC_ENABLED_KEY,
  pixAutomaticAvailable,
} from "./pix-automatic-config";
import { configKeyAccess } from "@/lib/admin/config-keys";

describe("Pix Automático: configuração", () => {
  it("só 'true' (ou true) liga", () => {
    expect(isPixAutomaticEnabledValue("true")).toBe(true);
    expect(isPixAutomaticEnabledValue(true)).toBe(true);
    for (const v of ["false", "1", "TRUE", "", null, undefined]) expect(isPixAutomaticEnabledValue(v)).toBe(false);
  });

  it("disponível só com gateway Asaas e a chave ligada", () => {
    expect(pixAutomaticAvailable("asaas", "true")).toBe(true);
    expect(pixAutomaticAvailable("asaas-sandbox", true)).toBe(true);
    expect(pixAutomaticAvailable("asaas", "false")).toBe(false);
    expect(pixAutomaticAvailable("mercadopago", "true")).toBe(false);
    expect(pixAutomaticAvailable("mock", "true")).toBe(false);
    expect(pixAutomaticAvailable(null, "true")).toBe(false);
  });

  it("a chave é só do admin do sistema e aceita só true/false", () => {
    expect(configKeyAccess(PIX_AUTOMATIC_ENABLED_KEY)).toBe("platform");
    expect(isValidPixAutomaticConfigValue(PIX_AUTOMATIC_ENABLED_KEY, "true")).toBe(true);
    expect(isValidPixAutomaticConfigValue(PIX_AUTOMATIC_ENABLED_KEY, "false")).toBe(true);
    expect(isValidPixAutomaticConfigValue(PIX_AUTOMATIC_ENABLED_KEY, "sim")).toBe(false);
    expect(isValidPixAutomaticConfigValue("siteName", "qualquer")).toBe(true);
  });

  it("id de autorização: só caracteres seguros para a URL do gateway", () => {
    expect(isValidPixAutomaticAuthorizationId("auth_1-ABC")).toBe(true);
    for (const bad of ["", "../x", "a/b", "a b", "x".repeat(101), 1, null]) {
      expect(isValidPixAutomaticAuthorizationId(bad)).toBe(false);
    }
  });
});
