/* ============================================================
   TRABAJADOR DE SEGUNDO PLANO (service worker)

   Es lo único que sigue vivo cuando la persona cerró la página. Su
   trabajo es recibir el aviso y mostrarlo, nada más: no guarda datos,
   no intercepta peticiones, no cachea. A propósito — mientras menos
   haga, menos cosas se pueden romper.

   Tiene que vivir en la raíz del sitio. Si estuviera dentro de una
   carpeta solo podría atender a esa carpeta.
   ============================================================ */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", evento => {
  let datos = {};
  try { datos = evento.data ? evento.data.json() : {}; } catch { }

  const titulo = datos.titulo || "Patas de vuelta";
  const opciones = {
    body: datos.cuerpo || "Hay una novedad en tu publicación.",
    icon: datos.icono || "/icono-192.png",
    badge: "/icono-192.png",
    tag: datos.etiqueta || "patas-aviso",   // reemplaza el anterior en vez de apilar
    renotify: true,
    requireInteraction: true,               // no se va sola: puede ser LA noticia
    data: { url: datos.url || "/" }
  };

  evento.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", evento => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || "/";

  /* Si la página ya está abierta en alguna pestaña, la reutilizamos y la
     llevamos al sitio correcto. Abrir una segunda pestaña de lo mismo es
     molesto, y en el celular desorienta. */
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(pestanas => {
      for (const p of pestanas) {
        if (p.url.includes(self.registration.scope) && "focus" in p) {
          p.navigate(destino).catch(() => { });
          return p.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
