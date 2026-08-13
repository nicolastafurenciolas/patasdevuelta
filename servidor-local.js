/* Servidor estático para revisar la página en el computador, imitando el
   comportamiento de Netlify: cualquier ruta que no sea un archivo devuelve
   index.html, igual que la redirección SPA de netlify.toml.

   Solo para desarrollo. No se usa en producción — Netlify sirve los
   archivos directamente.

   Uso:  node servidor-local.js     →  http://localhost:4173 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PUERTO = process.env.PORT || 4173;
const RAIZ = __dirname;

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

http.createServer((pedido, respuesta) => {
  const url = decodeURIComponent((pedido.url || "/").split("?")[0]);
  // Nunca dejamos salir de la carpeta del proyecto
  const destino = path.join(RAIZ, path.normalize(url).replace(/^(\.\.[/\\])+/, ""));

  fs.stat(destino, (err, info) => {
    const servir = archivo => {
      fs.readFile(archivo, (e, datos) => {
        if (e) { respuesta.writeHead(404); return respuesta.end("No encontrado"); }
        respuesta.writeHead(200, {
          "Content-Type": TIPOS[path.extname(archivo).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        });
        respuesta.end(datos);
      });
    };
    // Archivo real → se sirve. Cualquier otra ruta → index.html (rutas SPA)
    if (!err && info.isFile()) servir(destino);
    else servir(path.join(RAIZ, "index.html"));
  });
}).listen(PUERTO, () => console.log(`Patas de vuelta en http://localhost:${PUERTO}`));
