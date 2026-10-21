import { describe, it, expect } from "vitest";
import {
  isMemberPhotoPublicIdFor,
  isMemberPhotoType,
  isRenderableMemberPhotoSrc,
  isValidCloudName,
  MEMBER_PHOTO_ACCEPT,
  MEMBER_PHOTO_MAX_BYTES,
  MEMBER_PHOTO_TRANSFORM,
  memberInitials,
  memberPhotoDeliveryUrl,
  memberPhotoFolder,
  safeMemberPhotoUrl,
  sniffMemberPhotoType,
} from "./member-photo";

const CLOUD = "misto-test";
const PUBLIC_ID = "clube-a/socios/fotos/abc123XYZ";
const URL_OK = `https://res.cloudinary.com/${CLOUD}/image/upload/${MEMBER_PHOTO_TRANSFORM}/${PUBLIC_ID}`;

/** Bytes de início de arquivo de cada formato (o resto é preenchimento). */
const bytes = (...head: number[]) => Uint8Array.from([...head, ...new Array(24).fill(0)]);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = bytes(...ascii("RIFF"), 0x10, 0, 0, 0, ...ascii("WEBP"));

describe("sniffMemberPhotoType (magic bytes, não o MIME do cliente)", () => {
  it("reconhece JPEG, PNG e WebP pela assinatura", () => {
    expect(sniffMemberPhotoType(JPEG)).toBe("image/jpeg");
    expect(sniffMemberPhotoType(PNG)).toBe("image/png");
    expect(sniffMemberPhotoType(WEBP)).toBe("image/webp");
  });

  it("recusa GIF, SVG, HTML, PDF e texto, mesmo com cara de imagem", () => {
    expect(sniffMemberPhotoType(bytes(...ascii("GIF89a")))).toBeNull();
    expect(sniffMemberPhotoType(bytes(...ascii("<svg xmlns=")))).toBeNull();
    expect(sniffMemberPhotoType(bytes(...ascii("<html><script>")))).toBeNull();
    expect(sniffMemberPhotoType(bytes(...ascii("%PDF-1.7")))).toBeNull();
    expect(sniffMemberPhotoType(bytes(...ascii("hello world")))).toBeNull();
  });

  it("recusa RIFF que não é WebP (ex.: WAV) e arquivo truncado", () => {
    expect(sniffMemberPhotoType(bytes(...ascii("RIFF"), 0x10, 0, 0, 0, ...ascii("WAVE")))).toBeNull();
    expect(sniffMemberPhotoType(Uint8Array.from([0xff, 0xd8]))).toBeNull();
    expect(sniffMemberPhotoType(new Uint8Array(0))).toBeNull();
  });

  it("MIME aceito: só a allowlist (sem GIF e sem SVG)", () => {
    expect(isMemberPhotoType("image/jpeg")).toBe(true);
    expect(isMemberPhotoType("image/png")).toBe(true);
    expect(isMemberPhotoType("image/webp")).toBe(true);
    expect(isMemberPhotoType("image/gif")).toBe(false);
    expect(isMemberPhotoType("image/svg+xml")).toBe(false);
    expect(isMemberPhotoType("")).toBe(false);
    expect(MEMBER_PHOTO_ACCEPT).toBe("image/jpeg,image/png,image/webp");
    expect(MEMBER_PHOTO_MAX_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe("memberPhotoFolder e public_id do clube", () => {
  it("monta <clube>/socios/fotos com slug saneado", () => {
    expect(memberPhotoFolder("misto-clube")).toBe("misto-clube/socios/fotos");
    expect(memberPhotoFolder("Misto Clube")).toBe("mistoclube/socios/fotos");
  });

  it("nunca gera pasta com barra, ponto ou vazia", () => {
    expect(memberPhotoFolder("../../etc")).toBe("etc/socios/fotos");
    expect(memberPhotoFolder("")).toBeNull();
    expect(memberPhotoFolder("!!!")).toBeNull();
    expect(memberPhotoFolder(null)).toBeNull();
    expect(memberPhotoFolder("a".repeat(41))).toBeNull();
  });

  it("aceita public_id só da pasta de fotos de sócio DESTE clube", () => {
    expect(isMemberPhotoPublicIdFor(PUBLIC_ID, "clube-a")).toBe(true);
    expect(isMemberPhotoPublicIdFor(PUBLIC_ID, "clube-b")).toBe(false);
    expect(isMemberPhotoPublicIdFor("clube-a/socios/fotos/../../misto/x", "clube-a")).toBe(false);
    expect(isMemberPhotoPublicIdFor("clube-a/outra-pasta/abc", "clube-a")).toBe(false);
    expect(isMemberPhotoPublicIdFor(null, "clube-a")).toBe(false);
    expect(isMemberPhotoPublicIdFor(PUBLIC_ID, null)).toBe(false);
  });
});

describe("URL de entrega e validação ao exibir", () => {
  it("valida o nome do cloud", () => {
    expect(isValidCloudName(CLOUD)).toBe(true);
    expect(isValidCloudName("a b")).toBe(false);
    expect(isValidCloudName("")).toBe(false);
    expect(isValidCloudName(undefined)).toBe(false);
  });

  it("monta a URL de entrega do projeto (transformação fixa, https do Cloudinary)", () => {
    expect(memberPhotoDeliveryUrl(CLOUD, PUBLIC_ID)).toBe(URL_OK);
    expect(() => memberPhotoDeliveryUrl(CLOUD, "../../x")).toThrow();
    expect(() => memberPhotoDeliveryUrl("cloud bad", PUBLIC_ID)).toThrow();
  });

  it("aceita a URL de entrega gerada (ida e volta)", () => {
    expect(safeMemberPhotoUrl(URL_OK, CLOUD)).toBe(URL_OK);
    expect(safeMemberPhotoUrl(memberPhotoDeliveryUrl(CLOUD, PUBLIC_ID), CLOUD)).toBe(URL_OK);
  });

  it("recusa http, outro host, outro cloud, outra transformação e URL de upload crua", () => {
    const path = `${CLOUD}/image/upload/${MEMBER_PHOTO_TRANSFORM}/${PUBLIC_ID}`;
    const refused = [
      `http://res.cloudinary.com/${path}`,
      `https://evil.test/${path}`,
      `https://res.cloudinary.com.evil.test/${path}`,
      `https://outro-cloud/${path}`.replace("https://outro-cloud", "https://res.cloudinary.com/outro-cloud"),
      `https://res.cloudinary.com/${CLOUD}/image/upload/w_9999/${PUBLIC_ID}`,
      `https://res.cloudinary.com/${CLOUD}/image/upload/${PUBLIC_ID}`,
      `javascript:alert(1)`,
      `data:image/png;base64,AAAA`,
    ];
    for (const url of refused) {
      expect(safeMemberPhotoUrl(url, CLOUD), url).toBeNull();
    }
  });

  it("recusa credenciais, porta, query, fragmento, barra invertida, traversal e espaço", () => {
    const refused = [
      URL_OK.replace("https://", "https://user:pass@"),
      URL_OK.replace("res.cloudinary.com", "res.cloudinary.com:8443"),
      `${URL_OK}?x=1`,
      `${URL_OK}#x`,
      URL_OK.replace("/socios/fotos/", "/socios/fotos/../../"),
      URL_OK.replace("https://res.cloudinary.com", "https:\\\\res.cloudinary.com"),
      ` ${URL_OK}`,
      `${URL_OK}"onerror="x`,
      URL_OK.replace("abc123XYZ", "abc 123"),
    ];
    for (const url of refused) {
      expect(safeMemberPhotoUrl(url, CLOUD), url).toBeNull();
    }
  });

  it("sem cloud válido ou com valor que não é texto: null (fail closed)", () => {
    expect(safeMemberPhotoUrl(URL_OK, null)).toBeNull();
    expect(safeMemberPhotoUrl(URL_OK, "")).toBeNull();
    expect(safeMemberPhotoUrl(null, CLOUD)).toBeNull();
    expect(safeMemberPhotoUrl(42, CLOUD)).toBeNull();
    expect(safeMemberPhotoUrl(`${URL_OK}${"a".repeat(600)}`, CLOUD)).toBeNull();
  });

  it("isRenderableMemberPhotoSrc só deixa passar a entrega de foto de sócio", () => {
    expect(isRenderableMemberPhotoSrc(URL_OK)).toBe(true);
    expect(isRenderableMemberPhotoSrc(`https://res.cloudinary.com/${CLOUD}/image/upload/c_fill/${PUBLIC_ID}`)).toBe(false);
    expect(isRenderableMemberPhotoSrc("https://evil.test/foto.png")).toBe(false);
    expect(isRenderableMemberPhotoSrc("/foto.png")).toBe(false);
    expect(isRenderableMemberPhotoSrc(null)).toBe(false);
  });
});

describe("memberInitials", () => {
  it("usa a inicial do primeiro e do último nome", () => {
    expect(memberInitials("Maria S.")).toBe("MS");
    expect(memberInitials("José da Silva")).toBe("JS");
    expect(memberInitials("  ana  ")).toBe("A");
    expect(memberInitials("élcio")).toBe("É");
  });

  it("sem nome utilizável: '?'", () => {
    expect(memberInitials("   ")).toBe("?");
    expect(memberInitials("")).toBe("?");
  });
});
