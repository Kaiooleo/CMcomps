/*
 * CM Comps — service worker (PWA).
 *
 * - Código e dados (html, js, css, json): sempre confere com o servidor se
 *   há versão nova e usa a cópia guardada só quando estiver sem internet.
 *   Assim as atualizações chegam na hora.
 * - Imagens (img/, sp/, icons/, og.jpg): mostra a cópia guardada na hora e, ao
 *   mesmo tempo, confere com o servidor; se a imagem mudou, a cópia é trocada e
 *   a nova aparece na próxima visita.
 *
 * Com isso nada precisa ser trocado a cada publicação: código e imagens se
 * atualizam sozinhos. Só mude CACHE se a forma de guardar mudar.
 */
const CACHE = "cmcomps";
const CORE = [
  "./",
  "index.html",
  "style.css",
  "data.js",
  "theme.js",
  "affinity.js",
  "meta.js",
  "logic.js",
  "app.js",
  "manifest.webmanifest",
  "icons/favicon.png",
  "icons/cheval-chibi.webp",
  "icons/cheval-chibi-hover.webp",
  "icons/ui/speed.webp",
  "icons/ui/stamina.webp",
  "icons/ui/power.webp",
  "icons/ui/guts.webp",
  "icons/ui/wit.webp",
  "icons/ui/pal.webp",
  "icons/ui/group.webp",
  "icons/ui/ssr.webp",
  "icons/ui/sr.webp",
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
  /\/(sp|icons|img)\//.test(url.pathname) || url.pathname.endsWith("og.jpg");

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  if (isImage(url)) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(req).then((hit) => {
          const fresh = fetch(req)
            .then((res) => {
              if (res.ok) cache.put(req, res.clone());
              return res;
            })
            .catch(() => hit || Response.error());
          if (hit) {
            event.waitUntil(fresh); // atualiza a cópia em segundo plano
            return hit;
          }
          return fresh;
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
