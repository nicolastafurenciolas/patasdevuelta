// ============================================================
//  COPIA EJECUTABLE DEL ALGORITMO DE CRUCE
//
//  Es una copia literal de las funciones puras de app.js (puntuar,
//  parecidoColor, parecidoPaleta, distanciaKm, banda) para poder
//  correrlas desde Node sin navegador y sin tocar Supabase.
//
//  SI TOCAS EL ALGORITMO EN app.js, ACTUALIZA TAMBIÉN ESTE ARCHIVO.
//  Las pruebas de esta carpeta miden esta copia, no la original.
// ============================================================

const ORDEN_TAMANO = { "Pequeño": 0, "Mediano": 1, "Grande": 2 };
const ORDEN_EDAD = { "Cachorro": 0, "Joven": 1, "Adulto": 2, "Viejito": 3 };

const COLORES = [
  { k: "negro",    n: "Negro",    comp: ["negro"] },
  { k: "blanco",   n: "Blanco",   comp: ["blanco"] },
  { k: "gris",     n: "Gris",     comp: ["gris", "negro"] },
  { k: "cafe",     n: "Café",     comp: ["cafe"] },
  { k: "canela",   n: "Canela",   comp: ["cafe", "dorado"] },
  { k: "dorado",   n: "Dorado",   comp: ["dorado", "cafe"] },
  { k: "crema",    n: "Crema",    comp: ["blanco", "dorado"] },
  { k: "naranja",  n: "Naranja",  comp: ["naranja", "cafe"] },
  { k: "atigrado", n: "Atigrado", comp: ["cafe", "negro"] },
  { k: "manchado", n: "Manchado", comp: ["blanco", "negro"] },
  { k: "tricolor", n: "Tricolor", comp: ["blanco", "cafe", "negro"] }
];
const MAPA_COLOR = Object.fromEntries(COLORES.map(c => [c.k, c]));

function distanciaKm(a, b, c, d) {
  if ([a, b, c, d].some(v => v == null)) return null;
  const R = 6371, r = Math.PI / 180;
  const dLat = (c - a) * r, dLng = (d - b) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const distanciaTexto = km =>
  km == null ? "" : km < 1 ? `a ${Math.round(km * 1000)} m` : `a ${km.toFixed(km < 10 ? 1 : 0)} km`;

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

function parecidoPaleta(A = [], B = []) {
  if (!A.length || !B.length) return null;
  const mejor = (lista, otra) =>
    lista.reduce((s, x) => s + Math.max(...otra.map(y => parecidoColor(x, y))), 0) / lista.length;
  return (mejor(A, B) + mejor(B, A)) / 2;
}

const normalizarTexto = s => String(s || "").trim().toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "");

function distanciaEdicion(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
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
  if (typeof PALABRAS_DE_COLOR !== "undefined" && PALABRAS_DE_COLOR.has(a) && PALABRAS_DE_COLOR.has(b)) return false;
  const corta = Math.min(a.length, b.length);
  if (corta < 4) return false;
  return distanciaEdicion(a, b) <= (corta >= 8 ? 2 : 1);
}

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

const PALABRAS_SI_COLLAR = new Set(["si", "llevaba", "llevava", "tenia", "claro",
  "efectivamente", "obvio", "correcto", "asi", "seguro"]);
const PALABRAS_NO_COLLAR = new Set(["no", "nunca", "jamas"]);

function indicaCollar(texto) {
  const palabras = normalizarTexto(texto).split(/[^a-z0-9]+/).filter(Boolean);
  const si = palabras.some(p => PALABRAS_SI_COLLAR.has(p));
  const no = palabras.some(p => PALABRAS_NO_COLLAR.has(p));
  return si && !no;
}

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
      if (fp != null && fp === fq) return 0.65;
    }
    return 0.35;
  }

  const confirmaA = A.size > 0 || indicaCollar(a);
  const confirmaB = B.size > 0 || indicaCollar(b);
  if (confirmaA && confirmaB) return 0.2;

  return null;
}

function puntuar(base, cand) {
  if (base.especie !== cand.especie &&
      base.especie !== "Otro" && cand.especie !== "Otro") return { total: 0 };

  const fb = new Date(base.fecha + "T12:00:00"), fc = new Date(cand.fecha + "T12:00:00");
  const perdida = base.tipo === "perdida" ? fb : fc;
  const hallazgo = base.tipo === "perdida" ? fc : fb;
  const diasEntre = (hallazgo - perdida) / 86400000;

  const anticipo = Math.max(0, -diasEntre - 2);   // días más allá del margen de 2

  const razones = [];
  const senales = [];
  const castigos = [];

  if (anticipo > 0) castigos.push(Math.max(0.6, 1 - anticipo / 75));

  const km = distanciaKm(base.lat, base.lng, cand.lat, cand.lng);
  const radio = Math.min(3 + Math.abs(diasEntre) * 1.5, 25);

  if (km != null) {
    senales.push([40, Math.max(0, 1 - km / radio)]);
    razones.push(distanciaTexto(km) + " de distancia");
  } else if (base.municipio && cand.municipio && base.municipio === cand.municipio) {
    senales.push([40, 0.45]);
    razones.push("mismo municipio");
  } else {
    senales.push([40, base.departamento && base.departamento === cand.departamento ? 0.12 : 0]);
    castigos.push(0.75);
  }

  const ta = ORDEN_TAMANO[base.tamano], tb = ORDEN_TAMANO[cand.tamano];
  if (ta != null && tb != null) {
    const d = Math.abs(ta - tb);
    senales.push([18, d === 0 ? 1 : d === 1 ? 0.45 : 0]);
    if (d === 0) razones.push("mismo tamaño");
    if (d === 2) castigos.push(0.65);
  }

  const col = parecidoPaleta(base.colores, cand.colores);
  if (col != null) {
    senales.push([26, col]);
    if (col >= 0.85) razones.push("colores iguales");
    else if (col >= 0.45) razones.push("colores parecidos");
    if (col < 0.15) castigos.push(0.6);
  }

  const ea = ORDEN_EDAD[base.edad_aprox], eb = ORDEN_EDAD[cand.edad_aprox];
  if (ea != null && eb != null) {
    const d = Math.abs(ea - eb);
    senales.push([10, d === 0 ? 1 : d === 1 ? 0.5 : 0]);
    if (d >= 3) castigos.push(0.75);
  }

  if (base.pelo && cand.pelo) senales.push([8, base.pelo === cand.pelo ? 1 : 0.15]);
  if (base.sexo && cand.sexo && base.sexo !== "No sé" && cand.sexo !== "No sé") {
    const igual = base.sexo === cand.sexo;
    senales.push([8, igual ? 1 : 0]);
    if (!igual) castigos.push(0.7);
  }
  if (base.raza && cand.raza) {
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

/* Alarma de desincronización: si alguien toca puntuar() en app.js y olvida
   actualizar esta copia, las pruebas seguirían midiendo el código viejo y
   dando "todo bien" sobre un algoritmo que ya no existe. Esto compara el
   texto de la función real contra el de la copia y avisa. */
function verificarSincronia() {
  const fs = require("fs"), path = require("path");
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const desde = app.indexOf("function puntuar(base, cand) {");
  if (desde === -1) return { ok: false, motivo: "no se encontró puntuar() en app.js" };
  const hasta = app.indexOf("\n}", app.indexOf("return { total, razones, km, dias: diasEntre };", desde));
  const limpiar = t => t
    .replace(/\/\*[\s\S]*?\*\//g, "")   // comentarios de bloque
    .replace(/\/\/[^\n]*/g, "")          // comentarios de línea
    .replace(/\s+/g, " ").trim();
  const original = limpiar(app.slice(desde, hasta + 2));
  const copia = limpiar(puntuar.toString());
  return original === copia
    ? { ok: true }
    : { ok: false, motivo: "puntuar() en app.js YA NO COINCIDE con la copia de pruebas/algoritmo.js" };
}

const banda = n => n >= 72 ? "alta" : n >= 48 ? "media" : "baja";

// Replica el filtrado servidor+cliente de buscarCoincidencias() en app.js:
// misma especie, recuadro de ~60km cuando hay coordenadas, umbral 26, tope 12.
function candidatosPara(m, lista) {
  const grados = 60 / 111;
  return lista.filter(c => {
    if (c.especie !== m.especie && c.especie !== "Otro" && m.especie !== "Otro") return false;
    if (m.lat != null && c.lat != null) {
      if (Math.abs(c.lat - m.lat) > grados || Math.abs(c.lng - m.lng) > grados) return false;
    }
    return true;
  });
}

function coincidenciasDe(m, lista, { minimo = 26, tope = 24 } = {}) {
  return candidatosPara(m, lista)
    .map(c => ({ ...c, ...puntuar(m, c) }))
    .filter(c => c.total >= minimo)
    .sort((a, b) => b.total - a.total)
    .slice(0, tope);
}

const dias = (fecha, n) => {
  const d = new Date(fecha + "T12:00:00"); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

module.exports = {
  ORDEN_TAMANO, ORDEN_EDAD, COLORES, MAPA_COLOR,
  distanciaKm, distanciaTexto, parecidoColor, parecidoPaleta, normalizarTexto,
  distanciaEdicion, tipeoParecido, parecidoCollar, parecidoRasgos,
  puntuar, banda, candidatosPara, coincidenciasDe, dias, verificarSincronia
};
