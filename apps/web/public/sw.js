// RUNNER 360 — service worker mínimo para que la app se pueda instalar.
// No guarda páginas con datos personales: solo una página para cuando no hay conexión.
const CACHE = "r360-v2";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Con conexión, el navegador carga las páginas solo (sin pasar por acá). Safari y Chrome en iPhone
// rechazan las páginas que el service worker entrega después de una redirección ("Response served by
// service worker has redirections"), y la app redirige seguido (por ejemplo /inicio → /ingresar al
// abrir el ícono sin sesión). Por eso solo se interviene sin conexión, para mostrar la página offline.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate" || req.method !== "GET" || self.navigator.onLine) return;
  event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
});

// Notificaciones push (avisos de pagos). El contenido llega cifrado; al tocarla se abre la app.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "RUNNER 360", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "RUNNER 360", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/inicio" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/inicio", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const same = wins.find((w) => w.url.startsWith(self.location.origin));
      if (same) return same.focus().then((w) => w.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
