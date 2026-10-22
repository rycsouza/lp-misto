import { describe, it, expect } from "vitest";
import {
  isMemberLogoPublicIdFor,
  isRenderableMemberLogoSrc,
  MEMBER_LOGO_TRANSFORM,
  MEMBER_LOGO_UPLOAD_FORMAT,
  MEMBER_LOGO_UPLOAD_TRANSFORM_PARAMS,
  memberLogoDeliveryUrl,
  memberLogoFolder,
  safeMemberLogoUrl,
  sniffMemberLogoType,
} from "./member-logo";
import { isRenderableMemberPhotoSrc, safeMemberPhotoUrl } from "./member-photo";

const CLOUD = "misto-test";
const LOGO = `https://res.cloudinary.com/${CLOUD}/image/upload/${MEMBER_LOGO_TRANSFORM}/clube-a/socios/logos/abc123`;
const PHOTO = `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,g_face,w_512,h_512,q_auto,f_auto/clube-a/socios/fotos/abc123`;

describe("pasta e public_id do logo", () => {
  it("pasta do clube é <slug>/socios/logos, saneada; sem slug válido vira null", () => {
    expect(memberLogoFolder("clube-a")).toBe("clube-a/socios/logos");
    expect(memberLogoFolder("Clube A!")).toBe("clubea/socios/logos");
    expect(memberLogoFolder("")).toBeNull();
    expect(memberLogoFolder(null)).toBeNull();
    expect(memberLogoFolder("!!!")).toBeNull();
  });

  it("só apaga public_id de logo do PRÓPRIO clube (nunca de foto nem de outro clube)", () => {
    expect(isMemberLogoPublicIdFor("clube-a/socios/logos/abc123", "clube-a")).toBe(true);
    expect(isMemberLogoPublicIdFor("clube-b/socios/logos/abc123", "clube-a")).toBe(false);
    expect(isMemberLogoPublicIdFor("clube-a/socios/fotos/abc123", "clube-a")).toBe(false);
    expect(isMemberLogoPublicIdFor("clube-a/socios/logos/../../x", "clube-a")).toBe(false);
    expect(isMemberLogoPublicIdFor(null, "clube-a")).toBe(false);
  });

  it("parâmetros de upload: encaixe sem recorte, fundo transparente, PNG (nunca string)", () => {
    expect(MEMBER_LOGO_UPLOAD_TRANSFORM_PARAMS).toEqual([
      { crop: "pad", width: 512, height: 512, background: "transparent" },
    ]);
    expect(MEMBER_LOGO_UPLOAD_FORMAT).toBe("png");
    expect(MEMBER_LOGO_TRANSFORM).not.toMatch(/g_face|c_fill/);
  });
});

describe("sniff do logo (magic bytes)", () => {
  it("aceita JPEG, PNG e WebP pela assinatura; recusa SVG, GIF e HTML", () => {
    expect(sniffMemberLogoType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMemberLogoType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    const webp = new Uint8Array([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBP")]);
    expect(sniffMemberLogoType(webp)).toBe("image/webp");
    expect(sniffMemberLogoType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBeNull();
    expect(sniffMemberLogoType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(sniffMemberLogoType(new TextEncoder().encode("<html>"))).toBeNull();
  });
});

describe("URL de entrega do logo", () => {
  it("monta a URL com a transformação de logo e o public_id da pasta de logos", () => {
    expect(memberLogoDeliveryUrl(CLOUD, "clube-a/socios/logos/abc123")).toBe(LOGO);
  });

  it("recusa cloud ou public_id fora do formato (lança)", () => {
    expect(() => memberLogoDeliveryUrl("cloud com espaço", "clube-a/socios/logos/abc123")).toThrow();
    expect(() => memberLogoDeliveryUrl(CLOUD, "clube-a/socios/fotos/abc123")).toThrow();
    expect(() => memberLogoDeliveryUrl(CLOUD, "../x")).toThrow();
  });
});

describe("safeMemberLogoUrl — só o logo de entrega do PROJETO", () => {
  it("aceita a URL de logo do cloud do projeto", () => {
    expect(safeMemberLogoUrl(LOGO, CLOUD)).toBe(LOGO);
  });

  it("recusa a URL de FOTO de sócio (transformação e pasta diferentes)", () => {
    expect(safeMemberLogoUrl(PHOTO, CLOUD)).toBeNull();
  });

  it("recusa outro cloud, outro host, http, credenciais, porta, query e fragmento", () => {
    const casos = [
      LOGO.replace(CLOUD, "outro-cloud"),
      LOGO.replace("https://res.cloudinary.com", "https://evil.test"),
      LOGO.replace("https://", "http://"),
      LOGO.replace("https://", "https://user:senha@"),
      LOGO.replace("res.cloudinary.com", "res.cloudinary.com:8443"),
      `${LOGO}?x=1`,
      `${LOGO}#frag`,
      LOGO.replace("/socios/logos/", "/socios/fotos/"),
      LOGO.replace(MEMBER_LOGO_TRANSFORM, "c_fill,g_face,w_512,h_512,q_auto,f_auto"),
      "javascript:alert(1)",
      `${LOGO} "onerror=x`,
    ];
    for (const c of casos) expect(safeMemberLogoUrl(c, CLOUD), c).toBeNull();
  });

  it("sem cloud válido, ou valor que não é texto, ou URL longa demais: null", () => {
    expect(safeMemberLogoUrl(LOGO, null)).toBeNull();
    expect(safeMemberLogoUrl(LOGO, "")).toBeNull();
    expect(safeMemberLogoUrl(42, CLOUD)).toBeNull();
    expect(safeMemberLogoUrl(`${LOGO}${"a".repeat(600)}`, CLOUD)).toBeNull();
  });
});

describe("isRenderableMemberLogoSrc — checagem final antes de <img src>", () => {
  it("aceita só a forma da URL de entrega de logo de sócio", () => {
    expect(isRenderableMemberLogoSrc(LOGO)).toBe(true);
    expect(isRenderableMemberLogoSrc(PHOTO)).toBe(false);
    expect(isRenderableMemberLogoSrc("/logo.png")).toBe(false);
    expect(isRenderableMemberLogoSrc(null)).toBe(false);
    expect(isRenderableMemberLogoSrc(LOGO.replace("res.cloudinary.com", "evil.test"))).toBe(false);
  });

  it("logo e foto não se confundem: cada validador recusa o outro", () => {
    expect(isRenderableMemberPhotoSrc(LOGO)).toBe(false);
    expect(safeMemberPhotoUrl(LOGO, CLOUD)).toBeNull();
    expect(safeMemberLogoUrl(PHOTO, CLOUD)).toBeNull();
  });
});
