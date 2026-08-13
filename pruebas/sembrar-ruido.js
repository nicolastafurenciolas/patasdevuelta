/* ============================================================
   SEMBRAR RUIDO DE PRUEBA
   Corre con:  node pruebas/sembrar-ruido.js
   ============================================================

   Crea ~100 publicaciones de mentira en la base REAL para poder probar el
   algoritmo de cruce con competencia de verdad: sin otras mascotas alrededor,
   cualquier coincidencia sale de primera y la prueba no demuestra nada.

   CÓMO SE BORRAN DESPUÉS
   Todas quedan marcadas con un correo de contacto imposible:

       ruido-de-prueba@patasdevuelta.test

   Esa columna NO aparece en la vista pública, así que nadie la ve en la
   página, pero permite borrarlas todas de un solo golpe y sin riesgo de
   tocar una publicación de verdad. Al final el script imprime la orden SQL
   exacta. También queda la lista completa en pruebas/ruido-sembrado.json.

   Para quitarlas de la página al instante y sin entrar a SQL:
       node pruebas/borrar-ruido.js

   El teléfono de contacto es 3000000000 en todas: tiene forma válida de
   celular colombiano pero no es un número asignado a nadie, así que si
   alguien toca "ver contacto" no le cae una llamada a una persona real. */

const fs = require("fs");
const path = require("path");

const MARCA_CORREO = "ruido-de-prueba@patasdevuelta.test";
const TELEFONO = "3000000000";
// Se puede pedir otra cantidad: node pruebas/sembrar-ruido.js 20
const CUANTAS = Number(process.argv[2]) || 100;

// ---------- credenciales, leídas del mismo config.js que usa la página ----------
const config = fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8");
const sacar = clave => (config.match(new RegExp(clave + '\\s*:\\s*"([^"]+)"')) || [])[1];
const API = (sacar("SUPABASE_URL") || "").replace(/\/$/, "");
const KEY = sacar("SUPABASE_ANON_KEY") || "";

if (!API.startsWith("http") || KEY.length < 20) {
  console.error("No pude leer las credenciales de config.js."); process.exit(1);
}

/* ---------- azar ----------
   La semilla cambia en cada corrida para que dos siembras seguidas no generen
   las mismas mascotas. Se puede fijar para repetir una siembra igual:
   node pruebas/sembrar-ruido.js 100 12345 */
let semilla = Number(process.argv[3]) || (Date.now() % 2147483647);
const azar = () => (semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const elegir = l => l[Math.floor(azar() * l.length)];
const jitter = (v, m) => v + (azar() * 2 - 1) * m;
const entre = (a, b) => a + Math.floor(azar() * (b - a + 1));

// ---------- vocabulario ----------
const CIUDADES = [
  { m: "Bogotá D.C.", d: "Bogotá D.C.", lat: 4.7110, lng: -74.0721, peso: 14 },
  { m: "Medellín", d: "Antioquia", lat: 6.2442, lng: -75.5812, peso: 12 },
  { m: "Cali", d: "Valle del Cauca", lat: 3.4516, lng: -76.5320, peso: 10 },
  { m: "Barranquilla", d: "Atlántico", lat: 10.9685, lng: -74.7813, peso: 8 },
  { m: "Cartagena", d: "Bolívar", lat: 10.3910, lng: -75.4794, peso: 7 },
  { m: "Bucaramanga", d: "Santander", lat: 7.1193, lng: -73.1227, peso: 7 },
  { m: "Pereira", d: "Risaralda", lat: 4.8143, lng: -75.6946, peso: 7 },
  { m: "Manizales", d: "Caldas", lat: 5.0689, lng: -75.5174, peso: 7 },
  { m: "Ibagué", d: "Tolima", lat: 4.4389, lng: -75.2322, peso: 6 },
  { m: "Armenia", d: "Quindío", lat: 4.5339, lng: -75.6811, peso: 5 },
  { m: "Villavicencio", d: "Meta", lat: 4.1420, lng: -73.6266, peso: 5 },
  { m: "Cúcuta", d: "Norte de Santander", lat: 7.8939, lng: -72.5078, peso: 5 },
  { m: "Santa Marta", d: "Magdalena", lat: 11.2408, lng: -74.1990, peso: 4 },
  { m: "Pasto", d: "Nariño", lat: 1.2136, lng: -77.2811, peso: 4 },
  { m: "Neiva", d: "Huila", lat: 2.9273, lng: -75.2819, peso: 4 },
  { m: "Popayán", d: "Cauca", lat: 2.4448, lng: -76.6147, peso: 3 }
];
const RULETA = CIUDADES.flatMap(c => Array(c.peso).fill(c));

const BARRIOS = ["cerca del parque principal", "por el centro", "barrio La Esperanza",
  "cerca del colegio", "por la avenida principal", "barrio San José", "cerca de la cancha",
  "por la plaza de mercado", "barrio El Bosque", "cerca del hospital", "por la terminal",
  "barrio Los Alpes", "cerca del CAI", "por la ciclovía", "barrio Villa del Sol"];

const RAZAS_PERRO = ["Criollo", "Criollo", "Criollo", "Labrador", "Pastor alemán", "Poodle",
  "Schnauzer", "Pitbull", "Golden retriever", "Beagle", "Chihuahua", "Husky", "Bulldog",
  "Border collie", "Cocker spaniel", "Salchicha", "Pinscher", "French poodle", null, null];
const RAZAS_GATO = ["Criollo", "Criollo", "Criollo", "Siamés", "Persa", "Angora",
  "Atigrado", "Bombay", null, null];

const NOMBRES = ["Max", "Luna", "Rocky", "Nala", "Toby", "Kira", "Simba", "Lola", "Zeus",
  "Maya", "Coco", "Bruno", "Canela", "Duque", "Mia", "Thor", "Sasha", "Pelusa", "Negro",
  "Blanca", "Motas", "Firulais", "Manchas", "Copito", "Tigre", "Panda", "Oso", "Lucas",
  "Kiara", "Bobby", "Chocolate", "Galleta", "Nube", "Sol", "Chispa", "Trufa", "Milo",
  "Nina", "Rambo", "Princesa", "Capitán", "Perla", "Rayo", "Estrella", "Tomás", "Frida"];

const COLORES = ["negro", "blanco", "gris", "cafe", "canela", "dorado", "crema",
  "naranja", "atigrado", "manchado", "tricolor"];
const TAMANOS = ["Pequeño", "Mediano", "Grande"];
const PELOS = ["Corto", "Medio", "Largo"];
const SEXOS = ["Macho", "Hembra", "No sé"];
const EDADES = ["Cachorro", "Joven", "Adulto", "Viejito"];

const COLLARES = ["collar rojo", "collar azul con placa", "collar negro de cuero",
  "collar verde", "collar rosado", "collar café con placa dorada", "collar de tela naranja",
  null, null, null, null];

const SENAS = [
  "Mancha blanca en el pecho", "Le falta un pedazo de la oreja derecha",
  "Cojea un poco de la pata trasera", "Tiene la cola muy corta",
  "Cicatriz en el lomo", "Un ojo de cada color", "La oreja izquierda siempre caída",
  "Tiene las patas blancas como medias", "Mancha oscura alrededor de un ojo",
  "Le falta la punta de la cola", "Tiene una mancha en forma de corazón en el lomo",
  "Muy peludo en la cola", "Cicatriz pequeña sobre la nariz",
  "Tiene el hocico canoso", "Una oreja parada y la otra caída",
  null, null, null];

const ESTADOS_HALLAZGO = ["Estaba asustado pero sano, lo tengo en mi casa",
  "Lo vi solo en la calle, se ve bien de salud", "Está flaco pero tranquilo",
  "Lo tengo conmigo mientras aparece la familia", "Se acercó solo, es muy manso",
  "Estaba mojado y con hambre, ya comió", null, null];

const NOMBRES_CONTACTO = ["Ana", "Carlos", "María", "Jorge", "Laura", "Andrés", "Paula",
  "Diego", "Camila", "Santiago", "Valentina", "Felipe", "Daniela", "Julián", "Sofía"];

const hoy = new Date();
const fechaMenos = n => {
  const d = new Date(hoy); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

function generar(i) {
  const tipo = i % 2 === 0 ? "perdida" : "encontrada";
  const especie = azar() < 0.68 ? "Perro" : "Gato";
  const ciudad = elegir(RULETA);
  const paleta = [elegir(COLORES)];
  if (azar() < 0.3) { const otro = elegir(COLORES); if (otro !== paleta[0]) paleta.push(otro); }

  // Uno de cada tres viene incompleto, como en la vida real
  const flojo = azar() < 0.33;
  const quizas = (v, prob = 0.75) => (azar() < prob ? v : "");

  const color = paleta[0];
  const foto = `https://placehold.co/800x800/${
    { negro:"2A2A2A", blanco:"EFECE3", gris:"8E8E8E", cafe:"7A4A21", canela:"C98B3A",
      dorado:"DDB25A", crema:"E8D9B5", naranja:"C0562A", atigrado:"8A5A2B",
      manchado:"BFBBAE", tricolor:"9A7A5B" }[color] || "8A8A8A"
  }/12211C?text=${encodeURIComponent(especie)}`;

  return {
    tipo, especie,
    nombre: tipo === "perdida" ? elegir(NOMBRES) : "",
    raza: flojo ? "" : quizas(elegir(especie === "Perro" ? RAZAS_PERRO : RAZAS_GATO) || ""),
    tamano: elegir(TAMANOS),
    colores: paleta,
    pelo: flojo ? "" : quizas(elegir(PELOS)),
    sexo: flojo ? "" : quizas(elegir(SEXOS)),
    edad_aprox: flojo ? "" : quizas(elegir(EDADES), 0.6),
    collar: quizas(elegir(COLLARES) || "", 0.8),
    microchip: "",
    rasgos: quizas(elegir(SENAS) || "", 0.8),
    descripcion: tipo === "encontrada" ? quizas(elegir(ESTADOS_HALLAZGO) || "", 0.7) : "",
    rasgo_verificacion: "",
    fecha: fechaMenos(entre(0, 18)),
    lat: +jitter(ciudad.lat, 0.055).toFixed(6),
    lng: +jitter(ciudad.lng, 0.055).toFixed(6),
    precision_ubicacion: azar() < 0.7 ? "exacta" : "aproximada",
    lugar: quizas(elegir(BARRIOS), 0.8),
    municipio: ciudad.m,
    departamento: ciudad.d,
    fotos: [foto],
    contacto_nombre: elegir(NOMBRES_CONTACTO),
    contacto_tel: TELEFONO,
    contacto_email: MARCA_CORREO      // ← la marca que permite borrarlas todas
  };
}

async function crear(datos) {
  const r = await fetch(`${API}/rest/v1/rpc/crear_publicacion`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p: datos })
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(texto.slice(0, 200));
  return JSON.parse(texto);
}

(async () => {
  console.log(`Sembrando ${CUANTAS} publicaciones de prueba en ${API}`);
  console.log(`Marca de borrado: contacto_email = ${MARCA_CORREO}\n`);

  const creadas = [];
  const fallos = [];

  for (let i = 0; i < CUANTAS; i++) {
    const datos = generar(i);
    try {
      const r = await crear(datos);
      creadas.push({ codigo: r.codigo, token: r.token, tipo: datos.tipo,
                     especie: datos.especie, municipio: datos.municipio });
      process.stdout.write(`\r  creadas: ${creadas.length}/${CUANTAS}`);
    } catch (e) {
      fallos.push({ i, error: e.message });
    }
    await new Promise(r => setTimeout(r, 60));   // sin apuro, para no atosigar la base
  }

  /* La lista se ACUMULA, nunca se reemplaza: si se siembra en dos tandas y el
     archivo se sobrescribiera, los tokens de la primera se perderían y esas
     publicaciones quedarían sin forma de retirarse desde el script. */
  const archivo = path.join(__dirname, "ruido-sembrado.json");
  const previo = fs.existsSync(archivo)
    ? JSON.parse(fs.readFileSync(archivo, "utf8")).publicaciones || [] : [];
  const yaEstaban = new Set(previo.map(p => p.codigo));
  const salida = {
    actualizado: new Date().toISOString(),
    marca: MARCA_CORREO,
    telefono: TELEFONO,
    total: previo.length + creadas.filter(c => !yaEstaban.has(c.codigo)).length,
    publicaciones: [...previo, ...creadas.filter(c => !yaEstaban.has(c.codigo))]
  };
  fs.writeFileSync(archivo, JSON.stringify(salida, null, 2));
  console.log(`\n\nEn total hay ${salida.total} publicaciones de prueba registradas en la lista.`);

  console.log(`\n\nListas: ${creadas.length}. Fallidas: ${fallos.length}.`);
  if (fallos.length) console.log("  primer error:", fallos[0].error);

  const porTipo = creadas.reduce((a, c) => (a[c.tipo] = (a[c.tipo] || 0) + 1, a), {});
  const porEspecie = creadas.reduce((a, c) => (a[c.especie] = (a[c.especie] || 0) + 1, a), {});
  console.log("  por tipo:", porTipo);
  console.log("  por especie:", porEspecie);
  console.log("\nLista guardada en pruebas/ruido-sembrado.json");
  console.log("\n─────────────────────────────────────────────────────────");
  console.log("PARA BORRARLAS DEFINITIVAMENTE (SQL Editor de Supabase):\n");
  console.log(`  delete from mascotas where contacto_email = '${MARCA_CORREO}';`);
  console.log("\nPARA SOLO QUITARLAS DE LA PÁGINA, sin entrar a SQL:\n");
  console.log("  node pruebas/borrar-ruido.js");
  console.log("─────────────────────────────────────────────────────────");
})();
