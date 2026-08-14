/* ============================================================
   DOS FICHAS DE DEMOSTRACIÓN PARA GRABAR EL VIDEO
   Corre con:  node pruebas/sembrar-demo.js
   ============================================================

   Crea exactamente dos publicaciones que SÍ se emparejan, para poder grabar
   el momento en que aparece la coincidencia — que es lo único que esta página
   hace y un grupo de Facebook no.

   No son dos fichas idénticas a propósito. Una coincidencia perfecta no
   demuestra nada y encima se ve falsa en cámara. Estas están degradadas como
   pasa de verdad:

     · Quien encontró al perro le calculó un tamaño menos (la gente estima mal).
     · Dejó en blanco raza, sexo y edad — que es lo CORRECTO cuando no se sabe:
       un campo vacío casi no baja el puntaje, uno adivinado lo hunde.
     · No menciona el collar: se cayó o se lo quitaron al recogerlo.
     · Describe otra cosa en las señas ("flaco y asustado" en vez de la mancha
       del pecho), que es justo lo que pasa en la vida real.
     · Están a ~1 km y con 2 días de diferencia, no en el mismo punto.

   CÓMO SE BORRAN DESPUÉS
   Quedan marcadas con  demo-video@patasdevuelta.test  (columna que NO aparece
   en la vista pública). Para quitarlas:

       delete from mascotas where contacto_email = 'demo-video@patasdevuelta.test';

   El teléfono es 3000000000: tiene forma válida de celular colombiano pero no
   es un número de nadie, así que si alguien toca "ver contacto" durante el
   video no le cae una llamada a una persona real. */

const fs = require("fs");
const path = require("path");

const MARCA_CORREO = "demo-video@patasdevuelta.test";
const TELEFONO = "3000000000";

const config = fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8");
const sacar = clave => (config.match(new RegExp(clave + '\\s*:\\s*"([^"]+)"')) || [])[1];
const API = (sacar("SUPABASE_URL") || "").replace(/\/$/, "");
const KEY = sacar("SUPABASE_ANON_KEY") || "";

if (!API.startsWith("http") || KEY.length < 20) {
  console.error("No pude leer las credenciales de config.js."); process.exit(1);
}

// Las dos fotos, ya descargadas al lado de este archivo.
const FOTOS = {
  perdida: path.join(__dirname, "demo-buscado.png"),
  encontrada: path.join(__dirname, "demo-encontrado.jpg")
};

const hoyMenos = n => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

async function subirFoto(archivo, tipoMime) {
  const nombre = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` +
                 (tipoMime === "image/png" ? ".png" : ".jpg");
  const r = await fetch(`${API}/storage/v1/object/fotos/${nombre}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": tipoMime },
    body: fs.readFileSync(archivo)
  });
  if (!r.ok) throw new Error("foto: " + (await r.text()).slice(0, 200));
  return `${API}/storage/v1/object/public/fotos/${nombre}`;
}

async function crear(datos) {
  const r = await fetch(`${API}/rest/v1/rpc/crear_publicacion`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p: datos })
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(texto.slice(0, 300));
  return JSON.parse(texto);
}

(async () => {
  console.log("Creando las dos fichas de demostración en", API);
  console.log("Marca de borrado: contacto_email =", MARCA_CORREO, "\n");

  const fotoPerdida = await subirFoto(FOTOS.perdida, "image/png");
  const fotoEncontrada = await subirFoto(FOTOS.encontrada, "image/jpeg");
  console.log("  fotos subidas\n");

  /* ---------- 1 · LA QUE SE BUSCA ----------
     La llena el dueño: sabe todo y lo pone todo. Barrio Laureles, Medellín. */
  const perdida = {
    tipo: "perdida",
    especie: "Perro",
    nombre: "Simón",
    raza: "Criollo",
    tamano: "Mediano",
    colores: ["canela"],
    pelo: "Corto",
    sexo: "Macho",
    edad_aprox: "Cachorro",
    collar: "collar rojo de tela, sin placa",
    microchip: "",
    rasgos: "hocico negro, orejas grandes que se le doblan en la punta, muy flaco de patas",
    descripcion: "Se salió cuando el portero dejó la reja abierta. Es asustadizo con la gente " +
                 "pero se acerca si le hablan bajito. No sabe volver solo.",
    // Esta seña NO se publica en ninguna parte: es la prueba de que quien
    // llame de verdad lo tiene. Es la función que mencionas en el video.
    rasgo_verificacion: "Tiene una manchita blanca en forma de gota en el pecho, " +
                        "solo se le ve cuando se para en dos patas.",
    fecha: hoyMenos(5),
    lat: 6.244700,
    lng: -75.591600,
    precision_ubicacion: "exacta",
    lugar: "Laureles, cerca del Segundo Parque",
    municipio: "Medellín",
    departamento: "Antioquia",
    fotos: [fotoPerdida],
    contacto_nombre: "Daniela",
    contacto_tel: TELEFONO,
    contacto_email: MARCA_CORREO
  };

  /* ---------- 2 · LA QUE ALGUIEN ENCONTRÓ ----------
     La llena un desconocido de afán: solo lo que se ve, y con un error de
     tamaño. Deja raza, sexo y edad vacíos — bien hecho, no mal hecho.
     Barrio Estadio, a ~1 km. Dos días después. */
  const encontrada = {
    tipo: "encontrada",
    especie: "Perro",
    nombre: "",
    raza: "",                     // no la sabe, y hace bien en no adivinar
    tamano: "Pequeño",            // le calculó un tamaño menos: pasa siempre
    colores: ["canela"],
    pelo: "Corto",
    sexo: "",                     // no le miró
    edad_aprox: "",               // no sabría decir
    collar: "",                   // no tenía cuando lo encontró
    microchip: "",
    rasgos: "hocico oscuro, se ve muy flaco",
    descripcion: "Lleva dos días detrás de la panadería. Está asustado y con hambre, " +
                 "no se dejaba coger al principio. Lo tengo en el patio de mi casa " +
                 "mientras aparece el dueño.",
    rasgo_verificacion: "",
    fecha: hoyMenos(3),
    lat: 6.253100,
    lng: -75.588500,
    precision_ubicacion: "aproximada",
    lugar: "Barrio Estadio, por la 70",
    municipio: "Medellín",
    departamento: "Antioquia",
    fotos: [fotoEncontrada],
    contacto_nombre: "Andrés",
    contacto_tel: TELEFONO,
    contacto_email: MARCA_CORREO
  };

  const resultados = [];
  for (const [etiqueta, datos] of [["se busca", perdida], ["encontrada", encontrada]]) {
    const r = await crear(datos);
    resultados.push({ etiqueta, ...r });
    console.log(`  ${etiqueta.padEnd(10)} código ${r.codigo}`);
  }

  fs.writeFileSync(path.join(__dirname, "demo-sembrado.json"),
    JSON.stringify({ creado: new Date().toISOString(), publicaciones: resultados }, null, 2));

  const sitio = "https://patasdevuelta.netlify.app";
  console.log("\n─────────────────────────────────────────────────────────");
  console.log("PARA GRABAR:");
  for (const r of resultados) {
    console.log(`\n  ${r.etiqueta.toUpperCase()}`);
    console.log(`    ficha pública : ${sitio}/m/${r.codigo}`);
    console.log(`    afiche        : ${sitio}/afiche/${r.codigo}`);
    console.log(`    panel privado : ${sitio}/g/${r.token}`);
  }
  console.log("\n  El panel privado es el enlace secreto de administración:");
  console.log("  no lo muestres en pantalla durante el video.");
  console.log("\n─────────────────────────────────────────────────────────");
  console.log("PARA BORRARLAS DESPUÉS (SQL Editor de Supabase):");
  console.log(`\n  delete from mascotas where contacto_email = '${MARCA_CORREO}';`);
  console.log("─────────────────────────────────────────────────────────");
})().catch(e => { console.error("\nFalló:", e.message); process.exit(1); });
