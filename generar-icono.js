/* Genera icono-192.png y icono-512.png: la huella de la marca sobre el verde
   oscuro del sitio. Los usa el aviso push (una notificación sin ícono se ve
   rota) y sirven para cuando alguien agrega la página a su pantalla de inicio.

   Se escribe el PNG a mano en vez de traer una librería: el proyecto no tiene
   npm install y no vale la pena estrenarlo por dos imágenes.

       node generar-icono.js
*/

const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const FONDO = [18, 33, 28, 255];      // --tinta
const HUELLA = [244, 242, 233, 255];  // --papel

/* La huella son cuatro dedos y una almohadilla, en coordenadas de 0 a 1 para
   poder dibujarla a cualquier tamaño. Cada uno es una elipse: [cx, cy, rx, ry]. */
const DEDOS = [
  [0.275, 0.325, 0.110, 0.150],
  [0.455, 0.255, 0.115, 0.160],
  [0.640, 0.290, 0.108, 0.145],
  [0.790, 0.410, 0.100, 0.132]
];
const ALMOHADILLA = [0.520, 0.680, 0.235, 0.195];

const dentroDeElipse = (x, y, [cx, cy, rx, ry]) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

function pixeles(lado) {
  const datos = Buffer.alloc(lado * lado * 4);
  const m = 3;                                   // muestreo 3x3 para bordes suaves
  for (let py = 0; py < lado; py++) {
    for (let px = 0; px < lado; px++) {
      let dentro = 0;
      for (let sy = 0; sy < m; sy++) {
        for (let sx = 0; sx < m; sx++) {
          const x = (px + (sx + 0.5) / m) / lado;
          const y = (py + (sy + 0.5) / m) / lado;
          if (DEDOS.some(d => dentroDeElipse(x, y, d)) || dentroDeElipse(x, y, ALMOHADILLA)) dentro++;
        }
      }
      const t = dentro / (m * m);
      const i = (py * lado + px) * 4;
      for (let c = 0; c < 4; c++) datos[i + c] = Math.round(FONDO[c] + (HUELLA[c] - FONDO[c]) * t);
    }
  }
  return datos;
}

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

function png(lado) {
  const datos = pixeles(lado);
  // Cada fila lleva delante un byte que dice qué filtro usa. 0 = ninguno.
  const filas = Buffer.alloc(lado * (lado * 4 + 1));
  for (let y = 0; y < lado; y++) {
    filas[y * (lado * 4 + 1)] = 0;
    datos.copy(filas, y * (lado * 4 + 1) + 1, y * lado * 4, (y + 1) * lado * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0); ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8;    // bits por canal
  ihdr[9] = 6;    // color con transparencia (RGBA)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    trozo("IHDR", ihdr),
    trozo("IDAT", zlib.deflateSync(filas, { level: 9 })),
    trozo("IEND", Buffer.alloc(0))
  ]);
}

for (const lado of [192, 512]) {
  const archivo = path.join(__dirname, `icono-${lado}.png`);
  fs.writeFileSync(archivo, png(lado));
  console.log(`  ${path.basename(archivo)} — ${(fs.statSync(archivo).size / 1024).toFixed(1)} KB`);
}
