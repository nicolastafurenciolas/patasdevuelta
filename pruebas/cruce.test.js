// ============================================================
//  PRUEBAS DEL ALGORITMO DE CRUCE — corre con: node pruebas/cruce.test.js
//
//  No toca Supabase ni Netlify: todo pasa en memoria. Copia las funciones
//  puras de app.js (puntuar, parecidoColor, parecidoPaleta, distanciaKm,
//  banda) para poder correrlas desde Node sin un navegador. Si tocas el
//  algoritmo de cruce en app.js, actualiza también la copia de aquí.
// ============================================================

const { ORDEN_TAMANO, COLORES, MAPA_COLOR, distanciaKm, distanciaTexto,
        parecidoColor, parecidoPaleta, puntuar, banda, candidatosPara,
        coincidenciasDe, dias, verificarSincronia } = require("./algoritmo");

// ============================================================
//  PARTE 1 — CASOS DE MANO: escenarios concretos con un resultado
//  esperado. Si algo aquí falla, hay que revisar el algoritmo antes
//  de seguir.
// ============================================================

const HOY = "2026-08-12";

let ok = 0, mal = 0;
const fallas = [];

function caso(nombre, base, cand, verificar) {
  const r = puntuar(base, cand);
  const r2 = puntuar(cand, base); // debe ser simétrico
  const simetria = r.total === r2.total;
  const pasaVerificacion = verificar(r);
  if (pasaVerificacion && simetria) {
    ok++;
  } else {
    mal++;
    fallas.push({ nombre, total: r.total, banda: banda(r.total), simetria, esperado: verificar.toString() });
  }
}

caso("Gemelo casi perfecto: mismo lugar, tamaño, color, raza, sexo",
  { especie: "Perro", tipo: "perdida", fecha: HOY, lat: 5.0689, lng: -75.5174,
    tamano: "Mediano", colores: ["cafe", "blanco"], pelo: "Corto", sexo: "Macho", raza: "Criollo" },
  { especie: "Perro", tipo: "encontrada", fecha: dias(HOY, 1), lat: 5.0691, lng: -75.5170,
    tamano: "Mediano", colores: ["cafe", "blanco"], pelo: "Corto", sexo: "Macho", raza: "Criollo" },
  r => r.total >= 85);

caso("Parecido fuerte (~80%): mismo barrio, un campo distinto (pelo), color de la misma familia",
  { especie: "Perro", tipo: "perdida", fecha: HOY, lat: 4.7110, lng: -74.0721,
    tamano: "Grande", colores: ["dorado"], pelo: "Largo", sexo: "Hembra" },
  { especie: "Perro", tipo: "encontrada", fecha: dias(HOY, 3), lat: 4.7132, lng: -74.0698,
    tamano: "Grande", colores: ["canela"], pelo: "Corto", sexo: "Hembra" },
  r => r.total >= 65 && banda(r.total) !== "baja");

caso("Formulario muy vago en ambos lados: solo especie, fecha y ciudad (sin mapa)",
  { especie: "Gato", tipo: "perdida", fecha: HOY, municipio: "Pereira", departamento: "Risaralda" },
  { especie: "Gato", tipo: "encontrada", fecha: dias(HOY, 2), municipio: "Pereira", departamento: "Risaralda" },
  r => r.total > 0 && r.total < 60); // hay pista débil, no debe salir en "alta"

caso("Formulario a medio llenar: uno con casi todo, el otro solo con lo básico",
  { especie: "Perro", tipo: "perdida", fecha: HOY, lat: 6.2442, lng: -75.5812,
    tamano: "Pequeño", colores: ["negro", "blanco"], pelo: "Corto", sexo: "Macho", raza: "Schnauzer" },
  { especie: "Perro", tipo: "encontrada", fecha: dias(HOY, 1), lat: 6.2450, lng: -75.5800 },
  r => r.total >= 45); // sin datos de tamaño/color del otro lado, se decide solo con ubicación

caso("Contradicción de sexo debe castigar fuerte aunque todo lo demás coincida",
  { especie: "Perro", tipo: "perdida", fecha: HOY, lat: 3.4516, lng: -76.5320,
    tamano: "Mediano", colores: ["negro"], sexo: "Macho" },
  { especie: "Perro", tipo: "encontrada", fecha: dias(HOY, 1), lat: 3.4520, lng: -76.5316,
    tamano: "Mediano", colores: ["negro"], sexo: "Hembra" },
  r => r.total < 70);

caso("Tamaños opuestos (Pequeño vs Grande) debe castigar fuerte",
  { especie: "Perro", tipo: "perdida", fecha: HOY, lat: 10.4, lng: -75.5,
    tamano: "Pequeño", colores: ["blanco"] },
  { especie: "Perro", tipo: "encontrada", fecha: dias(HOY, 1), lat: 10.4, lng: -75.5,
    tamano: "Grande", colores: ["blanco"] },
  r => r.total < 55);

caso("Colores sin nada en común (negro vs naranja) debe castigar",
  { especie: "Gato", tipo: "perdida", fecha: HOY, lat: 7.1, lng: -73.1, tamano: "Pequeño", colores: ["negro"] },
  { especie: "Gato", tipo: "encontrada", fecha: dias(HOY, 1), lat: 7.1, lng: -73.1, tamano: "Pequeño", colores: ["naranja"] },
  r => r.total < 55);

caso("Especies distintas: filtro duro, total debe ser 0",
  { especie: "Perro", tipo: "perdida", fecha: HOY, lat: 4.6, lng: -74.1 },
  { especie: "Gato", tipo: "encontrada", fecha: dias(HOY, 1), lat: 4.6, lng: -74.1 },
  r => r.total === 0);

caso("Alguien reportó especie 'Otro': no debe filtrarse aunque el otro diga Perro",
  { especie: "Otro", tipo: "perdida", fecha: HOY, lat: 4.6, lng: -74.1, tamano: "Pequeño" },
  { especie: "Perro", tipo: "encontrada", fecha: dias(HOY, 1), lat: 4.6, lng: -74.1, tamano: "Pequeño" },
  r => r.total > 0);

caso("Hallazgo reportado 5 días ANTES de la pérdida (fuera del margen de 2 días): total 0",
  { especie: "Perro", tipo: "perdida", fecha: HOY, lat: 4.6, lng: -74.1 },
  { especie: "Perro", tipo: "encontrada", fecha: dias(HOY, -5), lat: 4.6, lng: -74.1 },
  r => r.total === 0);

caso("Hallazgo 1 día antes de la pérdida, dentro del margen de error de 2 días: no debe filtrarse",
  { especie: "Perro", tipo: "perdida", fecha: HOY, lat: 4.6, lng: -74.1, tamano: "Mediano" },
  { especie: "Perro", tipo: "encontrada", fecha: dias(HOY, -1), lat: 4.6, lng: -74.1, tamano: "Mediano" },
  r => r.total > 0);

caso("Muy lejos (200 km): debe filtrarse a 0 aunque todo lo demás coincida perfecto",
  { especie: "Perro", tipo: "perdida", fecha: HOY, lat: 4.7110, lng: -74.0721, tamano: "Mediano", colores: ["negro"] },
  { especie: "Perro", tipo: "encontrada", fecha: dias(HOY, 1), lat: 6.2442, lng: -75.5812, tamano: "Mediano", colores: ["negro"] },
  r => r.total === 0);

caso("Mismo municipio pero SIN coordenadas en ninguno de los dos: coincidencia débil, no 'alta'",
  { especie: "Gato", tipo: "perdida", fecha: HOY, municipio: "Manizales", departamento: "Caldas", tamano: "Pequeño" },
  { especie: "Gato", tipo: "encontrada", fecha: dias(HOY, 4), municipio: "Manizales", departamento: "Caldas", tamano: "Pequeño" },
  r => r.total > 0 && banda(r.total) !== "alta");

caso("Ni municipio ni coordenadas en común, solo mismo departamento: coincidencia muy débil",
  { especie: "Perro", tipo: "perdida", fecha: HOY, departamento: "Caldas", tamano: "Mediano" },
  { especie: "Perro", tipo: "encontrada", fecha: dias(HOY, 1), departamento: "Caldas", tamano: "Mediano" },
  r => banda(r.total) === "baja");

caso("Un escalón de diferencia en tamaño (Mediano vs Grande) casi no debe castigar",
  { especie: "Perro", tipo: "perdida", fecha: HOY, lat: 4.6, lng: -74.1, tamano: "Mediano", colores: ["cafe"] },
  { especie: "Perro", tipo: "encontrada", fecha: dias(HOY, 1), lat: 4.6, lng: -74.1, tamano: "Grande", colores: ["cafe"] },
  r => r.total >= 60);

caso("Radio se abre con los días: candidato a 20km recién perdido (día 0) debe salir mal",
  { especie: "Perro", tipo: "perdida", fecha: HOY, lat: 4.6, lng: -74.1, tamano: "Mediano" },
  { especie: "Perro", tipo: "encontrada", fecha: HOY, lat: 4.78, lng: -74.1, tamano: "Mediano" }, // ~20km, mismo día
  r => banda(r.total) !== "alta");

caso("Radio se abre con los días: mismo par de puntos pero 15 días después, debe mejorar mucho",
  { especie: "Perro", tipo: "perdida", fecha: HOY, lat: 4.6, lng: -74.1, tamano: "Mediano" },
  { especie: "Perro", tipo: "encontrada", fecha: dias(HOY, 15), lat: 4.78, lng: -74.1, tamano: "Mediano" }, // ~20km, 15 días
  r => r.total > 0);

caso("Raza igual suma puntos incluso si el resto es mediocre",
  { especie: "Perro", tipo: "perdida", fecha: HOY, lat: 4.6, lng: -74.1, raza: "Labrador" },
  { especie: "Perro", tipo: "encontrada", fecha: dias(HOY, 1), lat: 4.65, lng: -74.15, raza: "labrador" }, // mayúsculas distintas
  r => r.razones.includes("misma raza"));

caso("Sin ubicación de ningún tipo (ni mapa ni municipio ni depto): la señal de cercanía cae a 0, no debe reventar",
  { especie: "Gato", tipo: "perdida", fecha: HOY, tamano: "Pequeño", colores: ["blanco"] },
  { especie: "Gato", tipo: "encontrada", fecha: dias(HOY, 1), tamano: "Pequeño", colores: ["blanco"] },
  r => typeof r.total === "number" && !Number.isNaN(r.total));

caso("Ambos formularios casi vacíos (solo especie, tipo y fecha): no debe reventar ni dar 'alta'",
  { especie: "Perro", tipo: "perdida", fecha: HOY },
  { especie: "Perro", tipo: "encontrada", fecha: dias(HOY, 1) },
  r => typeof r.total === "number" && banda(r.total) !== "alta");

console.log(`\n== PARTE 1: casos de mano ==`);
console.log(`${ok} de ${ok + mal} pasaron.`);
if (fallas.length) {
  console.log("\nFallaron:");
  fallas.forEach(f => console.log(`  ✗ ${f.nombre} — total=${f.total} banda=${f.banda} simetria=${f.simetria}`));
}

// ============================================================
//  PARTE 2 — SIMULACRO A GRAN ESCALA
//  Genera muchas mascotas "perdidas" y "encontradas" al azar por toda
//  Colombia. Algunos pares se diseñan a propósito como el MISMO animal
//  descrito por dos personas distintas (con ruido realista: ubicación
//  corrida unos metros/km, un par de campos vacíos, color contado
//  distinto). El resto son pares sin relación. Luego se corre el mismo
//  filtrado que hace buscarCoincidencias() en app.js (especie, ventana
//  de fechas, recuadro ~60km) y se mide si el algoritmo encuentra a la
//  pareja real y no dispara falsos positivos "alta" entre desconocidos.
// ============================================================

const CIUDADES = [
  { m: "Manizales", d: "Caldas", lat: 5.0689, lng: -75.5174 },
  { m: "Pereira", d: "Risaralda", lat: 4.8143, lng: -75.6946 },
  { m: "Bogotá D.C.", d: "Bogotá D.C.", lat: 4.7110, lng: -74.0721 },
  { m: "Medellín", d: "Antioquia", lat: 6.2442, lng: -75.5812 },
  { m: "Cali", d: "Valle del Cauca", lat: 3.4516, lng: -76.5320 },
  { m: "Cartagena", d: "Bolívar", lat: 10.3910, lng: -75.4794 },
  { m: "San José del Palmar", d: "Chocó", lat: 4.9758, lng: -76.2306 },
  { m: "Armenia", d: "Quindío", lat: 4.5339, lng: -75.6811 },
  { m: "Villamaría", d: "Caldas", lat: 5.0397, lng: -75.5122 },
  { m: "Chinchiná", d: "Caldas", lat: 4.9836, lng: -75.6069 }
];

const ESPECIES = ["Perro", "Gato"];
const TAMANOS = ["Pequeño", "Mediano", "Grande"];
const PELOS = ["Corto", "Medio", "Largo"];
const SEXOS = ["Macho", "Hembra", "No sé"];
const PALETAS = COLORES.map(c => c.k);
const RAZAS = ["Criollo", "Labrador", "Pastor alemán", "Schnauzer", "Poodle", null, null];

let semilla = 42;
function azar() { // PRNG determinístico para que el simulacro sea reproducible
  semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
  return semilla / 0x7fffffff;
}
const elegir = lista => lista[Math.floor(azar() * lista.length)];
const jitter = (v, m) => v + (azar() * 2 - 1) * m;

function mascotaAlAzar(tipo, i) {
  const c = elegir(CIUDADES);
  const especie = elegir(ESPECIES);
  const incompleto = azar() < 0.35; // ~1 de cada 3 formularios viene incompleto, como en la vida real
  const m = {
    id: `${tipo}-${i}`,
    especie, tipo,
    fecha: dias(HOY, Math.floor(azar() * 20) - 10),
    lat: +jitter(c.lat, 0.25).toFixed(5),
    lng: +jitter(c.lng, 0.25).toFixed(5),
    municipio: c.m, departamento: c.d,
    tamano: elegir(TAMANOS),
    colores: [elegir(PALETAS)],
    pelo: elegir(PELOS),
    sexo: elegir(SEXOS),
    raza: elegir(RAZAS)
  };
  if (incompleto) { // le borramos 1-3 campos al azar, como haría alguien con afán
    const opcionales = ["pelo", "sexo", "raza", "colores"];
    const n = 1 + Math.floor(azar() * 2);
    for (let k = 0; k < n; k++) delete m[elegir(opcionales)];
  }
  return m;
}

// A partir de una mascota "perdida" ya creada, genera cómo la describiría
// una SEGUNDA persona que la encontró: misma identidad, pero con el ruido
// típico de dos formularios llenados por separado.
function comoLaDescribiriaOtroTestigo(perdida, i) {
  const diasHastaEncuentro = 1 + Math.floor(azar() * 12);
  const m = {
    id: `encontrada-pareja-${i}`,
    especie: perdida.especie,
    tipo: "encontrada",
    fecha: dias(perdida.fecha, diasHastaEncuentro),
    lat: +jitter(perdida.lat, 0.03).toFixed(5),   // se movió unas cuadras
    lng: +jitter(perdida.lng, 0.03).toFixed(5),
    municipio: perdida.municipio, departamento: perdida.departamento,
    tamano: perdida.tamano,
    colores: perdida.colores ? perdida.colores.map(c => {
      if (azar() < 0.4) { // 40% de las veces lo describe con un color "de la familia" distinto
        const familia = COLORES.find(x => x.k === c);
        const parecidos = COLORES.filter(x => x.comp.some(comp => familia?.comp.includes(comp)) && x.k !== c);
        return parecidos.length ? elegir(parecidos).k : c;
      }
      return c;
    }) : [elegir(PALETAS)],
    pelo: perdida.pelo,
    sexo: perdida.sexo,
    raza: perdida.raza
  };
  // esta segunda persona también puede llenar el formulario a medias
  const opcionales = ["pelo", "sexo", "raza"];
  if (azar() < 0.4) delete m[elegir(opcionales)];
  return m;
}

const N_ALEATORIAS = 30;   // mascotas sin relación entre sí, por lado
const N_PAREJAS = 15;      // pares diseñados como el mismo animal

const perdidas = [];
const encontradas = [];
const parejasEsperadas = []; // [idPerdida, idEncontradaCorrecta]

for (let i = 0; i < N_ALEATORIAS; i++) perdidas.push(mascotaAlAzar("perdida", i));
for (let i = 0; i < N_ALEATORIAS; i++) encontradas.push(mascotaAlAzar("encontrada", i));

for (let i = 0; i < N_PAREJAS; i++) {
  const base = mascotaAlAzar("perdida", `pareja-${i}`);
  const pareja = comoLaDescribiriaOtroTestigo(base, i);
  perdidas.push(base);
  encontradas.push(pareja);
  parejasEsperadas.push([base.id, pareja.id]);
}



console.log(`\n== PARTE 2: simulacro a gran escala ==`);
console.log(`${perdidas.length} reportes de "perdida", ${encontradas.length} de "encontrada" ` +
  `(${N_PAREJAS} son la misma mascota descrita por dos personas, el resto no tienen relación).`);

let parejasEncontradas = 0, parejasEnBandaAlta = 0, parejasEnBandaMedia = 0, parejasFueraDeTop = [];
for (const [idPerdida, idEncontradaEsperada] of parejasEsperadas) {
  const base = perdidas.find(p => p.id === idPerdida);
  const resultados = coincidenciasDe(base, encontradas, { minimo: 1, tope: encontradas.length });
  const posicion = resultados.findIndex(r => r.id === idEncontradaEsperada);
  const encontrada = posicion !== -1 && posicion < 24; // el buscador real muestra hasta 24
  if (encontrada) {
    parejasEncontradas++;
    const b = banda(resultados[posicion].total);
    if (b === "alta") parejasEnBandaAlta++;
    if (b === "media") parejasEnBandaMedia++;
  } else {
    parejasFueraDeTop.push({ idPerdida, idEncontradaEsperada, posicion });
  }
}

console.log(`\nParejas reales que el algoritmo SÍ encontró entre los primeros 24 resultados: ` +
  `${parejasEncontradas} de ${N_PAREJAS} (${Math.round(parejasEncontradas / N_PAREJAS * 100)}%)`);
console.log(`  - de esas, en banda "alta" (muy parecido): ${parejasEnBandaAlta}`);
console.log(`  - de esas, en banda "media" (podría ser): ${parejasEnBandaMedia}`);
if (parejasFueraDeTop.length) {
  console.log(`\nParejas que NO aparecieron en el top 24 (revisar):`);
  parejasFueraDeTop.forEach(f => console.log(`  ✗ ${f.idPerdida} → se esperaba ${f.idEncontradaEsperada}, posición real: ${f.posicion}`));
}

// Falsos positivos: entre TODOS los reportes de "perdida" (aleatorios y con
// pareja), ¿algún candidato SIN relación quedó marcado como "alta" (muy
// parecido) por pura coincidencia?
let falsosPositivosAlta = 0;
const ejemplosFalsosPositivos = [];
for (const p of perdidas) {
  const idEsperado = (parejasEsperadas.find(([ip]) => ip === p.id) || [])[1];
  const resultados = coincidenciasDe(p, encontradas, { minimo: 72, tope: 50 });
  for (const r of resultados) {
    if (r.id !== idEsperado) {
      falsosPositivosAlta++;
      if (ejemplosFalsosPositivos.length < 5) ejemplosFalsosPositivos.push({ perdida: p, sinRelacion: r });
    }
  }
}
console.log(`\nFalsos positivos en banda "alta" (candidatos sin relación real que igual marcaron ` +
  `"muy parecido"): ${falsosPositivosAlta}`);
if (ejemplosFalsosPositivos.length) {
  console.log("Ejemplos (con detalle, para juzgar si es un error real o una coincidencia legítima):");
  ejemplosFalsosPositivos.forEach(f => {
    console.log(`  ⚠ ${f.perdida.id} ↔ ${f.sinRelacion.id} — total=${f.sinRelacion.total} razones=[${(f.sinRelacion.razones || []).join(", ")}]`);
    console.log(`     perdida:    ${JSON.stringify({ especie: f.perdida.especie, tamano: f.perdida.tamano, colores: f.perdida.colores, pelo: f.perdida.pelo, sexo: f.perdida.sexo, municipio: f.perdida.municipio, lat: f.perdida.lat, lng: f.perdida.lng, fecha: f.perdida.fecha })}`);
    console.log(`     encontrada: ${JSON.stringify({ especie: f.sinRelacion.especie, tamano: f.sinRelacion.tamano, colores: f.sinRelacion.colores, pelo: f.sinRelacion.pelo, sexo: f.sinRelacion.sexo, municipio: f.sinRelacion.municipio, lat: f.sinRelacion.lat, lng: f.sinRelacion.lng, fecha: f.sinRelacion.fecha })}`);
  });
}

console.log(`\n== RESUMEN ==`);
console.log(`Casos de mano: ${ok}/${ok + mal} correctos.`);
console.log(`Parejas reales recuperadas: ${parejasEncontradas}/${N_PAREJAS}.`);
console.log(`Falsos positivos "alta": ${falsosPositivosAlta}.`);

process.exitCode = (mal > 0 || parejasEncontradas < N_PAREJAS) ? 1 : 0;
