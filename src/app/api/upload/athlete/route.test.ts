import { describe, it, expect, beforeEach, vi } from "vitest";

/** Upload anônimo de foto de atleta: limite por IP antes de ler o corpo / subir ao Cloudinary. */
const h = vi.hoisted(() => ({ limited: false, uploads: 0, keys: [] as string[] }));

vi.mock("@/lib/ratelimit", () => ({
  getClientIp: async () => "203.0.113.9",
  rateLimit: async (key: string) => {
    h.keys.push(key);
    return { ok: !h.limited, remaining: 0 };
  },
}));
vi.mock("cloudinary", () => ({
  v2: {
    config: () => {},
    uploader: {
      upload: async () => {
        h.uploads++;
        return { secure_url: "https://res.cloudinary.com/x/image/upload/v1/a.png" };
      },
    },
  },
}));

import { POST } from "./route";

function req() {
  const fd = new FormData();
  fd.append("file", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], "a.png", { type: "image/png" }));
  return new Request("https://clube.example/api/upload/athlete", { method: "POST", body: fd });
}

beforeEach(() => {
  h.limited = false;
  h.uploads = 0;
  h.keys = [];
});

describe("POST /api/upload/athlete", () => {
  it("dentro do limite → sobe", async () => {
    expect((await POST(req())).status).toBe(200);
    expect(h.uploads).toBe(1);
    expect(h.keys).toEqual(["rl:upload-athlete:ip:203.0.113.9"]);
  });

  it("limite estourado → 429, nada sobe", async () => {
    h.limited = true;
    expect((await POST(req())).status).toBe(429);
    expect(h.uploads).toBe(0);
  });
});
