/* ============================================================
   AVISO PUSH: "apareció una mascota que se parece a la tuya"

   La llama el navegador de quien ACABA de publicar un hallazgo, con la
   lista de coincidencias fuertes que el cruce le mostró. Esta función
   verifica que esa lista sea creíble y le manda el aviso a quien está
   buscando cada una de esas mascotas.

   Por qué lo dispara el navegador y no la base de datos: el algoritmo
   de cruce vive en app.js. Llevarlo a SQL significaría mantener dos
   copias del mismo algoritmo, y tarde o temprano se separan. Aquí el
   navegador propone y el servidor comprueba.

   QUÉ COMPRUEBA ANTES DE ENVIAR (todo esto importa: sin ello cualquiera
   podría usar esto para molestar a desconocidos)
     1. El token existe y corresponde a una publicación real.
     2. Esa publicación se creó hace menos de 30 minutos. Así el aviso
        solo puede salir en el momento de publicar, no cuando se le
        antoje a alguien.
     3. Cada destinatario es del tipo contrario, no está resuelto, y
        está a menos de 60 km. Una lista inventada no pasa.
     4. Máximo 5 destinatarios por llamada.
     5. A la misma pareja no se le avisa dos veces nunca (tabla
        avisos_enviados). Recargar la página no repite el aviso.

   Configuración: ver el README, sección "Avisos push".
   ============================================================ */

import * as webpush from "jsr:@negrel/webpush@0.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_LLAVES = Deno.env.get("VAPID_LLAVES") || "";
const CORREO_ADMIN = Deno.env.get("CORREO_ADMIN") || "avisos@patasdevuelta.org";
const SITIO = Deno.env.get("SITIO_URL") || "https://patasdevuelta.netlify.app";

const CABECERAS_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
};

const json = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CABECERAS_CORS, "Content-Type": "application/json" }
  });

// ---------- acceso a la base con la clave de servicio ----------
async function sql(ruta: string, opciones: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(opciones.headers || {})
    }
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

function distanciaKm(a: number, b: number, c: number, d: number) {
  if ([a, b, c, d].some(v => v === null || v === undefined)) return null;
  const R = 6371, r = Math.PI / 180;
  const dLat = (c - a) * r, dLng = (d - b) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// ---------- servidor de aplicación de push (se arma una sola vez) ----------
let servidorPush: Awaited<ReturnType<typeof webpush.ApplicationServer.new>> | null = null;
let llavesVapid: Awaited<ReturnType<typeof webpush.importVapidKeys>> | null = null;

async function prepararPush() {
  if (servidorPush) return servidorPush;
  if (!VAPID_LLAVES) throw new Error("Falta el secreto VAPID_LLAVES");
  llavesVapid = await webpush.importVapidKeys(JSON.parse(VAPID_LLAVES), { extractable: false });
  servidorPush = await webpush.ApplicationServer.new({
    contactInformation: "mailto:" + CORREO_ADMIN,
    vapidKeys: llavesVapid
  });
  return servidorPush;
}

Deno.serve(async (peticion) => {
  if (peticion.method === "OPTIONS") return new Response("ok", { headers: CABECERAS_CORS });

  try {
    // La clave pública que el navegador necesita para suscribirse
    if (peticion.method === "GET") {
      await prepararPush();
      const publica = await webpush.exportApplicationServerKey(llavesVapid!);
      return json({ clave: publica });
    }

    const { token, codigos } = await peticion.json();
    if (!token || !Array.isArray(codigos) || !codigos.length) {
      return json({ enviados: 0, motivo: "faltan datos" });
    }

    // 1 y 2: la publicación de origen existe y es recién nacida
    const origenes = await sql(
      `mascotas?token_gestion=eq.${encodeURIComponent(token)}` +
      `&select=id,tipo,especie,nombre,codigo,lat,lng,creado&limit=1`);
    const origen = origenes?.[0];
    if (!origen) return json({ enviados: 0, motivo: "token desconocido" });

    const minutos = (Date.now() - new Date(origen.creado).getTime()) / 60000;
    if (minutos > 30) return json({ enviados: 0, motivo: "la publicación ya no es reciente" });

    // 3 y 4: los destinatarios tienen que ser creíbles
    const lista = codigos.slice(0, 5).map(String);
    const enLista = lista.map(c => `"${c.replace(/"/g, "")}"`).join(",");
    const destinos = await sql(
      `mascotas?codigo=in.(${encodeURIComponent(enLista)})` +
      `&select=id,codigo,tipo,estado,nombre,especie,lat,lng,token_gestion`);

    const validos = (destinos || []).filter((d: any) => {
      if (d.tipo === origen.tipo) return false;            // tiene que ser del lado contrario
      if (d.estado === "resuelto" || d.estado === "oculto") return false;
      const km = distanciaKm(origen.lat, origen.lng, d.lat, d.lng);
      return km === null || km <= 60;                       // sin coordenadas no se descarta
    });

    let enviados = 0;
    const detalle: string[] = [];

    for (const d of validos) {
      // 5: a la misma pareja no se le avisa dos veces
      const yaFue = await sql(
        `avisos_enviados?mascota_destino=eq.${d.id}&mascota_origen=eq.${origen.id}&select=creado&limit=1`);
      if (yaFue?.length) { detalle.push(`${d.codigo}: ya se había avisado`); continue; }

      const suscripciones = await sql(
        `suscripciones_push?mascota_id=eq.${d.id}&select=id,endpoint,datos`);
      if (!suscripciones?.length) { detalle.push(`${d.codigo}: sin avisos activados`); continue; }

      const servidor = await prepararPush();
      const quien = d.nombre || `tu ${String(d.especie || "mascota").toLowerCase()}`;
      const mensaje = JSON.stringify({
        titulo: `Puede que hayan encontrado a ${quien}`,
        cuerpo: "Alguien reportó una mascota muy parecida cerca. Ábrela y míralo con calma.",
        url: `${SITIO}/g/${d.token_gestion}`,
        etiqueta: `coincidencia-${d.codigo}`
      });

      let alguno = false;
      for (const s of suscripciones) {
        try {
          await servidor.subscribe(s.datos).pushTextMessage(mensaje, {});
          alguno = true;
        } catch (e) {
          /* 404 y 410 significan que esa suscripción murió (desinstalaron la
             página, cambiaron de teléfono). Se limpia para no reintentar. */
          const msg = String(e);
          if (msg.includes("404") || msg.includes("410")) {
            await sql(`suscripciones_push?id=eq.${s.id}`, { method: "DELETE" }).catch(() => { });
            detalle.push(`${d.codigo}: suscripción vencida, eliminada`);
          } else {
            detalle.push(`${d.codigo}: falló el envío (${msg.slice(0, 80)})`);
          }
        }
      }

      if (alguno) {
        enviados++;
        detalle.push(`${d.codigo}: avisado`);
        await sql("avisos_enviados", {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates" },
          body: JSON.stringify({ mascota_destino: d.id, mascota_origen: origen.id })
        }).catch(() => { });
      }
    }

    return json({ enviados, revisados: validos.length, detalle });
  } catch (e) {
    /* Nunca fallamos ruidosamente: que no salga un aviso no puede impedir que
       la publicación se cree ni romper la pantalla de quien está reportando. */
    console.error("avisar:", e);
    return json({ enviados: 0, error: String(e).slice(0, 300) });
  }
});
