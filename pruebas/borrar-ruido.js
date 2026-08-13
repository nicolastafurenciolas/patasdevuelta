/* ============================================================
   QUITAR EL RUIDO DE PRUEBA DE LA PÁGINA
   Corre con:  node pruebas/borrar-ruido.js
   ============================================================

   Pone en "oculto" todas las publicaciones que sembró sembrar-ruido.js,
   usando el token de gestión de cada una (el mismo camino que usa el botón
   "Retirar la publicación" de la página). Al quedar ocultas desaparecen de
   la vista pública: ya no salen en el buscador, ni en la portada, ni en el
   cruce de coincidencias.

   OJO: ocultar no es borrar. Las filas siguen en la base. Para eliminarlas
   de verdad hay que correr esto en el SQL Editor de Supabase:

       delete from mascotas where contacto_email = 'ruido-de-prueba@patasdevuelta.test';

   Se hace así porque las tablas tienen todos los permisos revocados para la
   clave pública (a propósito): no existe forma de borrar filas desde el
   navegador ni desde este script, y está bien que sea así. */

const fs = require("fs");
const path = require("path");

const MARCA_CORREO = "ruido-de-prueba@patasdevuelta.test";

const config = fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8");
const sacar = clave => (config.match(new RegExp(clave + '\\s*:\\s*"([^"]+)"')) || [])[1];
const API = (sacar("SUPABASE_URL") || "").replace(/\/$/, "");
const KEY = sacar("SUPABASE_ANON_KEY") || "";

const archivo = path.join(__dirname, "ruido-sembrado.json");
if (!fs.existsSync(archivo)) {
  console.error("No encuentro pruebas/ruido-sembrado.json.");
  console.error("Sin esa lista no tengo los tokens. Usa la orden SQL de arriba.");
  process.exit(1);
}

const { publicaciones } = JSON.parse(fs.readFileSync(archivo, "utf8"));

(async () => {
  console.log(`Ocultando ${publicaciones.length} publicaciones de prueba…\n`);
  let ok = 0; const fallos = [];

  for (const p of publicaciones) {
    try {
      const r = await fetch(`${API}/rest/v1/rpc/actualizar_estado`, {
        method: "POST",
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_token: p.token, p_estado: "oculto" })
      });
      if (!r.ok) throw new Error((await r.text()).slice(0, 120));
      ok++;
      process.stdout.write(`\r  ocultas: ${ok}/${publicaciones.length}`);
    } catch (e) {
      fallos.push({ codigo: p.codigo, error: e.message });
    }
    await new Promise(res => setTimeout(res, 50));
  }

  console.log(`\n\nOcultas: ${ok}. Con problema: ${fallos.length}.`);
  if (fallos.length) console.log("  primer error:", fallos[0].error);
  console.log("\nYa no aparecen en la página. Para borrarlas de la base de verdad,");
  console.log("corre esto en el SQL Editor de Supabase:\n");
  console.log(`  delete from mascotas where contacto_email = '${MARCA_CORREO}';`);
})();
