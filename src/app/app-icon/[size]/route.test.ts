import { describe, it, expect, vi, beforeEach } from "vitest";

const { ImageResponse, rateLimit, getSiteConfig, getClientIp } = vi.hoisted(() => ({
  ImageResponse: vi.fn(function ImageResponseMock(_el: unknown, opts?: { headers?: Record<string, string> }) {
    return new Response("png", {
      status: 200,
      headers: { "content-type": "image/png", ...(opts?.headers ?? {}) },
    });
  }),
  rateLimit: vi.fn(),
  getSiteConfig: vi.fn(),
  getClientIp: vi.fn(),
}));

vi.mock("next/og", () => ({ ImageResponse }));
vi.mock("@/lib/config", () => ({ getSiteConfig: () => getSiteConfig() }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a), getClientIp: () => getClientIp() }));

import { GET } from "./route";

function call(size: string) {
  return GET(new Request(`https://clube.example/app-icon/${size}`), {
    params: Promise.resolve({ size }),
  });
}

describe("rota /app-icon/[size]", () => {
  beforeEach(() => {
    ImageResponse.mockClear();
    rateLimit.mockReset();
    rateLimit.mockResolvedValue({ ok: true, remaining: 100 });
    getClientIp.mockReset();
    getClientIp.mockResolvedValue("203.0.113.7");
    getSiteConfig.mockReset();
    getSiteConfig.mockResolvedValue({ siteName: "Misto Esporte Clube", primaryColor: "#1e3a8a" });
  });

  it("recusa tamanho fora da lista com 404, sem gerar imagem nem gastar rate limit", async () => {
    for (const bad of ["1024", "64", "512.png", "../config", "constructor", "192x192"]) {
      const res = await call(bad);
      expect(res.status).toBe(404);
    }
    expect(ImageResponse).not.toHaveBeenCalled();
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it.each([
    ["192", 192],
    ["512", 512],
    ["maskable-512", 512],
    ["180", 180],
  ])("gera PNG de %s com lado %i", async (size, px) => {
    const res = await call(size);
    expect(res.status).toBe(200);
    expect(ImageResponse).toHaveBeenCalledTimes(1);
    const opts = ImageResponse.mock.calls[0][1] as { width: number; height: number; headers: Record<string, string> };
    expect(opts.width).toBe(px);
    expect(opts.height).toBe(px);
    expect(opts.headers["Cache-Control"]).toBe("public, max-age=3600");
  });

  it("desenha as iniciais do clube sobre a cor primária, com texto de contraste", async () => {
    await call("maskable-512");
    const el = ImageResponse.mock.calls[0][0] as { props: { children: string; style: Record<string, unknown> } };
    expect(el.props.children).toBe("ME");
    expect(el.props.style.background).toBe("#1e3a8a");
    expect(el.props.style.color).toBe("#ffffff");
  });

  it("sem config válida, usa a inicial padrão e a cor padrão", async () => {
    getSiteConfig.mockRejectedValue(new Error("db down"));
    const res = await call("192");
    expect(res.status).toBe(200);
    const el = ImageResponse.mock.calls[0][0] as { props: { children: string; style: Record<string, unknown> } };
    expect(el.props.children).toBe("C");
    expect(el.props.style.background).toBe("#0a0a0a");
  });

  it("aplica rate limit por IP e recusa com 429 quando estourado", async () => {
    rateLimit.mockResolvedValue({ ok: false, remaining: 0 });
    const res = await call("192");
    expect(res.status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith("rl:app-icon:203.0.113.7", 120, 60);
    expect(ImageResponse).not.toHaveBeenCalled();
  });
});
