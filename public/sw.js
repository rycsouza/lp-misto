/*
 * Service worker mínimo do site (PWA e app TWA). Escrito à mão, sem build step:
 * é servido como está em /sw.js.
 *
 * Escopo = origem do clube. Cada clube tem o próprio domínio, então nada cruza
 * entre clubes.
 *
 * Regras:
 * - Só GET de mesma origem. POST (inclusive envio de formulário e server actions),
 *   /api, /admin, /_next/data e rotas de webhook nunca passam por aqui.
 * - Navegação: rede primeiro. Se a rede falhar, responde /offline (precache).
 *   HTML de página NUNCA entra em cache: pode trazer dados de quem está logado.
 * - /_next/static (nomes com hash, imutáveis): cache primeiro.
 * - O cache tem versão no nome. No activate, caches de outras versões são apagados.
 *
 * Testes: src/lib/pwa/service-worker.test.ts executa ESTE arquivo.
 */

const SW_VERSION = "v1";
const CACHE_PREFIX = "site-sw-";
const SHELL_CACHE = `${CACHE_PREFIX}${SW_VERSION}-shell`;
const STATIC_CACHE = `${CACHE_PREFIX}${SW_VERSION}-static`;
const OFFLINE_URL = "/offline";
const STATIC_PREFIX = "/_next/static/";
// Teto do cache de estáticos: cada deploy gera chunks novos, e os antigos saem primeiro.
const MAX_STATIC_ENTRIES = 300;
const NEVER_HANDLE = [/^\/api(\/|$)/, /^\/admin(\/|$)/, /^\/_next\/data\//, /webhook/i];
// Caminhos de assets que a página offline referencia (ex.: /_next/static/chunks/x.js).
const ASSET_PATH_RE = /\/_next\/static\/[A-Za-z0-9_\-./%]+/g;

function shouldHandle(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  return !NEVER_HANDLE.some((re) => re.test(url.pathname));
}

function strategyFor(request, url) {
  if (!shouldHandle(request, url)) return null;
  if (request.mode === "navigate") return "navigate";
  if (url.pathname.startsWith(STATIC_PREFIX)) return "static";
  return null;
}

function isCacheableStatic(response) {
  const type = response.headers.get("content-type") || "";
  return response.ok && !type.includes("text/html");
}

async function cacheStaticAsset(cache, path) {
  try {
    // credentials omit: o precache nunca leva cookies de sessão (fica anônimo).
    const response = await fetch(path, { cache: "reload", credentials: "omit" });
    if (isCacheableStatic(response)) await cache.put(path, response);
  } catch {
    // Melhor esforço: sem um asset, a página offline mostra o aviso sem ele.
  }
}

async function precacheOfflinePage() {
  const shell = await caches.open(SHELL_CACHE);
  const response = await fetch(OFFLINE_URL, { cache: "reload", credentials: "omit" });
  if (!response.ok) throw new Error("offline page unavailable");
  const html = await response.clone().text();
  await shell.put(OFFLINE_URL, response);

  // Descobre os assets que o HTML da página offline referencia (o Next escreve
  // alguns caminhos com barra escapada dentro do payload inline).
  const staticCache = await caches.open(STATIC_CACHE);
  const paths = [...new Set(html.replace(/\\\//g, "/").match(ASSET_PATH_RE) || [])];
  await Promise.all(paths.map((path) => cacheStaticAsset(staticCache, path)));
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const shell = await caches.open(SHELL_CACHE);
    const offline = await shell.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

async function trimStaticCache(cache) {
  const keys = await cache.keys();
  const extra = keys.length - MAX_STATIC_ENTRIES;
  // Cache.keys() segue a ordem de inserção: os primeiros são os mais antigos.
  for (const key of keys.slice(0, Math.max(0, extra))) await cache.delete(key);
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (isCacheableStatic(response)) {
    await cache.put(request, response.clone());
    await trimStaticCache(cache);
  }
  return response;
}

self.addEventListener("install", (event) => {
  // skipWaiting só depois do precache: se a página offline não puder ser guardada,
  // a instalação falha e o SW antigo continua valendo.
  event.waitUntil(precacheOfflinePage().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, STATIC_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && !keep.has(name))
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const strategy = strategyFor(request, new URL(request.url));
  if (strategy === "navigate") {
    event.respondWith(networkFirstNavigation(request));
  } else if (strategy === "static") {
    event.respondWith(cacheFirstStatic(request));
  }
});
