# Patas de vuelta

Plataforma para reunir mascotas perdidas con sus familias, en toda Colombia.

No es un tablón de anuncios. Mantiene dos listas —las que se buscan y las que alguien
encontró— y las cruza sola por cercanía real y características, de modo que cada persona
ve una lista corta de candidatos en vez de cientos de fichas.

---

## Lo que cuesta

**Cero pesos.** Todo corre en planes gratuitos:

| Cosa | Servicio | Plan | Límite |
|---|---|---|---|
| Hosting | Netlify | Gratis | 100 GB de tráfico al mes |
| Base de datos y fotos | Supabase | Gratis | 500 MB de base, 1 GB de fotos |
| Mapas | OpenStreetMap | Gratis | Uso razonable |
| Dominio | `algo.netlify.app` | Gratis | — |

Con las fotos comprimidas en el navegador (~180 KB cada una, hasta 3 por mascota),
1 GB alcanza para unas **1.800 mascotas**. Muy por encima de lo que vas a necesitar
al arrancar, y cuando te acerques, el plan siguiente de Supabase cuesta unos 25 USD al mes.

Lo único que cuesta plata es un dominio propio (unos $40.000–$60.000 al año). **No lo
necesitas para lanzar**, pero ayuda: un dominio corto se lee mejor impreso en el afiche.
Puedes lanzar con el subdominio gratis y comprarlo después.

> Los afiches ya descargados llevan la dirección impresa. Si cambias de dominio más
> adelante, deja una redirección del viejo al nuevo para que esos afiches sigan sirviendo.

---

## Montarlo (unos 15 minutos)

### 1. Base de datos

1. Entra a [supabase.com](https://supabase.com) y crea una cuenta gratis.
2. **New project.** Elige región **South America (São Paulo)** o **East US**.
3. Cuando termine, ve a **SQL Editor → New query**, pega **todo** `supabase-schema.sql`
   y dale **Run**. Debe decir *Success*.

Eso crea las tablas, las vistas públicas, las funciones, los permisos y el depósito de fotos.
Es seguro volver a ejecutarlo si más adelante actualizas el esquema: no borra datos.

### 2. Conectar la página

1. En Supabase: **Project Settings → API**.
2. Copia **Project URL** y la clave **anon public**.
3. Ábrelas en `config.js`:

```js
SUPABASE_URL: "https://abcdefgh.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi..."
```

La clave `anon` es pública a propósito: viaja en el navegador de todo el mundo. Lo que
protege los datos no es el secreto de la clave sino los permisos del esquema. Ver
"Seguridad" más abajo.

### 3. Subirlo a Netlify

**Rápido:** arrastra la carpeta completa a [app.netlify.com/drop](https://app.netlify.com/drop).

**Recomendado:** súbela a un repositorio de GitHub y en Netlify usa **Add new site →
Import an existing project**. No hay que configurar comando de build: no se compila nada.

### 4. Vistas previas al compartir

Para que al pegar un enlace en WhatsApp o Instagram salga la foto de la mascota:

Netlify → **Site configuration → Environment variables**:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | el mismo Project URL |
| `SUPABASE_ANON_KEY` | la misma clave anon |

Vuelve a desplegar. Si no lo haces, la página funciona igual pero los enlaces
compartidos salen sin foto.

### 5. Tu dominio en el afiche

En `config.js`, `DOMINIO`. Si lo dejas vacío toma el dominio donde esté publicada,
que es lo correcto casi siempre.

---

## Avisos por correo (opcional)

**La página funciona sin esto.** Quien encuentra un animal obtiene el contacto directo
al instante, así que el aviso no es lo que cierra el ciclo: solo acorta el tiempo cuando
nadie está mirando la página. Móntalo cuando tengas tiempo, no antes de lanzar.

1. Crea una cuenta en [resend.com](https://resend.com) (gratis, 3.000 correos al mes) y
   genera una API key.
2. Instala la CLI de Supabase y despliega la función:
   ```bash
   supabase functions deploy notificar --no-verify-jwt
   ```
3. En Supabase → **Edge Functions → notificar → Secrets**, agrega:
   `RESEND_API_KEY`, `CORREO_REMITENTE` (por ejemplo `avisos@tudominio.co`)
   y `SITIO_URL` (la dirección de tu página).
4. En Supabase → **Database → Webhooks → Create a new hook**:
   - Tabla: `pistas`, evento: `Insert`
   - Tipo: **Supabase Edge Functions** → `notificar`

Si algo de esto falla, no pasa nada: la función está escrita para no romper nunca el
registro de la pista.

---

## Cómo está armado

```
index.html                          la cáscara
app.js                              rutas, formularios, cruce, mapa, afiches
styles.css                          estilos
config.js                           lo único que editas
datos-colombia.js                   33 departamentos y 1.104 municipios
qr.js                               generador de QR (MIT, incluido para no depender de un CDN)
netlify.toml                        redirecciones y función edge
netlify/edge-functions/ficha-og.js  vistas previas al compartir
supabase-schema.sql                 base de datos
supabase/functions/notificar/       avisos por correo (opcional)
vista-previa.html                   archivo único con datos falsos, para revisar el diseño
```

Sin framework, sin build, sin `npm install`. Se despliega arrastrando la carpeta.

### Rutas

| Ruta | Qué es |
|---|---|
| `/` | portada |
| `/buscar` | listado con filtros y orden por cercanía |
| `/como-funciona` | explicación del método (útil también para difundir) |
| `/reportar/perdida` · `/reportar/encontrada` | los dos formularios |
| `/m/CÓDIGO` | ficha pública (la del QR) |
| `/g/TOKEN` | administrar tu publicación |
| `/editar/TOKEN` | corregir datos |
| `/afiche/CÓDIGO` | generador de afiches |

---

## Las decisiones que importan

### La ubicación es el corazón

Un animal perdido no tiene nombre buscable: quien lo encuentra no sabe cómo se llama.
Lo único que comparten quien busca y quien encontró es **cómo se ve**, **dónde** y **cuándo**.

Y de esos tres, el que de verdad separa a tu perro de todos los perros parecidos del país
es la ubicación. Por eso pedimos un punto en el mapa y no solo el nombre del barrio:
dos textos ("cerca del parque" y "junto a la cancha") no se pueden comparar, pero dos
puntos sí se restan y dan 400 metros.

El selector de ubicación ofrece cuatro caminos, de más a menos preciso: botón de GPS,
tocar o arrastrar el punto en el mapa, escribir el barrio (que se geocodifica), o elegir
solo el municipio. Cada ficha guarda si el punto es exacto o aproximado, y la ficha
pública lo muestra: punto exacto se dibuja como marcador, aproximado como un círculo.

### El cruce

Para cada reporte se traen los del lado contrario dentro de un recuadro de ~60 km
(filtrado en el servidor, para que funcione con el país entero) y se puntúa cada uno:

- **Distancia real**, con el radio abriéndose 1,5 km por día transcurrido hasta 25 km,
  porque los animales caminan y la gente los mueve.
- **Tamaño**, con tolerancia: un escalón de diferencia casi no castiga porque mucha
  gente lo estima mal; dos escalones sí.
- **Color por componentes**: "manchado" y "negro y blanco" describen al mismo animal,
  y el sistema lo sabe. Igual "canela" y "dorado".
- **Fechas coherentes**: nadie encuentra a un animal antes de que se pierda (con dos
  días de margen por errores al reportar).
- **Pelo, sexo y raza** cuando están.

La puntuación es un promedio ponderado **solo entre las señales que existen**, así que a
un reporte incompleto no se le castiga por lo que no dijo. Al final se aplican
penalizaciones por contradicciones directas (sexo opuesto, tamaños opuestos, colores sin
nada en común).

Dos propiedades que se probaron explícitamente: es **simétrico** (da igual desde qué lado
se mire) y **prefiere errar por exceso**. Mostrar un candidato de más cuesta tres segundos
de mirar una foto; perder uno significa una mascota que no vuelve. Por eso el umbral es
bajo y los resultados vienen en tres bandas: *muy parecido*, *podría ser*, *poco probable*.

### El contacto: por qué se revela y no se publica

El teléfono de quien publica **no aparece escrito en ninguna parte de la página** y
nunca viaja en las consultas de listado. Para conseguirlo hay que tocar un botón, en una
ficha a la vez, lo cual dispara una consulta específica a esa ficha.

Es un equilibrio deliberado. Publicarlo abierto facilita que alguien recoja miles de
números de un golpe para venderlos o para estafar en masa. Esconderlo del todo —que fue
la primera versión de este proyecto— rompe lo único que importa: que quien tiene al animal
pueda avisar ya.

Con este diseño, una persona lo consigue en un toque; un programa automático que barre
la base entera, no. Y además:

- Al enviar la información, el contacto aparece **inmediatamente**, con el mensaje ya
  escrito para WhatsApp y un botón para llamar.
- La pista queda registrada, así que hay rastro de quién dijo qué.
- Quien publicó ve el contacto de quien avisó, y puede responderle por WhatsApp desde
  su panel.

### La seña de verificación

A quien publica una mascota perdida se le pide una seña que **no se publica**. Cuando
alguien dice tener al animal, la página le recuerda a ambos usarla: si de verdad lo
tiene, puede describirla. Es la defensa contra entregas equivocadas y contra quien
reclama un animal que no es suyo.

### Nada de cuentas

Cada publicación genera un enlace secreto de gestión que además se guarda en el teléfono
de quien publicó. Registrarse es la fricción que hace que la gente abandone el formulario,
y aquí cada abandono es una mascota que no aparece.

### Las fichas caducan solas

El estado "sin confirmar" se calcula al momento de leer, a los 12 días sin actualizar.
No hace falta ninguna tarea programada. Las fichas caducadas **se siguen mostrando y se
siguen cruzando** —una mascota perdida hace un mes sigue perdida— pero salen marcadas y
al final de los resultados.

Cada 3 días, la página le pregunta a quien publicó si ya apareció, con dos botones.

---

## Seguridad

Se probó contra una base PostgreSQL real, simulando a un atacante que tomó la clave
pública del navegador. Los cinco intentos quedan bloqueados:

| Intento | Resultado |
|---|---|
| Leer la tabla `mascotas` directo | denegado |
| Leer solo la columna de teléfonos | denegado |
| Insertar saltándose las validaciones | denegado |
| Modificar o borrar publicaciones ajenas | denegado |
| Leer los contactos de las pistas | denegado |

Ni el rol público ni nadie sin el token pueden tocar las tablas: **todo pasa por
funciones controladas** que validan y solo devuelven lo que corresponde. Las vistas
públicas ni siquiera contienen las columnas privadas, así que no hay forma de pedirlas.

Contra el spam automático hay una trampa oculta en el formulario y un tiempo mínimo de
llenado. No sustituye a la moderación humana.

---

## Operarla

**Moderar.** No hay panel de administración. Desde Supabase → **Table Editor** →
`mascotas`, cambia `estado` a `oculto` para retirar cualquier publicación. Revísalo un
par de veces al día: que cualquiera publique sin registrarse es lo que la hace útil y
también lo que la hace abusable.

**Empujar los reencuentros.** La gente no vuelve a marcar "ya apareció": está feliz con
su perro y se olvidó de ti. La página pregunta sola cada 3 días a quien publicó desde ese
teléfono, pero conviene revisar en Supabase las fichas con `ultima_confirmacion` de más
de dos semanas y escribirles. Cinco minutos al día.

**Distribuir.** Es tu verdadero riesgo, no el código. La mejor página sin usuarios no
salva ni un animal. Consigue que dos o tres cuentas grandes de rescate animal la
compartan, y busca que veterinarias y albergues publiquen lo que tienen recogido: son
los que más casos resuelven de un golpe.

**Sobre el alcance.** La página cubre el país entero, y así debe ser: sirve igual para el
terremoto que para una mascota perdida cualquier martes. Pero eso vale para el *producto*,
no para la *difusión*: concentra la promoción en una región a la vez, porque el cruce
necesita densidad. Cien casos en dos ciudades producen coincidencias; mil regados en
catorce departamentos, ninguna.

---

## Lo que no tiene

- **Avisos instantáneos por notificación push.** El correo (opcional) cubre buena parte.
- **Mapa con todos los reportes.** Los datos están; falta la vista.
- **Cuentas para albergues** que administren muchos animales a la vez.
- **Detección de duplicados** cuando cinco vecinos reportan al mismo perro callejero.

---

## Aviso

Iniciativa ciudadana, voluntaria y sin ánimo de lucro. No reemplaza a las autoridades ni
a los organismos de rescate. Para emergencias con personas, **123**.
