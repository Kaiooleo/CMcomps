/*
 * CM Comps — service worker (PWA).
 *
 * - Código e dados (html, js, css, json): sempre confere com o servidor se
 *   há versão nova e usa a cópia guardada só quando estiver sem internet.
 *   Assim as atualizações chegam na hora.
 * - Imagens (img/, sp/, icons/, og.png): usa a cópia guardada primeiro, porque
 *   quase nunca mudam e são o que mais pesa.
 *
 * Suba CACHE quando quiser forçar todos a baixarem tudo de novo.
 */
const CACHE = "cmcomps-v21";
const CORE = [
  "./",
  "index.html",
  "style.css",
  "data.js",
  "affinity.js",
  "logic.js",
  "app.js",
  "manifest.webmanifest",
  "icons/favicon.png",
  "icons/cheval-chibi.webp",
  "icons/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const isImage = (url) =>
  /\/(sp|icons|img)\//.test(url.pathname) || url.pathname.endsWith("og.png");

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  if (isImage(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // "no-cache": sempre pergunta ao servidor se o arquivo mudou (o GitHub Pages
  // manda o navegador guardar por 10 min, o que mostraria a versão antiga)
  event.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match("index.html")),
      ),
  );
});
