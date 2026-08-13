// ============================================================
//  PRUEBAS ADVERSARIALES — corre con: node pruebas/adversario.test.js
//
//  Todas las parejas de este archivo SON LA MISMA MASCOTA. No hay
//  distractores disfrazados: si el algoritmo no las junta, es un fallo
//  real, porque en la vida real esa familia no recupera a su animal.
//
//  Cada caso degrada el reporte de quien ENCONTRÓ al animal de alguna
//  forma realista: lo llenó de afán, adivinó mal la raza, calculó mal
//  el tamaño, se equivocó de sexo, marcó el mapa en el centro del
//  pueblo en vez del sitio exacto, invirtió lat/lng, etc.
//
//  La métrica que importa NO es el puntaje: es si la pareja verdadera
//  alcanza a salir en los 24 resultados que la persona ve en pantalla,
//  compitiendo contra decenas de mascotas reales de la misma ciudad.
//  Un puntaje de 55 que sale de primero sirve; un 71 que queda de #14
//  no sirve para nada.
// ============================================================

const { puntuar, banda, coincidenciasDe, dias } = require("./algoritmo");

const HOY = "2026-08-12";

// ---------- Ruido de fondo: mascotas reales de la misma ciudad ----------
// Sin esto la prueba sería trampa: cualquier puntaje > 26 "saldría en la
// lista" porque la lista estaría vacía. La competencia tiene que existir.

let semilla = 7;
const azar = () => (semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const elegir = l => l[Math.floor(azar() * l.length)];
const jitter = (v, m) => v + (azar() * 2 - 1) * m;

const TAMANOS = ["Pequeño", "Mediano", "Grande"];
const PELOS = ["Corto", "Medio", "Largo"];
const SEXOS = ["Macho", "Hembra", "No sé"];
const PALETAS = ["negro", "blanco", "gris", "cafe", "canela", "dorado",
                 "crema", "naranja", "atigrado", "manchado", "tricolor"];
const RAZAS = ["Criollo", "Labrador", "Pastor alemán", "Schnauzer", "Poodle", null, null];
// Collares del ruido: si no los tuviera, medir la señal de collar sería trampa
// (la pareja buena sería la única con collar y ganaría por defecto).
const COLLARES = ["collar rojo", "collar azul", "collar negro", "collar con placa",
                  "collar verde", "rojo con placa", "collar de cuero café", null, null, null];
// Señas del ruido: mezcla de señas reales y de frases genéricas, como en la vida
// real. Sin esto, medir la señal de rasgos sería trampa.
const EDADES_RUIDO = ["Cachorro", "Joven", "Adulto", "Adulto", "Viejito", null, null];
const RASGOS_RUIDO = [
  "mancha blanca en el pecho", "le falta un pedazo de la oreja", "cojea de la pata trasera",
  "tiene la cola muy corta", "cicatriz en el lomo", "un ojo de cada color",
  "estaba asustado y con hambre", "muy manso, se deja acariciar", "la oreja izquierda caída",
  null, null, null];

// 150 mascotas encontradas, repartidas alrededor del punto de referencia.
// Es el peor caso de competencia: todas en la misma ciudad, misma ventana
// de fechas, todas plausibles.
function ruidoDeFondo(especie, lat, lng, n = 150) {
  const lista = [];
  for (let i = 0; i < n; i++) {
    const incompleto = azar() < 0.35;
    const m = {
      id: `ruido-${i}`, especie, tipo: "encontrada",
      fecha: dias(HOY, Math.floor(azar() * 14) - 2),
      lat: +jitter(lat, 0.09).toFixed(5),
      lng: +jitter(lng, 0.09).toFixed(5),
      municipio: "Manizales", departamento: "Caldas",
      tamano: elegir(TAMANOS), colores: [elegir(PALETAS)],
      pelo: elegir(PELOS), sexo: elegir(SEXOS), raza: elegir(RAZAS),
      collar: elegir(COLLARES), rasgos: elegir(RASGOS_RUIDO), edad_aprox: elegir(EDADES_RUIDO)
    };
    if (incompleto) {
      const op = ["pelo", "sexo", "raza", "colores"];
      const k = 1 + Math.floor(azar() * 2);
      for (let j = 0; j < k; j++) delete m[elegir(op)];
    }
    lista.push(m);
  }
  return lista;
}

// ---------- Motor de la prueba ----------

const resultados = [];

function escenario(bloque, nombre, perdida, encontrada, notas) {
  const p = { id: "perdida", tipo: "perdida", ...perdida };
  const e = { id: "LA-BUENA", tipo: "encontrada", ...encontrada };

  const r = puntuar(p, e);
  const r2 = puntuar(e, p);
  const simetrico = r.total === r2.total;

  // Medimos el puesto con tres niveles de competencia. No es lo mismo un
  // municipio pequeño con 10 reportes activos que una ciudad saturada con
  // 150: así separamos "el algoritmo puntuó bajo" de "lo tapó el montón".
  const puestos = {};
  for (const n of [10, 30, 150]) {
    semilla = 7; // mismo ruido en todos los casos, para poder comparar
    const pool = [e, ...ruidoDeFondo(e.especie, p.lat ?? 5.0689, p.lng ?? -75.5174, n)];
    const lista = coincidenciasDe(p, pool);   // umbral 26, tope 24: lo que ve el usuario
    puestos[n] = lista.findIndex(x => x.id === "LA-BUENA");
  }

  let veredicto, causa;
  if (r.total === 0) {
    veredicto = "BLOQUEADA"; causa = "filtro duro";
  } else if (r.total < 26) {
    veredicto = "NO SALE"; causa = "puntaje bajo el umbral 26";
  } else if (puestos[150] === -1) {
    veredicto = puestos[30] !== -1 ? `solo en ciudad chica (#${puestos[30] + 1})` : "NO SALE";
    causa = "la competencia lo empujó fuera del top 24";
  } else {
    veredicto = puestos[150] === 0 ? "1er lugar" : `#${puestos[150] + 1}`;
    causa = "";
  }

  const bien = puestos[150] !== -1;
  const rescatable = !bien && puestos[30] !== -1;
  resultados.push({ bloque, nombre, total: r.total, banda: banda(r.total), veredicto, causa,
                    bien, rescatable, simetrico, notas, km: r.km, dias: r.dias, puestos });
}

// ============================================================
//  BLOQUE A — Quien encontró al animal llenó el formulario de afán
//  Es el escenario MÁS común y el más importante: un desconocido que
//  hace el favor de reportar, sin cariño por los detalles.
// ============================================================

const DUENO_COMPLETO = {
  especie: "Perro", fecha: HOY, lat: 5.0689, lng: -75.5174,
  municipio: "Manizales", departamento: "Caldas",
  tamano: "Mediano", colores: ["negro", "blanco"], pelo: "Corto",
  sexo: "Macho", raza: "Criollo"
};

escenario("A", "Encontró: solo marcó especie, mapa y fecha. Nada más.",
  DUENO_COMPLETO,
  { especie: "Perro", fecha: dias(HOY, 2), lat: 5.0702, lng: -75.5161,
    municipio: "Manizales", departamento: "Caldas" },
  "El caso más común de todos: el formulario mínimo viable.");

escenario("A", "Encontró: mínimo, y ni siquiera marcó el mapa (solo municipio)",
  DUENO_COMPLETO,
  { especie: "Perro", fecha: dias(HOY, 2), municipio: "Manizales", departamento: "Caldas" },
  "Sin coordenadas la señal de cercanía cae a 0.45 fijo.");

escenario("A", "Encontró: lo vio sucio de barro y reportó café en vez de negro y blanco",
  DUENO_COMPLETO,
  { especie: "Perro", fecha: dias(HOY, 1), lat: 5.0695, lng: -75.5180,
    municipio: "Manizales", departamento: "Caldas",
    tamano: "Mediano", colores: ["cafe"] },
  "Color de otra familia: castigo x0.6. Pasa siempre con animales callejeros.");

escenario("A", "Encontró: llenó todo al azar salvo la ubicación (tamaño, color y sexo mal)",
  DUENO_COMPLETO,
  { especie: "Perro", fecha: dias(HOY, 1), lat: 5.0691, lng: -75.5170,
    municipio: "Manizales", departamento: "Caldas",
    tamano: "Grande", colores: ["naranja"], pelo: "Largo", sexo: "Hembra", raza: "Poodle" },
  "Todo mal menos el punto en el mapa. Castigos acumulados: 0.6 x 0.7.");

escenario("A", "Encontró: puso 'No sé' en sexo y dejó color vacío (lo honesto)",
  DUENO_COMPLETO,
  { especie: "Perro", fecha: dias(HOY, 3), lat: 5.0710, lng: -75.5150,
    municipio: "Manizales", departamento: "Caldas",
    tamano: "Mediano", sexo: "No sé" },
  "No decir nada debe ser mejor que decir algo equivocado.");

escenario("A", "Encontró: marcó el centro del pueblo en vez del sitio exacto (a 8 km)",
  DUENO_COMPLETO,
  { especie: "Perro", fecha: dias(HOY, 1), lat: 5.0689 + 0.072, lng: -75.5174,
    municipio: "Manizales", departamento: "Caldas",
    tamano: "Mediano", colores: ["negro", "blanco"], pelo: "Corto", sexo: "Macho" },
  "Radio del día 1 = 4.5 km. 8 km lo deja en el borde.");

escenario("A", "Encontró: escribió la raza a su manera ('pastor aleman' sin tilde)",
  { ...DUENO_COMPLETO, raza: "Pastor Alemán" },
  { especie: "Perro", fecha: dias(HOY, 1), lat: 5.0691, lng: -75.5170,
    municipio: "Manizales", departamento: "Caldas",
    tamano: "Mediano", colores: ["negro", "blanco"], raza: "pastor aleman " },
  "La comparación de raza hace trim+lowercase pero NO quita tildes.");

// ============================================================
//  BLOQUE B — Reporte cuidadoso, pero un dato clave está mal
//  Aquí es donde un algoritmo mal calibrado pierde mascotas: todo
//  encaja salvo un campo, y ese campo lo hunde.
// ============================================================

escenario("B", "Todo perfecto salvo el SEXO (la gente no le revisa el sexo a un perro ajeno)",
  DUENO_COMPLETO,
  { ...DUENO_COMPLETO, fecha: dias(HOY, 1), lat: 5.0691, lng: -75.5170, sexo: "Hembra" },
  "Contradicción de sexo: señal en 0 + castigo x0.7.");

escenario("B", "Todo perfecto salvo el TAMAÑO, en el extremo opuesto (Mediano→Pequeño)",
  DUENO_COMPLETO,
  { ...DUENO_COMPLETO, fecha: dias(HOY, 1), lat: 5.0691, lng: -75.5170, tamano: "Pequeño" },
  "Un escalón: tolerancia diseñada, casi no castiga.");

escenario("B", "Todo perfecto salvo el TAMAÑO, dos escalones (Pequeño real vs Grande reportado)",
  { ...DUENO_COMPLETO, tamano: "Pequeño" },
  { ...DUENO_COMPLETO, fecha: dias(HOY, 1), lat: 5.0691, lng: -75.5170, tamano: "Grande" },
  "Dos escalones: señal 0 + castigo x0.65. ¿Es demasiado?");

escenario("B", "Todo perfecto salvo la RAZA adivinada (Criollo real, reportado Labrador)",
  DUENO_COMPLETO,
  { ...DUENO_COMPLETO, fecha: dias(HOY, 1), lat: 5.0691, lng: -75.5170, raza: "Labrador" },
  "Raza distinta: señal 0.3, sin castigo multiplicativo.");

escenario("B", "Todo perfecto pero el hallazgo se reportó 1 día ANTES de la pérdida",
  DUENO_COMPLETO,
  { ...DUENO_COMPLETO, fecha: dias(HOY, -1), lat: 5.0691, lng: -75.5170 },
  "Margen de 2 días para errores de captura: debe sobrevivir.");

escenario("B", "Todo perfecto pero el hallazgo se reportó 4 días ANTES (error de fecha grande)",
  DUENO_COMPLETO,
  { ...DUENO_COMPLETO, fecha: dias(HOY, -4), lat: 5.0691, lng: -75.5170 },
  "Fuera del margen: filtro duro. Se pierde la mascota.");

escenario("B", "Todo perfecto pero lo movieron 40 km (alguien lo recogió en carro)",
  DUENO_COMPLETO,
  { ...DUENO_COMPLETO, fecha: dias(HOY, 2), lat: 5.0689 + 0.36, lng: -75.5174 },
  "Radio día 2 = 6 km, tope duro = 15 km. 40 km lo mata.");

escenario("B", "Todo perfecto, mismo sitio, pero apareció 45 días después",
  DUENO_COMPLETO,
  { ...DUENO_COMPLETO, fecha: dias(HOY, 45), lat: 5.0691, lng: -75.5170 },
  "Ficha ya en 'sin_confirmar'. El cruce igual debe funcionar.");

escenario("B", "Todo perfecto pero mismo día exacto y a 500 m",
  DUENO_COMPLETO,
  { ...DUENO_COMPLETO, fecha: HOY, lat: 5.0734, lng: -75.5174 },
  "Escapó y lo encontraron el mismo día: debe ser puntaje altísimo.");

// ============================================================
//  BLOQUE C — Improbables pero posibles (errores de captura, dudas)
// ============================================================

escenario("C", "Quien encontró invirtió lat/lng al marcar el mapa",
  DUENO_COMPLETO,
  { ...DUENO_COMPLETO, fecha: dias(HOY, 1), lat: -75.5174, lng: 5.0689 },
  "Coordenadas imposibles para Colombia. Debe fallar, pero ¿silenciosamente?");

escenario("C", "El dueño dijo 'Perro', quien encontró no supo y puso 'Otro'",
  DUENO_COMPLETO,
  { ...DUENO_COMPLETO, especie: "Otro", fecha: dias(HOY, 1), lat: 5.0691, lng: -75.5170 },
  "'Otro' es comodín por diseño: no debe filtrarse.");

escenario("C", "Ambos dijeron 'Otro' (un conejo, una iguana)",
  { ...DUENO_COMPLETO, especie: "Otro", raza: null },
  { ...DUENO_COMPLETO, especie: "Otro", raza: null, fecha: dias(HOY, 1), lat: 5.0691, lng: -75.5170 },
  "Mascotas no convencionales, cubiertas por el mismo camino.");

escenario("C", "Un gato reportado como perro por quien lo encontró (de noche, de lejos)",
  { ...DUENO_COMPLETO, especie: "Gato" },
  { ...DUENO_COMPLETO, especie: "Perro", fecha: dias(HOY, 1), lat: 5.0691, lng: -75.5170 },
  "Filtro duro de especie. Perder esto es aceptable o no, hay que decidirlo.");

escenario("C", "Colores de la misma familia contados distinto (manchado vs 'negro y blanco')",
  { ...DUENO_COMPLETO, colores: ["manchado"] },
  { ...DUENO_COMPLETO, fecha: dias(HOY, 1), lat: 5.0691, lng: -75.5170, colores: ["negro", "blanco"] },
  "El caso que motivó la comparación por componentes visuales.");

escenario("C", "Perro tricolor: el dueño puso los 3 colores, quien encontró puso solo uno",
  { ...DUENO_COMPLETO, colores: ["blanco", "cafe", "negro"] },
  { ...DUENO_COMPLETO, fecha: dias(HOY, 1), lat: 5.0691, lng: -75.5170, colores: ["cafe"] },
  "Paleta parcial: no debería castigarse como contradicción.");

escenario("C", "Ambos formularios casi vacíos: especie, fecha y mapa, nada más",
  { especie: "Perro", fecha: HOY, lat: 5.0689, lng: -75.5174,
    municipio: "Manizales", departamento: "Caldas" },
  { especie: "Perro", fecha: dias(HOY, 1), lat: 5.0691, lng: -75.5170,
    municipio: "Manizales", departamento: "Caldas" },
  "Solo hay una señal viva (distancia). ¿Alcanza para destacarse del ruido?");

// ============================================================
//  BLOQUE D — Fallas acumuladas: el peor escenario realista
// ============================================================

escenario("D", "Dos fallas: sexo equivocado + un escalón de tamaño",
  DUENO_COMPLETO,
  { ...DUENO_COMPLETO, fecha: dias(HOY, 2), lat: 5.0700, lng: -75.5160,
    sexo: "Hembra", tamano: "Grande" },
  "0.7 de castigo, más dos señales caídas.");

escenario("D", "Tres fallas: sexo + color de otra familia + raza adivinada",
  DUENO_COMPLETO,
  { ...DUENO_COMPLETO, fecha: dias(HOY, 2), lat: 5.0700, lng: -75.5160,
    sexo: "Hembra", colores: ["naranja"], raza: "Poodle" },
  "Castigos multiplicados: 0.7 x 0.6 = 0.42. Muy agresivo.");

escenario("D", "Cuatro fallas y a 6 km: prácticamente solo coincide la especie y la zona",
  DUENO_COMPLETO,
  { ...DUENO_COMPLETO, fecha: dias(HOY, 3), lat: 5.0689 + 0.054, lng: -75.5174,
    sexo: "Hembra", colores: ["naranja"], raza: "Poodle", tamano: "Grande", pelo: "Largo" },
  "El peor caso realista. Aquí se ve el techo del algoritmo.");

escenario("D", "Formulario mínimo del que encontró + el dueño también reportó poco",
  { especie: "Perro", fecha: HOY, municipio: "Manizales", departamento: "Caldas", tamano: "Mediano" },
  { especie: "Perro", fecha: dias(HOY, 3), municipio: "Manizales", departamento: "Caldas", tamano: "Mediano" },
  "Sin mapa en ninguno de los dos lados. Es una situación real y frecuente.");

escenario("D", "Sin mapa de ningún lado y además el tamaño mal por un escalón",
  { especie: "Perro", fecha: HOY, municipio: "Manizales", departamento: "Caldas",
    tamano: "Mediano", colores: ["negro"] },
  { especie: "Perro", fecha: dias(HOY, 3), municipio: "Manizales", departamento: "Caldas",
    tamano: "Grande", colores: ["negro"] },
  "Municipio grande + datos flojos: el escenario donde más se pierde gente.");

// ============================================================
//  BLOQUE E — El collar
//  Es el dato más identificador que un desconocido SÍ puede ver de una.
//  Regla de diseño: suma cuando ambos lo mencionan, NUNCA castiga cuando
//  solo uno lo menciona (los collares se caen, o quien recoge al animal
//  se lo quita antes de reportarlo).
// ============================================================

const DUENO_COLLAR = { ...DUENO_COMPLETO, collar: "collar rojo con placa" };

escenario("E", "Ambos vieron el mismo collar, descrito con otras palabras",
  DUENO_COLLAR,
  { ...DUENO_COMPLETO, collar: "rojo", fecha: dias(HOY, 2), lat: 5.0700, lng: -75.5160 },
  "Comparte la palabra 'rojo': debe sumar fuerte.");

escenario("E", "Mismo collar pero escrito con mayúsculas y tildes distintas",
  { ...DUENO_COMPLETO, collar: "Collar Café con Placa" },
  { ...DUENO_COMPLETO, collar: "cafe", fecha: dias(HOY, 1), lat: 5.0691, lng: -75.5170 },
  "normalizarTexto debe hacer que 'Café' y 'cafe' coincidan.");

escenario("E", "Al dueño se le cayó el collar: él lo reportó, quien lo encontró no",
  DUENO_COLLAR,
  { ...DUENO_COMPLETO, fecha: dias(HOY, 2), lat: 5.0700, lng: -75.5160 },
  "Solo uno lo menciona: NO debe castigar. Es lo más común de todo.");

escenario("E", "Ambos vieron collar pero de colores distintos (uno se confundió)",
  DUENO_COLLAR,
  { ...DUENO_COMPLETO, collar: "collar azul", fecha: dias(HOY, 2), lat: 5.0700, lng: -75.5160 },
  "Indicio parcial (0.35), sin castigo: tener collar ya es informativo.");

escenario("E", "El collar rescata un reporte flojo: sexo mal, color mal, pero collar igual",
  DUENO_COLLAR,
  { ...DUENO_COMPLETO, collar: "placa", fecha: dias(HOY, 2), lat: 5.0700, lng: -75.5160,
    sexo: "Hembra", colores: ["naranja"] },
  "Sin collar este caso se perdía. Es la razón de agregar la señal.");

escenario("E", "Los dos escribieron solo la palabra 'collar', sin ningún detalle",
  { ...DUENO_COMPLETO, collar: "collar" },
  { ...DUENO_COMPLETO, collar: "tenía collar", fecha: dias(HOY, 1), lat: 5.0691, lng: -75.5170 },
  "Puro relleno: no debe contar como señal ni sumar ni restar.");

// ============================================================
//  BLOQUE F — Las señas particulares (texto libre)
//  Regla de diseño: SOLO SUMA, NUNCA RESTA. Si no hay palabras en común la
//  señal no participa, porque quien encuentra al animal muchas veces describe
//  otra cosa aunque sea la misma mascota.
// ============================================================

const DUENO_SENAS = { ...DUENO_COMPLETO, rasgos: "Mancha blanca en el pecho y la oreja izquierda caída" };

escenario("F", "Ambos describen la misma seña con otras palabras",
  DUENO_SENAS,
  { ...DUENO_COMPLETO, rasgos: "tiene una mancha en el pecho", fecha: dias(HOY, 2), lat: 5.0700, lng: -75.5160 },
  "Comparte 'mancha' y 'pecho': dos palabras, crédito completo.");

escenario("F", "Solo una palabra en común ('cojea')",
  { ...DUENO_COMPLETO, rasgos: "cojea de la pata trasera derecha" },
  { ...DUENO_COMPLETO, rasgos: "cojea un poco", fecha: dias(HOY, 2), lat: 5.0700, lng: -75.5160 },
  "Una palabra: crédito parcial (0.7).");

escenario("F", "Quien encontró describió el estado, no las señas (cero palabras en común)",
  DUENO_SENAS,
  { ...DUENO_COMPLETO, rasgos: "estaba asustado y con mucha hambre", fecha: dias(HOY, 2), lat: 5.0700, lng: -75.5160 },
  "SIN palabras comunes: la señal no debe participar NI castigar.");

escenario("F", "Las señas rescatan un reporte flojo: color y sexo mal, pero la seña coincide",
  DUENO_SENAS,
  { ...DUENO_COMPLETO, rasgos: "mancha en el pecho, oreja caída", fecha: dias(HOY, 2),
    lat: 5.0700, lng: -75.5160, sexo: "Hembra", colores: ["naranja"] },
  "Es la razón de agregar la señal.");

escenario("F", "Solo coinciden en palabras genéricas ('perro negro grande')",
  { ...DUENO_COMPLETO, rasgos: "es un perro negro grande y muy manso" },
  { ...DUENO_COMPLETO, rasgos: "perro negro grande, estaba manso", fecha: dias(HOY, 1), lat: 5.0691, lng: -75.5170 },
  "Colores, tamaños y adjetivos genéricos se ignoran: no debe dar crédito falso.");

escenario("F", "Plural contra singular ('manchas' vs 'mancha')",
  { ...DUENO_COMPLETO, rasgos: "tiene manchas en las patas" },
  { ...DUENO_COMPLETO, rasgos: "una mancha en la pata", fecha: dias(HOY, 1), lat: 5.0691, lng: -75.5170 },
  "Se quita la 's' final: 'manchas'→'mancha', 'patas'→'pata'.");

// ============================================================
//  BLOQUE G — La edad
//  Se trata como el tamaño: en escalones y con tolerancia, porque nadie
//  acierta la edad de un animal ajeno a ojo. Pero cachorro contra viejito
//  sí es una contradicción de verdad.
// ============================================================

escenario("G", "Misma edad reportada por los dos",
  { ...DUENO_COMPLETO, edad_aprox: "Adulto" },
  { ...DUENO_COMPLETO, edad_aprox: "Adulto", fecha: dias(HOY, 2), lat: 5.0700, lng: -75.5160 },
  "Coincide: debe sumar.");

escenario("G", "Un escalón de diferencia (Joven vs Adulto): casi no debe castigar",
  { ...DUENO_COMPLETO, edad_aprox: "Joven" },
  { ...DUENO_COMPLETO, edad_aprox: "Adulto", fecha: dias(HOY, 2), lat: 5.0700, lng: -75.5160 },
  "Tolerancia diseñada: la gente calcula mal la edad.");

escenario("G", "Cachorro contra viejito: contradicción de verdad",
  { ...DUENO_COMPLETO, edad_aprox: "Cachorro" },
  { ...DUENO_COMPLETO, edad_aprox: "Viejito", fecha: dias(HOY, 2), lat: 5.0700, lng: -75.5160 },
  "Tres escalones: señal en 0 y castigo. Aun así no debe desaparecer.");

escenario("G", "Solo uno reportó la edad: no debe castigar",
  { ...DUENO_COMPLETO, edad_aprox: "Adulto" },
  { ...DUENO_COMPLETO, fecha: dias(HOY, 2), lat: 5.0700, lng: -75.5160 },
  "Señal ausente: se decide con menos evidencia, sin penalizar.");

// ============================================================
//  INFORME
// ============================================================

const NOMBRE_BLOQUE = {
  A: "A — Quien encontró llenó el formulario de afán",
  B: "B — Reporte cuidadoso con un dato clave equivocado",
  C: "C — Improbables pero posibles",
  D: "D — Fallas acumuladas (el peor escenario realista)",
  E: "E — El collar",
  F: "F — Las señas particulares",
  G: "G — La edad (señal nueva)"
};

console.log("\n============================================================");
console.log(" PRUEBAS ADVERSARIALES — todas estas parejas SON la misma mascota");
console.log(" La pregunta no es el puntaje, es si alcanza a salir en los 24");
console.log(" resultados que la persona ve, compitiendo contra 150 mascotas");
console.log(" reales de la misma ciudad y la misma ventana de fechas.");
console.log("============================================================");

let recuperadas = 0, perdidasTotales = 0, asimetrias = 0;

for (const b of ["A", "B", "C", "D", "E", "F", "G"]) {
  console.log(`\n--- ${NOMBRE_BLOQUE[b]} ---\n`);
  for (const r of resultados.filter(x => x.bloque === b)) {
    if (r.bien) recuperadas++; else perdidasTotales++;
    if (!r.simetrico) asimetrias++;
    const marca = r.bien ? (r.veredicto === "1er lugar" ? "✓✓" : "✓ ") : (r.rescatable ? "~ " : "✗ ");
    const pos = n => r.puestos[n] === -1 ? "fuera" : `#${r.puestos[n] + 1}`;
    console.log(`${marca} ${r.nombre}`);
    console.log(`     puntaje ${String(r.total).padStart(3)}  banda ${r.banda.padEnd(5)}  ` +
                `puesto según competencia — 10 rivales: ${pos(10)} · 30: ${pos(30)} · 150: ${pos(150)}` +
                (r.simetrico ? "" : "  ⚠ NO SIMÉTRICO"));
    if (r.causa) console.log(`     causa del fallo: ${r.causa}`);
    console.log(`     ${r.notas}`);
  }
}

const total = resultados.length;
const rescatables = resultados.filter(r => r.rescatable).length;
console.log("\n============================================================");
console.log(` RESUMEN`);
console.log(`   Ciudad saturada (150 rivales): ${recuperadas}/${total} recuperadas ` +
            `(${Math.round(recuperadas / total * 100)}%)`);
console.log(`   Municipio mediano (30 rivales): ${recuperadas + rescatables}/${total} ` +
            `(${Math.round((recuperadas + rescatables) / total * 100)}%)`);
console.log(` Mascotas que se habrían perdido en ciudad saturada: ${perdidasTotales}`);
console.log(`   de esas, ${rescatables} SÍ aparecían en un municipio con menos reportes`);
const porFiltro = resultados.filter(r => !r.bien && r.total === 0).length;
const porUmbral = resultados.filter(r => !r.bien && r.total > 0 && r.total < 26).length;
const porCompetencia = perdidasTotales - porFiltro - porUmbral;
console.log(`\n Causa de las ${perdidasTotales} pérdidas:`);
console.log(`   ${porFiltro} por filtro duro (especie, fecha o distancia): puntaje 0, nunca se compara`);
console.log(`   ${porUmbral} por quedar bajo el umbral de 26 puntos`);
console.log(`   ${porCompetencia} por competencia: el puntaje alcanzaba, pero otras 24 fichas puntuaron más`);
if (asimetrias) console.log(` ⚠ Casos no simétricos: ${asimetrias} — es un bug, puntuar(a,b) debe ser puntuar(b,a)`);
console.log("============================================================");

if (perdidasTotales) {
  console.log("\nLas que se perdieron, en orden de gravedad:\n");
  resultados.filter(r => !r.bien)
    .sort((a, b) => b.total - a.total)
    .forEach(r => console.log(`  ✗ [${r.bloque}] ${r.nombre}\n      puntaje ${r.total} — ${r.veredicto} — ${r.notas}`));
}
