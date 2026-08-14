/* ============================================================
   VIGILANTE DE LA PÁGINA
   Corre con:  node pruebas/vigilar.js
   ============================================================

   Revisa que la página esté viva y avisa ANTES de que se caiga por quedarse
   sin cupo. Está pensado para correr solo, cada pocos minutos, desde GitHub
   Actions (.github/workflows/vigilar.yml). También se puede correr a mano
   desde el computador para mirar cómo va todo en vivo.

   QUÉ REVISA
     1. Que patasdevuelta.netlify.app responda, y en cuánto tiempo.
     2. Que Supabase responda (que es lo que se cae si se acaba el cupo).
     3. Cuántas publicaciones hay y a qué ritmo están entrando.
     4. Cuánto ancho de banda se lleva gastado, ESTIMADO (ver abajo).
     5. Que la función de avisos siga en pie.

   SOBRE LA ESTIMACIÓN DE ANCHO DE BANDA
   Supabase no deja consultar el gasto real con la clave pública, así que se
   calcula a partir de la columna `vistas`, que cuenta cada vez que alguien
   abre una ficha. Cada visita a una ficha mueve ~0,5 MB (medido), y por cada
   ficha que alguien abre suele mirar también la portada y el buscador, así
   que se multiplica por FACTOR_TRAFICO.

   ES UNA ESTIMACIÓN, NO EL NÚMERO EXACTO. Sirve para enterarse a tiempo, no
   para cuadrar la factura. El número de verdad está en el panel de Supabase,
   en Settings → Usage. Cuando esto avise, ve y míralo ahí.

   CUÁNTO CUESTA VIGILAR
   Cada revisión gasta ~20 KB. Cada 10 minutos son unos 90 MB al mes: menos
   del 2% del cupo. El vigilante no es el que te va a tumbar la página.
   ============================================================ */

const fs = require("fs");
const path = require("path");

// ---------- lo que se considera "ya es hora de avisar" ----------
const SITIO = process.env.SITIO_URL || "https://patasdevuelta.netlify.app";
/* Si algún día subes al plan Pro, cambia esto a 250 (o pon la variable
   CUPO_EGRESO_GB) o el vigilante te va a estar alarmando sin motivo. */
const CUPO_EGRESO_GB = Number(process.env.CUPO_EGRESO_GB) || 5;   // plan gratuito de Supabase
const AVISO_AMARILLO = 0.55;         // 55% del cupo: ojo
const AVISO_ROJO = 0.80;             // 80% del cupo: hay que actuar hoy
const MB_POR_VISITA_FICHA = 0.5;     // medido: 514 KB
const FACTOR_TRAFICO = 1.6;          // portada y buscador además de la ficha
const LENTO_MS = 4000;               // más de esto es que algo va mal
const PUBLICACIONES_POR_HORA_RARO = 90;   // por encima, huele a inundación
const CUPO_FILAS = 200000;           // 500 MB de base / ~2,5 KB por ficha

const ARCHIVO_ESTADO = process.env.ESTADO_VIGILANCIA ||
  path.join(__dirname, "vigilancia-estado.json");

// ---------- credenciales, del mismo config.js que usa la página ----------
const cfg = fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8");
const sacar = c => (cfg.match(new RegExp(c + '\\s*:\\s*"([^"]+)"')) || [])[1];
const API = (sacar("SUPABASE_URL") || "").replace(/\/$/, "");
const KEY = sacar("SUPABASE_ANON_KEY") || "";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

let base_mes = null;  // vistas que ya había al empezar el mes (ver más abajo)
const alertas = [];   // rojo: hay que hacer algo
const avisos = [];    // amarillo: para tener en cuenta
const lineas = [];    // el informe legible

const nota = t => lineas.push(t);
const numero = n => Number(n).toLocaleString("es-CO");

async function conTiempo(url, opciones) {
  const t = Date.now();
  try {
    const r = await fetch(url, { ...opciones, signal: AbortSignal.timeout(20000) });
    return { ok: true, status: r.status, ms: Date.now() - t, r };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t, error: e.message };
  }
}

(async () => {
  const ahora = Date.now();
  let previo = null;
  try { previo = JSON.parse(fs.readFileSync(ARCHIVO_ESTADO, "utf8")); } catch { }

  nota(`Revisión del ${new Date(ahora).toLocaleString("es-CO", { timeZone: "America/Bogota" })} (hora de Colombia)`);
  nota("");

  /* ---------- 1. ¿La página responde? ---------- */
  const sitio = await conTiempo(SITIO);
  if (!sitio.ok) {
    alertas.push(`La página NO responde (${sitio.error}). Está caída.`);
    nota(`✗ Página          sin respuesta — ${sitio.error}`);
  } else if (sitio.status >= 400) {
    alertas.push(`La página responde con error ${sitio.status}.`);
    nota(`✗ Página          HTTP ${sitio.status}`);
  } else {
    if (sitio.ms > LENTO_MS) avisos.push(`La página va lenta: ${sitio.ms} ms en responder.`);
    nota(`${sitio.ms > LENTO_MS ? "!" : "✓"} Página          HTTP ${sitio.status} en ${sitio.ms} ms`);
  }

  /* ---------- 2. ¿Supabase responde? Es lo primero que falla si se acaba el cupo ---------- */
  const base = await conTiempo(
    `${API}/rest/v1/mascotas_publicas?select=id&limit=1`,
    { headers: { ...H, Prefer: "count=exact", Range: "0-0" } });

  let filas = null;
  if (!base.ok) {
    alertas.push(`Supabase NO responde (${base.error}). Nadie puede publicar ni buscar.`);
    nota(`✗ Base de datos   sin respuesta — ${base.error}`);
  } else if (base.status >= 400) {
    alertas.push(`Supabase responde con error ${base.status}. ` +
      (base.status === 402 || base.status === 429
        ? "Puede ser que se acabó el cupo del plan gratuito."
        : "Revisa el panel de Supabase."));
    nota(`✗ Base de datos   HTTP ${base.status}`);
  } else {
    const rango = base.r.headers.get("content-range") || "";
    filas = Number((rango.split("/")[1] || "").trim());
    if (!Number.isFinite(filas)) filas = null;
    if (base.ms > LENTO_MS) avisos.push(`La base de datos va lenta: ${base.ms} ms.`);
    nota(`${base.ms > LENTO_MS ? "!" : "✓"} Base de datos   HTTP ${base.status} en ${base.ms} ms`);
  }

  /* ---------- 3. ¿Cuántas publicaciones y a qué ritmo? ---------- */
  let porHora = null;
  if (filas != null) {
    nota(`  Publicaciones   ${numero(filas)}`);
    if (previo && previo.filas != null) {
      const horas = (ahora - previo.ts) / 3600000;
      if (horas > 0.02) {
        porHora = Math.round((filas - previo.filas) / horas);
        nota(`  Ritmo           ${numero(porHora)} publicaciones por hora`);
        if (porHora >= PUBLICACIONES_POR_HORA_RARO) {
          alertas.push(`Están entrando ${numero(porHora)} publicaciones por hora. ` +
            `O te volviste viral, o alguien está inundando la página. Míralo ya.`);
        }
      }
    }
    if (filas > CUPO_FILAS * 0.8) {
      alertas.push(`La base va por ${numero(filas)} fichas, cerca del límite de 500 MB del plan gratuito.`);
    }
  }

  /* ---------- 4. Ancho de banda estimado ---------- */
  if (base.ok && base.status < 400) {
    const v = await conTiempo(`${API}/rest/v1/mascotas_publicas?select=vistas&limit=5000`, { headers: H });
    if (v.ok && v.status < 400) {
      let vistas = 0;
      try { vistas = (await v.r.json()).reduce((a, f) => a + (f.vistas || 0), 0); } catch { }

      /* El cupo de Supabase se reinicia cada mes, pero la columna `vistas` no:
         va sumando para siempre. Así que se guarda cuántas vistas había al
         empezar el mes y solo se cuentan las de este mes.
         Esto también deja fuera las vistas que dejaron las pruebas de carga
         antes del lanzamiento, que no las gastó nadie de verdad. */
      const mesAhora = new Date(ahora).toISOString().slice(0, 7);
      const mesPrevio = previo && previo.mes;
      base_mes = (mesPrevio === mesAhora && previo.vistasBase != null)
        ? previo.vistasBase
        : vistas;                     // mes nuevo (o primera vez): se pone a cero aquí
      const vistasDelMes = Math.max(0, vistas - base_mes);

      const gb = vistasDelMes * MB_POR_VISITA_FICHA * FACTOR_TRAFICO / 1024;
      const pct = gb / CUPO_EGRESO_GB;
      nota(`  Vistas de fichas ${numero(vistasDelMes)} este mes  (${numero(vistas)} desde siempre)`);
      nota(`  Ancho de banda  ~${gb.toFixed(2)} GB de ${CUPO_EGRESO_GB} GB  (${Math.round(pct * 100)}%, estimado)`);

      if (pct >= AVISO_ROJO) {
        alertas.push(`Vas por ~${gb.toFixed(1)} GB de los ${CUPO_EGRESO_GB} GB del mes (${Math.round(pct * 100)}%). ` +
          `Cuando se acabe, la página deja de cargar. Entra a Supabase → Settings → Usage a mirar el número real, ` +
          `y si va parecido, sube al plan Pro (25 USD al mes, 250 GB) HOY.`);
      } else if (pct >= AVISO_AMARILLO) {
        avisos.push(`Vas por ~${Math.round(pct * 100)}% del ancho de banda del mes. ` +
          `Todavía hay margen, pero ve mirando el panel de Supabase.`);
      }
    } else {
      avisos.push("No pude calcular el ancho de banda en esta revisión.");
    }
  }

  /* ---------- 5. La función de avisos ---------- */
  const avisosFn = await conTiempo(`${API}/functions/v1/clever-action`, { headers: H });
  if (!avisosFn.ok || avisosFn.status >= 400) {
    avisos.push(`La función de avisos no responde bien (${avisosFn.status || avisosFn.error}). ` +
      `No tumba la página: solo deja de funcionar el botón de activar avisos.`);
    nota(`! Avisos push     ${avisosFn.status || avisosFn.error}`);
  } else {
    nota(`✓ Avisos push     HTTP ${avisosFn.status}`);
  }

  /* ---------- guardar para poder comparar la próxima vez ---------- */
  try {
    fs.writeFileSync(ARCHIVO_ESTADO, JSON.stringify({
      ts: ahora, filas, porHora,
      mes: new Date(ahora).toISOString().slice(0, 7),
      vistasBase: base_mes
    }, null, 2));
  } catch { }

  /* ---------- informe ---------- */
  console.log(lineas.join("\n"));
  console.log("");

  if (alertas.length) {
    console.log("=".repeat(64));
    console.log("  HAY QUE HACER ALGO");
    console.log("=".repeat(64));
    alertas.forEach(a => console.log("  • " + a));
    console.log("");
  }
  if (avisos.length) {
    console.log("  Para tener en cuenta:");
    avisos.forEach(a => console.log("  · " + a));
    console.log("");
  }
  if (!alertas.length && !avisos.length) console.log("Todo bien.");

  // Salir con error hace que GitHub Actions marque la corrida como fallida,
  // y GitHub le manda el correo al dueño del repositorio. Ese es el aviso.
  if (alertas.length) {
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        `## Patas de vuelta — hay que hacer algo\n\n` +
        alertas.map(a => `- ${a}`).join("\n") +
        `\n\n\`\`\`\n${lineas.join("\n")}\n\`\`\`\n`);
    }
    process.exit(1);
  }
})().catch(e => {
  console.error("El vigilante falló:", e.message);
  process.exit(1);
});
