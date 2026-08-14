/* ============================================================
   PATAS DE VUELTA — aplicación
   ============================================================ */

const CFG = window.CONFIG || {};
const API = (CFG.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = CFG.SUPABASE_ANON_KEY || "";
const CONFIGURADO = API.startsWith("http") && !API.includes("TU-PROYECTO") && KEY.length > 20;
const GEO = window.COLOMBIA || [];

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const main = $("#principal");

/* ============================================================
   1. VOCABULARIO DEL DOMINIO
   ============================================================ */
const ESPECIES = ["Perro", "Gato", "Otro"];
const TAMANOS = ["Pequeño", "Mediano", "Grande"];
const ORDEN_TAMANO = { "Pequeño": 0, "Mediano": 1, "Grande": 2 };
const PELOS = ["Corto", "Medio", "Largo"];
const SEXOS = ["Macho", "Hembra", "No sé"];
const EDADES = ["Cachorro", "Joven", "Adulto", "Viejito"];
const ORDEN_EDAD = { "Cachorro": 0, "Joven": 1, "Adulto": 2, "Viejito": 3 };

/* Cada color se describe por sus componentes visuales. Dos personas describen
   al mismo animal de forma distinta —"manchado" y "negro y blanco" son lo
   mismo—, así que comparamos componentes en vez de exigir la misma etiqueta. */
const COLORES = [
  { k: "negro",    n: "Negro",    c: "#1E1E1E", comp: ["negro"] },
  { k: "blanco",   n: "Blanco",   c: "#F7F5EE", comp: ["blanco"] },
  { k: "gris",     n: "Gris",     c: "#8E8E8E", comp: ["gris", "negro"] },
  { k: "cafe",     n: "Café",     c: "#7A4A21", comp: ["cafe"] },
  { k: "canela",   n: "Canela",   c: "#C98B3A", comp: ["cafe", "dorado"] },
  { k: "dorado",   n: "Dorado",   c: "#DDB25A", comp: ["dorado", "cafe"] },
  { k: "crema",    n: "Crema",    c: "#E8D9B5", comp: ["blanco", "dorado"] },
  { k: "naranja",  n: "Naranja",  c: "#C0562A", comp: ["naranja", "cafe"] },
  { k: "atigrado", n: "Atigrado", c: "repeating-linear-gradient(65deg,#8A5A2B 0 3px,#3A2515 3px 5px)", comp: ["cafe", "negro"] },
  { k: "manchado", n: "Manchado", c: "radial-gradient(circle at 32% 32%,#2A2A2A 30%,transparent 31%),radial-gradient(circle at 72% 68%,#2A2A2A 26%,transparent 27%),#F0EDE4", comp: ["blanco", "negro"] },
  { k: "tricolor", n: "Tricolor", c: "linear-gradient(120deg,#F0EDE4 33%,#8A5A2B 33% 66%,#2A2A2A 66%)", comp: ["blanco", "cafe", "negro"] }
];
const MAPA_COLOR = Object.fromEntries(COLORES.map(c => [c.k, c]));
const colorNombre = k => (MAPA_COLOR[k] || {}).n || k;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/* ============================================================
   2. UTILIDADES
   ============================================================ */
const esc = s => String(s ?? "").replace(/[&<>"']/g, m =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

const hoy = () => new Date().toISOString().slice(0, 10);

function fechaLarga(f) {
  if (!f) return "";
  const d = new Date(f + "T12:00:00");
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/* Cuenta días de CALENDARIO, no horas transcurridas. Antes se restaba
   Date.now() contra el mediodía de la fecha: si alguien miraba la página a las
   9 de la mañana, una mascota perdida ayer decía "hoy" y una de anteayer decía
   "ayer". Aquí las fechas son información crítica, no adorno. */
function haceCuanto(f) {
  const d = new Date(f + "T12:00:00");
  const hoyMediodia = new Date(); hoyMediodia.setHours(12, 0, 0, 0);
  const dias = Math.round((hoyMediodia - d) / 86400000);   // redondeo: absorbe el cambio de hora
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const m = Math.floor(dias / 30);
  return m === 1 ? "hace un mes" : `hace ${m} meses`;
}

function distanciaKm(a, b, c, d) {
  if ([a, b, c, d].some(v => v == null)) return null;
  const R = 6371, r = Math.PI / 180;
  const dLat = (c - a) * r, dLng = (d - b) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const distanciaTexto = km =>
  km == null ? "" : km < 1 ? `a ${Math.round(km * 1000)} m` : `a ${km.toFixed(km < 10 ? 1 : 0)} km`;

function brindis(msg, ms = 3600) {
  const t = $("#brindis");
  t.textContent = msg;
  t.classList.add("brindis--visible");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("brindis--visible"), ms);
}

/* Espera a que la persona pare de mover algo antes de hacer el trabajo caro
   (aquí, redibujar el afiche completo). Sin esto, arrastrar la foto en un
   celular de gama baja repintaría un lienzo de 1080px en cada milisegundo. */
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function baseURL() {
  if (CFG.DOMINIO) return CFG.DOMINIO.replace(/\/$/, "");
  if (location.protocol.startsWith("http")) return location.origin;
  return "patasdevuelta.netlify.app";
}

const telLimpio = t => String(t || "").replace(/[^0-9+]/g, "");

function telValido(t) {
  const n = telLimpio(t).replace(/^\+/, "").replace(/^57(?=\d{10}$)/, "");
  return /^3\d{9}$/.test(n)        // celular: 10 dígitos empezando por 3
      || /^60\d{8}$/.test(n)       // fijo nacional: 60X + 7
      || /^[2-8]\d{6}$/.test(n);   // fijo local antiguo de 7 dígitos
}

function enlaceWhatsapp(tel, texto) {
  let n = telLimpio(tel).replace(/^\+/, "");
  if (!n.startsWith("57")) n = "57" + n;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

const fotosDe = m => (m.fotos && m.fotos.length ? m.fotos : []).filter(Boolean);
const fotoPrincipal = m => fotosDe(m)[0] || "";
const nombreMostrado = m => m.nombre ||
  (m.tipo === "encontrada" ? `${m.especie} sin identificar` : `${m.especie} sin nombre`);

/* ---------- MEMORIA LOCAL ---------- */
const MIS = {
  leer() { try { return JSON.parse(localStorage.getItem("patas_mis") || "[]"); } catch { return []; } },
  /* Fusiona, no reemplaza. Antes rehacía la entrada desde cero cada vez, y como
     vistaGestionar() la vuelve a guardar en cada visita, se borraba todo lo que
     parchar() hubiera dejado: el aplazamiento del recordatorio ("Todavía no") y
     las coincidencias ya vistas. El aviso volvía a salir como si nada. */
  guardar(o) {
    const previo = MIS.leer().find(x => x.token === o.token) || {};
    const l = MIS.leer().filter(x => x.token !== o.token);
    l.unshift({ ...previo, ...o });
    localStorage.setItem("patas_mis", JSON.stringify(l.slice(0, 30)));
  },
  parchar(token, cambios) {
    localStorage.setItem("patas_mis", JSON.stringify(
      MIS.leer().map(x => x.token === token ? { ...x, ...cambios } : x)));
  },
  quitar(token) {
    localStorage.setItem("patas_mis", JSON.stringify(MIS.leer().filter(x => x.token !== token)));
  }
};

/* ---------- AVISOS PUSH ----------
   Lo único que le suena a la persona sin que tenga que volver a entrar.

   Se pide el permiso JUSTO DESPUÉS de publicar, nunca al entrar a la página:
   ahí es cuando de verdad lo quiere, y el navegador solo deja preguntar una
   vez — si lo niega, no se le puede volver a pedir con un botón.

   Todo esto es opcional y falla en silencio: si el navegador no lo soporta
   (iPhone sin agregar a pantalla de inicio, navegadores viejos) o la persona
   dice que no, la página sigue funcionando igual que siempre. */

/* La función Edge que envía los avisos SE LLAMA "avisar" en la configuración
   de Supabase, pero al crearla desde el panel web, Supabase le asignó una ruta
   al azar ("clever-action") en vez de usar ese nombre — el campo "Name" que se
   ve ahí es solo una etiqueta para humanos, no decide la URL. Si algún día se
   vuelve a desplegar con un nombre real (por ejemplo con el CLI de Supabase:
   `supabase functions deploy avisar`), este es el único lugar que hay que
   actualizar. */
const RUTA_FUNCION_AVISOS = "clever-action";

const AVISOS = {
  // Los avisos exigen conexión segura. localhost cuenta como segura, y es lo
  // que permite probar todo esto en el computador antes de desplegar.
  soportado: () => "serviceWorker" in navigator && "PushManager" in window &&
                   "Notification" in window &&
                   (location.protocol === "https:" || location.hostname === "localhost"),

  yaDecidio: () => "Notification" in window && Notification.permission !== "default",
  concedido: () => "Notification" in window && Notification.permission === "granted",

  /* Por qué no se pueden activar aquí — para mostrarlo, no para adivinar en
     silencio. El caso más común con esta audiencia es iPhone sin instalar:
     Safari solo expone PushManager cuando la página está agregada a la
     pantalla de inicio, no en una pestaña normal. */
  motivoNoSoportado() {
    if (!("Notification" in window) || !("serviceWorker" in navigator))
      return "Este navegador no admite avisos. Prueba abriendo el enlace en Chrome o en el navegador que trae el teléfono.";
    if (location.protocol !== "https:" && location.hostname !== "localhost")
      return "Los avisos necesitan que la página esté publicada con conexión segura.";
    if (!("PushManager" in window)) {
      const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      return esIOS
        ? "En iPhone, los avisos solo funcionan si agregas esta página a la pantalla de inicio: toca Compartir → Añadir a pantalla de inicio, y ábrela desde ahí."
        : "Este navegador no admite avisos. Si abriste el enlace desde WhatsApp o Instagram, prueba abriéndolo en Chrome.";
    }
    return "Este navegador no admite avisos.";
  },

  /* La clave pública del servidor de avisos. La pedimos a la función Edge en
     vez de escribirla en config.js para que no haya un dato más que copiar a
     mano al montar el proyecto. Se guarda para no volver a pedirla. */
  async clavePublica() {
    const guardada = localStorage.getItem("patas_vapid");
    if (guardada) return guardada;
    const r = await fetch(`${API}/functions/v1/${RUTA_FUNCION_AVISOS}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
    });
    const d = await r.json();
    if (!d.clave) throw new Error("El servidor de avisos no está configurado");
    localStorage.setItem("patas_vapid", d.clave);
    return d.clave;
  },

  // El navegador exige la clave como bytes, no como texto
  aBytes(base64) {
    const relleno = "=".repeat((4 - base64.length % 4) % 4);
    const limpio = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
    const crudo = atob(limpio);
    return Uint8Array.from([...crudo].map(c => c.charCodeAt(0)));
  },

  async activar(token) {
    if (!AVISOS.soportado()) throw new Error("Este navegador no puede mostrar avisos");
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") throw new Error("No diste permiso para los avisos");

    const registro = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const clave = await AVISOS.clavePublica();
    const suscripcion = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: AVISOS.aBytes(clave)
    });

    const ok = await rpc("guardar_suscripcion", {
      p_token: token, p_suscripcion: suscripcion.toJSON()
    });
    if (!ok) throw new Error("No se pudo guardar el aviso");
    return true;
  },

  /* Le pide al servidor que avise a los dueños de las coincidencias fuertes.
     Lo llama quien acaba de publicar un hallazgo: es el único momento en que
     el servidor lo acepta. Si algo falla, no pasa nada — la publicación ya
     está hecha y las coincidencias ya se ven en pantalla. */
  async avisarCoincidencias(token, codigos) {
    if (!codigos.length) return { enviados: 0 };
    try {
      const r = await fetch(`${API}/functions/v1/${RUTA_FUNCION_AVISOS}`, {
        method: "POST",
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ token, codigos })
      });
      return await r.json();
    } catch { return { enviados: 0 }; }
  }
};

/* ============================================================
   3. ACCESO A DATOS
   ============================================================ */
async function rest(ruta, opciones = {}) {
  if (!CONFIGURADO) throw new Error("SIN_CONFIGURAR");
  const r = await fetch(`${API}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json", ...(opciones.headers || {})
    }
  });
  if (!r.ok) {
    let detalle = ""; try { detalle = (JSON.parse(await r.text()).message) || ""; } catch { }
    throw new Error(detalle || `Error ${r.status}`);
  }
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const rpc = (fn, args = {}) => rest(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

async function subirFoto(blob) {
  const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const r = await fetch(`${API}/storage/v1/object/fotos/${nombre}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "image/jpeg" },
    body: blob
  });
  if (!r.ok) throw new Error("No se pudo subir la foto");
  return `${API}/storage/v1/object/public/fotos/${nombre}`;
}

/* Reduce la foto en el navegador: en zona de desastre la conexión es mala
   y una foto de 8 MB significa un formulario abandonado. */
function comprimir(archivo, max = 1400, calidad = 0.82) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const e = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * e); c.height = Math.round(img.height * e);
      const x = c.getContext("2d");
      x.imageSmoothingQuality = "high";
      x.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => b ? res(b) : rej(new Error("Error al procesar la foto")), "image/jpeg", calidad);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => rej(new Error("No pudimos leer esa imagen"));
    img.src = URL.createObjectURL(archivo);
  });
}

/* ============================================================
   4. UBICACIÓN
   ============================================================ */
const municipiosDe = dep => (GEO.find(g => g.d === dep) || {}).m || [];
const centroDe = dep => (GEO.find(g => g.d === dep) || {}).c || [4.6, -74.1];

let leafletCargando = null;
function cargarLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletCargando) return leafletCargando;
  leafletCargando = new Promise(res => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => res(window.L);
    s.onerror = () => res(null);
    document.head.appendChild(s);
  });
  return leafletCargando;
}

async function geocodificar(texto) {
  try {
    const r = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=co&q="
      + encodeURIComponent(texto), { headers: { "Accept-Language": "es" } });
    const d = await r.json();
    if (d && d[0]) return { lat: +d[0].lat, lng: +d[0].lon };
  } catch { }
  return null;
}

async function geocodificarInverso(lat, lng) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=12&lat=${lat}&lon=${lng}`,
      { headers: { "Accept-Language": "es" } });
    const d = await r.json();
    const a = d.address || {};
    return {
      municipio: a.city || a.town || a.village || a.municipality || null,
      departamento: a.state || null,
      barrio: a.suburb || a.neighbourhood || a.hamlet || null
    };
  } catch { return null; }
}

/* Selector de ubicación: departamento, municipio, mapa arrastrable y GPS.
   El punto del mapa es lo que de verdad usa el cruce. */
function SelectorUbicacion(estado, opciones = {}) {
  const etiqueta = opciones.etiqueta || "¿Dónde fue?";
  const ayuda = opciones.ayuda ||
    "Marca el punto en el mapa lo más preciso que puedas. Es lo que usamos para cruzar reportes cercanos.";

  const html = `
    <fieldset class="bloque">
      <legend class="bloque__titulo">${esc(etiqueta)}</legend>
      <p class="campo__ayuda">${esc(ayuda)}</p>

      <div class="filtros__fila">
        <select id="u-dep" aria-label="Departamento">
          <option value="">Departamento…</option>
          ${GEO.map(g => `<option ${estado.departamento === g.d ? "selected" : ""}>${esc(g.d)}</option>`).join("")}
        </select>
        <select id="u-mun" aria-label="Municipio"><option value="">Municipio…</option></select>
      </div>

      <div class="campo" style="margin:12px 0 10px">
        <input type="text" id="u-barrio" maxlength="80"
          placeholder="Barrio o punto de referencia (ej: Palogrande, cerca de la 23)"
          value="${esc(estado.lugar || "")}">
      </div>

      <div id="u-mapa" class="mapa" role="application" aria-label="Mapa para marcar la ubicación"></div>
      <div class="mapa__pie">
        <button type="button" class="boton boton--claro boton--compacto" id="u-gps">Usar mi ubicación</button>
        <span id="u-estado" class="mapa__estado">Sin punto marcado</span>
      </div>
    </fieldset>`;

  const conectar = async () => {
    const dep = $("#u-dep"), mun = $("#u-mun"), barrio = $("#u-barrio"),
      info = $("#u-estado"), caja = $("#u-mapa");

    const pintarMunicipios = () => {
      const lista = municipiosDe(dep.value);
      mun.innerHTML = `<option value="">Municipio…</option>` +
        lista.map(m => `<option ${estado.municipio === m ? "selected" : ""}>${esc(m)}</option>`).join("");
      mun.disabled = !lista.length;
    };
    pintarMunicipios();

    const L = await cargarLeaflet();
    let mapa = null, marca = null;

    const describir = () => {
      if (estado.lat == null) { info.textContent = "Sin punto marcado"; info.className = "mapa__estado"; return; }
      info.innerHTML = estado.precision === "exacta"
        ? `<strong>Punto exacto marcado.</strong> Así el cruce por cercanía funciona bien.`
        : `Punto aproximado. Arrástralo al sitio exacto si puedes.`;
      info.className = "mapa__estado " + (estado.precision === "exacta" ? "mapa__estado--bien" : "");
    };

    const mover = (lat, lng, precision, zoom) => {
      estado.lat = +lat.toFixed(6); estado.lng = +lng.toFixed(6);
      estado.precision = precision;
      if (mapa) {
        mapa.setView([lat, lng], zoom || mapa.getZoom());
        if (marca) marca.setLatLng([lat, lng]);
      }
      describir();
      if (opciones.alCambiar) opciones.alCambiar(estado);
    };

    if (L) {
      const inicio = estado.lat != null ? [estado.lat, estado.lng] : centroDe(dep.value || "Bogotá D.C.");
      mapa = L.map(caja, { scrollWheelZoom: false })
        .setView(inicio, estado.lat != null ? 16 : (dep.value ? 9 : 5));
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "&copy; OpenStreetMap"
      }).addTo(mapa);

      marca = L.marker(inicio, { draggable: true }).addTo(mapa);
      if (estado.lat == null) marca.setOpacity(0.35);

      marca.on("dragend", () => {
        const p = marca.getLatLng();
        marca.setOpacity(1);
        mover(p.lat, p.lng, "exacta");
      });
      mapa.on("click", e => { marca.setOpacity(1); mover(e.latlng.lat, e.latlng.lng, "exacta"); });
      setTimeout(() => mapa.invalidateSize(), 220);
    } else {
      caja.innerHTML = `<div class="mapa__falla">No se pudo cargar el mapa.
        Usa el botón de ubicación o describe bien el barrio: seguimos funcionando.</div>`;
    }

    dep.addEventListener("change", async () => {
      estado.departamento = dep.value; estado.municipio = "";
      pintarMunicipios();
      if (mapa && dep.value) mapa.setView(centroDe(dep.value), 9);
    });

    mun.addEventListener("change", async () => {
      estado.municipio = mun.value;
      if (!mun.value) return;
      info.textContent = "Ubicando el municipio…";
      const p = await geocodificar(`${mun.value}, ${dep.value}, Colombia`);
      if (p) { if (marca) marca.setOpacity(1); mover(p.lat, p.lng, "aproximada", 13); }
      else { describir(); }
    });

    barrio.addEventListener("input", () => { estado.lugar = barrio.value.trim(); });

    barrio.addEventListener("change", async () => {
      if (!barrio.value.trim() || !mun.value || estado.precision === "exacta") return;
      const p = await geocodificar(`${barrio.value}, ${mun.value}, ${dep.value}, Colombia`);
      if (p) { if (marca) marca.setOpacity(1); mover(p.lat, p.lng, "aproximada", 15); }
    });

    $("#u-gps").addEventListener("click", () => {
      if (!navigator.geolocation) { info.textContent = "Tu navegador no comparte la ubicación."; return; }
      info.textContent = "Buscando tu ubicación…";
      navigator.geolocation.getCurrentPosition(async p => {
        if (marca) marca.setOpacity(1);
        mover(p.coords.latitude, p.coords.longitude, "exacta", 16);
        const dir = await geocodificarInverso(p.coords.latitude, p.coords.longitude);
        if (dir) {
          const depEncontrado = GEO.find(g =>
            g.d.toLowerCase().includes((dir.departamento || "~").toLowerCase().replace(" department", "")) ||
            (dir.departamento || "").toLowerCase().includes(g.d.toLowerCase()));
          if (depEncontrado) {
            dep.value = depEncontrado.d; estado.departamento = depEncontrado.d; pintarMunicipios();
            const muni = municipiosDe(depEncontrado.d)
              .find(m => m.toLowerCase() === (dir.municipio || "").toLowerCase());
            if (muni) { mun.value = muni; estado.municipio = muni; }
          }
          if (dir.barrio && !barrio.value) { barrio.value = dir.barrio; estado.lugar = dir.barrio; }
        }
      }, err => {
        info.textContent = err.code === 1
          ? "Diste permiso denegado. Marca el punto en el mapa con el dedo."
          : "No pudimos obtener tu ubicación. Marca el punto en el mapa.";
      }, { enableHighAccuracy: true, timeout: 10000 });
    });

    describir();
  };

  return { html, conectar };
}

/* ============================================================
   5. CRUCE DE REPORTES
   ============================================================ */

/* Parecido entre dos etiquetas de color, comparando componentes visuales.
   Mezcla dos medidas: cuánto se solapan en total, y cuánto está la más simple
   contenida en la más compleja. Así "manchado" y "negro" se parecen bastante,
   porque un animal manchado ES en parte negro. */
function parecidoColor(a, b) {
  if (a === b) return 1;
  const ca = (MAPA_COLOR[a] || {}).comp || [a];
  const cb = (MAPA_COLOR[b] || {}).comp || [b];
  const comunes = ca.filter(x => cb.includes(x)).length;
  if (!comunes) return 0;
  const solape = comunes / new Set([...ca, ...cb]).size;
  const contenido = comunes / Math.min(ca.length, cb.length);
  return (solape + contenido) / 2;
}

/* Parecido entre dos paletas: cada color busca su mejor pareja, en ambos sentidos. */
function parecidoPaleta(A = [], B = []) {
  if (!A.length || !B.length) return null;
  const mejor = (lista, otra) =>
    lista.reduce((s, x) => s + Math.max(...otra.map(y => parecidoColor(x, y))), 0) / lista.length;
  return (mejor(A, B) + mejor(B, A)) / 2;
}

/* Puntúa qué tanto se parecen un reporte de pérdida y uno de hallazgo.

   No sumamos puntos sueltos: cada señal se normaliza entre 0 y 1 y se promedia
   ponderada solo entre las señales que existen. Un reporte al que le faltan
   datos no queda castigado por lo que no dijo, solo se decide con menos
   evidencia. Al final aplicamos penalizaciones por contradicciones directas.

   Es simétrico: puntuar(a,b) === puntuar(b,a). */
/* Compara textos escritos a mano: ignora mayúsculas, espacios sobrantes y
   tildes. Sin esto "Pastor Alemán" y "pastor aleman" contaban como razas
   distintas, y la mitad de la gente escribe sin tildes en el celular. */
const normalizarTexto = s => String(s || "").trim().toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "");

/* ---------- TOLERANCIA A ERRORES DE TECLEO ----------
   En vez de armar un diccionario de sinónimos para adivinar lo que alguien
   quiso escribir, esto resuelve el problema real que sí se puede resolver sin
   adivinar significados: los errores de tecleo. "azul" y "asul", "collar" y
   "collr" son la MISMA palabra con una letra de más, de menos o cambiada —
   eso se mide, no se interpreta.

   La tolerancia crece con el largo de la palabra: en una palabra de 4 letras
   una sola letra distinta puede ser una palabra totalmente distinta ("pata" /
   "bata"), así que ahí no se arriesga nada. En una palabra de 8 letras o más,
   una letra de diferencia case siempre es un error de tecleo real. */
function distanciaEdicion(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;   // ni vale la pena calcular
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let arriba = fila[0]; fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const diag = arriba;
      arriba = fila[j];
      fila[j] = a[i - 1] === b[j - 1] ? diag : 1 + Math.min(diag, arriba, fila[j - 1]);
    }
  }
  return fila[b.length];
}

function tipeoParecido(a, b) {
  if (a === b) return true;
  /* Los nombres de color NUNCA se comparan por tecleo aquí: "dorado" y
     "morado" quedan a una sola letra de distancia y son colores reales
     distintos, no un error al escribir. Para colores hay un sistema propio
     más abajo (familias visuales) que sí entiende el significado en vez de
     solo contar letras. PALABRAS_DE_COLOR se define después en este archivo,
     pero para cuando esta función se LLAME por primera vez ya existe. */
  if (typeof PALABRAS_DE_COLOR !== "undefined" && PALABRAS_DE_COLOR.has(a) && PALABRAS_DE_COLOR.has(b)) return false;
  const corta = Math.min(a.length, b.length);
  if (corta < 4) return false;                          // palabras muy cortas: no se arriesga
  return distanciaEdicion(a, b) <= (corta >= 8 ? 2 : 1);
}

/* El collar es el dato más identificador que un desconocido SÍ puede ver:
   "azul con placa" es casi una identificación única. Se compara por palabras
   sueltas porque nadie lo describe igual ("collar rojo" vs "rojo con placa").

   Regla clave: si solo UNO de los dos menciona collar, esto no cuenta como
   señal y no castiga. Los collares se caen, o quien recoge al animal se lo
   quita antes de reportarlo — penalizarlo perdería reencuentros reales. */
const PALABRAS_VACIAS_COLLAR = new Set(["collar", "con", "sin", "de", "del", "la",
  "el", "los", "las", "un", "una", "unos", "unas", "que", "por", "para", "creo",
  "tenia", "llevaba", "puesto", "puesta", "color", "algo", "como", "pero"]);

/* Las "señas particulares" son texto libre y son lo más identificador que
   escribe la gente: "mancha blanca en el pecho", "le falta la cola", "cojea".
   Dos personas nunca las escriben igual, así que buscamos palabras compartidas.

   Dos reglas hacen que esto sea seguro:

   1) SOLO SUMA, NUNCA RESTA. Si no hay ninguna palabra en común, la señal ni
      siquiera participa. Es indispensable: quien encuentra al animal muchas
      veces describe otra cosa ("estaba asustado y con hambre") aunque sea la
      misma mascota, y eso no puede contar como contradicción.

   2) Se ignoran las palabras que no distinguen a un animal de otro: artículos,
      verbos comunes, y a propósito TAMBIÉN los colores y los tamaños — esos ya
      se puntúan en sus propias señales, y contarlos aquí otra vez sería
      cobrarlos dos veces. */
const PALABRAS_VACIAS_RASGOS = new Set([
  // relleno del idioma
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "en", "con",
  "sin", "por", "para", "que", "se", "su", "sus", "es", "esta", "este", "ese", "esa",
  "muy", "mas", "pero", "como", "cuando", "donde", "tiene", "tenia", "lleva",
  "llevaba", "era", "fue", "esta", "estaba", "todo", "toda", "bien", "mal", "casi",
  "algo", "poco", "solo", "sola", "tambien", "siempre", "ademas", "hacia", "desde",
  // palabras que describen a cualquier mascota, no a esta
  "perro", "perra", "gato", "gata", "animal", "mascota", "cachorro", "cachorra",
  "macho", "hembra", "pequeno", "mediano", "grande", "chiquito", "chiquita",
  "asustado", "asustada", "sano", "sana", "herido", "herida", "bonito", "bonita",
  "lindo", "linda", "hermoso", "hermosa", "manso", "mansa", "nervioso", "nerviosa",
  "calle", "casa", "sucio", "sucia", "flaco", "flaca", "gordo", "gorda", "viejo",
  "vieja", "joven", "adulto", "pelo", "cuerpo", "parece", "creo",
  // colores y tamaños: ya tienen su propia señal, contarlos aquí sería doble cobro
  "negro", "negra", "blanco", "blanca", "gris", "cafe", "canela", "dorado", "dorada",
  "crema", "naranja", "atigrado", "atigrada", "manchado", "manchada", "tricolor",
  "marron", "amarillo", "amarilla", "beige", "claro", "clara", "oscuro", "oscura"
]);

function palabrasDeRasgos(texto) {
  return new Set(normalizarTexto(texto).split(/[^a-z0-9]+/)
    .map(p => p.length > 4 && p.endsWith("s") ? p.slice(0, -1) : p)  // manchas → mancha
    .filter(p => p.length > 3 && !PALABRAS_VACIAS_RASGOS.has(p)));
}

// Tolera errores de tecleo en las palabras compartidas ("mancha"/"mansha").
function contarComunes(A, B) {
  let comunes = 0;
  for (const p of A) for (const q of B) if (tipeoParecido(p, q)) { comunes++; break; }
  return comunes;
}

function parecidoRasgos(a, b) {
  const A = palabrasDeRasgos(a), B = palabrasDeRasgos(b);
  if (!A.size || !B.size) return null;
  const comunes = contarComunes(A, B);
  if (comunes === 0) return null;   // sin nada en común la señal no participa
  return comunes >= 2 ? 1 : 0.7;    // una palabra es indicio; dos o más ya es mucha casualidad
}

/* Palabras que confirman "sí había collar" sin describirlo ("sí", "llevaba",
   "tenía"). No es un diccionario de sinónimos general — es un vocabulario
   CERRADO para una sola pregunta de sí/no, que es justamente donde los
   sinónimos son seguros de usar: no hay ambigüedad de a qué se refieren. */
const PALABRAS_SI_COLLAR = new Set(["si", "llevaba", "llevava", "tenia", "claro",
  "efectivamente", "obvio", "correcto", "asi", "seguro"]);
const PALABRAS_NO_COLLAR = new Set(["no", "nunca", "jamas"]);

function indicaCollar(texto) {
  const palabras = normalizarTexto(texto).split(/[^a-z0-9]+/).filter(Boolean);
  const si = palabras.some(p => PALABRAS_SI_COLLAR.has(p));
  const no = palabras.some(p => PALABRAS_NO_COLLAR.has(p));
  return si && !no;   // "no tenía" no cuenta como afirmación aunque contenga "tenía"
}

/* Colores de COLLAR, no de pelaje: un collar sí puede ser azul o morado,
   colores que no existen en la paleta de animales (COLORES, arriba) y que a
   propósito no se agregaron ahí. Aquí sirven para que "azul" y "morado" —
   fáciles de confundir a simple vista o con mala luz — den más crédito que
   dos palabras cualquiera sin nada que ver. */
const FAMILIAS_COLOR_COLLAR = [
  ["azul", "celeste", "turquesa", "morado", "violeta", "lila", "purpura"],
  ["rojo", "rosado", "rosa", "fucsia", "vinotinto", "guinda"],
  ["verde", "oliva", "esmeralda"],
  ["negro", "gris", "plateado", "plomo"],
  ["cafe", "marron", "beige", "dorado", "amarillo", "naranja", "mostaza"],
  ["blanco", "crema", "hueso"]
];
const MAPA_FAMILIA_COLLAR = new Map(
  FAMILIAS_COLOR_COLLAR.flatMap((familia, i) => familia.map(palabra => [palabra, i])));

// Usado por tipeoParecido() para que los colores nunca se confundan por
// tecleo entre sí (ver el comentario de esa función).
const PALABRAS_DE_COLOR = new Set([...Object.keys(MAPA_COLOR), ...MAPA_FAMILIA_COLLAR.keys()]);

function palabrasDeCollar(texto) {
  return new Set(normalizarTexto(texto).split(/[^a-z0-9]+/)
    .filter(p => p.length > 2 && !PALABRAS_VACIAS_COLLAR.has(p)));
}

function parecidoCollar(a, b) {
  const A = palabrasDeCollar(a), B = palabrasDeCollar(b);

  if (A.size && B.size) {
    for (const p of A) for (const q of B) if (tipeoParecido(p, q)) return 1;
    for (const p of A) for (const q of B) {
      const fp = MAPA_FAMILIA_COLLAR.get(p), fq = MAPA_FAMILIA_COLLAR.get(q);
      if (fp != null && fp === fq) return 0.65;   // misma familia de color, palabra distinta
    }
    return 0.35;   // ambos describieron algo, pero nada en común
  }

  /* Uno de los dos (o ambos) no describió nada concreto. Si de todas formas
     confirmó con palabras que sí había collar, es un indicio débil — mejor
     que nada, porque la mayoría de animales callejeros NO llevan collar, así
     que coincidir en que sí había uno ya dice algo. */
  const confirmaA = A.size > 0 || indicaCollar(a);
  const confirmaB = B.size > 0 || indicaCollar(b);
  if (confirmaA && confirmaB) return 0.2;

  return null;   // uno escribió puro relleno: no hay señal
}

function puntuar(base, cand) {
  // Especie: filtro duro, salvo que alguno se haya reportado como "Otro"
  if (base.especie !== cand.especie &&
      base.especie !== "Otro" && cand.especie !== "Otro") return { total: 0 };

  const fb = new Date(base.fecha + "T12:00:00"), fc = new Date(cand.fecha + "T12:00:00");
  const perdida = base.tipo === "perdida" ? fb : fc;
  const hallazgo = base.tipo === "perdida" ? fc : fb;
  const diasEntre = (hallazgo - perdida) / 86400000;

  // Nadie encuentra a un animal antes de que se pierda (2 días de margen por errores al reportar)
  if (diasEntre < -2) return { total: 0 };

  const razones = [];
  const senales = [];              // [peso, valor 0..1]

  /* Los castigos NO se multiplican entre sí: se aplica solo el más fuerte.
     Cada contradicción ya baja el promedio por su cuenta al meter una señal
     en 0, así que multiplicar además los castigos cobraba dos veces el mismo
     error y los acumulaba. Un reporte llenado de afán con tres campos
     equivocados, pero con el animal encontrado en el mismo punto y el mismo
     día, caía a 20 puntos y desaparecía de la lista — justo el caso que el
     producto tiene que tolerar. */
  const castigos = [];

  // --- Geografía: el radio se abre con los días, porque los animales caminan
  const km = distanciaKm(base.lat, base.lng, cand.lat, cand.lng);
  const radio = Math.min(3 + Math.max(0, diasEntre) * 1.5, 25);

  if (km != null) {
    /* SIN tope duro por distancia. Antes existía uno ("si km > radio*2.5 o
       60, total 0"), y se quitó a propósito: un animal con TODAS las demás
       señales exactamente iguales no debe desaparecer solo porque quedó
       lejos — a un animal lo pueden mover en carro decenas de kilómetros, y
       en un desastre eso es lo normal. Pasado el radio la señal de cercanía
       ya vale 0 por su cuenta (Math.max(0, ...) más abajo), así que un
       candidato lejano solo puede puntuar alto si TODO lo demás coincide —
       que es exactamente cuando hay que mostrarlo.

       Esto no abre la puerta a comparar contra el país entero: el candidato
       ya tuvo que pasar el recuadro geográfico de la consulta a Supabase
       (buscarCoincidencias) para llegar hasta aquí. Ese recuadro sigue
       siendo el límite real, por ancho de banda — este archivo solo deja de
       castigar dos veces lo que ya limitó la consulta. */
    senales.push([40, Math.max(0, 1 - km / radio)]);
    razones.push(distanciaTexto(km) + " de distancia");
  } else if (base.municipio && cand.municipio && base.municipio === cand.municipio) {
    senales.push([40, 0.45]);
    razones.push("mismo municipio");
  } else {
    // sin ninguna prueba de cercanía la coincidencia es mucho más débil
    senales.push([40, base.departamento && base.departamento === cand.departamento ? 0.12 : 0]);
    castigos.push(0.75);
  }

  // --- Tamaño: mucha gente lo estima mal, así que un escalón casi no castiga
  const ta = ORDEN_TAMANO[base.tamano], tb = ORDEN_TAMANO[cand.tamano];
  if (ta != null && tb != null) {
    const d = Math.abs(ta - tb);
    senales.push([18, d === 0 ? 1 : d === 1 ? 0.45 : 0]);
    if (d === 0) razones.push("mismo tamaño");
    if (d === 2) castigos.push(0.65);
  }

  // --- Color
  const col = parecidoPaleta(base.colores, cand.colores);
  if (col != null) {
    senales.push([26, col]);
    if (col >= 0.85) razones.push("colores iguales");
    else if (col >= 0.45) razones.push("colores parecidos");
    if (col < 0.15) castigos.push(0.6);
  }

  // --- Detalles
  /* Edad: se trata como el tamaño, en escalones y con tolerancia. Un escalón de
     diferencia casi no castiga porque nadie acierta la edad de un animal ajeno
     a ojo, pero cachorro contra viejito sí es una contradicción de verdad.
     El campo se pedía desde el principio y no entraba al cruce: era el único
     dato que la gente llenaba sin que sirviera para nada. */
  const ea = ORDEN_EDAD[base.edad_aprox], eb = ORDEN_EDAD[cand.edad_aprox];
  if (ea != null && eb != null) {
    const d = Math.abs(ea - eb);
    senales.push([10, d === 0 ? 1 : d === 1 ? 0.5 : 0]);
    if (d >= 3) castigos.push(0.75);      // cachorro contra viejito
  }

  if (base.pelo && cand.pelo) senales.push([8, base.pelo === cand.pelo ? 1 : 0.15]);
  if (base.sexo && cand.sexo && base.sexo !== "No sé" && cand.sexo !== "No sé") {
    const igual = base.sexo === cand.sexo;
    senales.push([8, igual ? 1 : 0]);
    if (!igual) castigos.push(0.7);
  }
  if (base.raza && cand.raza) {
    // tipeoParecido además de la igualdad exacta: "labrador"/"labrdor" no
    // debería contar como razas distintas por una letra que falta
    const igual = tipeoParecido(normalizarTexto(base.raza), normalizarTexto(cand.raza));
    senales.push([10, igual ? 1 : 0.3]);
    if (igual) razones.push("misma raza");
  }
  if (base.collar && cand.collar) {
    const c = parecidoCollar(base.collar, cand.collar);
    if (c != null) {
      senales.push([14, c]);
      if (c === 1) razones.push("collar parecido");
    }
  }
  if (base.rasgos && cand.rasgos) {
    const r = parecidoRasgos(base.rasgos, cand.rasgos);
    if (r != null) {           // null = sin palabras en común: no participa, no castiga
      senales.push([12, r]);
      razones.push(r === 1 ? "las señas coinciden" : "una seña coincide");
    }
  }

  const peso = senales.reduce((a, [w]) => a + w, 0);
  const suma = senales.reduce((a, [w, v]) => a + w * v, 0);
  const castigo = castigos.length ? Math.min(...castigos) : 1;
  const total = Math.round(Math.max(0, Math.min(100, (suma / peso) * 100 * castigo)));

  return { total, razones, km, dias: diasEntre };
}

const banda = n => n >= 72 ? { k: "alta", t: "Muy parecido" }
  : n >= 48 ? { k: "media", t: "Podría ser" }
    : { k: "baja", t: "Poco probable" };

/* ============================================================
   REPORTES DUPLICADOS DEL MISMO HALLAZGO
   Cuando un animal callejero anda suelto, no es raro que varias personas lo
   encuentren por separado y publiquen cada una su propia ficha del MISMO
   animal. Sin nada que lo evite, esa mascota queda fragmentada en 3 o 4
   publicaciones distintas en vez de una sola con varios testigos — y peor,
   compitiendo entre sí por la atención del dueño.

   Esto NO reutiliza puntuar(): esa función asume una pérdida y un hallazgo,
   y decide el orden de las fechas a partir de eso ("nadie encuentra antes de
   perder"). Aquí ambos reportes son "encontrada" — no hay una fecha que deba
   ser posterior a la otra, sino dos AVISTAMIENTOS que deberían estar cerca en
   tiempo y espacio. Es un problema distinto, así que tiene su propia función
   más simple, sin la maquinaria de castigos de puntuar(). */
function puntuarDuplicado(a, b) {
  if (a.especie !== b.especie && a.especie !== "Otro" && b.especie !== "Otro") return 0;

  const dias = Math.abs((new Date(a.fecha + "T12:00:00") - new Date(b.fecha + "T12:00:00")) / 86400000);
  if (dias > 5) return 0;   // avistamientos tan separados en el tiempo: probablemente otro animal

  const km = distanciaKm(a.lat, a.lng, b.lat, b.lng);
  if (km != null) {
    if (km > 5) return 0;   // esto es para el MISMO avistamiento, no para "cerca de la ciudad"
  } else if (!(a.municipio && b.municipio && a.municipio === b.municipio)) {
    return 0;                // sin coordenadas ni municipio en común, no hay base para sugerirlo
  }

  /* Mismo punto y mismo día YA dan un piso alto por sí solos (dos animales
     cualquiera reportados en la misma calle el mismo día no son tan raros).
     Sin un castigo, ese piso casi alcanza el umbral aunque el color sea
     completamente distinto. Igual que en puntuar(): un castigo por
     contradicción fuerte, no multiplicado, el más severo se queda. */
  const castigos = [];
  const senales = [];
  if (km != null) senales.push([30, Math.max(0, 1 - km / 5)]);
  else senales.push([30, 0.5]);
  senales.push([15, Math.max(0, 1 - dias / 5)]);

  const ta = ORDEN_TAMANO[a.tamano], tb = ORDEN_TAMANO[b.tamano];
  if (ta != null && tb != null) {
    const d = Math.abs(ta - tb);
    senales.push([15, d === 0 ? 1 : d === 1 ? 0.4 : 0]);
    if (d === 2) castigos.push(0.5);   // Pequeño contra Grande: contradicción real
  }

  const col = parecidoPaleta(a.colores, b.colores);
  if (col != null) {
    senales.push([20, col]);
    if (col < 0.15) castigos.push(0.3);   // colores sin ninguna familia en común
  }

  if (a.collar && b.collar) {
    const c = parecidoCollar(a.collar, b.collar);
    if (c != null) senales.push([10, c]);
  }
  if (a.rasgos && b.rasgos) {
    const r = parecidoRasgos(a.rasgos, b.rasgos);
    if (r != null) senales.push([10, r]);
  }
  if (a.raza && b.raza) {
    senales.push([8, tipeoParecido(normalizarTexto(a.raza), normalizarTexto(b.raza)) ? 1 : 0.3]);
  }

  const peso = senales.reduce((s, [w]) => s + w, 0);
  const suma = senales.reduce((s, [w, v]) => s + w * v, 0);
  const castigo = castigos.length ? Math.min(...castigos) : 1;
  return Math.round(Math.max(0, Math.min(100, (suma / peso) * 100 * castigo)));
}

/* Busca, entre los hallazgos ya publicados, si alguien más pudo haber
   reportado el MISMO animal que se está a punto de publicar. Se corre justo
   antes de crear la publicación, con una consulta acotada y barata (mismo
   municipio, últimos 5 días) — no es el cruce completo del país. */
async function buscarPosibleDuplicado(datos) {
  if (!datos.municipio && datos.lat == null) return null;
  try {
    const partes = [`tipo=eq.encontrada`, `estado=neq.resuelto`,
      `especie=in.(${encodeURIComponent(datos.especie)},Otro)`, `order=creado.desc`, `limit=60`];
    if (datos.municipio) partes.push(`municipio=eq.${encodeURIComponent(datos.municipio)}`);
    const candidatos = await rest(`mascotas_publicas?${partes.join("&")}`);
    let mejor = null, mejorPuntaje = 0;
    for (const c of candidatos) {
      const p = puntuarDuplicado(datos, c);
      if (p > mejorPuntaje) { mejorPuntaje = p; mejor = c; }
    }
    return mejorPuntaje >= 60 ? { candidato: mejor, puntaje: mejorPuntaje } : null;
  } catch { return null; }   // si falla la consulta, no bloqueamos la publicación por esto
}

/* Trae candidatos del lado contrario. Filtra en el servidor por especie, tipo y
   recuadro geográfico para que funcione con el país entero cargado. */
/* El tope es 24, no 12. En una ciudad con muchos reportes activos la pareja
   verdadera puede quedar en el puesto 14 o 20 cuando quien la encontró llenó
   el formulario de afán: el puntaje alcanzaba, pero el corte la dejaba fuera.
   Medido en pruebas/adversario.test.js. Mostrar doce fichas más cuesta un
   scroll; perder la buena significa una mascota que no vuelve. */
/* Ya NO recorta a un top fijo. Antes tope=24 significaba que una coincidencia
   real, con puntaje suficiente, podía quedar oculta para siempre si otras 24
   fichas puntuaban apenas un poco más — eso se probó y pasaba de verdad (ver
   pruebas/adversario.test.js). Ahora devuelve TODO lo que pase el umbral,
   ordenado de más a menos parecido, y quien llama decide cuánto mostrar de
   una vez: la interfaz las va cargando por tandas a medida que se hace
   scroll (pintarCoincidenciasPaginadas, más abajo), en vez de esconder el
   resto. `tope` se deja como opción para quien de verdad necesite un límite
   (por ejemplo la función de avisos push, que solo usa las primeras). */
async function buscarCoincidencias(m, { minimo = 26, tope = Infinity } = {}) {
  const contrario = m.tipo === "perdida" ? "encontrada" : "perdida";
  const partes = [
    `tipo=eq.${contrario}`,
    `estado=neq.resuelto`,      // las caducadas SIGUEN buscándose: excluirlas perdería reencuentros
    `especie=in.(${encodeURIComponent(m.especie)},Otro)`,
    `order=fecha.desc`, `limit=800`
  ];

  if (m.lat != null && m.lng != null) {
    const grados = 60 / 111;    // ~60 km alrededor: cubre el radio máximo con margen
    partes.push(`lat=gte.${(m.lat - grados).toFixed(4)}`, `lat=lte.${(m.lat + grados).toFixed(4)}`,
      `lng=gte.${(m.lng - grados).toFixed(4)}`, `lng=lte.${(m.lng + grados).toFixed(4)}`);
  } else if (m.departamento) {
    partes.push(`departamento=eq.${encodeURIComponent(m.departamento)}`);
  }

  let filas = await rest(`mascotas_publicas?${partes.join("&")}`);

  /* Si el reporte tiene coordenadas, el recuadro deja fuera a quien publicó sin
     marcar el mapa. Los recuperamos por municipio para no perder coincidencias. */
  if (m.lat != null && m.municipio) {
    try {
      const sinPunto = await rest(`mascotas_publicas?tipo=eq.${contrario}&estado=neq.resuelto` +
        `&municipio=eq.${encodeURIComponent(m.municipio)}&lat=is.null&limit=200`);
      const vistos = new Set(filas.map(f => f.id));
      filas = filas.concat(sinPunto.filter(f => !vistos.has(f.id)));
    } catch { }
  }

  return filas
    .map(c => ({ ...c, ...puntuar(m, c) }))
    .filter(c => c.total >= minimo)
    .sort((a, b) => b.total - a.total)
    .slice(0, tope);
}

/* ---------- COINCIDENCIAS YA VISTAS ----------
   Quien está buscando a su mascota vuelve a entrar una y otra vez, y sin esto
   la lista se ve idéntica cada vez: no hay forma de notar que entró una ficha
   que se parece más que todas las anteriores. Guardamos en el teléfono qué
   coincidencias ya vio y con qué puntaje, y al volver le marcamos solo lo que
   cambió. Es lo más parecido a un aviso que se puede hacer sin servidor. */
function novedadesDeCruce(token, lista) {
  const vistas = (MIS.leer().find(x => x.token === token) || {}).coincidenciasVistas || {};
  const conocidas = Object.keys(vistas).length;

  const nuevas = lista.filter(c => vistas[c.codigo] == null);
  // "Subió" = la misma ficha ahora puntúa más porque alguien la corrigió o
  // completó datos. El margen de 4 evita avisar por ruido de redondeo.
  const subieron = lista.filter(c => vistas[c.codigo] != null && c.total > vistas[c.codigo] + 4);

  const mejorAntes = conocidas ? Math.max(...Object.values(vistas)) : -1;
  const mejorAhora = lista.length ? Math.max(...lista.map(c => c.total)) : -1;
  const mejorQueNunca = conocidas > 0 && mejorAhora > mejorAntes;

  return { nuevas, subieron, mejorAntes, mejorAhora, mejorQueNunca, primeraVez: conocidas === 0 };
}

function recordarCoincidenciasVistas(token, lista) {
  const coincidenciasVistas = {};
  for (const c of lista) coincidenciasVistas[c.codigo] = c.total;
  MIS.parchar(token, { coincidenciasVistas });
}

/* ============================================================
   6. PIEZAS DE INTERFAZ
   ============================================================ */
function grupoOpciones(nombre, lista, { multiple = false, valor = null } = {}) {
  const tipo = multiple ? "checkbox" : "radio";
  return `<div class="opciones">${lista.map(v => `
    <label class="opcion">
      <input type="${tipo}" name="${nombre}" value="${esc(v)}" ${valor === v ? "checked" : ""}>
      <span>${esc(v)}</span>
    </label>`).join("")}</div>`;
}

function grupoColores(valores = []) {
  return `<div class="colores">${COLORES.map(c => `
    <label class="opcion color">
      <input type="checkbox" name="colores" value="${c.k}" ${valores.includes(c.k) ? "checked" : ""}>
      <span><i style="background:${c.c}"></i>${c.n}</span>
    </label>`).join("")}</div>`;
}

const leerRadio = n => (document.querySelector(`input[name="${n}"]:checked`) || {}).value || null;
const leerChecks = n => $$(`input[name="${n}"]:checked`).map(i => i.value);

/* Hasta 3 fotos: más ángulos, más posibilidades de que alguien lo reconozca. */
function GaleriaCarga(estado, max = 3) {
  const html = `
    <div class="fotos">
      <div class="fotos__lista" id="f-lista"></div>
      <label class="foto-zona" id="f-zona">
        <b>Toca para agregar una foto</b>
        <span>Que se le vea la cara. Puedes poner hasta ${max}.</span>
        <input type="file" id="f-input" accept="image/*" multiple>
      </label>
    </div>`;

  const conectar = () => {
    const lista = $("#f-lista"), zona = $("#f-zona"), input = $("#f-input");

    const pintar = () => {
      lista.innerHTML = estado.fotos.map((f, i) => `
        <div class="fotos__item">
          <img src="${f.url}" alt="Foto ${i + 1}">
          ${i === 0 ? `<span class="fotos__principal">Principal</span>` : ""}
          <button type="button" class="fotos__quitar" data-i="${i}" aria-label="Quitar la foto ${i + 1}">✕</button>
        </div>`).join("");
      zona.hidden = estado.fotos.length >= max;
      $$(".fotos__quitar", lista).forEach(b => b.addEventListener("click", () => {
        estado.fotos.splice(+b.dataset.i, 1); pintar();
      }));
    };

    input.addEventListener("change", async () => {
      const archivos = [...input.files].slice(0, max - estado.fotos.length);
      input.value = "";
      for (const a of archivos) {
        try {
          brindis("Preparando la foto…", 1200);
          const blob = await comprimir(a);
          estado.fotos.push({ blob, url: URL.createObjectURL(blob) });
        } catch (e) { brindis(e.message); }
      }
      pintar();
    });
    pintar();
  };

  return { html, conectar };
}

function tarjeta(m, extra = {}) {
  const et = m.estado === "resuelto" ? ["resuelto", "En casa"]
    : m.tipo === "perdida" ? ["", "Se busca"] : ["encontrada", "Encontrada"];
  const foto = fotoPrincipal(m);
  return `<a class="tarjeta ${m.estado === "sin_confirmar" ? "tarjeta--apagada" : ""}" href="/m/${m.codigo}" data-ruta>
    <div class="tarjeta__foto" style="${foto ? `background-image:url('${esc(foto)}')` : ""}">
      <span class="tarjeta__etiqueta ${et[0] ? "tarjeta__etiqueta--" + et[0] : ""}">${et[1]}</span>
      ${fotosDe(m).length > 1 ? `<span class="tarjeta__fotos">${fotosDe(m).length} fotos</span>` : ""}
    </div>
    <div class="tarjeta__cuerpo">
      <p class="tarjeta__nombre">${esc(nombreMostrado(m))}</p>
      <p class="tarjeta__meta">${esc([m.especie, m.tamano].filter(Boolean).join(" · "))}</p>
      <p class="tarjeta__meta">${esc(m.lugar || m.municipio || "")}</p>
      <p class="tarjeta__meta tarjeta__meta--tenue">${haceCuanto(m.fecha)}${extra.km != null ? " · " + distanciaTexto(extra.km) : ""}</p>
    </div></a>`;
}

const rejilla = (filas, extras = {}) =>
  `<div class="rejilla">${filas.map(f => tarjeta(f, extras[f.id] || {})).join("")}</div>`;

function filaCoincidencia(c, marca = "") {
  const b = banda(c.total);
  const foto = fotoPrincipal(c);
  return `<a class="coincidencia ${marca ? "coincidencia--nueva" : ""}" href="/m/${c.codigo}" data-ruta>
    ${marca ? `<span class="cinta-nueva">${esc(marca)}</span>` : ""}
    ${/* Sin la condición, una ficha sin foto generaba <img src=""> y el
          navegador volvía a pedir la página entera y mostraba el ícono roto. */""}
    ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy">`
           : `<span class="coincidencia__sinfoto" aria-hidden="true">🐾</span>`}
    <div class="coincidencia__texto">
      <b>${esc(nombreMostrado(c))}</b>
      <span>${esc([c.tamano, (c.colores || []).map(colorNombre).join(" y ")].filter(Boolean).join(" · "))}</span>
      <span>${esc(c.lugar || c.municipio || "")} · ${haceCuanto(c.fecha)}</span>
      ${c.razones && c.razones.length ? `<span class="coincidencia__razones">${esc(c.razones.join(" · "))}</span>` : ""}
    </div>
    <span class="insignia insignia--${b.k}">${b.t}</span></a>`;
}

/* Pinta una lista de coincidencias por tandas, cargando más a medida que se
   hace scroll — sin límite fijo de cuántas mostrar, porque siempre puede
   haber una coincidencia real más abajo en la lista (buscarCoincidencias ya
   no recorta a un top fijo, ver el comentario ahí). Se muestran de a POR_TANDA
   para no pintar de una un DOM enorme en un celular de gama baja; el resto se
   agrega solo cuando la persona de verdad llega hasta ahí.

   `contenedor` es el nodo donde va la lista. `marcaDe(c)` es opcional: para
   ponerle una cinta ("Nueva", "Se parece más") a filas concretas. */
function pintarCoincidenciasPaginadas(contenedor, lista, marcaDe) {
  const POR_TANDA = 12;
  let mostrados = 0;

  const cuerpo = document.createElement("div");
  const centinela = document.createElement("div");
  centinela.className = "coincidencias__centinela";
  contenedor.appendChild(cuerpo);
  contenedor.appendChild(centinela);

  let observador = null;
  const siguienteTanda = () => {
    const tanda = lista.slice(mostrados, mostrados + POR_TANDA);
    if (!tanda.length) { observador?.disconnect(); centinela.remove(); return; }
    cuerpo.insertAdjacentHTML("beforeend",
      tanda.map(c => filaCoincidencia(c, marcaDe ? marcaDe(c) : "")).join(""));
    mostrados += tanda.length;
    if (mostrados >= lista.length) { observador?.disconnect(); centinela.remove(); }
  };

  siguienteTanda();   // la primera tanda se pinta de una, sin esperar a que se vea el centinela
  if (mostrados < lista.length) {
    observador = new IntersectionObserver(entradas => {
      if (entradas[0].isIntersecting) siguienteTanda();
    });
    observador.observe(centinela);
  }
}

function avisoSinConfigurar(nodo) {
  nodo.innerHTML = `<div class="aviso aviso--rojo">
    <strong>Falta conectar la base de datos.</strong> Abre <code>config.js</code> y pega la URL y la
    clave anónima de tu proyecto de Supabase. El paso a paso está en el README.</div>`;
}

/* Recordatorio en el calendario del propio celular.

   No tenemos servidor de avisos, y sin algo que salga de la página el dueño
   solo se acuerda de actualizar su publicación si vuelve a entrar por su
   cuenta. Un evento de calendario sí le suena en el teléfono el día indicado,
   no cuesta nada, no necesita permisos ni cuentas, y funciona igual en Android
   y en iPhone porque el formato .ics lo entienden los dos. */
function descargarRecordatorio(m, enlaceGestion, dias = 3) {
  const quien = m.nombre || (m.tipo === "perdida" ? "tu mascota" : "la mascota que encontraste");
  const cuando = new Date(Date.now() + dias * 86400000);
  cuando.setHours(19, 0, 0, 0);                       // 7 pm: hora en que la gente mira el celular
  const fin = new Date(cuando.getTime() + 15 * 60000);
  const marca = f => f.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const limpiar = t => String(t).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

  const titulo = m.tipo === "perdida" ? `¿Ya apareció ${quien}?` : `¿${quien} volvió con su familia?`;
  const detalle = `Si ya está en casa, márcalo aquí para que la publicación deje de aparecer ` +
    `en las búsquedas y no le haga perder tiempo a quien quiere ayudar:\n${enlaceGestion}`;

  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Patas de vuelta//ES", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:patas-${m.codigo}-${Date.now()}@patasdevuelta`,
    `DTSTAMP:${marca(new Date())}`,
    `DTSTART:${marca(cuando)}`,
    `DTEND:${marca(fin)}`,
    `SUMMARY:${limpiar(titulo)}`,
    `DESCRIPTION:${limpiar(detalle)}`,
    `URL:${limpiar(enlaceGestion)}`,
    "BEGIN:VALARM", "TRIGGER:-PT0M", "ACTION:DISPLAY",
    `DESCRIPTION:${limpiar(titulo)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"
  ].join("\r\n");                                      // el formato .ics exige CRLF

  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = `recordatorio-${m.codigo}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  brindis(`Listo. Tu celular te va a preguntar en ${dias} días.`, 5000);
}

/* ============================================================
   7. VISTAS
   ============================================================ */

async function vistaPortada() {
  main.innerHTML = `
    <h1 class="portada__titulo">Se perdió.
      <span class="marca-texto">Vamos a devolverlo a casa.</span></h1>
    <p class="portada__bajada">Publica a tu mascota o reporta una que encontraste.
      Cruzamos los dos lados por cercanía y características, y te mostramos lo que coincide.</p>

    <div class="acciones">
      <a class="accion accion--perdida" href="/reportar/perdida" data-ruta>
        <b>Perdí a mi mascota</b>
        <span>Publica su ficha y genera un afiche para compartir.</span>
      </a>
      <a class="accion accion--encontrada" href="/reportar/encontrada" data-ruta>
        <b>Me encontré una mascota</b>
        <span>La foto y dónde fue. Menos de un minuto.</span>
      </a>
    </div>

    <div class="cifras" id="cifras"></div>
    <div id="recordatorio"></div>
    <div id="mias"></div>

    <h2 class="seccion__titulo">Reportes recientes</h2>
    <div id="recientes"><p class="cargando">Cargando…</p></div>
    <p style="margin-top:18px"><a href="/buscar" data-ruta class="enlace-fuerte">Ver todos y filtrar →</a></p>

    <h2 class="seccion__titulo">Cómo funciona</h2>
    <p class="parrafo">La diferencia con un grupo de redes sociales es que aquí los dos lados se
      cruzan solos: cuando alguien reporta un hallazgo cerca de donde tú perdiste a tu mascota,
      la ficha aparece en tu lista sin que nadie tenga que estar mirando.</p>
    <p style="margin-top:10px"><a href="/como-funciona" data-ruta class="enlace-fuerte">Ver cómo funciona en detalle →</a></p>`;

  pintarMias();
  if (!CONFIGURADO) { avisoSinConfigurar($("#recientes")); return; }

  rpc("estadisticas").then(e => {
    $("#cifras").innerHTML = `
      <div class="cifra"><b>${e.perdidas}</b><span>Buscadas</span></div>
      <div class="cifra"><b>${e.encontradas}</b><span>Encontradas</span></div>
      <div class="cifra cifra--verde"><b>${e.resueltas}</b><span>De vuelta en casa</span></div>`;
  }).catch(() => { });

  try {
    const filas = await rest("mascotas_publicas?estado=neq.oculto&order=creado.desc&limit=12");
    $("#recientes").innerHTML = filas.length ? rejilla(filas) : `
      <div class="vacio"><b>Todavía no hay reportes</b>
      El primero puede ser el que arranque todo.</div>`;
  } catch {
    $("#recientes").innerHTML = `<div class="vacio"><b>No pudimos cargar los reportes</b>
      Revisa tu conexión y vuelve a intentar.</div>`;
  }
}

/* Mis publicaciones + el recordatorio de "¿ya apareció?" */
async function pintarMias() {
  const mias = MIS.leer().filter(x => !x.resuelto);
  const caja = $("#mias"), rec = $("#recordatorio");
  if (!caja || !mias.length) return;

  caja.innerHTML = `<h2 class="seccion__titulo">Mis publicaciones</h2>` +
    mias.map(x => `<a class="coincidencia coincidencia--simple" href="/g/${x.token}" data-ruta>
      <div class="coincidencia__texto">
        <b>${esc(x.nombre)}</b>
        <span>Código ${esc(x.codigo)} · ${x.tipo === "perdida" ? "se busca" : "encontrada"}</span>
      </div>
      <span class="insignia insignia--neutra" id="nov-${esc(x.codigo)}">Ver</span></a>`).join("");

  const pendiente = mias.find(x => Date.now() > (x.recordar || (x.creado + 3 * 86400000)));
  if (pendiente && rec) {
    rec.innerHTML = `<div class="aviso aviso--verde">
      <p style="margin:0 0 10px"><strong>¿Ya apareció ${esc(pendiente.nombre)}?</strong>
        Mantenlo al día: una ficha vieja le hace perder tiempo a mucha gente.</p>
      <div class="botonera">
        <button class="boton boton--verde boton--compacto" id="rec-si">Sí, ya está en casa</button>
        <button class="boton boton--claro boton--compacto" id="rec-no">Todavía no</button>
      </div></div>`;
    $("#rec-si").addEventListener("click", () => navegar(`/g/${pendiente.token}`));
    $("#rec-no").addEventListener("click", async () => {
      MIS.parchar(pendiente.token, { recordar: Date.now() + 3 * 86400000 });
      try { await rpc("confirmar_vigencia", { p_token: pendiente.token }); } catch { }
      rec.innerHTML = "";
      brindis("Listo. Tu publicación sigue vigente y te preguntamos en 3 días.");
    });
  }

  /* Marca cada publicación con lo que cambió: pistas sin leer y coincidencias
     nuevas. Aquí NO se marcan como vistas — eso pasa solo al abrir el panel y
     ver la lista de verdad. Si se marcaran aquí, con pasar por la portada se
     perdería el aviso sin haberlo leído. */
  for (const x of mias) {
    rpc("ficha_gestion", { p_token: x.token }).then(async d => {
      if (!d || !d.mascota) return;
      const nodo = $(`#nov-${CSS.escape(x.codigo)}`);
      if (!nodo) return;

      const pistas = d.mascota.pistas_nuevas || 0;
      let nuevas = 0, mejorQueNunca = false;
      try {
        const cs = await buscarCoincidencias(d.mascota);
        const nov = novedadesDeCruce(x.token, cs);
        if (!nov.primeraVez) { nuevas = nov.nuevas.length + nov.subieron.length; mejorQueNunca = nov.mejorQueNunca; }
      } catch { }

      const partes = [];
      if (pistas) partes.push(pistas === 1 ? "1 novedad" : `${pistas} novedades`);
      if (nuevas) partes.push(nuevas === 1 ? "1 coincidencia nueva" : `${nuevas} coincidencias nuevas`);
      if (!partes.length) return;

      nodo.textContent = mejorQueNunca ? "¡La más parecida!" : partes.join(" · ");
      nodo.className = "insignia insignia--alta";
    }).catch(() => { });
  }
}

/* ---------- FORMULARIO DE REPORTE ---------- */
function vistaReportar(tipo) {
  const perdida = tipo === "perdida";
  const estadoFotos = { fotos: [] };
  const galeria = GaleriaCarga(estadoFotos);
  const ubi = { lat: null, lng: null, precision: "aproximada", municipio: "", departamento: "", lugar: "" };
  const mapa = SelectorUbicacion(ubi, {
    etiqueta: perdida ? "¿Dónde se perdió?" : "¿Dónde lo encontraste?",
    ayuda: perdida
      ? "Marca el último sitio donde estuvo, no dónde vives tú. Es lo que usamos para cruzarlo con los hallazgos cercanos."
      : "Marca el sitio exacto donde lo viste. Es lo que usamos para cruzarlo con las mascotas que están buscando cerca."
  });
  const inicio = Date.now();
  let duplicadoConfirmado = false;   // "no, es un animal distinto": ya no volvemos a preguntar

  /* Raza, sexo y edad cambian de sitio según QUIÉN está llenando el formulario,
     y no es un capricho:

     - Quien PERDIÓ a su mascota conoce cada dato y está dispuesto a darlos
       todos. Para esa persona esconderlos solo le resta información al cruce.
       Van a la vista, abiertos.
     - Quien la ENCONTRÓ muchas veces no puede saberlos (el sexo no se ve sin
       revisar al animal, la raza se adivina mal). Para esa persona van aparte,
       diciéndole que en blanco es mejor que adivinado. Está medido: un campo
       vacío casi no baja el puntaje, uno equivocado lo hunde hasta 53 puntos. */
  const campoRaza = `
    <div class="campo">
      <label class="campo__etiqueta" for="raza">Raza o mezcla</label>
      ${perdida ? `<span class="campo__ayuda">Aunque sea criollo, escríbelo: ayuda a descartar.</span>` : ""}
      <input type="text" id="raza" maxlength="40" placeholder="Ej: criollo, labrador, siamés">
    </div>`;
  const campoSexo = `
    <div class="campo">
      <span class="campo__etiqueta">Sexo</span>
      ${perdida ? "" : `<span class="campo__ayuda">Si no lo revisaste, "No sé" es la respuesta correcta.</span>`}
      ${grupoOpciones("sexo", SEXOS)}
    </div>`;
  const campoEdad = `
    <div class="campo">
      <span class="campo__etiqueta">Edad aproximada</span>
      ${perdida ? "" : `<span class="campo__ayuda">A ojo basta: un cachorro y un viejito se distinguen.</span>`}
      ${grupoOpciones("edad", EDADES)}
    </div>`;

  main.innerHTML = `
    <a class="volver" href="/" data-ruta>← Volver</a>
    <p class="paso">${perdida ? "Reporte de búsqueda" : "Reporte de hallazgo"}</p>
    <h1 class="titulo-pagina">${perdida ? "Publica a tu mascota" : "Reporta la mascota que encontraste"}</h1>
    <p class="intro-pagina">${perdida
      ? "Con esto creamos su ficha, su afiche para compartir, y la empezamos a cruzar contra todos los hallazgos reportados. Llena todo lo que puedas: cada dato es una forma más de que alguien la reconozca, y de que puedas comprobar que de verdad es la tuya."
      : "Con la foto y el sitio ya podemos cruzarla contra las mascotas que están buscando cerca. Lo demás es opcional."}</p>

    <form class="form" id="form" novalidate>
      <input type="text" name="sitio_web" id="trampa" tabindex="-1" autocomplete="off" aria-hidden="true">

      <div id="posible-duplicado"></div>

      <fieldset class="bloque">
        <legend class="bloque__titulo">Fotos</legend>
        ${galeria.html}
      </fieldset>

      <fieldset class="bloque">
        <legend class="bloque__titulo">Cómo es</legend>
        <div class="campo">
          <span class="campo__etiqueta">¿Qué animal es?</span>
          ${grupoOpciones("especie", ESPECIES, { valor: "Perro" })}
        </div>

        ${perdida ? `
        <div class="campo">
          <label class="campo__etiqueta" for="nombre">¿Cómo se llama?</label>
          <span class="campo__ayuda">Sirve para el afiche y para llamarlo si alguien lo ve.</span>
          <input type="text" id="nombre" maxlength="40" placeholder="Ej: Max">
        </div>` : ""}

        <div class="campo">
          <span class="campo__etiqueta">Tamaño</span>
          <span class="campo__ayuda">Pequeño hasta 10 kg, mediano hasta 25 kg, grande de ahí para arriba.</span>
          ${grupoOpciones("tamano", TAMANOS)}
        </div>

        <div class="campo">
          <span class="campo__etiqueta">Colores <span class="campo__opcional">— marca todos los que tenga</span></span>
          ${grupoColores()}
        </div>

        <div class="campo">
          <span class="campo__etiqueta">Pelo</span>
          ${grupoOpciones("pelo", PELOS)}
        </div>

        ${perdida ? campoSexo + campoEdad + campoRaza : ""}

        <div class="campo">
          <label class="campo__etiqueta" for="collar">¿Llevaba collar?</label>
          <span class="campo__ayuda">Si tiene, describe el color y si lleva placa. Es de las cosas
            que mejor identifican a un animal, y se ve de una.</span>
          <input type="text" id="collar" maxlength="80" placeholder="Ej: collar azul con placa">
        </div>

        <div class="campo">
          <label class="campo__etiqueta" for="rasgos">Señas que se noten a simple vista</label>
          <span class="campo__ayuda">Una mancha, una oreja caída, que cojea, que le falta la cola.
            Esto es lo que hace que alguien lo reconozca en la calle.</span>
          <textarea id="rasgos" maxlength="300" placeholder="Ej: mancha blanca en el pecho, la oreja izquierda siempre caída"></textarea>
        </div>
      </fieldset>

      ${/* Lo que sigue son datos que quien encuentra al animal muchas veces NO
            puede saber (el sexo no se ve sin revisarlo, la raza se adivina mal).
            Van aparte y con el rótulo diciendo la verdad: en blanco es MEJOR que
            adivinado. Medido en pruebas/adversario.test.js — un campo vacío casi
            no baja el puntaje, uno equivocado lo hunde hasta 53 puntos. */""}
      <details class="mas">
        <summary>${perdida
          ? "Un dato más, por si lo tienes"
          : "Si alcanzaste a fijarte (déjalo en blanco si no estás seguro)"}</summary>
        <div class="mas__cuerpo">
          ${perdida ? `
          <div class="campo">
            <label class="campo__etiqueta" for="microchip">Número de microchip</label>
            <span class="campo__ayuda">Si está registrado, una veterinaria puede leerlo y confirmar
              que es tuyo sin lugar a dudas.</span>
            <input type="text" id="microchip" maxlength="40" placeholder="Si lo tiene registrado">
          </div>` : `
          <p class="campo__ayuda">En serio: dejar algo vacío no estorba. Poner un dato equivocado
            sí puede alejar a la mascota de su familia.</p>
          ${campoRaza}
          ${campoSexo}
          ${campoEdad}
          <div class="campo">
            <label class="campo__etiqueta" for="descripcion">¿En qué estado estaba?</label>
            <textarea id="descripcion" maxlength="300" placeholder="Ej: asustado pero sano, lo tengo en mi casa"></textarea>
          </div>`}
        </div>
      </details>

      <fieldset class="bloque">
        <legend class="bloque__titulo">Cuándo</legend>
        <div class="campo">
          <label class="campo__etiqueta" for="fecha">${perdida ? "¿Qué día se perdió?" : "¿Qué día lo encontraste?"}</label>
          <input type="date" id="fecha" value="${hoy()}" max="${hoy()}" min="2020-01-01">
        </div>
      </fieldset>

      ${mapa.html}

      ${perdida ? `
      <fieldset class="bloque">
        <legend class="bloque__titulo">Una seña que no vamos a publicar</legend>
        <p class="campo__ayuda">Esta queda privada. Sirve para comprobar que quien dice tenerlo de
          verdad lo tiene: te va a poder describir algo que no está en ninguna parte de la publicación.</p>
        <textarea id="verificacion" maxlength="200"
          placeholder="Ej: cicatriz en la pata trasera derecha, una mancha bajo la barriga"></textarea>
      </fieldset>` : ""}

      <fieldset class="bloque">
        <legend class="bloque__titulo">Cómo te contactan</legend>
        <div class="aviso">Tu número <strong>no aparece escrito en la página</strong>. Quien quiera
          escribirte tiene que tocar un botón, uno por uno. Así una persona te contacta al instante
          y un programa que recoge números en masa no puede.</div>

        <div class="campo">
          <label class="campo__etiqueta" for="cnombre">Tu nombre</label>
          <input type="text" id="cnombre" maxlength="60" placeholder="Con el nombre basta">
        </div>
        <div class="campo">
          <label class="campo__etiqueta" for="ctel">Tu WhatsApp</label>
          <span class="campo__ayuda">Es por donde te van a avisar. Revísalo bien: un dígito mal y nadie te encuentra.</span>
          <input type="tel" id="ctel" maxlength="20" inputmode="tel" placeholder="300 123 4567">
          <p class="campo__error" id="err-tel" hidden></p>
        </div>
        <div class="campo">
          <label class="campo__etiqueta" for="cmail">Tu correo <span class="campo__opcional">— opcional</span></label>
          <span class="campo__ayuda">Solo para avisarte si alguien deja información. No se publica.</span>
          <input type="email" id="cmail" maxlength="80" placeholder="tucorreo@ejemplo.com">
        </div>
      </fieldset>

      <button class="boton" type="submit" id="enviar">
        ${perdida ? "Publicar y ver coincidencias" : "Publicar el hallazgo"}
      </button>
      <p class="nota-pie">Al publicar aceptas que la información y las fotos se muestren
        públicamente para ayudar a encontrar al animal. Puedes retirarla cuando quieras.</p>
    </form>`;

  galeria.conectar();
  mapa.conectar();

  $("#ctel").addEventListener("blur", () => {
    const v = $("#ctel").value.trim();
    const err = $("#err-tel");
    const malo = v && !telValido(v);
    err.hidden = !malo;
    if (malo) err.textContent = "Revisa el número: un celular colombiano tiene 10 dígitos y empieza por 3.";
  });

  $("#form").addEventListener("submit", async ev => {
    ev.preventDefault();
    const btn = $("#enviar");

    if ($("#trampa").value) return;                       // relleno automático: lo ignoramos
    if (Date.now() - inicio < 2500) return brindis("Un momento, se está preparando el formulario.");

    /* Cuando falta algo no basta con el mensajito de abajo: este formulario mide
       varias pantallas y la persona no sabe a dónde volver. Llevamos la pantalla
       al campo, lo resaltamos y ahí sí avisamos. */
    const falta = (selector, mensaje) => {
      const nodo = $(selector);
      if (nodo) {
        const caja = nodo.closest(".campo, .bloque, .fotos") || nodo;
        caja.classList.add("campo--falta");
        setTimeout(() => caja.classList.remove("campo--falta"), 2600);
        nodo.scrollIntoView({ behavior: "smooth", block: "center" });
        if (nodo.focus && nodo.tagName !== "DIV") setTimeout(() => nodo.focus({ preventScroll: true }), 350);
      }
      brindis(mensaje, 4200);
      return true;
    };

    const especie = leerRadio("especie");
    const tel = $("#ctel").value.trim();
    if (!estadoFotos.fotos.length)
      return falta("#f-zona", "Falta la foto. Sin foto casi nadie lo reconoce.");
    if (!especie)
      return falta("#form .opciones", "Dinos qué animal es.");
    if (ubi.lat == null && !ubi.municipio)
      return falta("#u-dep", "Falta la ubicación: marca el punto en el mapa o elige al menos el municipio.");
    if (!tel)
      return falta("#ctel", "Falta tu WhatsApp: es por donde te avisan.");
    if (!telValido(tel))
      return falta("#ctel", "Revisa el número: un celular colombiano tiene 10 dígitos y empieza por 3.");

    /* Antes de publicar un HALLAZGO (nunca para "perdida"), revisamos si ya
       hay un reporte muy parecido de los últimos días en la misma zona: es
       el caso de que varias personas vean al mismo animal callejero y cada
       una publique su propia ficha por separado. Si aparece uno fuerte, se
       ofrece ir a esa ficha (y dejar ahí la información como pista) en vez
       de crear una publicación nueva y duplicada. Solo se pregunta una vez
       por intento: si la persona confirma que es un animal distinto, no se
       vuelve a interrumpir la publicación. */
    if (!perdida && !duplicadoConfirmado) {
      btn.disabled = true; btn.textContent = "Revisando…";
      const posible = await buscarPosibleDuplicado({
        especie, municipio: ubi.municipio || null, departamento: ubi.departamento || null,
        lat: ubi.lat, lng: ubi.lng, fecha: $("#fecha").value || hoy(),
        tamano: leerRadio("tamano") || "", colores: leerChecks("colores"),
        collar: $("#collar").value.trim(), rasgos: $("#rasgos").value.trim(),
        raza: $("#raza").value.trim()
      });
      btn.disabled = false; btn.textContent = "Publicar el hallazgo";

      if (posible) {
        const { candidato, puntaje } = posible;
        const caja = $("#posible-duplicado");
        caja.innerHTML = `
          <div class="aviso aviso--verde">
            <p style="margin:0 0 10px"><strong>Espera — puede que alguien más ya haya reportado a
              este mismo animal.</strong> Publicado ${haceCuanto(candidato.fecha)}, cerca de donde
              marcaste el tuyo.</p>
            ${filaCoincidencia({ ...candidato, total: puntaje })}
            <p class="pista__nota" style="margin:12px 0 10px">Si es el mismo, mejor entra a esa
              ficha y deja ahí lo que sabes — así el dueño ve toda la información junta en un solo
              lugar, en vez de repartida en varias publicaciones.</p>
            <div class="botonera">
              <a class="boton boton--verde boton--compacto" href="/m/${candidato.codigo}" data-ruta>
                Sí, es el mismo → ver esa ficha</a>
              <button type="button" class="boton boton--claro boton--compacto" id="btn-es-distinto">
                No, es un animal distinto</button>
            </div>
          </div>`;
        caja.scrollIntoView({ behavior: "smooth", block: "center" });
        $("#btn-es-distinto").addEventListener("click", () => {
          duplicadoConfirmado = true;
          caja.innerHTML = "";
          $("#form").requestSubmit();
        });
        return;   // se detiene aquí: no publica hasta que la persona decida
      }
    }

    btn.disabled = true; btn.textContent = "Publicando…";
    try {
      const urls = [];
      for (const f of estadoFotos.fotos) urls.push(await subirFoto(f.blob));

      const datos = {
        tipo, especie,
        nombre: perdida ? $("#nombre").value.trim() : "",
        raza: $("#raza").value.trim(),
        tamano: leerRadio("tamano") || "",
        colores: leerChecks("colores"),
        pelo: leerRadio("pelo") || "",
        sexo: leerRadio("sexo") || "",
        edad_aprox: leerRadio("edad") || "",
        collar: $("#collar").value.trim(),
        microchip: perdida ? $("#microchip").value.trim() : "",
        rasgos: $("#rasgos").value.trim(),
        descripcion: perdida ? "" : $("#descripcion").value.trim(),
        rasgo_verificacion: perdida ? $("#verificacion").value.trim() : "",
        fecha: $("#fecha").value || hoy(),
        lat: ubi.lat, lng: ubi.lng, precision_ubicacion: ubi.precision,
        lugar: ubi.lugar || "", municipio: ubi.municipio || "", departamento: ubi.departamento || "",
        fotos: urls,
        contacto_nombre: $("#cnombre").value.trim(),
        contacto_tel: tel,
        contacto_email: $("#cmail").value.trim()
      };

      const r = await rpc("crear_publicacion", { p: datos });
      MIS.guardar({
        token: r.token, codigo: r.codigo, tipo,
        nombre: datos.nombre || datos.especie, creado: Date.now()
      });
      navegar(`/g/${r.token}?nuevo=1`);
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      btn.textContent = perdida ? "Publicar y ver coincidencias" : "Publicar el hallazgo";
      brindis(e.message === "SIN_CONFIGURAR"
        ? "Falta conectar la base de datos (config.js)."
        : "No se pudo publicar: " + e.message);
    }
  });
}

/* ---------- FICHA PÚBLICA ---------- */
async function vistaFicha(codigo) {
  main.innerHTML = `<p class="cargando">Cargando la ficha…</p>`;
  if (!CONFIGURADO) return avisoSinConfigurar(main);

  let m;
  try { m = (await rest(`mascotas_publicas?codigo=eq.${encodeURIComponent(codigo)}&limit=1`))[0]; }
  catch { }
  if (!m) {
    main.innerHTML = `<div class="vacio"><b>No encontramos esta ficha</b>
      El código puede estar mal escrito, o la publicación se retiró.
      <p style="margin-top:14px"><a href="/buscar" data-ruta class="enlace-fuerte">Buscar en todos los reportes →</a></p></div>`;
    return;
  }
  rpc("sumar_vista", { p_codigo: codigo }).catch(() => { });

  const perdida = m.tipo === "perdida";
  const resuelto = m.estado === "resuelto";
  const titulo = nombreMostrado(m);
  const fotos = fotosDe(m);

  const bandaEstado = resuelto
    ? `<div class="banda banda--resuelto">Esta mascota ya está de vuelta en casa
         <small>Si llegaste por un afiche que sigue circulando, ya no hace falta compartirlo.
         Gracias por mirar — y si perdiste la tuya, puedes publicarla aquí mismo.</small></div>`
    : m.estado === "sin_confirmar"
      ? `<div class="banda banda--sin-confirmar">Sin confirmar hace ${m.dias_sin_confirmar} días
         <small>Nadie ha actualizado este caso en un tiempo. Puede que ya se haya resuelto,
         pero la información sigue publicada por si acaso.</small></div>` : "";

  const datos = [
    ["Animal", [m.especie, m.raza].filter(Boolean).join(" · ")],
    ["Tamaño", m.tamano], ["Pelo", m.pelo], ["Sexo", m.sexo], ["Edad", m.edad_aprox],
    ["Color", (m.colores || []).map(colorNombre).join(", ")],
    ["Collar", m.collar],
    ["Microchip", m.microchip],
    [perdida ? "Se perdió el" : "Lo encontraron el", `${fechaLarga(m.fecha)} (${haceCuanto(m.fecha)})`],
    ["Zona", [m.lugar, m.municipio, m.departamento].filter(Boolean).join(", ")]
  ].filter(d => d[1]);

  /* ¿Quien está mirando es el dueño de esta publicación? Es el momento de más
     alcance que tenemos: sin avisos que salgan de la página, la ficha propia es
     lo que más visita quien publicó (para compartirla, para ver si hay
     novedades, o al escanear el QR de su propio afiche). Aprovecharlo evita
     fichas viejas que le hacen perder tiempo a todo el mundo. */
  const mio = MIS.leer().find(x => x.codigo === m.codigo);

  main.innerHTML = `
    <a class="volver" href="/buscar" data-ruta>← Todos los reportes</a>
    ${bandaEstado}

    ${mio && !resuelto ? `
    <div class="aviso aviso--verde barra-dueno">
      <p style="margin:0 0 10px"><strong>Esta publicación es tuya.</strong>
        ¿Ya ${perdida ? "apareció" : "se reunió con su familia"}? Márcalo apenas pase:
        una ficha desactualizada le hace perder tiempo a mucha gente que quiere ayudar.</p>
      <div class="botonera">
        <button class="boton boton--verde boton--compacto" id="ficha-resuelto">
          Sí, ya está en casa</button>
        <a class="boton boton--claro boton--compacto" href="/g/${esc(mio.token)}" data-ruta>
          Administrar</a>
      </div>
    </div>` : ""}

    <div class="ficha__cabeza">
      <div style="flex:1">
        <h1 class="ficha__titulo">${esc(titulo)}</h1>
        <p class="ficha__sub">${resuelto ? "Ya está en casa"
          : perdida ? "Se busca" : "Encontrada, buscando a su familia"} ·
          ${esc(m.lugar || m.municipio || "zona sin especificar")} · ${haceCuanto(m.fecha)}</p>
      </div>
      <span class="ficha__codigo">${esc(m.codigo)}</span>
    </div>

    ${fotos.length ? `
      <div class="galeria">
        <img class="galeria__grande" id="foto-grande" src="${esc(fotos[0])}" alt="Foto de ${esc(titulo)}">
        ${fotos.length > 1 ? `<div class="galeria__tiras">${fotos.map((f, i) => `
          <button type="button" class="galeria__tira ${i === 0 ? "es-activa" : ""}" data-f="${esc(f)}">
            <img src="${esc(f)}" alt="Foto ${i + 1}" loading="lazy"></button>`).join("")}</div>` : ""}
      </div>` : ""}

    ${m.reencuentro_foto ? `<img class="ficha__foto" src="${esc(m.reencuentro_foto)}" alt="Foto del reencuentro">` : ""}

    ${m.rasgos ? `<div class="aviso aviso--destacado"><strong>Señas particulares:</strong> ${esc(m.rasgos)}</div>` : ""}
    ${m.descripcion ? `<div class="aviso">${esc(m.descripcion)}</div>` : ""}

    ${!resuelto ? `
    <div class="acciones-ficha">
      <button class="boton" id="btn-tengo">
        ${perdida ? "Lo vi o lo tengo" : "Creo que es mi mascota"}
      </button>
      <div class="botonera">
        <button class="boton boton--claro boton--compacto" id="btn-afiche">Crear afiche</button>
        <button class="boton boton--claro boton--compacto" id="btn-wa">Compartir</button>
        <button class="boton boton--claro boton--compacto" id="btn-link">Copiar enlace</button>
      </div>
    </div>` : `
    <div class="acciones-ficha">
      <a class="boton" href="/reportar/perdida" data-ruta>Publicar mi mascota perdida</a>
    </div>`}

    <div id="contacto"></div>

    <dl class="datos">${datos.map(d => `
      <div class="dato ${["Zona", "Collar", "Microchip"].includes(d[0]) ? "dato--ancho" : ""}">
        <dt>${esc(d[0])}</dt><dd>${esc(d[1])}</dd></div>`).join("")}</dl>

    ${m.lat != null ? `<div id="mapa-ficha" class="mapa mapa--ficha"></div>
      <p class="mapa__nota">${m.precision_ubicacion === "exacta"
        ? "Punto marcado por quien publicó." : "Ubicación aproximada."}</p>` : ""}

    <div id="pistas"></div>
    <div id="coincidencias"></div>
    <div id="formulario-pista"></div>`;

  // galería
  $$(".galeria__tira").forEach(b => b.addEventListener("click", () => {
    $("#foto-grande").src = b.dataset.f;
    $$(".galeria__tira").forEach(o => o.classList.toggle("es-activa", o === b));
  }));

  // mapa de la ficha
  if (m.lat != null) {
    cargarLeaflet().then(L => {
      if (!L || !$("#mapa-ficha")) return;
      const mp = L.map($("#mapa-ficha"), { scrollWheelZoom: false, dragging: true })
        .setView([m.lat, m.lng], m.precision_ubicacion === "exacta" ? 15 : 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(mp);
      if (m.precision_ubicacion === "exacta") L.marker([m.lat, m.lng]).addTo(mp);
      else L.circle([m.lat, m.lng], { radius: 900, color: "#D6402A", weight: 2, fillOpacity: .12 }).addTo(mp);
      setTimeout(() => mp.invalidateSize(), 200);
    });
  }

  const enlace = `${baseURL()}/m/${m.codigo}`;

  $("#btn-link")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(enlace); brindis("Enlace copiado"); }
    catch { brindis(enlace); }
  });
  $("#btn-afiche")?.addEventListener("click", () => navegar(`/afiche/${m.codigo}`));
  $("#btn-wa")?.addEventListener("click", async () => {
    const t = `${perdida ? "🔎 SE BUSCA" : "🐾 ENCONTRADA"}: ${titulo} — ${m.lugar || m.municipio || ""}. Información y contacto: ${enlace}`;
    if (navigator.share) { try { await navigator.share({ text: t }); return; } catch { } }
    open(`https://wa.me/?text=${encodeURIComponent(t)}`, "_blank");
  });

  $("#btn-tengo")?.addEventListener("click", () => abrirFormularioPista(m));

  $("#ficha-resuelto")?.addEventListener("click", async () => {
    if (!confirm(`¿Confirmas que ${titulo} ya está en casa? La ficha dejará de aparecer en las búsquedas.`)) return;
    try {
      await rpc("actualizar_estado", { p_token: mio.token, p_estado: "resuelto" });
      MIS.parchar(mio.token, { resuelto: true });
      brindis("¡Qué buena noticia! Gracias por avisar.", 5000);
      vistaFicha(m.codigo);
    } catch { brindis("No se pudo actualizar. Intenta desde 'Administrar'."); }
  });

  // pistas públicas
  rest(`pistas_publicas?mascota_id=eq.${m.id}&order=creado.desc&limit=60`).then(ps => {
    if (!ps.length) return;
    $("#pistas").innerHTML = `<h2 class="seccion__titulo">Lo que ha reportado la gente</h2>` +
      ps.map(p => `<div class="pista ${p.clase === "tengo" ? "pista--tengo" : ""}">
        <p class="pista__meta">${new Date(p.creado).toLocaleDateString("es-CO")}${p.lugar ? " · " + esc(p.lugar) : ""}${p.clase === "tengo" ? " · DICE TENERLO" : ""}</p>
        <p>${esc(p.mensaje)}</p></div>`).join("");
  }).catch(() => { });

  // coincidencias del lado contrario
  if (!resuelto) {
    buscarCoincidencias(m).then(cs => {
      if (!cs.length) return;
      const caja = $("#coincidencias");
      caja.innerHTML = `
        <h2 class="seccion__titulo">Posibles coincidencias (${cs.length})</h2>
        <p class="parrafo">${perdida ? "Mascotas encontradas" : "Mascotas que están buscando"} cerca
          y con características parecidas, de la más probable a la menos probable. Míralas: nosotros
          solo ordenamos la lista, quien decide eres tú.</p>`;
      pintarCoincidenciasPaginadas(caja, cs);
    }).catch(() => { });
  }
}

/* Flujo de contacto: es el momento más importante de toda la página. */
function abrirFormularioPista(m) {
  const perdida = m.tipo === "perdida";
  const caja = $("#formulario-pista");

  caja.innerHTML = `
    <h2 class="seccion__titulo">Cuéntanos qué sabes</h2>
    <form class="form" id="form-pista">
      <div class="campo">
        <span class="campo__etiqueta">¿Cuál es tu caso?</span>
        ${grupoOpciones("clase", perdida
      ? ["Lo tengo conmigo", "Lo vi en la calle"]
      : ["Creo que es mi mascota", "Tengo información"], { valor: perdida ? "Lo tengo conmigo" : "Creo que es mi mascota" })}
      </div>
      <div class="campo">
        <label class="campo__etiqueta" for="p-mensaje">Cuenta lo que sepas</label>
        <span class="campo__ayuda">Dónde, cuándo, para dónde iba, cómo estaba. Cualquier detalle sirve.</span>
        <textarea id="p-mensaje" maxlength="600" required
          placeholder="Ej: lo vi el martes hacia las 5 pm bajando por la 23, iba solo y asustado"></textarea>
      </div>
      <div class="campo">
        <label class="campo__etiqueta" for="p-lugar">¿Dónde? <span class="campo__opcional">— opcional</span></label>
        <input type="text" id="p-lugar" maxlength="80" placeholder="Barrio, calle o punto de referencia">
      </div>
      <div class="campo">
        <label class="campo__etiqueta" for="p-contacto">Tu WhatsApp <span class="campo__opcional">— opcional pero recomendado</span></label>
        <span class="campo__ayuda">No se publica. Solo lo ve quien publicó, por si necesita preguntarte algo.</span>
        <input type="tel" id="p-contacto" maxlength="20" inputmode="tel" placeholder="300 123 4567">
      </div>
      <button class="boton" type="submit">Enviar y ver el contacto</button>
    </form>`;

  caja.scrollIntoView({ behavior: "smooth", block: "start" });

  $("#form-pista").addEventListener("submit", async ev => {
    ev.preventDefault();
    const mensaje = $("#p-mensaje").value.trim();
    if (!mensaje) return brindis("Escribe lo que sepas, aunque sea corto.");
    const clase = (leerRadio("clase") || "").startsWith("Lo tengo") ||
      (leerRadio("clase") || "").startsWith("Creo que") ? "tengo" : "avistamiento";
    try {
      await rpc("agregar_pista", {
        p_codigo: m.codigo, p_mensaje: mensaje, p_clase: clase,
        p_lugar: $("#p-lugar").value.trim() || null,
        p_contacto: $("#p-contacto").value.trim() || null
      });
      await mostrarContacto(m, mensaje);
      brindis("Enviado. Ahora escríbele directo.");
    } catch (e) {
      brindis("No se pudo enviar. Revisa tu conexión e intenta otra vez.");
    }
  });
}

/* Revela el contacto. Nunca viaja en los listados: se pide de a uno. */
async function mostrarContacto(m, mensajePrevio = "") {
  const caja = $("#formulario-pista") || $("#contacto");
  const perdida = m.tipo === "perdida";
  caja.innerHTML = `<p class="cargando">Buscando el contacto…</p>`;
  let c = null;
  try { c = await rpc("obtener_contacto", { p_codigo: m.codigo }); } catch { }

  if (!c || !c.tel) {
    caja.innerHTML = `<div class="aviso aviso--rojo">
      <strong>Gracias, ya quedó registrado.</strong> No hay un número de contacto disponible en esta
      publicación, pero quien la creó verá tu mensaje al entrar a administrarla.</div>`;
    return;
  }

  const quien = c.nombre || (perdida ? "la familia" : "quien lo encontró");
  const saludo = perdida
    ? `Hola${c.nombre ? " " + c.nombre : ""}, te escribo por ${c.nombre_mascota || "tu mascota"} que publicaste en Patas de vuelta (código ${m.codigo}). ${mensajePrevio}`
    : `Hola${c.nombre ? " " + c.nombre : ""}, te escribo por la mascota que encontraste y publicaste en Patas de vuelta (código ${m.codigo}). Creo que es mía. ${mensajePrevio}`;

  caja.innerHTML = `
    <div class="contacto-caja">
      <h2 class="contacto-caja__titulo">Escríbele a ${esc(quien)}</h2>
      <a class="boton boton--verde" href="${esc(enlaceWhatsapp(c.tel, saludo))}" target="_blank" rel="noopener">
        Abrir WhatsApp</a>
      <a class="boton boton--claro" href="tel:${esc(telLimpio(c.tel))}">Llamar al ${esc(c.tel)}</a>

      ${perdida ? `<div class="aviso aviso--rojo" style="margin-top:16px">
        <strong>Antes de entregar al animal.</strong> Quien lo perdió guardó una seña que no está
        publicada en ninguna parte. Pídele que te la describa: si de verdad es su mascota, la sabe.</div>`
      : `<div class="aviso aviso--rojo" style="margin-top:16px">
        <strong>Te van a pedir una prueba.</strong> Ten a mano una foto donde salgas con tu mascota,
        o el carné de vacunas. Es lo normal para evitar entregas equivocadas.</div>`}

      <div class="aviso">Nadie legítimo te va a pedir dinero por adelantado para devolverte un animal
        ni para "el transporte". Si te lo piden, es una estafa.</div>
    </div>`;
  caja.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- BUSCADOR ---------- */
async function vistaBuscar() {
  main.innerHTML = `
    <a class="volver" href="/" data-ruta>← Inicio</a>
    <h1 class="titulo-pagina">Buscar</h1>
    <p class="intro-pagina">Filtra por lo que recuerdas. No hace falta el nombre: lo que sirve
      es la zona y cómo se ve.</p>

    <div class="filtros">
      <div class="filtros__fila">
        <select id="f-tipo">
          <option value="">Perdidas y encontradas</option>
          <option value="perdida">Solo las que buscan</option>
          <option value="encontrada">Solo las encontradas</option>
          <option value="resuelto">Ya en casa</option>
        </select>
        <select id="f-especie"><option value="">Cualquier animal</option>${ESPECIES.map(e => `<option>${e}</option>`).join("")}</select>
      </div>
      <div class="filtros__fila">
        <select id="f-dep"><option value="">Todo el país</option>${GEO.map(g => `<option>${esc(g.d)}</option>`).join("")}</select>
        <select id="f-mun" disabled><option value="">Todo el departamento</option></select>
      </div>
      <div class="filtros__fila">
        <select id="f-tamano"><option value="">Cualquier tamaño</option>${TAMANOS.map(t => `<option>${t}</option>`).join("")}</select>
        <select id="f-color"><option value="">Cualquier color</option>${COLORES.map(c => `<option value="${c.k}">${c.n}</option>`).join("")}</select>
      </div>
      <div class="filtros__fila">
        <input type="search" id="f-texto" placeholder="Nombre, barrio, código o seña particular">
      </div>
      <div class="filtros__fila">
        <button type="button" class="boton boton--claro boton--compacto" id="f-cerca">Ordenar por cercanía</button>
        <button type="button" class="boton boton--claro boton--compacto" id="f-limpiar">Limpiar filtros</button>
      </div>
    </div>

    <div id="resultados"><p class="cargando">Cargando…</p></div>`;

  if (!CONFIGURADO) return avisoSinConfigurar($("#resultados"));

  let todos = [], miPunto = null;
  try { todos = await rest("mascotas_publicas?order=creado.desc&limit=1500"); }
  catch {
    $("#resultados").innerHTML = `<div class="vacio"><b>No pudimos cargar los reportes</b>Revisa tu conexión.</div>`;
    return;
  }

  const dep = $("#f-dep"), mun = $("#f-mun");
  dep.addEventListener("change", () => {
    const lista = municipiosDe(dep.value);
    mun.innerHTML = `<option value="">Todo el departamento</option>` +
      lista.map(m => `<option>${esc(m)}</option>`).join("");
    mun.disabled = !lista.length;
    pintar();
  });

  const pintar = () => {
    const tipo = $("#f-tipo").value, esp = $("#f-especie").value;
    const dpto = dep.value, muni = mun.value;
    const tam = $("#f-tamano").value, col = $("#f-color").value;
    const txt = $("#f-texto").value.trim().toLowerCase();

    let r = todos.filter(m => {
      if (tipo === "resuelto") { if (m.estado !== "resuelto") return false; }
      else if (tipo) { if (m.tipo !== tipo || m.estado === "resuelto") return false; }
      else if (m.estado === "resuelto") return false;
      if (esp && m.especie !== esp) return false;
      if (dpto && m.departamento !== dpto) return false;
      if (muni && m.municipio !== muni) return false;
      if (tam && m.tamano !== tam) return false;
      if (col && !(m.colores || []).some(k => parecidoColor(k, col) >= 0.4)) return false;
      if (txt) {
        const bolsa = [m.nombre, m.raza, m.lugar, m.municipio, m.departamento, m.rasgos,
          m.descripcion, m.collar, m.codigo].filter(Boolean).join(" ").toLowerCase();
        if (!bolsa.includes(txt)) return false;
      }
      return true;
    });

    const extras = {};
    if (miPunto) {
      r.forEach(m => { extras[m.id] = { km: distanciaKm(miPunto.lat, miPunto.lng, m.lat, m.lng) }; });
      r.sort((a, b) => {
        const ka = extras[a.id].km, kb = extras[b.id].km;
        if (ka == null && kb == null) return 0;
        if (ka == null) return 1; if (kb == null) return -1;
        return ka - kb;
      });
    } else {
      r.sort((a, b) => (a.estado === "sin_confirmar") - (b.estado === "sin_confirmar"));
    }

    $("#resultados").innerHTML = r.length
      ? `<p class="conteo">${r.length} reporte${r.length === 1 ? "" : "s"}${miPunto ? ", del más cercano al más lejano" : ""}</p>${rejilla(r, extras)}`
      : `<div class="vacio"><b>Nada con esos filtros</b>
          Prueba con menos filtros, o amplía la zona. Si tu mascota no aparece,
          <a href="/reportar/perdida" data-ruta>publícala</a> para que te avisen cuando alguien la reporte.</div>`;
  };

  ["f-tipo", "f-especie", "f-tamano", "f-color"].forEach(id => $("#" + id).addEventListener("change", pintar));
  mun.addEventListener("change", pintar);
  $("#f-texto").addEventListener("input", pintar);
  $("#f-limpiar").addEventListener("click", () => {
    $$("#f-tipo,#f-especie,#f-dep,#f-tamano,#f-color").forEach(s => s.value = "");
    mun.innerHTML = `<option value="">Todo el departamento</option>`; mun.disabled = true;
    $("#f-texto").value = ""; miPunto = null; pintar();
  });
  $("#f-cerca").addEventListener("click", () => {
    if (!navigator.geolocation) return brindis("Tu navegador no comparte la ubicación.");
    brindis("Buscando tu ubicación…", 2000);
    navigator.geolocation.getCurrentPosition(
      p => { miPunto = { lat: p.coords.latitude, lng: p.coords.longitude }; pintar(); brindis("Ordenado por cercanía"); },
      () => brindis("No pudimos obtener tu ubicación."),
      { enableHighAccuracy: true, timeout: 9000 });
  });

  pintar();
}

/* ---------- GESTIÓN ---------- */
async function vistaGestionar(token, params) {
  if (!token) {
    const mias = MIS.leer();
    main.innerHTML = `
      <a class="volver" href="/" data-ruta>← Inicio</a>
      <h1 class="titulo-pagina">Mi publicación</h1>
      <p class="intro-pagina">Desde acá ves las novedades, la corriges, o marcas que ya apareció.</p>
      ${mias.length ? `<h2 class="seccion__titulo">En este teléfono</h2>` + mias.map(x => `
        <a class="coincidencia coincidencia--simple" href="/g/${x.token}" data-ruta>
          <div class="coincidencia__texto"><b>${esc(x.nombre)}</b>
            <span>Código ${esc(x.codigo)} · ${x.tipo === "perdida" ? "se busca" : "encontrada"}</span></div>
          <span class="insignia insignia--neutra">Abrir</span></a>`).join("")
        : `<div class="vacio"><b>No hay publicaciones guardadas en este teléfono</b>
            Si publicaste desde otro dispositivo, pega abajo el enlace de gestión.</div>`}
      <h2 class="seccion__titulo">Abrir con el enlace</h2>
      <form class="form" id="form-token">
        <div class="campo"><input type="text" id="token" placeholder="Pega aquí el enlace de gestión"></div>
        <button class="boton" type="submit">Abrir</button>
      </form>`;
    $("#form-token").addEventListener("submit", e => {
      e.preventDefault();
      const v = $("#token").value.trim().split("/g/").pop().split("?")[0];
      if (v) navegar(`/g/${v}`);
    });
    return;
  }

  main.innerHTML = `<p class="cargando">Abriendo tu publicación…</p>`;
  if (!CONFIGURADO) return avisoSinConfigurar(main);

  let d;
  try { d = await rpc("ficha_gestion", { p_token: token }); } catch { }
  if (!d || !d.mascota) {
    main.innerHTML = `<div class="vacio"><b>Ese enlace no corresponde a ninguna publicación</b>
      Revisa que lo hayas copiado completo.</div>`;
    return;
  }

  const m = d.mascota, pistas = d.pistas || [];
  const nuevo = params.get("nuevo");
  const enlace = `${baseURL()}/m/${m.codigo}`;
  const gestion = `${baseURL()}/g/${m.token_gestion}`;
  const resuelto = m.estado === "resuelto";

  MIS.guardar({
    token: m.token_gestion, codigo: m.codigo, nombre: m.nombre || m.especie,
    tipo: m.tipo, creado: Date.parse(m.creado) || Date.now(), resuelto
  });
  if (m.pistas_nuevas) rpc("marcar_pistas_vistas", { p_token: token }).catch(() => { });

  main.innerHTML = `
    <a class="volver" href="/" data-ruta>← Inicio</a>

    ${nuevo ? `<div class="aviso aviso--verde">
      <strong>Publicado.</strong> Este enlace es tu llave: con él vuelves a entrar a ver novedades
      y coincidencias, aunque cambies de teléfono o borres los datos del navegador.
      No pide contraseña, así que no se lo pases a nadie.
      <div class="token-caja">${esc(gestion)}</div>
      <div class="botonera">
        ${/* Mandárselo por WhatsApp a uno mismo es la forma más segura de no
              perderlo nunca: queda en una conversación que sobrevive al cambio
              de celular, al formateo y a que se borre el navegador. */""}
        ${m.contacto_tel ? `<a class="boton boton--verde boton--compacto" target="_blank" rel="noopener"
           href="${esc(enlaceWhatsapp(m.contacto_tel,
             `Mi publicación en Patas de vuelta — ${m.nombre || m.especie} (código ${m.codigo}). ` +
             `Con este enlace entro a ver novedades y a marcar cuando aparezca:\n${gestion}`))}"
           id="guardar-wa">Enviármelo por WhatsApp</a>` : ""}
        <button class="boton boton--claro boton--compacto" id="copiar-gestion">Copiar</button>
        <button class="boton boton--claro boton--compacto" id="recordar-nuevo">Agendar recordatorio</button>
      </div>
      <p class="pista__nota">Queda guardado en este navegador, pero eso se pierde si borras los
        datos o cambias de celular. <strong>Mándatelo por WhatsApp:</strong> es lo único que
        sobrevive a que el teléfono se dañe, se pierda o se cambie.</p>
      </div>` : ""}

    <h1 class="titulo-pagina">${esc(m.nombre || m.especie)}</h1>
    <p class="intro-pagina">Código <strong>${esc(m.codigo)}</strong> ·
      ${resuelto ? "ya está en casa" : m.tipo === "perdida" ? "se busca" : "encontrada"} ·
      ${m.vistas || 0} visitas</p>

    ${!resuelto ? `
    <div class="aviso aviso--verde">
      <p style="margin:0 0 10px"><strong>¿Ya apareció?</strong> Márcalo apenas pase: una ficha
        desactualizada le hace perder tiempo a mucha gente que quiere ayudar.</p>
      <div class="botonera">
        <button class="boton boton--verde boton--compacto" id="btn-resuelto">Sí, ya está en casa</button>
        <button class="boton boton--claro boton--compacto" id="btn-recordar">Recordármelo en 3 días</button>
      </div>
      <p class="pista__nota">El recordatorio queda en el calendario de tu celular y te suena solo.
        No enviamos mensajes ni necesitamos tus datos para eso.</p>
    </div>` : `
    <div class="banda banda--resuelto">Marcada como resuelta
      <small>La ficha ahora muestra el aviso de reencuentro a quien llegue por un afiche viejo.</small></div>
    <button class="boton boton--claro boton--compacto" id="btn-reactivar" style="margin-bottom:20px">Volver a activarla</button>`}

    <div class="botonera botonera--ancha">
      <a class="boton boton--claro boton--compacto" href="/m/${m.codigo}" data-ruta>Ver la ficha</a>
      <button class="boton boton--claro boton--compacto" id="btn-afiche2">Crear afiche</button>
      <a class="boton boton--claro boton--compacto" href="/editar/${m.token_gestion}" data-ruta>Corregir datos</a>
      <button class="boton boton--claro boton--compacto" id="btn-copiar">Copiar enlace</button>
    </div>

    ${/* Siempre a la mano, no solo al publicar: mucha gente entra por primera vez
          desde el navegador y nunca guarda la llave. */""}
    ${!nuevo && m.contacto_tel ? `
    <div class="aviso">
      <p style="margin:0 0 10px"><strong>¿Ya guardaste tu enlace de administración?</strong>
        Si borras los datos del navegador o cambias de celular, es la única forma de volver a entrar.</p>
      <a class="boton boton--claro boton--compacto" target="_blank" rel="noopener"
         href="${esc(enlaceWhatsapp(m.contacto_tel,
           `Mi publicación en Patas de vuelta — ${m.nombre || m.especie} (código ${m.codigo}). ` +
           `Con este enlace entro a ver novedades y a marcar cuando aparezca:\n${gestion}`))}">
        Enviármelo por WhatsApp</a>
    </div>` : ""}

    <div id="avisos-push"></div>
    <div id="tras-escribir"></div>

    <h2 class="seccion__titulo">Novedades (${pistas.length})</h2>
    ${pistas.length ? pistas.map(p => `
      <div class="pista ${p.clase === "tengo" ? "pista--tengo" : ""}">
        <p class="pista__meta">${new Date(p.creado).toLocaleString("es-CO")}${p.lugar ? " · " + esc(p.lugar) : ""}${p.clase === "tengo" ? " · DICE TENERLO" : ""}</p>
        <p>${esc(p.mensaje)}</p>
        ${p.contacto ? `<div class="botonera" style="margin-top:10px">
          <a class="boton boton--verde boton--compacto" target="_blank" rel="noopener" data-escribio
             href="${esc(enlaceWhatsapp(p.contacto, `Hola, te escribo por ${m.nombre || "mi mascota"} (código ${m.codigo}). Gracias por avisar.`))}">
            Escribirle por WhatsApp</a>
          <a class="boton boton--claro boton--compacto" href="tel:${esc(telLimpio(p.contacto))}">Llamar</a>
        </div>` : `<p class="pista__nota">No dejó número de contacto.</p>`}
      </div>`).join("")
      : `<div class="vacio"><b>Todavía no hay novedades</b>
          Comparte el afiche: es lo que más las mueve.</div>`}

    <div id="coincidencias2"></div>

    <h2 class="seccion__titulo">Retirar</h2>
    <p class="parrafo">Oculta la publicación de la página. Puedes volver con este mismo enlace.</p>
    <button class="boton boton--claro boton--compacto" id="btn-ocultar" style="margin-top:10px">Retirar la publicación</button>`;

  $("#copiar-gestion")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(gestion); brindis("Copiado. Guárdalo en tus notas."); }
    catch { brindis("Copia el enlace de arriba a mano."); }
  });
  $("#btn-copiar").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(enlace); brindis("Enlace copiado"); }
    catch { brindis(enlace); }
  });
  $("#btn-afiche2").addEventListener("click", () => navegar(`/afiche/${m.codigo}`));
  $("#btn-recordar")?.addEventListener("click", () => descargarRecordatorio(m, gestion));
  $("#recordar-nuevo")?.addEventListener("click", () => descargarRecordatorio(m, gestion));

  /* ---------- Avisos push ----------
     Solo mientras el caso siga abierto. Si la persona ya dijo que no, no
     insistimos con un botón que no va a funcionar: el navegador no vuelve a
     preguntar.

     ANTES, cuando AVISOS.soportado() daba falso (el caso más común: iPhone
     sin agregar la página a la pantalla de inicio), el bloque completo se
     quedaba vacío y sin ninguna explicación — parecía que la opción
     simplemente no existía. Ahora siempre se muestra algo. */
  if (!resuelto) {
    const caja = $("#avisos-push");

    if (!AVISOS.soportado()) {
      caja.innerHTML = `<div class="aviso">${esc(AVISOS.motivoNoSoportado())}</div>`;
    } else {
      const pintarAvisos = (estado) => {
        if (estado === "activo") {
          caja.innerHTML = `<div class="aviso aviso--verde">
            <strong>Avisos activados en este teléfono.</strong> Si alguien publica una mascota que
            se parece mucho a ${esc(m.nombre || "la tuya")}, te suena aquí aunque tengas la página cerrada.</div>`;
        } else if (estado === "negado") {
          caja.innerHTML = `<div class="aviso">
            <strong>Los avisos están bloqueados en este navegador.</strong> Se pueden volver a permitir
            desde los ajustes del sitio, en el candado de la barra de direcciones.</div>`;
        } else {
          caja.innerHTML = `<div class="aviso">
            <p style="margin:0 0 10px"><strong>¿Te avisamos apenas aparezca algo?</strong>
              Te suena en este teléfono si alguien publica una mascota parecida, sin que tengas
              que entrar a revisar.</p>
            <button class="boton boton--claro boton--compacto" id="btn-activar-avisos">Activar avisos</button></div>`;
          $("#btn-activar-avisos").addEventListener("click", async () => {
            const b = $("#btn-activar-avisos");
            b.disabled = true; b.textContent = "Activando…";
            try {
              await AVISOS.activar(token);
              pintarAvisos("activo");
              brindis("Listo. Te avisamos apenas haya algo.", 4500);
            } catch (e) {
              pintarAvisos(Notification.permission === "denied" ? "negado" : "sin");
              brindis(e.message || "No se pudieron activar los avisos.", 4500);
            }
          });
        }
      };

      if (Notification.permission === "denied") pintarAvisos("negado");
      else rpc("tiene_suscripcion", { p_token: token })
        .then(tiene => pintarAvisos(tiene && AVISOS.concedido() ? "activo" : "sin"))
        .catch(() => pintarAvisos("sin"));
    }
  }

  /* Escribirle a alguien que dice tener al animal es el momento en que el
     reencuentro está más cerca. Al volver de WhatsApp la pregunta ya está
     esperando, en vez de depender de que la persona se acuerde días después. */
  if (!resuelto) $$("[data-escribio]").forEach(a => a.addEventListener("click", () => {
    const caja = $("#tras-escribir");
    if (!caja || caja.dataset.puesto) return;
    caja.dataset.puesto = "1";
    caja.innerHTML = `<div class="aviso aviso--verde">
      <p style="margin:0 0 10px"><strong>¿Era ${esc(m.nombre || "tu mascota")}?</strong>
        Si ya la recuperaste, márcalo aquí mismo y la ficha deja de aparecer en las búsquedas.</p>
      <button class="boton boton--verde boton--compacto" id="btn-resuelto2">Sí, ya está en casa</button>
    </div>`;
    $("#btn-resuelto2").addEventListener("click", () => $("#btn-resuelto")?.click()
      || marcarResuelto());
  }));

  async function marcarResuelto() {
    try {
      await rpc("actualizar_estado", { p_token: token, p_estado: "resuelto" });
      MIS.parchar(token, { resuelto: true });
      brindis("¡Qué buena noticia! Gracias por avisar.", 5000);
      vistaGestionar(token, new URLSearchParams());
    } catch { brindis("No se pudo actualizar. Intenta otra vez."); }
  }

  $("#btn-resuelto")?.addEventListener("click", async () => {
    try {
      await rpc("actualizar_estado", { p_token: token, p_estado: "resuelto" });
      MIS.parchar(token, { resuelto: true });
      brindis("¡Qué buena noticia! Gracias por avisar.");
      vistaGestionar(token, new URLSearchParams());
    } catch { brindis("No se pudo actualizar. Intenta otra vez."); }
  });
  $("#btn-reactivar")?.addEventListener("click", async () => {
    try {
      await rpc("actualizar_estado", { p_token: token, p_estado: "activo" });
      MIS.parchar(token, { resuelto: false });
      vistaGestionar(token, new URLSearchParams());
    } catch { brindis("No se pudo actualizar."); }
  });
  $("#btn-ocultar").addEventListener("click", async () => {
    if (!confirm("¿Retirar la publicación de la página?")) return;
    try {
      await rpc("actualizar_estado", { p_token: token, p_estado: "oculto" });
      MIS.quitar(token); navegar("/");
    } catch { brindis("No se pudo retirar."); }
  });

  if (!resuelto) {
    buscarCoincidencias(m).then(cs => {
      if (!cs.length) return;

      /* Si acaba de publicar un hallazgo y hay una coincidencia muy fuerte, no
         sirve solo listarla: quien tiene al animal en las manos es esta persona,
         y es la que puede resolver el caso ahora mismo. En vez de esperar a que
         el dueño entre algún día (no tenemos cómo avisarle), le ponemos aquí el
         botón para escribirle de una. */
      const fuertes = cs.filter(c => c.total >= 72);

      /* Le pedimos al servidor que le avise a quien está buscando esas
         mascotas. Solo al publicar un hallazgo, que es el único momento en que
         el servidor acepta la petición, y sin esperar la respuesta: si falla,
         la publicación ya está hecha y las coincidencias ya se ven aquí. */
      if (nuevo && m.tipo === "encontrada" && fuertes.length) {
        AVISOS.avisarCoincidencias(token, fuertes.map(c => c.codigo)).catch(() => { });
      }
      const empujon = fuertes.length && m.tipo === "encontrada" ? `
        <div class="aviso aviso--verde">
          <p style="margin:0 0 6px"><strong>${fuertes.length === 1
            ? "Hay una mascota que se parece muchísimo a la que encontraste."
            : `Hay ${fuertes.length} mascotas que se parecen muchísimo a la que encontraste.`}</strong></p>
          <p style="margin:0 0 10px">Su familia la está buscando y no tiene forma de saber que
            apareció. Ábrela y toca <em>"Creo que es mi mascota"</em>: el contacto se revela al
            instante y les escribes por WhatsApp.</p>
          <a class="boton boton--verde boton--compacto" href="/m/${fuertes[0].codigo}" data-ruta>
            Abrir la más parecida</a>
        </div>` : "";

      /* Lo que cambió desde la última vez que entró. Va ARRIBA de la lista y
         antes de guardar el nuevo estado: si se guardara primero, la novedad
         se borraría sin que la persona alcanzara a verla. */
      const nov = novedadesDeCruce(token, cs);
      // En la primera visita TODO es nuevo: marcarlo sería ruido, no información
      const idsNuevas = new Set(nov.primeraVez ? [] : nov.nuevas.map(c => c.codigo));
      const idsSubieron = new Set(nov.primeraVez ? [] : nov.subieron.map(c => c.codigo));

      let aviso = "";
      if (!nov.primeraVez && (nov.nuevas.length || nov.subieron.length)) {
        const partes = [];
        if (nov.nuevas.length) partes.push(nov.nuevas.length === 1
          ? "1 coincidencia nueva" : `${nov.nuevas.length} coincidencias nuevas`);
        if (nov.subieron.length) partes.push(nov.subieron.length === 1
          ? "1 que ahora se parece más" : `${nov.subieron.length} que ahora se parecen más`);
        aviso = `<div class="aviso aviso--verde">
          <p style="margin:0 0 6px"><strong>Desde tu última visita: ${partes.join(" y ")}.</strong></p>
          <p style="margin:0">${nov.mejorQueNunca
            ? `Y una de ellas es la que <strong>más se ha parecido hasta ahora</strong> (${nov.mejorAhora} de 100). Vale la pena que la abras de primeras.`
            : "Están marcadas abajo para que no tengas que revisar toda la lista otra vez."}</p>
        </div>`;
      }

      const caja2 = $("#coincidencias2");
      caja2.innerHTML = empujon + aviso +
        `<h2 class="seccion__titulo">Revisa estas ${cs.length}</h2>
        <p class="parrafo">Coinciden en zona y características, de la más probable a la menos
          probable. Míralas una por una: toma tres segundos.</p>`;
      pintarCoincidenciasPaginadas(caja2, cs, c =>
        idsNuevas.has(c.codigo) ? "Nueva" : idsSubieron.has(c.codigo) ? "Se parece más" : "");

      recordarCoincidenciasVistas(token, cs);
    }).catch(() => { });
  }
}

/* ---------- EDITAR ---------- */
async function vistaEditar(token) {
  main.innerHTML = `<p class="cargando">Cargando…</p>`;
  if (!CONFIGURADO) return avisoSinConfigurar(main);

  let d; try { d = await rpc("ficha_gestion", { p_token: token }); } catch { }
  if (!d || !d.mascota) { main.innerHTML = `<div class="vacio"><b>Enlace no válido</b></div>`; return; }
  const m = d.mascota;

  const ubi = {
    lat: m.lat, lng: m.lng, precision: m.precision_ubicacion || "aproximada",
    municipio: m.municipio || "", departamento: m.departamento || "", lugar: m.lugar || ""
  };
  const mapa = SelectorUbicacion(ubi, { etiqueta: "Ubicación" });

  main.innerHTML = `
    <a class="volver" href="/g/${token}" data-ruta>← Volver</a>
    <h1 class="titulo-pagina">Corregir datos</h1>
    <p class="intro-pagina">Cambia lo que necesites. Las fotos se conservan.</p>

    <form class="form" id="form-editar">
      <fieldset class="bloque">
        <legend class="bloque__titulo">Datos</legend>
        <div class="campo">
          <label class="campo__etiqueta" for="e-nombre">Nombre</label>
          <input type="text" id="e-nombre" maxlength="40" value="${esc(m.nombre || "")}">
        </div>
        <div class="campo">
          <label class="campo__etiqueta" for="e-raza">Raza o mezcla</label>
          <input type="text" id="e-raza" maxlength="40" value="${esc(m.raza || "")}">
        </div>
        <div class="campo">
          <span class="campo__etiqueta">Tamaño</span>
          ${grupoOpciones("tamano", TAMANOS, { valor: m.tamano })}
        </div>
        <div class="campo">
          <span class="campo__etiqueta">Colores</span>
          ${grupoColores(m.colores || [])}
        </div>
        <div class="campo">
          <span class="campo__etiqueta">Pelo</span>
          ${grupoOpciones("pelo", PELOS, { valor: m.pelo })}
        </div>
        <div class="campo">
          <span class="campo__etiqueta">Sexo</span>
          ${grupoOpciones("sexo", SEXOS, { valor: m.sexo })}
        </div>
        <div class="campo">
          <label class="campo__etiqueta" for="e-rasgos">Señas particulares</label>
          <textarea id="e-rasgos" maxlength="300">${esc(m.rasgos || "")}</textarea>
        </div>
        <div class="campo">
          <label class="campo__etiqueta" for="e-fecha">Fecha</label>
          <input type="date" id="e-fecha" value="${esc(m.fecha)}" max="${hoy()}">
        </div>
      </fieldset>

      ${mapa.html}

      <fieldset class="bloque">
        <legend class="bloque__titulo">Contacto</legend>
        <div class="campo">
          <label class="campo__etiqueta" for="e-cnombre">Tu nombre</label>
          <input type="text" id="e-cnombre" maxlength="60" value="${esc(m.contacto_nombre || "")}">
        </div>
        <div class="campo">
          <label class="campo__etiqueta" for="e-ctel">Tu WhatsApp</label>
          <input type="tel" id="e-ctel" maxlength="20" value="${esc(m.contacto_tel || "")}">
        </div>
        <div class="campo">
          <label class="campo__etiqueta" for="e-cmail">Tu correo</label>
          <input type="email" id="e-cmail" maxlength="80" value="${esc(m.contacto_email || "")}">
        </div>
      </fieldset>

      <button class="boton" type="submit" id="e-enviar">Guardar los cambios</button>
    </form>`;

  mapa.conectar();

  $("#form-editar").addEventListener("submit", async ev => {
    ev.preventDefault();
    const tel = $("#e-ctel").value.trim();
    if (tel && !telValido(tel)) return brindis("Revisa el número de teléfono.");
    const btn = $("#e-enviar"); btn.disabled = true; btn.textContent = "Guardando…";
    try {
      await rpc("editar_publicacion", {
        p_token: token,
        p: {
          nombre: $("#e-nombre").value.trim(), raza: $("#e-raza").value.trim(),
          tamano: leerRadio("tamano") || "", colores: leerChecks("colores"),
          pelo: leerRadio("pelo") || "", sexo: leerRadio("sexo") || "",
          rasgos: $("#e-rasgos").value.trim(), fecha: $("#e-fecha").value || m.fecha,
          lat: ubi.lat, lng: ubi.lng, precision_ubicacion: ubi.precision,
          lugar: ubi.lugar, municipio: ubi.municipio, departamento: ubi.departamento,
          contacto_nombre: $("#e-cnombre").value.trim(), contacto_tel: tel,
          contacto_email: $("#e-cmail").value.trim()
        }
      });
      brindis("Cambios guardados");
      navegar(`/g/${token}`);
    } catch (e) {
      btn.disabled = false; btn.textContent = "Guardar los cambios";
      brindis("No se pudo guardar: " + e.message);
    }
  });
}

/* ---------- CÓMO FUNCIONA ---------- */
function vistaComoFunciona() {
  main.innerHTML = `
    <a class="volver" href="/" data-ruta>← Inicio</a>
    <h1 class="titulo-pagina">Cómo funciona</h1>
    <p class="intro-pagina">Y por qué es distinto a publicar en un grupo de redes sociales.</p>

    <h2 class="seccion__titulo">El problema</h2>
    <p class="parrafo">Un perro perdido no tiene nombre buscable. Si tu perro se llama Max y alguien
      lo encuentra, esa persona no sabe que se llama Max. No puede buscarlo por nombre, ni por
      documento, ni por nada de lo que tú sabes de él.</p>
    <p class="parrafo">Lo único que ese desconocido tiene es lo que ve: un perro mediano, café con
      blanco, con una oreja caída, en tal barrio, hoy. Y lo único que tú tienes es lo mismo, más la
      fecha en que se perdió.</p>

    <h2 class="seccion__titulo">Por qué la ubicación es la pieza clave</h2>
    <p class="parrafo">Miles de mascotas se parecen entre sí. Un criollo café y blanco de tamaño
      mediano hay en todas las ciudades del país. Lo que separa a <em>tu</em> perro de todos los
      perros parecidos del país es <strong>dónde</strong> y <strong>cuándo</strong>.</p>
    <p class="parrafo">Por eso te pedimos marcar un punto en el mapa y no solo escribir el barrio.
      Un texto como "cerca del parque" no se puede comparar con otro texto que diga "junto a la
      cancha": para un computador son dos frases distintas. Dos puntos en el mapa, en cambio,
      se pueden restar: están a 400 metros. Eso sí es comparable, y es lo que permite que el
      cruce funcione solo.</p>
    <div class="aviso aviso--destacado">
      <strong>Marca dónde pasó, no dónde estás.</strong> Si perdiste a tu mascota en el parque
      pero estás publicando desde tu casa, mueve el punto al parque. Si te encontraste un animal
      y ya lo llevaste a tu casa, marca la calle donde lo viste, no tu casa.
    </div>
    <p class="parrafo">El radio de búsqueda se abre solo con el tiempo: el primer día buscamos en
      unos 3 km a la redonda, y esa distancia crece cada día que pasa, porque los animales caminan
      y porque la gente los mueve.</p>

    <h2 class="seccion__titulo">Los dos lados se cruzan solos</h2>
    <p class="parrafo">Esta es la diferencia de fondo. En un grupo de redes sociales tú publicas y
      esperas que la persona correcta vea tu publicación antes de que se hunda en el muro. El
      encuentro depende del algoritmo y de la suerte.</p>
    <p class="parrafo">Aquí hay dos listas: la de mascotas que se buscan y la de mascotas
      encontradas. Cada vez que entra un reporte nuevo, se compara contra toda la lista contraria
      y se ordenan las que más se parecen. No decidimos nada: reducimos cientos de casos a los
      seis que vale la pena mirar, y tú decides en tres segundos viendo las fotos.</p>

    <h2 class="seccion__titulo">Qué comparamos</h2>
    <ul class="lista">
      <li><strong>Distancia real</strong> entre los dos puntos del mapa, con el radio creciendo por día.</li>
      <li><strong>Especie y tamaño</strong>, con tolerancia: mucha gente calcula mal el tamaño,
        así que un escalón de diferencia casi no castiga.</li>
      <li><strong>Colores por componentes.</strong> "Manchado" y "negro y blanco" describen al
        mismo animal, y para nosotros cuentan como parecidos.</li>
      <li><strong>Fechas coherentes:</strong> nadie encuentra a un animal antes de que se pierda.</li>
      <li><strong>Pelo, sexo y raza</strong> cuando están.</li>
    </ul>

    <h2 class="seccion__titulo">El afiche que no caduca</h2>
    <p class="parrafo">Los afiches que la gente hace a mano se vuelven basura en cuanto el animal
      aparece: siguen circulando por WhatsApp durante meses y mandan a la gente a buscar en vano.</p>
    <p class="parrafo">El afiche de aquí lleva un código QR. La imagen no cambia, pero la ficha a la
      que lleva sí: si el animal ya apareció, quien lo escanee ve un aviso verde de que el caso se
      resolvió, y un botón para publicar el suyo. Un afiche viejo se convierte en un usuario nuevo
      en vez de en una búsqueda inútil.</p>

    <h2 class="seccion__titulo">Contacto y estafas</h2>
    <p class="parrafo">El número de quien publica no aparece escrito en la página. Para conseguirlo
      hay que tocar un botón, en una ficha a la vez. Una persona lo consigue al instante; un
      programa que recoge números en masa para vender bases de datos, no.</p>
    <p class="parrafo">Además, a quien publica una mascota perdida le pedimos una seña que
      <em>no</em> se publica en ninguna parte. Si alguien dice tener a tu mascota, pídele que te
      describa esa seña. Si de verdad la tiene, la ve.</p>
    <div class="aviso aviso--rojo">Nadie legítimo pide dinero por adelantado para devolver un
      animal, ni para "el transporte", ni para "el veterinario". Si te lo piden, es una estafa.</div>

    <p style="margin-top:26px"><a href="/reportar/perdida" data-ruta class="enlace-fuerte">Publicar una mascota perdida →</a></p>
    <p style="margin-top:8px"><a href="/reportar/encontrada" data-ruta class="enlace-fuerte">Reportar una que encontré →</a></p>`;
}

/* ============================================================
   8. AFICHE
   ============================================================ */
/* Con tiempo límite: si la foto no carga (almacenamiento lento, red caída),
   el afiche se genera igual con el recuadro vacío en vez de quedarse colgado. */
function cargarImagen(url, limite = 8000) {
  return new Promise(res => {
    let listo = false;
    const terminar = v => { if (!listo) { listo = true; res(v); } };
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => terminar(i);
    i.onerror = () => terminar(null);
    setTimeout(() => terminar(null), limite);
    i.src = url;
  });
}

function ajustarTexto(ctx, texto, maxAncho, tamInicial, fuente, peso) {
  let t = tamInicial;
  do { ctx.font = `${peso} ${t}px ${fuente}`; t -= 2; }
  while (ctx.measureText(texto).width > maxAncho && t > 16);
  return t + 2;
}

function envolver(ctx, texto, maxAncho) {
  const palabras = String(texto).split(/\s+/), lineas = []; let linea = "";
  for (const p of palabras) {
    const prueba = linea ? linea + " " + p : p;
    if (ctx.measureText(prueba).width > maxAncho && linea) { lineas.push(linea); linea = p; }
    else linea = prueba;
  }
  if (linea) lineas.push(linea);
  return lineas;
}

/* Rectángulo de esquinas redondeadas. roundRect() nativo no existe en
   navegadores viejos, y en zona rural hay muchos teléfonos viejos. */
function cajaRedonda(x, px, py, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  x.beginPath();
  x.moveTo(px + rr, py);
  x.arcTo(px + w, py, px + w, py + h, rr);
  x.arcTo(px + w, py + h, px, py + h, rr);
  x.arcTo(px, py + h, px, py, rr);
  x.arcTo(px, py, px + w, py, rr);
  x.closePath();
}

/* La foto ocupa cerca de la mitad del afiche y va de borde a borde: en un
   afiche pegado en un poste la foto ES el mensaje. El bloque del QR va sobre
   un panel oscuro para que se lea como "aquí se hace algo", no como pie de
   página perdido.

   Un solo lugar para las medidas: tanto dibujarAfiche() como el control de
   "ajustar foto" (más abajo) necesitan saber cuánto mide la franja de la
   foto, y si vivieran en dos sitios se podrían desincronizar como ya pasó
   una vez con la copia del algoritmo de cruce. */
/* ---------- AJUSTE DE FOTO PARA EL AFICHE ----------
   El afiche recorta la foto para llenar la franja de arriba ("cover"). Si el
   animal no quedó centrado en la foto original, la parte que importa puede
   caer fuera del recuadro o quedar tapada por el resto del diseño. Este
   control deja arrastrar y hacer zoom sobre la foto para elegir qué parte se
   ve, antes de generar el afiche. No se sube ni se recorta nada de verdad:
   solo se guardan tres números (zoom, panX, panY) que dibujarAfiche() usa
   al pintar el lienzo.

   Por qué en fracciones y no en píxeles: así el mismo ajuste sirve igual sin
   importar el ancho de la franja, y no hay que recalcular nada al cambiar
   entre "Publicación" e "Historia". */
function AjustadorFoto(estado, opciones = {}) {
  const html = `
    <div class="ajuste-foto">
      <div class="ajuste-foto__marco" id="af-marco" style="aspect-ratio:${esc(opciones.aspecto || "1")}">
        <img id="af-img" src="${esc(estado.url)}" alt="" draggable="false">
      </div>
      <div class="ajuste-foto__controles">
        <span class="ajuste-foto__icono" aria-hidden="true">🔍</span>
        <input type="range" id="af-zoom" min="1" max="2.5" step="0.02" value="${estado.ajuste.zoom}"
          aria-label="Acercar la foto">
        <button type="button" class="boton boton--claro boton--compacto" id="af-reset">Centrar de nuevo</button>
      </div>
      <p class="campo__ayuda">Arrastra la foto para moverla dentro del marco.</p>
    </div>`;

  const conectar = () => {
    const marco = $("#af-marco"), img = $("#af-img"), zoom = $("#af-zoom");
    let arrastrando = false, ultimo = null;

    const avisar = final => { if (opciones.alCambiar) opciones.alCambiar(final); };

    const pintar = () => {
      const mw = marco.clientWidth, mh = marco.clientHeight;
      const iw = img.naturalWidth, ih = img.naturalHeight;
      if (!iw || !ih || !mw || !mh) return;
      const cubre = Math.max(mw / iw, mh / ih) * estado.ajuste.zoom;
      const aw = iw * cubre, ah = ih * cubre;
      const x = -(aw - mw) * estado.ajuste.panX;
      const y = -(ah - mh) * estado.ajuste.panY;
      img.style.width = aw + "px";
      img.style.height = ah + "px";
      img.style.transform = `translate(${x}px, ${y}px)`;
    };
    if (img.complete) pintar(); else img.addEventListener("load", pintar, { once: true });
    new ResizeObserver(pintar).observe(marco);   // cambia el ancho al rotar el celular

    zoom.addEventListener("input", () => {
      estado.ajuste.zoom = +zoom.value;
      pintar(); avisar(false);
    });
    zoom.addEventListener("change", () => avisar(true));   // al soltar el control

    $("#af-reset").addEventListener("click", () => {
      estado.ajuste = { zoom: 1, panX: 0.5, panY: 0 };
      zoom.value = 1;
      pintar(); avisar(true);
    });

    const mover = (dx, dy) => {
      const mw = marco.clientWidth, mh = marco.clientHeight;
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const cubre = Math.max(mw / iw, mh / ih) * estado.ajuste.zoom;
      // Math.max(1, …): evita dividir entre 0 en el caso límite de una foto
      // que cubre justo al pelo, sin nada de sobrante para desplazar.
      const excesoX = Math.max(1, iw * cubre - mw), excesoY = Math.max(1, ih * cubre - mh);
      estado.ajuste.panX = Math.min(1, Math.max(0, estado.ajuste.panX - dx / excesoX));
      estado.ajuste.panY = Math.min(1, Math.max(0, estado.ajuste.panY - dy / excesoY));
      pintar();
    };

    marco.addEventListener("pointerdown", e => {
      arrastrando = true; ultimo = { x: e.clientX, y: e.clientY };
      // Puede fallar en algún borde raro (p.ej. si el navegador ya perdió el
      // puntero); no debe tumbar el resto del arrastre si eso pasa.
      try { marco.setPointerCapture(e.pointerId); } catch { }
      marco.classList.add("ajuste-foto__marco--arrastrando");
    });
    marco.addEventListener("pointermove", e => {
      if (!arrastrando) return;
      mover(e.clientX - ultimo.x, e.clientY - ultimo.y);
      ultimo = { x: e.clientX, y: e.clientY };
      avisar(false);
    });
    const soltar = () => {
      if (!arrastrando) return;
      arrastrando = false;
      marco.classList.remove("ajuste-foto__marco--arrastrando");
      avisar(true);
    };
    marco.addEventListener("pointerup", soltar);
    marco.addEventListener("pointercancel", soltar);
  };

  return { html, conectar };
}

const LAYOUT_AFICHE = {
  cuadrado: { W: 1080, H: 1080, franja: 118, rotulo: 76, margen: 48,
    fotoY: 118, fotoAlto: 486,
    nombre: 74, clave: 33, zona: 36, senas: 29, senasSalto: 38, senasMax: 1,
    panelY: 842, panelAlto: 186, qrLado: 122, enlace: 32, pie: 22 },
  historia: { W: 1080, H: 1920, franja: 186, rotulo: 108, margen: 56,
    fotoY: 186, fotoAlto: 940,
    nombre: 104, clave: 46, zona: 50, senas: 40, senasSalto: 52, senasMax: 2,
    panelY: 1560, panelAlto: 286, qrLado: 190, enlace: 44, pie: 30 }
};

/* ajusteFoto = { zoom, panX, panY }, todo en fracciones (0..1), no en píxeles:
   así sirve igual sin importar el ancho de la franja, y no hay que recalcular
   nada al cambiar entre "Publicación" e "Historia". Sin ajuste (o con el
   default zoom:1, panX:0.5, panY:0) el resultado es idéntico al de antes:
   centrada en horizontal, pegada arriba en vertical. */
async function dibujarAfiche(m, formato, ajusteFoto) {
  try { await document.fonts.ready; } catch { }

  const historia = formato === "historia";
  const L = LAYOUT_AFICHE[historia ? "historia" : "cuadrado"];
  const W = L.W, H = L.H;

  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");

  const PAPEL = "#F4F2E9", TINTA = "#12211C", SUAVE = "#4A5A53", MARCADOR = "#FFD447";
  const ACENTO = m.estado === "resuelto" ? "#15704B"
    : m.tipo === "perdida" ? "#D6402A" : "#15704B";
  const D = '"Bricolage Grotesque", sans-serif', C = '"Instrument Sans", sans-serif';

  x.fillStyle = PAPEL; x.fillRect(0, 0, W, H);

  // ---------- Franja del rótulo ----------
  x.fillStyle = ACENTO; x.fillRect(0, 0, W, L.franja);
  x.fillStyle = "#fff"; x.textAlign = "center";
  const rotulo = m.estado === "resuelto" ? "YA ESTÁ EN CASA"
    : m.tipo === "perdida" ? "SE BUSCA" : "SE ENCONTRÓ";
  const tr = ajustarTexto(x, rotulo, W - 120, L.rotulo, D, 800);
  x.font = `800 ${tr}px ${D}`;
  x.fillText(rotulo, W / 2, L.franja / 2 + tr * 0.35);

  // ---------- Foto de borde a borde ----------
  const img = fotoPrincipal(m) ? await cargarImagen(fotoPrincipal(m)) : null;
  x.fillStyle = "#E7E4D7";
  x.fillRect(0, L.fotoY, W, L.fotoAlto);
  if (img) {
    const a = ajusteFoto || { zoom: 1, panX: 0.5, panY: 0 };
    const cubre = Math.max(W / img.width, L.fotoAlto / img.height) * a.zoom;
    const aw = img.width * cubre, ah = img.height * cubre;
    // panX/panY dicen qué tanto del sobrante se recorta de cada lado: 0 pega
    // la imagen contra el borde de arriba/izquierda, 1 contra el de abajo/derecha.
    const dx = -(aw - W) * a.panX;
    const dy = L.fotoY - (ah - L.fotoAlto) * a.panY;
    x.save(); x.beginPath(); x.rect(0, L.fotoY, W, L.fotoAlto); x.clip();
    x.drawImage(img, dx, dy, aw, ah);
    x.restore();
  } else {
    // Sin foto no dejamos un bloque gris enorme y mudo
    x.fillStyle = "#CFCBBC"; x.textAlign = "center";
    x.font = `800 ${historia ? 150 : 96}px ${D}`;
    x.fillText("🐾", W / 2, L.fotoY + L.fotoAlto / 2 + (historia ? 20 : 12));
    x.fillStyle = SUAVE; x.font = `500 ${historia ? 40 : 30}px ${C}`;
    x.fillText("Sin foto — mira las señas", W / 2, L.fotoY + L.fotoAlto / 2 + (historia ? 116 : 78));
  }
  // línea fina que separa la foto del papel
  x.fillStyle = "rgba(18,33,28,.18)"; x.fillRect(0, L.fotoY + L.fotoAlto - 2, W, 2);

  // ---------- Nombre ----------
  let y = L.fotoY + L.fotoAlto + (historia ? 104 : 66);
  x.textAlign = "center"; x.fillStyle = TINTA;
  const titulo = (m.nombre || `${m.especie} sin identificar`).toUpperCase();
  const tt = ajustarTexto(x, titulo, W - L.margen * 2, L.nombre, D, 800);
  x.font = `800 ${tt}px ${D}`;
  x.fillText(titulo, W / 2, y);
  y += historia ? 64 : 44;

  // ---------- Datos clave ----------
  const clave = [m.especie, m.tamano, (m.colores || []).map(colorNombre).join(" y ")]
    .filter(Boolean).join(" · ");
  x.font = `500 ${L.clave}px ${C}`; x.fillStyle = SUAVE;
  x.fillText(clave, W / 2, y);
  y += historia ? 76 : 54;

  // ---------- Zona, resaltada ----------
  const zona = `${m.tipo === "perdida" ? "Se perdió" : "Apareció"} en ${m.lugar || m.municipio || "zona sin especificar"}`;
  const anchoUtil = W - L.margen * 2 - 36;
  let tz = L.zona;
  x.font = `600 ${tz}px ${C}`;
  let lineasZona = [zona];
  if (x.measureText(zona).width > anchoUtil) {
    lineasZona = envolver(x, zona, anchoUtil).slice(0, 2);
    if (lineasZona.length === 1) tz = ajustarTexto(x, zona, anchoUtil, L.zona, C, 600);
  }
  lineasZona.forEach(linea => {
    x.font = `600 ${tz}px ${C}`;
    const anchoZ = Math.min(x.measureText(linea).width + 34, W - L.margen);
    x.fillStyle = MARCADOR;
    cajaRedonda(x, W / 2 - anchoZ / 2, y - tz * 0.82, anchoZ, tz * 1.2, tz * 0.28); x.fill();
    x.fillStyle = TINTA;
    x.fillText(linea, W / 2, y);
    y += tz * 1.34;
  });
  y += historia ? 14 : 8;

  // ---------- Fecha ----------
  x.font = `400 ${L.senas}px ${C}`; x.fillStyle = SUAVE;
  x.fillText(`${fechaLarga(m.fecha)} · ${haceCuanto(m.fecha)}`, W / 2, y);
  y += historia ? 54 : 38;

  /* ---------- Señas y collar ----------
     El collar va primero: es lo más identificador que un desconocido alcanza a
     ver de lejos, sin acercarse al animal. */
  const detalles = [];
  if (m.collar) detalles.push(`Collar: ${m.collar}`);
  if (m.rasgos) detalles.push(m.rasgos);
  if (detalles.length) {
    x.font = `400 ${L.senas}px ${C}`; x.fillStyle = TINTA;
    const lineas = [];
    for (const d of detalles) lineas.push(...envolver(x, d, W - L.margen * 2));
    const caben = Math.max(0, Math.min(L.senasMax,
      Math.floor((L.panelY - 20 - y) / L.senasSalto)));
    lineas.slice(0, caben).forEach(l => { x.fillText(l, W / 2, y); y += L.senasSalto; });
  }

  /* ---------- Panel del QR ----------
     Sobre fondo oscuro, con el QR en su tarjeta blanca. Antes el QR flotaba
     sobre el papel y se leía como pie de página; así se lee como la acción
     principal del afiche. */
  const url = `${baseURL()}/m/${m.codigo}`;
  const dominio = baseURL().replace(/^https?:\/\//, "");
  const pm = L.margen, pw = W - pm * 2;

  x.fillStyle = TINTA;
  cajaRedonda(x, pm, L.panelY, pw, L.panelAlto, historia ? 34 : 26); x.fill();

  const relleno = historia ? 30 : 22;
  let textoX = pm + relleno;

  if (window.qrcode) {
    const q = window.qrcode(0, "M"); q.addData(url); q.make();
    const n = q.getModuleCount(), p = L.qrLado / n;
    /* El QR necesita un borde blanco de al menos 4 módulos alrededor ("zona
       tranquila") o hay lectores que no lo agarran. Como el panel es oscuro,
       ese borde tiene que venir de la tarjeta blanca: lo calculamos a partir
       del tamaño real del módulo, no a ojo. */
    const acolchado = Math.ceil(p * 4) + 2;
    const qrCaja = L.qrLado + acolchado * 2;
    const qrX = pm + relleno, qrY = L.panelY + (L.panelAlto - qrCaja) / 2;

    x.fillStyle = "#fff";
    cajaRedonda(x, qrX, qrY, qrCaja, qrCaja, 12); x.fill();
    const ix = qrX + acolchado, iy = qrY + acolchado;
    x.fillStyle = TINTA;
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++)
      if (q.isDark(r, col)) x.fillRect(ix + col * p, iy + r * p, p + 0.6, p + 0.6);
    textoX = qrX + qrCaja + (historia ? 40 : 28);
  }

  x.textAlign = "left";
  const anchoTexto = W - textoX - pm - relleno;
  let ty = L.panelY + (historia ? 92 : 62);

  x.fillStyle = MARCADOR; x.font = `700 ${L.senas}px ${C}`;
  x.fillText("ESCANEA EL CÓDIGO", textoX, ty);
  ty += historia ? 56 : 40;

  x.fillStyle = "#fff";
  const te = ajustarTexto(x, `${dominio}/m/${m.codigo}`, anchoTexto, L.enlace, D, 700);
  x.font = `700 ${te}px ${D}`;
  x.fillText(`${dominio}/m/${m.codigo}`, textoX, ty);
  ty += historia ? 50 : 34;

  x.fillStyle = "rgba(255,255,255,.72)"; x.font = `400 ${L.pie}px ${C}`;
  envolver(x, "Información al día y contacto directo.", anchoTexto)
    .slice(0, 2).forEach((l, i) => x.fillText(l, textoX, ty + i * (L.pie + 8)));

  // ---------- Pie ----------
  x.textAlign = "center"; x.fillStyle = SUAVE; x.font = `400 ${L.pie}px ${C}`;
  x.fillText("Nadie que de verdad lo tenga te va a pedir dinero por adelantado.", W / 2, H - 30);

  return c;
}

async function vistaAfiche(codigo) {
  main.innerHTML = `<p class="cargando">Preparando el afiche…</p>`;
  if (!CONFIGURADO) return avisoSinConfigurar(main);

  let m;
  try { m = (await rest(`mascotas_publicas?codigo=eq.${encodeURIComponent(codigo)}&limit=1`))[0]; } catch { }
  if (!m) { main.innerHTML = `<div class="vacio"><b>No encontramos esa ficha</b></div>`; return; }

  const foto = fotoPrincipal(m);
  /* Un solo ajuste, reutilizado en los dos formatos: como zoom/pan se guardan
     en fracciones (ver AjustadorFoto), sigue siendo válido al cambiar entre
     "Publicación" e "Historia" aunque la franja de la foto cambie de forma. */
  const estadoFoto = { url: foto, ajuste: { zoom: 1, panX: 0.5, panY: 0 } };

  main.innerHTML = `
    <a class="volver" href="/m/${m.codigo}" data-ruta>← Volver a la ficha</a>
    <h1 class="titulo-pagina">Afiche para compartir</h1>
    <p class="intro-pagina">El código QR lleva a la ficha, que siempre muestra el estado al día.
      Aunque el afiche siga circulando dentro de un mes, nadie va a buscar en vano.</p>
    <div class="afiche-formatos">
      <label class="opcion"><input type="radio" name="formato" value="cuadrado" checked><span>Publicación</span></label>
      <label class="opcion"><input type="radio" name="formato" value="historia"><span>Historia</span></label>
    </div>
    ${foto ? `<div id="ajuste-foto-caja"></div>` : ""}
    <img class="afiche-previa" id="previa" alt="Vista previa del afiche">
    <div class="botonera botonera--ancha" style="margin-top:16px">
      <button class="boton boton--compacto" id="btn-compartir">Compartir</button>
      <button class="boton boton--claro boton--compacto" id="btn-descargar">Descargar</button>
    </div>
    <div class="aviso">Súbelo a tus historias y pega copias impresas cerca de donde se perdió.
      La gente del barrio es la que más lo ve.</div>`;

  let lienzo = null;
  const pintar = async () => {
    const f = leerRadio("formato") || "cuadrado";
    $("#previa").style.opacity = ".4";
    lienzo = await dibujarAfiche(m, f, estadoFoto.ajuste);
    $("#previa").src = lienzo.toDataURL("image/png");
    $("#previa").style.opacity = "1";
  };
  const pintarLento = debounce(pintar, 200);   // mientras se arrastra o se hace zoom

  const montarAjustador = () => {
    const caja = $("#ajuste-foto-caja");
    if (!caja) return;
    const f = leerRadio("formato") || "cuadrado";
    const l = LAYOUT_AFICHE[f];
    const ajustador = AjustadorFoto(estadoFoto, {
      aspecto: `${l.W}/${l.fotoAlto}`,
      alCambiar: final => final ? pintar() : pintarLento()
    });
    caja.innerHTML = ajustador.html;
    ajustador.conectar();
  };

  if (foto) montarAjustador();
  $$('input[name="formato"]').forEach(i => i.addEventListener("change", () => {
    if (foto) montarAjustador();   // el marco cambia de forma según el formato
    pintar();
  }));
  await pintar();

  const nombreArchivo = () =>
    `afiche-${(m.nombre || m.especie).toLowerCase().replace(/\s+/g, "-")}-${m.codigo}.png`;

  $("#btn-descargar").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = lienzo.toDataURL("image/png"); a.download = nombreArchivo(); a.click();
    brindis("Afiche descargado");
  });

  $("#btn-compartir").addEventListener("click", () => {
    lienzo.toBlob(async blob => {
      const archivo = new File([blob], nombreArchivo(), { type: "image/png" });
      const texto = `${m.tipo === "perdida" ? "SE BUSCA" : "ENCONTRADA"}: ${nombreMostrado(m)} — ${m.lugar || m.municipio || ""}. Información y contacto: ${baseURL()}/m/${m.codigo}`;
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        try { await navigator.share({ files: [archivo], text: texto }); return; } catch { }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = nombreArchivo(); a.click();
      try { await navigator.clipboard.writeText(texto); } catch { }
      brindis("Afiche descargado y texto copiado.");
    }, "image/png");
  });
}

/* ============================================================
   9. RUTAS
   ============================================================ */
let modoHash = location.protocol === "file:";

function rutaActual() {
  const cruda = modoHash ? (location.hash.slice(1) || "/") : location.pathname + location.search;
  const [camino, consulta] = cruda.split("?");
  return { camino: camino.replace(/\/+$/, "") || "/", params: new URLSearchParams(consulta || "") };
}

function navegar(ruta) {
  if (!modoHash) {
    try { history.pushState({}, "", ruta); enrutar(); return; }
    catch { modoHash = true; }
  }
  if (location.hash.slice(1) === ruta) enrutar();
  else location.hash = ruta;
}

function enrutar() {
  const { camino: p, params } = rutaActual();
  scrollTo(0, 0);

  if (p === "/") return vistaPortada();
  if (p === "/buscar") return vistaBuscar();
  if (p === "/como-funciona") return vistaComoFunciona();
  if (p === "/reportar/perdida") return vistaReportar("perdida");
  if (p === "/reportar/encontrada") return vistaReportar("encontrada");
  if (p === "/gestionar") return vistaGestionar(null, params);
  if (p.startsWith("/m/")) return vistaFicha(decodeURIComponent(p.slice(3)));
  if (p.startsWith("/g/")) return vistaGestionar(decodeURIComponent(p.slice(3)), params);
  if (p.startsWith("/editar/")) return vistaEditar(decodeURIComponent(p.slice(8)));
  if (p.startsWith("/afiche/")) return vistaAfiche(decodeURIComponent(p.slice(8)));

  main.innerHTML = `<div class="vacio">
    <h1 style="font:inherit;margin:0 0 5px"><b>Esta página no existe</b></h1>
    Puede que el enlace esté incompleto o que la publicación se haya retirado.
    <p style="margin-top:12px"><a href="/" data-ruta class="enlace-fuerte">Volver al inicio →</a></p></div>`;
}

document.addEventListener("click", e => {
  const a = e.target.closest("a[data-ruta]");
  if (!a) return;
  const destino = a.getAttribute("href");
  if (!destino || !destino.startsWith("/")) return;
  e.preventDefault();
  navegar(destino);
});

addEventListener("popstate", enrutar);
addEventListener("hashchange", enrutar);
enrutar();
