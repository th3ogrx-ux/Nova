// Service worker minimal — nécessaire pour que l'app soit installable
// (PWA) sur la plupart des navigateurs. Stratégie "network first" :
// toujours essayer le réseau d'abord (contenu à jour), ne retombe sur
// le cache que hors-ligne. Ne met en cache que la coquille de l'appli
// (HTML/JS/CSS/manifest), jamais les données Supabase.
const CACHE_NAME = "zenoa-agency-shell-v2";
const SHELL_FILES = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // laisse passer les appels Supabase/Nominatim/Overpass

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
