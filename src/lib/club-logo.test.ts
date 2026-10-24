import { describe, it, expect } from "vitest";
import { isValidClubLogoConfigValue, safeClubLogoSrc } from "./club-logo";

const CLOUD = "misto-test";
const LOGO = `https://res.cloudinary.com/${CLOUD}/image/upload/v1/misto/misto/escudo.png`;

describe("isValidClubLogoConfigValue", () => {
  it("aceita vazio, upload do projeto e caminho do site", () => {
    expect(isValidClubLogoConfigValue("", CLOUD)).toBe(true);
    expect(isValidClubLogoConfigValue(LOGO, CLOUD)).toBe(true);
    expect(isValidClubLogoConfigValue("/escudo.png", CLOUD)).toBe(true);
  });

  it("recusa outro host, outro cloud, http, esquemas perigosos e aspas", () => {
    for (const bad of [
      "https://evil.example.com/escudo.png",
      `https://res.cloudinary.com/outro/image/upload/v1/x.png`,
      LOGO.replace("https:", "http:"),
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "//evil.example.com/x.png",
      '/x.png"',
      `${LOGO}"`,
    ]) {
      expect(isValidClubLogoConfigValue(bad, CLOUD)).toBe(false);
    }
  });

  it("sem cloud configurado só aceita vazio e caminho do site", () => {
    expect(isValidClubLogoConfigValue(LOGO, undefined)).toBe(false);
    expect(isValidClubLogoConfigValue("/escudo.png", undefined)).toBe(true);
  });
});

describe("safeClubLogoSrc", () => {
  it("devolve URL segura aparada", () => {
    expect(safeClubLogoSrc(` ${LOGO} `)).toBe(LOGO);
    expect(safeClubLogoSrc("/escudo.png")).toBe("/escudo.png");
  });

  it("zera o que quebraria o CSS montado em string", () => {
    for (const bad of ['/x.png");}body{color:red', "https://a.example.com/x\\.png", "javascript:alert(1)", null, 1]) {
      expect(safeClubLogoSrc(bad)).toBe("");
    }
  });
});
