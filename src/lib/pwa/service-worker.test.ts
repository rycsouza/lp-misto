import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// Executa o próprio public/sw.js (sem cópia das regras) num contexto isolado, com
// caches, fetch e eventos simulados.
const SW_SOURCE = readFileSync(fileURLToPath(new URL("../../../public/sw.js", import.meta.url)), "utf8");
const ORIGIN = "https://clube.test";
const OFFLINE_MARK = "PAGINA_OFFLINE";
// No HTML real o Next escreve alguns caminhos com barra escapada (\/).
const OFFLINE_HTML = `<!doctype html><html><body>${OFFLINE_MARK}<script src="/_next/static/chunks/app-1.js"></script><script>self.__next_f.push(["\\/_next\\/static\\/css\\/site.css"])</script></body></html>`;

type Handler = (url: string) => Promise<Response>;

function keyOf(input: unknown): string {
  if (typeof input === "string") return new URL(input, ORIGIN).href;
  return new URL((input as { url: string }).url, ORIGIN).href;
}

function createWorker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const caches = new Map<string, Map<string, Response>>();
  const network: { calls: string[]; inits: Array<RequestInit | undefined>; handler: Handler } = {
    calls: [],
    inits: [],
    handler: async () => {
      throw new TypeError("Failed to fetch");
    },
  };
  const state = { skipWaiting: 0, claimed: 0 };

  const cachesApi = {
    open: async (name: string) => {
      if (!caches.has(name)) caches.set(name, new Map());
      const store = caches.get(name)!;
      return {
        match: async (req: unknown) => store.get(keyOf(req))?.clone(),
        put: async (req: unknown, res: Response) => {
          store.set(keyOf(req), res);
        },
        // Como o Cache real: keys() na ordem de inserção.
        keys: async () => [...store.keys()].map((url) => ({ url })),
        delete: async (req: unknown) => store.delete(keyOf(req)),
      };
    },
    keys: async () => [...caches.keys()],
    delete: async (name: string) => caches.delete(name),
  };

  const sandbox = {
    self: {
      location: new URL(`${ORIGIN}/sw.js`),
      addEventListener: (type: string, fn: (event: unknown) => void) => {
        listeners.set(type, fn);
      },
      skipWaiting: async () => {
        state.skipWaiting++;
      },
      clients: {
        claim: async () => {
          state.claimed++;
        },
      },
    },
    caches: cachesApi,
    fetch: (input: unknown, init?: RequestInit) => {
      const key = keyOf(input);
      network.calls.push(key);
      network.inits.push(init);
      return network.handler(key);
    },
    Response,
    URL,
  };
  vm.runInNewContext(SW_SOURCE, sandbox, { filename: "sw.js" });

  return { listeners, caches, network, state };
}

type Worker = ReturnType<typeof createWorker>;

function req(path: string, init: { method?: string; mode?: string } = {}) {
  return { url: `${ORIGIN}${path}`, method: init.method ?? "GET", mode: init.mode ?? "cors" };
}

/** Dispara fetch; devolve a promise de respondWith, ou undefined se o SW não respondeu. */
function dispatchFetch(w: Worker, request: unknown): Promise<Response> | undefined {
  let responded: Promise<Response> | undefined;
  w.listeners.get("fetch")!({
    request,
    respondWith: (p: Promise<Response>) => {
      responded = p;
    },
  });
  return responded;
}

async function runLifecycle(w: Worker, type: "install" | "activate") {
  let pending: Promise<unknown> | undefined;
  w.listeners.get(type)!({
    waitUntil: (p: Promise<unknown>) => {
      pending = p;
    },
  });
  await pending;
}

const html = (body: string) => new Response(body, { status: 200, headers: { "content-type": "text/html" } });
const js = (body: string) =>
  new Response(body, { status: 200, headers: { "content-type": "application/javascript" } });

/** Worker já instalado com a página offline e os assets descobertos. */
async function installed(): Promise<Worker> {
  const w = createWorker();
  w.network.handler = async (url) => (url.endsWith("/offline") ? html(OFFLINE_HTML) : js("/*asset*/"));
  await runLifecycle(w, "install");
  return w;
}

function cacheNames(w: Worker, suffix: string): string[] {
  return [...w.caches.keys()].filter((n) => n.endsWith(suffix));
}

function allCachedKeys(w: Worker): string[] {
  return [...w.caches.values()].flatMap((store) => [...store.keys()]);
}

describe("sw.js - install", () => {
  it("pré-cacheia /offline e os assets que o HTML referencia, então ativa (skipWaiting)", async () => {
    const w = createWorker();
    w.network.handler = async (url) => (url.endsWith("/offline") ? html(OFFLINE_HTML) : js("/*asset*/"));

    await runLifecycle(w, "install");

    const shell = cacheNames(w, "-shell");
    expect(shell).toHaveLength(1);
    const offline = await w.caches.get(shell[0])!.get(`${ORIGIN}/offline`)!.text();
    expect(offline).toContain(OFFLINE_MARK);

    const staticKeys = [...w.caches.get(cacheNames(w, "-static")[0])!.keys()];
    expect(staticKeys).toContain(`${ORIGIN}/_next/static/chunks/app-1.js`);
    // Barra escapada (\/) no payload inline é normalizada antes de baixar.
    expect(staticKeys).toContain(`${ORIGIN}/_next/static/css/site.css`);
    expect(w.state.skipWaiting).toBe(1);
  });

  it("o precache é anônimo: nenhum fetch da instalação leva cookies (credentials omit)", async () => {
    const w = createWorker();
    w.network.handler = async (url) => (url.endsWith("/offline") ? html(OFFLINE_HTML) : js("/*asset*/"));

    await runLifecycle(w, "install");

    expect(w.network.inits.length).toBeGreaterThan(1);
    for (const init of w.network.inits) expect(init?.credentials).toBe("omit");
  });

  it("falha quando /offline não pode ser guardada: o SW não ativa", async () => {
    const w = createWorker();
    w.network.handler = async () => new Response("erro", { status: 500 });

    await expect(runLifecycle(w, "install")).rejects.toThrow();
    expect(w.state.skipWaiting).toBe(0);
  });

  it("asset que falha não derruba a instalação", async () => {
    const w = createWorker();
    w.network.handler = async (url) => {
      if (url.endsWith("/offline")) return html(OFFLINE_HTML);
      throw new TypeError("offline");
    };

    await runLifecycle(w, "install");

    expect(w.state.skipWaiting).toBe(1);
    expect(cacheNames(w, "-shell")).toHaveLength(1);
  });

  it("asset que volta como HTML não entra no cache de estáticos", async () => {
    const w = createWorker();
    w.network.handler = async (url) => (url.endsWith("/offline") ? html(OFFLINE_HTML) : html("<p>erro</p>"));

    await runLifecycle(w, "install");

    expect(cacheNames(w, "-static")).toHaveLength(1);
    expect(w.caches.get(cacheNames(w, "-static")[0])!.size).toBe(0);
  });
});

describe("sw.js - navegação (rede primeiro)", () => {
  it("online: vai para a rede e NÃO guarda o HTML da página", async () => {
    const w = await installed();
    w.network.handler = async () => html("<p>MINHA_CONTA</p>");

    const res = await dispatchFetch(w, req("/conta", { mode: "navigate" }))!;

    expect(await res.text()).toContain("MINHA_CONTA");
    expect(allCachedKeys(w)).not.toContain(`${ORIGIN}/conta`);
  });

  it("offline: responde a página /offline do cache", async () => {
    const w = await installed();
    w.network.handler = async () => {
      throw new TypeError("Failed to fetch");
    };

    const res = await dispatchFetch(w, req("/socios/carteirinha", { mode: "navigate" }))!;

    expect(await res.text()).toContain(OFFLINE_MARK);
  });

  it("offline e sem /offline no cache: erro de rede (nada inventado)", async () => {
    const w = createWorker();
    w.network.handler = async () => {
      throw new TypeError("Failed to fetch");
    };

    const res = await dispatchFetch(w, req("/conta", { mode: "navigate" }))!;

    expect(res.type).toBe("error");
  });

  it("erro do servidor (500) não vira página offline", async () => {
    const w = await installed();
    w.network.handler = async () => new Response("falhou", { status: 500 });

    const res = await dispatchFetch(w, req("/conta", { mode: "navigate" }))!;

    expect(res.status).toBe(500);
  });
});

describe("sw.js - o que nunca é interceptado", () => {
  it("envio de formulário (POST de navegação) não é interceptado", async () => {
    const w = await installed();
    expect(dispatchFetch(w, req("/checkout", { method: "POST", mode: "navigate" }))).toBeUndefined();
  });

  it("server action / POST em qualquer rota não é interceptado", async () => {
    const w = await installed();
    expect(dispatchFetch(w, req("/conta", { method: "POST", mode: "cors" }))).toBeUndefined();
  });

  it("/admin nunca é interceptado (nem navegação)", async () => {
    const w = await installed();
    expect(dispatchFetch(w, req("/admin/dashboard", { mode: "navigate" }))).toBeUndefined();
    expect(dispatchFetch(w, req("/admin", { mode: "navigate" }))).toBeUndefined();
  });

  it("/api, webhooks e /_next/data não são interceptados", async () => {
    const w = await installed();
    expect(dispatchFetch(w, req("/api/cron/alguma-coisa"))).toBeUndefined();
    expect(dispatchFetch(w, req("/api/qstash/callback"))).toBeUndefined();
    expect(dispatchFetch(w, req("/webhooks/pagamento"))).toBeUndefined();
    expect(dispatchFetch(w, req("/_next/data/abc/conta.json"))).toBeUndefined();
  });

  it("origem externa não é interceptada (nem navegação)", async () => {
    const w = await installed();
    const outside = { url: "https://outro.test/_next/static/x.js", method: "GET", mode: "no-cors" };
    expect(dispatchFetch(w, outside)).toBeUndefined();
    expect(dispatchFetch(w, { url: "https://outro.test/", method: "GET", mode: "navigate" })).toBeUndefined();
  });
});

describe("sw.js - /_next/static (cache primeiro)", () => {
  it("primeira vez busca e guarda; depois serve do cache sem nova ida à rede", async () => {
    const w = await installed();
    w.network.handler = async () => js("console.log(1)");

    const first = await dispatchFetch(w, req("/_next/static/chunks/nova.js", { mode: "no-cors" }))!;
    expect(await first.text()).toBe("console.log(1)");
    const second = await dispatchFetch(w, req("/_next/static/chunks/nova.js", { mode: "no-cors" }))!;
    expect(await second.text()).toBe("console.log(1)");

    expect(w.network.calls.filter((u) => u.endsWith("/chunks/nova.js"))).toHaveLength(1);
  });

  it("o cache de estáticos tem teto: os chunks mais antigos saem primeiro", async () => {
    const w = await installed();
    w.network.handler = async () => js("/*chunk*/");

    // 300 de teto: adiciona 302 chunks; os 2 primeiros (mais antigos) devem sair.
    for (let i = 0; i < 302; i++) {
      await dispatchFetch(w, req(`/_next/static/chunks/c${i}.js`))!;
    }

    const staticStore = w.caches.get(cacheNames(w, "-static")[0])!;
    expect(staticStore.size).toBe(300);
    expect(staticStore.has(`${ORIGIN}/_next/static/chunks/c0.js`)).toBe(false);
    expect(staticStore.has(`${ORIGIN}/_next/static/chunks/c1.js`)).toBe(false);
    expect(staticStore.has(`${ORIGIN}/_next/static/chunks/c301.js`)).toBe(true);
  });

  it("resposta de erro não é guardada", async () => {
    const w = await installed();
    w.network.handler = async () => new Response("nf", { status: 404, headers: { "content-type": "text/plain" } });

    await dispatchFetch(w, req("/_next/static/chunks/sumiu.js"))!;
    await dispatchFetch(w, req("/_next/static/chunks/sumiu.js"))!;

    expect(w.network.calls.filter((u) => u.endsWith("/sumiu.js"))).toHaveLength(2);
  });
});

describe("sw.js - activate", () => {
  it("apaga caches de versões antigas do SW, mantém os atuais e não mexe em caches de outros usos", async () => {
    const w = createWorker();
    w.caches.set("site-sw-v0-shell", new Map());
    w.caches.set("site-sw-v0-static", new Map());
    w.caches.set("outro-app-cache", new Map());
    w.network.handler = async (url) => (url.endsWith("/offline") ? html(OFFLINE_HTML) : js("/*asset*/"));
    await runLifecycle(w, "install");

    await runLifecycle(w, "activate");

    const names = [...w.caches.keys()];
    expect(names).not.toContain("site-sw-v0-shell");
    expect(names).not.toContain("site-sw-v0-static");
    expect(names).toContain("outro-app-cache");
    expect(cacheNames(w, "-shell")).toHaveLength(1);
    expect(cacheNames(w, "-static")).toHaveLength(1);
    expect(w.state.claimed).toBe(1);
  });
});
