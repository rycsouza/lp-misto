import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getSiteConfig = vi.fn();
vi.mock("@/lib/config", () => ({ getSiteConfig: () => getSiteConfig() }));

import manifest from "./manifest";

const CLOUD = "misto-test";
const LOGO = `https://res.cloudinary.com/${CLOUD}/image/upload/v123/misto/logo.png`;
const HEX_RE = /^#[0-9a-f]{6}$/;

async function build(config: Record<string, unknown> | null) {
  getSiteConfig.mockResolvedValue(config);
  return manifest();
}

describe("manifest PWA por clube", () => {
  beforeEach(() => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", CLOUD);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    getSiteConfig.mockReset();
  });

  it("declara 192 e 512 PNG com purpose any, e um maskable 512 separado", async () => {
    const m = await build({ siteName: "Misto", clubLogoUrl: LOGO, primaryColor: "#1e3a8a" });
    const icons = m.icons ?? [];
    expect(icons).toHaveLength(3);
    expect(icons.every((i) => i.type === "image/png")).toBe(true);
    expect(icons.find((i) => i.purpose === "any" && i.sizes === "192x192")).toBeDefined();
    expect(icons.find((i) => i.purpose === "any" && i.sizes === "512x512")).toBeDefined();
    const maskable = icons.find((i) => i.purpose === "maskable");
    expect(maskable?.sizes).toBe("512x512");
    expect(maskable?.src).toContain("b_rgb:1e3a8a");
  });

  it("ícones do Cloudinary do projeto usam transformações; sem logo, rota gerada", async () => {
    const withLogo = await build({ siteName: "Misto", clubLogoUrl: LOGO });
    expect(withLogo.icons?.[0].src).toContain(`res.cloudinary.com/${CLOUD}/image/upload/c_fit`);

    const without = await build({ siteName: "Misto", clubLogoUrl: "https://evil.example.com/x.png" });
    expect(without.icons?.map((i) => i.src)).toEqual(["/app-icon/192", "/app-icon/512", "/app-icon/maskable-512"]);
    expect(JSON.stringify(without)).not.toContain("evil.example");
  });

  it("id, display standalone, start_url e categoria esportes", async () => {
    const m = await build({ siteName: "Misto" });
    expect(m.id).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.categories).toEqual(["sports"]);
    expect(m.lang).toBe("pt-BR");
  });

  it("shortcuts: Minha conta, Carteirinha (aba sócio) e Ingressos, todos caminhos internos", async () => {
    const m = await build({ siteName: "Misto" });
    const urls = (m.shortcuts ?? []).map((s) => s.url);
    expect(urls).toEqual(["/conta", "/conta?aba=socio", "/ingresso"]);
    for (const s of m.shortcuts ?? []) {
      expect(s.url.startsWith("/")).toBe(true);
      expect(s.url.startsWith("//")).toBe(false);
      expect(s.name.length).toBeGreaterThan(0);
    }
  });

  it("não declara screenshots (sem fonte confiável)", async () => {
    const m = await build({ siteName: "Misto" });
    expect("screenshots" in m).toBe(false);
  });

  it("theme_color e background_color são sempre hex válido, mesmo com config inválida", async () => {
    const m = await build({
      siteName: "Misto",
      primaryColor: "hsl(210 50% 30%)",
      backgroundColor: "red; background:url(x)",
    });
    expect(m.theme_color).toMatch(HEX_RE);
    expect(m.background_color).toMatch(HEX_RE);
    expect(m.theme_color).toBe("#0a0a0a");
  });

  it("sem config (falha ao ler), ainda gera manifest com ícones e nome padrão", async () => {
    getSiteConfig.mockRejectedValue(new Error("db down"));
    const m = await manifest();
    expect(m.name).toBe("Clube");
    expect(m.icons).toHaveLength(3);
    expect(m.theme_color).toMatch(HEX_RE);
  });
});
