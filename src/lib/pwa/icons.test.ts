import { describe, it, expect } from "vitest";
import {
  APP_ICON_KINDS,
  appIconForeground,
  appIconInitials,
  appTheme,
  buildAppIconUrls,
  cloudinaryUploadRef,
  DEFAULT_APP_COLOR,
  normalizeHexColor,
  parseAppIconKind,
} from "./icons";

const CLOUD = "misto-test";
const LOGO = `https://res.cloudinary.com/${CLOUD}/image/upload/v123/misto/logo.png`;

describe("normalizeHexColor", () => {
  it("aceita #rgb e #rrggbb e normaliza para minúsculas com 6 dígitos", () => {
    expect(normalizeHexColor("#FFF")).toBe("#ffffff");
    expect(normalizeHexColor("#1E3A8A")).toBe("#1e3a8a");
    expect(normalizeHexColor("  #0a0a0a  ")).toBe("#0a0a0a");
  });

  it("recusa qualquer coisa que não seja hex (hsl, nomes, injeção, tamanho errado)", () => {
    expect(normalizeHexColor("hsl(210 50% 30%)")).toBeNull();
    expect(normalizeHexColor("red")).toBeNull();
    expect(normalizeHexColor("#12345")).toBeNull();
    expect(normalizeHexColor("#gggggg")).toBeNull();
    expect(normalizeHexColor("#fff,e_blur:300")).toBeNull();
    expect(normalizeHexColor("#fff;background:url(x)")).toBeNull();
    expect(normalizeHexColor(undefined)).toBeNull();
    expect(normalizeHexColor(123)).toBeNull();
  });
});

describe("parseAppIconKind (lista fechada de tamanhos)", () => {
  it("aceita só os tamanhos da lista", () => {
    for (const kind of APP_ICON_KINDS) expect(parseAppIconKind(kind)).toBe(kind);
  });

  it("recusa tamanhos fora da lista, caminhos e variações", () => {
    for (const bad of ["1024", "64", "192x192", "512.png", "MASKABLE-512", " 512", "../512", "192?x=1", "", "constructor"]) {
      expect(parseAppIconKind(bad)).toBeNull();
    }
    expect(parseAppIconKind(undefined)).toBeNull();
    expect(parseAppIconKind(512)).toBeNull();
  });
});

describe("cloudinaryUploadRef (só upload do próprio projeto)", () => {
  it("aceita upload do projeto e devolve o caminho após /image/upload/", () => {
    expect(cloudinaryUploadRef(LOGO, CLOUD)).toEqual({ cloudName: CLOUD, path: "v123/misto/logo.png" });
  });

  it("descarta query e fragmento", () => {
    expect(cloudinaryUploadRef(`${LOGO}?x=1#y`, CLOUD)?.path).toBe("v123/misto/logo.png");
  });

  it("recusa outro host, outra cloud, http, credenciais, porta e subdomínio falso", () => {
    expect(cloudinaryUploadRef("https://evil.example.com/x.png", CLOUD)).toBeNull();
    expect(cloudinaryUploadRef(`https://res.cloudinary.com/outra-cloud/image/upload/x.png`, CLOUD)).toBeNull();
    expect(cloudinaryUploadRef(LOGO.replace("https://", "http://"), CLOUD)).toBeNull();
    expect(cloudinaryUploadRef(LOGO.replace("https://", "https://user:pw@"), CLOUD)).toBeNull();
    expect(cloudinaryUploadRef(LOGO.replace("res.cloudinary.com", "res.cloudinary.com:8443"), CLOUD)).toBeNull();
    expect(cloudinaryUploadRef(`https://res.cloudinary.com.evil.example/${CLOUD}/image/upload/x.png`, CLOUD)).toBeNull();
  });

  it("recusa caminho com ponto-ponto, vazio, vírgula (transformação injetada) e não-imagem de upload", () => {
    expect(cloudinaryUploadRef(`https://res.cloudinary.com/${CLOUD}/image/upload/../x.png`, CLOUD)).toBeNull();
    expect(cloudinaryUploadRef(`https://res.cloudinary.com/${CLOUD}/image/upload/a//b.png`, CLOUD)).toBeNull();
    expect(cloudinaryUploadRef(`https://res.cloudinary.com/${CLOUD}/image/upload/w_9999,c_fill/x.png`, CLOUD)).toBeNull();
    expect(cloudinaryUploadRef(`https://res.cloudinary.com/${CLOUD}/image/fetch/https://evil.example/x.png`, CLOUD)).toBeNull();
    expect(cloudinaryUploadRef(`https://res.cloudinary.com/${CLOUD}/image/upload/%2e%2e/x.png`, CLOUD)).toBeNull();
  });

  it("sem nome de cloud válido, nada é aceito (fail closed)", () => {
    expect(cloudinaryUploadRef(LOGO, null)).toBeNull();
    expect(cloudinaryUploadRef(LOGO, "")).toBeNull();
    expect(cloudinaryUploadRef(LOGO, "bad cloud!")).toBeNull();
  });
});

describe("buildAppIconUrls com logo do Cloudinary", () => {
  it("any 192 e 512: logo com 80% do lado, fundo transparente, PNG", () => {
    const urls = buildAppIconUrls({ clubLogoUrl: LOGO, primaryColor: "#1e3a8a" }, CLOUD);
    expect(urls.any192).toBe(
      `https://res.cloudinary.com/${CLOUD}/image/upload/c_fit,w_154,h_154/c_pad,w_192,h_192,f_png/v123/misto/logo.png`,
    );
    expect(urls.any512).toBe(
      `https://res.cloudinary.com/${CLOUD}/image/upload/c_fit,w_410,h_410/c_pad,w_512,h_512,f_png/v123/misto/logo.png`,
    );
    expect(urls.any192).not.toContain("b_rgb");
  });

  it("maskable 512: logo com 62% do lado e fundo sólido na cor do tema", () => {
    const urls = buildAppIconUrls({ clubLogoUrl: LOGO, primaryColor: "#1E3A8A" }, CLOUD);
    expect(urls.maskable512).toBe(
      `https://res.cloudinary.com/${CLOUD}/image/upload/c_fit,w_317,h_317/c_pad,w_512,h_512,b_rgb:1e3a8a,f_png/v123/misto/logo.png`,
    );
  });

  it("apple 180 tem fundo sólido (iOS não recorta transparência)", () => {
    const urls = buildAppIconUrls({ clubLogoUrl: LOGO, primaryColor: "#112233" }, CLOUD);
    expect(urls.apple180).toBe(
      `https://res.cloudinary.com/${CLOUD}/image/upload/c_fit,w_144,h_144/c_pad,w_180,h_180,b_rgb:112233,f_png/v123/misto/logo.png`,
    );
  });

  it("cor de tema inválida cai no padrão; nenhuma parte da cor injetada entra na URL", () => {
    const urls = buildAppIconUrls({ clubLogoUrl: LOGO, primaryColor: "#fff,e_blur:300" }, CLOUD);
    expect(urls.maskable512).toContain(`b_rgb:${DEFAULT_APP_COLOR.slice(1)}`);
    expect(urls.maskable512).not.toContain("e_blur");
    expect(urls.maskable512).not.toContain("fff");
  });

  it("usa o favicon do Cloudinary quando o logo não serve", () => {
    const favicon = `https://res.cloudinary.com/${CLOUD}/image/upload/v9/misto/fav.png`;
    const urls = buildAppIconUrls({ clubLogoUrl: "https://evil.example/logo.png", faviconUrl: favicon }, CLOUD);
    expect(urls.any192).toContain("/image/upload/c_fit,w_154,h_154/c_pad,w_192,h_192,f_png/v9/misto/fav.png");
  });
});

describe("buildAppIconUrls sem logo válido (fallback de iniciais)", () => {
  it("URL de outro host NÃO é usada: todos os ícones apontam para a rota gerada", () => {
    const urls = buildAppIconUrls({ clubLogoUrl: "https://evil.example.com/logo.png" }, CLOUD);
    expect(urls).toEqual({
      any192: "/app-icon/192",
      any512: "/app-icon/512",
      maskable512: "/app-icon/maskable-512",
      apple180: "/app-icon/180",
    });
    expect(JSON.stringify(urls)).not.toContain("evil.example");
  });

  it("sem config nenhuma, a rota gerada ainda é declarada", () => {
    expect(buildAppIconUrls(null, undefined).any192).toBe("/app-icon/192");
  });

  it("sem cloud configurada, logo do Cloudinary também não é usado", () => {
    expect(buildAppIconUrls({ clubLogoUrl: LOGO }, null).any512).toBe("/app-icon/512");
  });
});

describe("appTheme", () => {
  it("usa hex validado; cor não-hex (ex.: hsl) cai no padrão", () => {
    expect(appTheme({ primaryColor: "#2563EB", backgroundColor: "#FFF" })).toEqual({
      theme: "#2563eb",
      background: "#ffffff",
    });
    expect(appTheme({ primaryColor: "hsl(210 50% 30%)", backgroundColor: "" })).toEqual({
      theme: DEFAULT_APP_COLOR,
      background: DEFAULT_APP_COLOR,
    });
  });
});

describe("appIconInitials", () => {
  it("usa as iniciais das duas primeiras palavras relevantes", () => {
    expect(appIconInitials("Misto Esporte Clube")).toBe("ME");
    expect(appIconInitials("Clube de Regatas do Flamengo")).toBe("CR");
    expect(appIconInitials("Três Lagoas")).toBe("TL");
    expect(appIconInitials("misto - ec")).toBe("ME");
  });

  it("só letras e dígitos ASCII maiúsculos; nunca HTML ou caractere estranho", () => {
    const out = appIconInitials('<img src=x onerror=alert(1)> "Ação"');
    expect(out).toMatch(/^[A-Z0-9]{1,2}$/);
  });

  it("vazio ou sem letras vira C", () => {
    expect(appIconInitials("")).toBe("C");
    expect(appIconInitials(null)).toBe("C");
    expect(appIconInitials("!!! ???")).toBe("C");
  });
});

describe("appIconForeground", () => {
  it("texto claro sobre fundo escuro e escuro sobre fundo claro", () => {
    expect(appIconForeground("#0a0a0a")).toBe("#ffffff");
    expect(appIconForeground("#ffff00")).toBe("#000000");
  });
});
