// Service worker: guarda la app en el celular para que abra sin internet.
// Cuando cambies index.html, sube el número de versión (v12 -> v13) para que los celulares detecten la actualización.
// La versión nueva NO se activa sola mientras alguien está usando la app: la app muestra el aviso
// "Hay una nueva versión" y el usuario toca "Actualizar" cuando le conviene (sus borradores se conservan).
const CACHE = "evalcampo-v13";
const ARCHIVOS = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  // cache: "reload" evita que el navegador entregue una copia vieja guardada por su propio caché
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS.map(u => new Request(u, { cache: "reload" })))));
});

self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request))
  );
});
