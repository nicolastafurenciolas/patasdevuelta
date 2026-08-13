/* Regenera vista-previa.html a partir de los archivos reales.

   vista-previa.html es un archivo ÚNICO y autocontenido: lleva dentro una copia
   de styles.css y de app.js, más una capa que simula la red con datos de
   ejemplo. Sirve para ver el diseño en el celular sin montar Supabase, y para
   mandárselo a alguien por WhatsApp y que lo abra de una.

   El problema de tener copias es que se quedan viejas: llegó a mostrar un
   diseño que ya no existía. Este script las vuelve a copiar de la fuente, así
   que después de tocar app.js o styles.css basta con correr:

       node construir-vista-previa.js

   No inventa nada: solo reemplaza el bloque de estilos y el bloque de la
   aplicación, dejando intacta la capa de demostración que sí es propia de este
   archivo. */

const fs = require("fs");
const path = require("path");

const raiz = __dirname;
const leer = f => fs.readFileSync(path.join(raiz, f), "utf8");

const previa = leer("vista-previa.html").split("\n");
const estilos = leer("styles.css").trimEnd();
const aplicacion = leer("app.js").trimEnd();

/* Localizamos los bloques por su contenido, no por número de línea, para que
   siga funcionando aunque el archivo crezca o se reordene. */
const indiceDe = (predicado, desde = 0) => {
  for (let i = desde; i < previa.length; i++) if (predicado(previa[i], i)) return i;
  return -1;
};

const inicioEstilos = indiceDe(l => l.trim() === "<style>");
const finEstilos    = indiceDe(l => l.trim() === "</style>", inicioEstilos);

const inicioApp = indiceDe(l => l.includes("PATAS DE VUELTA — aplicación")) - 1; // la línea del /* ===
const finApp    = indiceDe((l, i) => l.trim() === "enrutar();" && i > inicioApp);

for (const [nombre, valor] of Object.entries({ inicioEstilos, finEstilos, inicioApp, finApp })) {
  if (valor < 0) {
    console.error(`No se encontró el bloque "${nombre}" en vista-previa.html.`);
    console.error("El archivo cambió de forma: revísalo a mano antes de seguir.");
    process.exit(1);
  }
}

const resultado = [
  ...previa.slice(0, inicioEstilos + 1),
  estilos,
  ...previa.slice(finEstilos, inicioApp),
  aplicacion,
  ...previa.slice(finApp + 1)
].join("\n");

fs.writeFileSync(path.join(raiz, "vista-previa.html"), resultado);

const kb = n => (n / 1024).toFixed(0) + " KB";
console.log("vista-previa.html regenerada.");
console.log(`  estilos:     ${kb(estilos.length)}`);
console.log(`  aplicación:  ${kb(aplicacion.length)}`);
console.log(`  archivo:     ${kb(resultado.length)}`);
