# Patas de vuelta — contexto del proyecto

Este archivo se lee automáticamente al abrir Claude Code en esta carpeta. Si eres un
colaborador nuevo: léelo completo antes de tocar código. Si eres Claude Code: esto es
todo lo que un chat anterior (en claude.ai) ya decidió, probó y descartó. No lo
redescubras desde cero ni lo "simplifiques" sin entender el porqué — varias decisiones
parecen raras a primera vista y tienen una razón concreta explicada abajo.

---

## 1. Qué es esto y de dónde viene

**Patas de vuelta** es una plataforma para reunir mascotas perdidas con sus familias,
en toda Colombia.

Nació a raíz del terremoto de magnitud 7.4 del 10 de agosto de 2026 (epicentro en San
José del Palmar, Chocó), que dejó personas y mascotas desaparecidas. La idea original
del dueño del proyecto era cubrir **personas y mascotas**. Se descartó la parte de
personas deliberadamente: ya existe una plataforma ciudadana activa y con tracción real
para eso (Colombia Te Busca, colombiatebusca.com), y montar una segunda fragmentaría la
información justo cuando más urge que esté centralizada. El hueco real y sin cubrir
estaba en mascotas, así que el proyecto se enfocó ahí por completo.

**No es una herramienta solo para el terremoto.** Por decisión explícita del dueño,
tiene alcance nacional y permanente: sirve igual para una mascota perdida un martes
cualquiera en cualquier municipio del país. El terremoto fue el disparador, no el límite.

**No es un tablón de anuncios tipo grupo de Facebook.** La diferencia de fondo, y la
razón de ser del proyecto: mantiene dos listas —mascotas que se buscan y mascotas que
alguien encontró— y las cruza sola por cercanía real y características. Cuando entra un
reporte nuevo, se compara contra toda la lista contraria y se muestran las coincidencias
más fuertes. En un grupo de redes sociales, el encuentro depende de que la persona
correcta vea el post antes de que se hunda en el muro.

---

## 2. Reglas que no se deben romper

Estas son decisiones de diseño no obvias. Si algo aquí parece un error o una
sobre-ingeniería, **no lo "arregles" sin releer la razón** — ya se consideró la
alternativa simple y se descartó a propósito.

### La ubicación es el corazón del producto, no un campo más
Un animal perdido no tiene nombre buscable: quien lo encuentra no sabe cómo se llama.
Lo único que comparten quien busca y quien encontró es cómo se ve, dónde y cuándo. De
esos tres, la ubicación es la que de verdad separa a un perro de todos los perros
parecidos del país. Por eso el formulario pide marcar un punto en el mapa (no solo
escribir el barrio): dos textos como "cerca del parque" y "junto a la cancha" no se
pueden comparar entre sí, pero dos puntos en el mapa sí se restan y dan una distancia.
**No reemplaces el selector de mapa por un simple campo de texto.**

### El teléfono se revela con un toque, no se oculta del todo ni se publica abierto
Este es el cambio de diseño más importante que hubo en el proyecto. La primera versión
ocultaba el contacto por completo y todo pasaba por un formulario de mensajes — y eso
rompía el flujo crítico: quien encontraba al animal escribía un mensaje que el dueño
solo veía si entraba a revisar su panel, perdiendo tiempo valioso.

La versión actual: el número **no aparece escrito en ninguna parte de la página** y
**nunca viaja en las consultas de listado** (la vista pública `mascotas_publicas` ni
siquiera tiene esa columna). Para conseguirlo hay que tocar un botón en una ficha
puntual, lo cual dispara la función `obtener_contacto(codigo)`. Con esto, una persona
lo consigue al instante; un programa que recoge números en masa para vender bases de
datos o para spam, no puede — tendría que pedirlo ficha por ficha.
**No lo vuelvas a esconder del todo, y no lo publiques abierto en el listado.**

### Las fichas caducadas se siguen mostrando y se siguen cruzando
A los 12 días sin que quien publicó confirme que sigue vigente, el estado pasa a
`sin_confirmar` (calculado al leer, en la vista SQL — no hay ninguna tarea programada
de por medio). Pero **la ficha sigue activa, sigue apareciendo en el buscador y sigue
entrando en el cruce de coincidencias**, solo que marcada y al final de los resultados.

Esto fue un bug real que se encontró y corrigió: la primera versión del algoritmo de
cruce excluía todo lo que no fuera `estado = activo`, así que una mascota perdida hace
más de 12 días se volvía invisible para quien la encontrara — justo el impedimento que
el dueño pidió explícitamente evitar. Una mascota perdida hace un mes sigue perdida.
**Nunca filtres las coincidencias por `estado = activo` solamente.**

### La seña de verificación privada
Al publicar una mascota perdida se pide una seña que **no se publica en ningún lugar**
(columna `rasgo_verificacion`, nunca expuesta en la vista pública). Sirve para que quien
dice tener al animal la describa como prueba de que de verdad lo tiene. Es la defensa
contra entregas equivocadas y contra reclamos falsos. No la agregues a ninguna vista
pública ni a los datos que trae el cruce de coincidencias.

### El formulario cambia según QUIÉN lo llena
Raza, sexo y edad están **a la vista en el formulario de quien perdió** a su mascota, y
**dentro del acordeón en el de quien la encontró**. No es inconsistencia:

- Quien perdió a su mascota conoce cada dato y está dispuesto a darlos todos. Esconderlos
  solo le resta información al cruce y evidencia para verificar la identidad después.
- Quien la encontró muchas veces no puede saberlos, y **adivinar hace daño activo**: un
  campo vacío casi no baja el puntaje, uno equivocado lo hunde hasta 53 puntos.

Los campos existen siempre en el DOM (el envío los lee por `id`), solo cambian de sitio.

### Recuperar la publicación sin cuentas: por qué NO hay recuperación por teléfono
Se consideró y se descartó por inseguro. Cualquiera puede obtener el teléfono de una ficha
tocando el botón de contacto (`obtener_contacto`), así que "código + teléfono" no prueba
nada: serviría para que un desconocido se apropiara de una publicación ajena y la ocultara.
**No la agregues.**

Lo que sí protege el acceso, en orden de resistencia:
1. **Mandarse el enlace por WhatsApp a uno mismo** (botón en el panel de gestión). Es lo
   único que sobrevive a que el celular se dañe, se pierda o se cambie.
2. El evento de calendario, que también lleva el enlace dentro.
3. `localStorage`, que se pierde al borrar datos del navegador o cambiar de equipo.

Una recuperación de verdad necesita un canal que solo controle el dueño: **el correo**.
Eso depende de conectar la función de avisos (ver sección 5), que hoy no está conectada.

### Sin cuentas ni contraseñas
Cada publicación genera un token de gestión aleatorio (columna `token_gestion`) que
funciona como enlace secreto de administración (`/g/TOKEN`). No hay login. Registrarse
es la fricción que hace que la gente abandone el formulario, y aquí cada abandono es
una mascota que no se publica. El enlace también se guarda en `localStorage` del
navegador de quien publicó.

### Todo pasa por funciones SQL controladas, nunca por acceso directo a las tablas
Las tablas `mascotas` y `pistas` tienen **todos los permisos revocados** para los roles
`anon` y `authenticated`. No se puede leer ni escribir directamente ni con la clave
pública. Todo pasa por funciones `security definer` (`crear_publicacion`,
`editar_publicacion`, `actualizar_estado`, `agregar_pista`, `obtener_contacto`,
`ficha_gestion`, etc.) que validan antes de tocar los datos. Las vistas públicas
(`mascotas_publicas`, `pistas_publicas`) excluyen a propósito las columnas privadas.

Esto se probó de verdad, no solo se diseñó así: se instaló PostgreSQL real y se simuló
un atacante con la clave pública intentando (1) leer la tabla directo, (2) leer solo la
columna de teléfonos, (3) insertar saltándose las validaciones, (4) modificar fichas
ajenas, (5) leer los contactos privados de las pistas. Los cinco quedaron bloqueados.
**Cualquier función SQL nueva debe seguir este mismo patrón**: valida adentro de la
función, nunca abras permisos directos sobre las tablas.

### El algoritmo de cruce
Vive en `app.js`, función `puntuar(base, cand)`. Es un **promedio ponderado solo entre
las señales que sí están presentes** en ambos reportes — un reporte incompleto no se
castiga por lo que no dijo, se decide con menos evidencia. Señales: distancia real (el
radio se abre con los días transcurridos), tamaño (con tolerancia: un escalón de
diferencia casi no castiga porque la gente estima mal), color (comparado por
*componentes visuales*, no por igualdad de etiqueta — "manchado" y "negro y blanco"
cuentan como parecidos), fecha (nadie encuentra un animal antes de que se pierda, con
2 días de margen por errores al reportar), pelo, sexo, raza y collar cuando existen.

Es **simétrico** (`puntuar(a,b) === puntuar(b,a)`) y está calibrado para **preferir
errar por exceso**: mostrar un candidato de más cuesta tres segundos de mirar una foto;
perder uno significa una mascota que no vuelve.

**Los castigos no se acumulan.** Cuando hay contradicciones directas se aplica solo el
castigo más fuerte (`Math.min`), nunca el producto de todos. Multiplicarlos cobraba dos
veces el mismo error: la señal contradicha ya entra en 0 y baja el promedio por su
cuenta. Con el producto, un animal encontrado *en el mismo punto y el mismo día* pero
con tres campos mal llenados caía a 20 puntos y desaparecía de la lista.

**Un dato en blanco vale más que un dato adivinado.** Medido: dejar un campo vacío
cuesta 0-1 puntos; adivinarlo mal cuesta hasta 53 (color) o 35 (sexo). De ahí sale el
diseño del formulario — ver la sección "Los formularios piden por observabilidad".

**El collar nunca castiga cuando solo uno de los dos lo menciona.** Los collares se
caen, o quien recoge al animal se lo quita antes de reportarlo. Solo cuenta como señal
si ambos reportes lo describen, y se compara por palabras sueltas porque nadie lo
describe igual ("collar rojo" vs "rojo con placa").

**Las señas particulares (`rasgos`) SOLO SUMAN, NUNCA RESTAN.** Es texto libre y se
compara por palabras compartidas. Si no hay ninguna en común, la señal ni siquiera
participa — es indispensable, porque quien encuentra al animal muchas veces describe
otra cosa ("estaba asustado y con hambre") aunque sea la misma mascota, y eso no puede
contar como contradicción. Se ignoran las palabras que no distinguen a un animal de
otro, y **a propósito también los colores y los tamaños**: esos ya tienen su propia
señal y contarlos aquí sería cobrarlos dos veces. Medido: entre dos mascotas distintas
que comparten palabras genéricas el puntaje no se mueve (19 → 19).

**No hay tope de distancia.** Existió uno ("más de ~60 km, total 0") y se quitó a
propósito: un animal con TODAS las demás señales iguales no debe desaparecer solo por
la distancia — lo pudieron mover en carro. La señal de cercanía ya cae a 0 por su cuenta
pasado el radio, así que un candidato lejano solo puntúa alto si todo lo demás coincide
— que es justo cuando hay que mostrarlo. Esto no compara contra el país entero: el
candidato ya tuvo que pasar el recuadro geográfico de la consulta a Supabase
(`buscarCoincidencias`, ~60 km) para llegar hasta `puntuar()`. Ese recuadro sigue siendo
el límite real por ancho de banda.

**Tolerancia a errores de tecleo (`tipeoParecido`), no un diccionario de sinónimos.**
Se consideró construir un repertorio de sinónimos para el texto libre (collar, señas) y
se descartó a propósito: sin estructura gramatical, un sinónimo mal puesto genera falsos
positivos ("pequeña" podría referirse al tamaño general, que ya es su propia señal, y
contarlo también en las señas sería cobrarlo dos veces). En cambio, `tipeoParecido()`
mide distancia de edición (Levenshtein) entre dos palabras — cubre errores de tecleo
reales ("azul"/"asul", por el seseo) sin necesidad de enumerarlos a mano. Se aplica a
collar, señas y raza. **Los nombres de color NUNCA se comparan por tecleo entre sí**
("dorado" y "morado" quedan a una letra de distancia y son colores reales distintos,
no un error de tipeo) — para colores existe el sistema de familias visuales, que sí
entiende el significado.

**El collar reconoce una confirmación sin detalle** ("sí", "llevaba", "tenía" — un
vocabulario cerrado de sí/no, no un diccionario general) y le da un crédito débil (0.2)
si ambos lados confirman que había collar aunque ninguno lo describa. "No tenía" NO
cuenta como confirmación aunque contenga la palabra "tenía" — hay una lista de negación
aparte que lo bloquea. También existe una familia de colores *de collar* (`azul`
`morado` `celeste`...) separada de la paleta de pelaje, porque un collar sí puede ser
azul o morado y esos colores no existen en `COLORES`.

Hay dos suites de pruebas, ambas en Node puro sin tocar la base de datos:
`node pruebas/cruce.test.js` (20 casos de mano + simulacro de 90 fichas) y
`node pruebas/adversario.test.js` (52 parejas que **sí** son la misma mascota, cada una
degradada de una forma realista, midiendo si alcanzan a salir en pantalla contra 10, 30
y 150 fichas rivales). Si tocas `puntuar()`, corre las dos. `pruebas/algoritmo.js` tiene
una copia ejecutable de la función y un `verificarSincronia()` que avisa si esa copia se
desincroniza de `app.js`.

### La lista de coincidencias no tiene tope, y carga por tandas al hacer scroll
`buscarCoincidencias()` ya no recorta a un top fijo (antes 24): devuelve TODO lo que pase
el umbral de 26 puntos, ordenado de más a menos parecido. Se probó y pasaba de verdad:
una coincidencia real con puntaje suficiente podía quedar oculta para siempre si otras 24
fichas puntuaban apenas un poco más (ver `pruebas/adversario.test.js`).

La interfaz (`pintarCoincidenciasPaginadas`, usada en la ficha pública y en el panel de
gestión) pinta 12 de una vez y carga 12 más cada vez que un `IntersectionObserver` ve un
centinela invisible al final de la lista — así un celular de gama baja nunca tiene que
pintar de una un DOM de cientos de filas. Si agregas otro lugar que muestre
coincidencias, usa esta función en vez de volver a recortar con `.slice()`.

### Reportes duplicados del mismo hallazgo
Cuando varias personas encuentran al mismo animal callejero por separado, cada una
publicaba su propia ficha — el mismo animal fragmentado en 3 o 4 publicaciones que
además compiten entre sí por la atención del dueño. Antes de crear una publicación de
tipo **encontrada** (nunca para "perdida"), `buscarPosibleDuplicado()` revisa si hay un
reporte muy parecido de los últimos 5 días a menos de 5 km, y si lo hay, ofrece ir a esa
ficha en vez de publicar una nueva — para que la persona deje su información ahí como
pista, y el dueño vea todo junto en un solo lugar.

Esto usa `puntuarDuplicado()`, una función **aparte** de `puntuar()`, no una reutilización.
`puntuar()` asume una pérdida y un hallazgo y decide el orden de las fechas a partir de
eso ("nadie encuentra antes de perder"); aquí ambos reportes son "encontrada" — no hay
una fecha que deba ser posterior a la otra, sino dos avistamientos que deberían estar
cerca en tiempo y espacio. Es un problema distinto, con su propio umbral (60 de 100) y
sus propios límites duros (más de 5 km o más de 5 días de diferencia, cero).

**Tiene su propio castigo por contradicción de color.** Sin él, dos animales genuinamente
distintos reportados en el mismo punto el mismo día ya suman un piso de ~56% solo por
ubicación y fecha, y con un tamaño apenas parecido cruzan el umbral aunque el color sea
totalmente opuesto (blanco contra negro). Se probó y pasaba de verdad antes de agregar el
castigo. Si tocas esta función, no le quites esa comprobación.

No tiene una suite de pruebas adversarial como `puntuar()` — se verificó a mano con
casos representativos (mismo animal, animal distinto con cada señal opuesta, lejos,
tarde, simetría). Si se vuelve a tocar, vale la pena construirle una igual de rigurosa.

### Los formularios piden por observabilidad, no por importancia
Los campos del formulario están agrupados según **lo que quien encontró al animal puede
ver de un vistazo**, no según qué tan valioso sería el dato. Arriba y siempre visibles:
especie, tamaño, colores, pelo y collar — todo eso se ve sin tocar al animal. En el
acordeón "Si alcanzaste a fijarte": raza, sexo y edad, con el texto diciendo
explícitamente que dejarlo en blanco es mejor que adivinar.

No es timidez para pedir datos: es que **adivinar hace daño activo**. Un radio sin tocar
se envía como `""` y se guarda nulo, así que la señal simplemente no participa en el
cruce; en cambio un valor equivocado mete un cero *y* dispara un castigo. Quien encuentra
a un animal no le revisa el sexo ni sabe la raza, y si lo presionamos a llenar todo va a
inventar. **No conviertas estos campos en obligatorios ni los subas al bloque principal.**

El collar sí subió al bloque principal justamente por lo contrario: se ve de una, es de
lo más identificador que existe, y el algoritmo lo usa.

### Mantener la ficha al día sin poder mandar avisos
No hay forma de avisarle a nadie por fuera de la página (ver sección 5), así que una
ficha vieja solo se actualiza si quien publicó vuelve por su cuenta. En vez de un solo
recordatorio, la pregunta "¿ya apareció?" está puesta en los **cuatro momentos en que esa
persona sí está mirando**, y cada uno cubre lo que los otros no:

1. **En su propia ficha pública** (`/m/CODIGO`). Si el token está en `localStorage` sale
   una barra de dueño con el botón. Es el sitio que más visita quien publicó: para
   compartirlo, para ver novedades, o al escanear el QR de su propio afiche.
2. **Al volver de WhatsApp** después de escribirle a alguien que dice tener al animal.
   Es el momento en que el reencuentro está más cerca; la pregunta ya está esperando.
3. **Un evento en el calendario del propio celular** (`.ics`, botón "Recordármelo en 3
   días"). Es lo único que de verdad le suena a la persona sin servidor, sin cuentas y
   sin costo, y funciona igual en Android y iPhone.
4. **El aviso en la portada** y el contador de novedades, que ya existían.
5. **Las coincidencias nuevas marcadas al volver a entrar.** El navegador recuerda qué
   coincidencias ya vio esa persona y con qué puntaje (`coincidenciasVistas` en
   `localStorage`), y al volver le señala solo lo que cambió: las fichas nuevas, las que
   ahora puntúan más, y si alguna es la que más se ha parecido hasta ahora. Es lo más
   cercano a un aviso que se puede lograr sin servidor.

   **`MIS.guardar()` fusiona, no reemplaza.** Antes rehacía la entrada desde cero, y como
   `vistaGestionar()` la vuelve a guardar en cada visita, borraba lo que `parchar()`
   hubiera dejado: el aplazamiento del recordatorio y las coincidencias ya vistas. Si
   tocas `MIS`, no rompas eso.

No quites ninguno pensando que se repiten: cubren personas distintas. Quien nunca vuelve
a la portada sí abre su ficha; quien no agenda nada sí contesta un WhatsApp.

### El afiche deja ajustar el recorte de la foto
`vistaAfiche()` incluye un control de arrastrar y hacer zoom (`AjustadorFoto`, junto a
`dibujarAfiche` en `app.js`) para elegir qué parte de la foto se ve en la franja del
afiche, por si el animal no quedó centrado en la foto original.

El ajuste se guarda como `{ zoom, panX, panY }` en **fracciones (0 a 1), no en píxeles**:
así el mismo ajuste sirve igual sin importar el ancho de la franja, y no hay que
recalcular nada al cambiar entre "Publicación" e "Historia". El valor por defecto
(`zoom:1, panX:0.5, panY:0`) reproduce exactamente el recorte de antes de que existiera
este control (centrado en horizontal, pegado arriba en vertical) — verificado
comparando el PNG resultante byte a byte.

Las medidas de los dos formatos viven en un solo lugar, `LAYOUT_AFICHE`: antes estaban
repetidas dentro de `dibujarAfiche()`, y el control de recorte también las necesita para
saber la proporción del marco. No las vuelvas a duplicar.

**Al arrastrar, `marco.setPointerCapture()` puede lanzar `NotFoundError`** en algunos
casos límite (se confirmó al simular el arrastre con eventos sintéticos durante las
pruebas). Está en un `try/catch` a propósito: sin eso, el resto del gesto no se rompe,
pero mejor no arriesgarse en un dispositivo real. No le quites el `try/catch`.

### Modo oscuro: dos trampas que ya se pisaron
Sigue `prefers-color-scheme`, sin interruptor: acompaña lo que la persona ya eligió
en su teléfono. Dos cosas que parecen detalles y no lo son:

1. **El amarillo del resaltador no cambia**, así que el texto que va encima debe
   quedarse oscuro (`--sobre-marcador`). Si se aclarara con el resto de la tipografía,
   quedaría amarillo sobre amarillo.
2. **Los ajustes por componente van al FINAL de `styles.css`**, no junto al bloque
   `:root` del modo oscuro. Tienen la misma especificidad que las reglas normales, así
   que puestos arriba la cascada los anula **en silencio** — pasó, y los títulos de la
   portada quedaron en 3.19 de contraste creyendo que estaban en 5.75.

Rojo y verde cumplen dos papeles: como **fondo** de insignias con letra blanca se
quedan sólidos, y como **texto** sobre el fondo oscuro se aclaran aparte. Los 13
componentes están medidos y pasan AA.

### Alcance nacional, siempre
33 departamentos y 1.104 municipios de Colombia están embebidos en
`datos-colombia.js` (fuente: DIVIPOLA). No lo reduzcas a una lista corta de ciudades
"principales": el dueño fue explícito en que debe cubrir el país completo, tanto para
casos de desastre como para pérdidas cotidianas en cualquier municipio.

### Fotos comprimidas en el navegador antes de subir
En zona de desastre o zona rural la conexión es mala. Las fotos se redimensionan y
comprimen con `<canvas>` en el cliente (función `comprimir()`) antes de subirse a
Supabase Storage. No quites este paso pensando que "total, el usuario tiene buena
conexión" — no se puede asumir eso para este producto.

### Anti-spam simple, sin CAPTCHA
Los formularios tienen un campo oculto trampa (honeypot) y una espera mínima de 2.5
segundos antes de aceptar el envío. Es deliberadamente simple: un CAPTCHA agrega
fricción a personas reales en un momento de estrés (acaban de perder a su mascota), y
el honeypot ya filtra los bots más simples. No lo reemplaces por algo más agresivo sin
discutirlo primero.

---

## 3. Arquitectura

**Sin framework, sin build, sin `npm install`.** HTML + CSS + JavaScript puro. Se
despliega arrastrando la carpeta o conectando el repositorio a Netlify — no hay
compilación de por medio. Esto fue intencional para que cualquier colaborador, con
cualquier nivel técnico, pueda editar un archivo y ver el cambio.

```
index.html                          la cáscara de la página (rutas por SPA)
app.js                              TODO el comportamiento: rutas, formularios,
                                     mapa, algoritmo de cruce, generador de afiches
                                     (~1.900 líneas — es el archivo más grande y
                                     el que más cuidado necesita al editar)
styles.css                          estilos, con variables CSS para color y tipografía
config.js                           credenciales de Supabase (clave pública, ok subirla)
datos-colombia.js                   33 departamentos + 1.104 municipios (DIVIPOLA)
qr.js                                generador de QR (librería qrcode-generator, MIT,
                                     incluida localmente para no depender de un CDN)
netlify.toml                        redirecciones SPA + registro de la función edge
netlify/edge-functions/ficha-og.js  inyecta Open Graph (foto, título) al compartir
                                     un enlace de ficha en WhatsApp/Instagram
supabase-schema.sql                 esquema completo: tablas, vistas, funciones,
                                     permisos, bucket de fotos. Reejecutable sin
                                     borrar datos (usa CREATE OR REPLACE / IF NOT EXISTS)
supabase/functions/notificar/       función Edge de Supabase (Deno) para avisos por
  index.ts                          correo cuando llega una pista — OPCIONAL, no es
                                     el mecanismo principal de contacto
servidor-local.js                   servidor estático para revisar la página en el
                                     computador imitando a Netlify (rutas SPA).
                                     `node servidor-local.js` → localhost:4173
pruebas/sembrar-ruido.js            crea publicaciones de mentira en la base REAL
                                     para probar el cruce con competencia. Todas
                                     quedan marcadas con
                                     contacto_email = ruido-de-prueba@patasdevuelta.test
                                     (columna que NO está en la vista pública), así
                                     que se borran de un solo golpe con:
                                     delete from mascotas where contacto_email = '…';
pruebas/borrar-ruido.js             las quita de la página al instante (las pone en
                                     "oculto"). Ocultar no es borrar: para eliminarlas
                                     de la base hay que correr el SQL de arriba.
construir-vista-previa.js           regenera vista-previa.html copiando styles.css y
                                     app.js dentro. CÓRRELO cuando toques cualquiera
                                     de los dos, o la vista previa muestra un diseño
                                     que ya no existe (pasó).
vista-previa.html                   archivo único autocontenido con datos de ejemplo
                                     y toda la red simulada, para ver el diseño en el
                                     celular sin necesitar Supabase configurado
README.md                           documentación completa para humanos: cómo montar
                                     Supabase/Netlify, cómo opera todo, qué falta
```

**Backend:** Supabase (PostgreSQL + Storage). **Hosting:** Netlify. **Mapas:** Leaflet
+ tiles de OpenStreetMap, cargados desde CDN bajo demanda. **Geocodificación:**
Nominatim (OpenStreetMap), también gratuito. Todo el stack corre en planes gratuitos;
el único gasto opcional es un dominio propio.

### Rutas de la aplicación (enrutador propio en `app.js`, sin librería)
`/` portada · `/buscar` listado con filtros y orden por cercanía · `/como-funciona`
explicación del método · `/reportar/perdida` y `/reportar/encontrada` los dos
formularios · `/m/CODIGO` ficha pública · `/g/TOKEN` panel de gestión ·
`/editar/TOKEN` corrección de datos · `/afiche/CODIGO` generador de afiches.

El enrutador detecta si está corriendo desde `file://` (doble clic local) y cambia
solo a navegación por `#` en ese caso, porque `file://` no permite `history.pushState`.
En Netlify usa rutas normales.

---

## 4. Qué ya se probó (y cómo, para que puedas repetirlo)

- **Esquema SQL contra PostgreSQL real**, no solo revisado a ojo: se instaló Postgres
  en un entorno de pruebas, se ejecutó el esquema completo desde cero, y se corrió una
  auditoría de seguridad simulando el rol `anon` (la clave pública) intentando los
  cinco ataques descritos arriba. Todos bloqueados. También se probó el ciclo completo:
  publicar → un desconocido obtiene el contacto → deja una pista → el dueño ve la
  novedad → confirmar vigencia → marcar resuelto → editar → retirar.
- **El algoritmo de cruce**, extraído y probado de forma aislada con 19 casos
  (simetría, fechas límite, colores de la misma familia, sin coordenadas, tamaños
  opuestos, etc.).
- **Las 12 vistas de la aplicación**, renderizadas en un DOM real (jsdom) sin ningún
  error de JavaScript.
- **El generador de afiches**, con 7 variantes extremas: nombre larguísimo, ubicación
  larguísima, sin foto, mascota resuelta, sin ningún dato opcional. Se corrigieron dos
  bugs reales en el proceso: la foto se salía del lienzo en formato cuadrado, y una
  ubicación muy larga volvía el texto ilegible (ahora se reparte en dos líneas).
- **El flujo de contacto de extremo a extremo**: alguien entra a una ficha, dice "lo
  tengo", el contacto se revela al instante con el mensaje de WhatsApp ya redactado, y
  la pista le llega a quien publicó con botón para responder.

## 5. Qué falta (a propósito, no por descuido)

- **Los avisos push ya están escritos, pero hay que conectarlos una vez.** El paso a paso
  está en `AVISOS-PUSH.md`: ejecutar el esquema, generar las llaves VAPID, desplegar la
  función `avisar` y ponerle los secretos. Mientras no se haga, el botón de avisos
  simplemente no funciona y **nada más se rompe** — todo lo demás sigue igual.
  Piezas: `sw.js` (raíz, obligatorio), `manifest.json`, el objeto `AVISOS` en `app.js`,
  `supabase/functions/avisar/index.ts`, y las tablas `suscripciones_push` y
  `avisos_enviados`. El aviso lo dispara el navegador de quien publica un hallazgo, y el
  servidor comprueba antes de enviar: token válido, publicación de menos de 30 minutos,
  destinatarios del tipo contrario y a menos de 60 km, máximo 5, y nunca dos veces a la
  misma pareja. **No quites esas comprobaciones**: sin ellas esto sirve para molestar
  desconocidos.

  **La ruta real de la función en Supabase puede no coincidir con su nombre.** El panel
  web a veces le asigna a la función una ruta al azar (por ejemplo `clever-action`) en
  vez de usar el nombre que se escribió al crearla — el "Name" de *Function
  Configuration* es solo una etiqueta, no decide la URL. La ruta real que sí importa
  está en la constante `RUTA_FUNCION_AVISOS` de `app.js`.

  **Si el bloque de avisos no aparece en el panel de gestión, no es forzosamente un
  problema de configuración.** `AVISOS.soportado()` da falso simplemente cuando el
  navegador no expone `PushManager` — el caso más común con esta audiencia es iPhone sin
  haber agregado la página a la pantalla de inicio. Esto pasó de verdad: el bloque
  quedaba completamente vacío y sin ninguna explicación, como si la opción no existiera.
  Ya está corregido — `AVISOS.motivoNoSoportado()` explica el motivo — pero si tocas ese
  código en `vistaGestionar()`, ten cuidado: no está en una función propia, vive en el
  cuerpo de `vistaGestionar()`, así que un `return` a medio camino ahí corta el resto del
  panel (novedades, coincidencias, retirar publicación), no solo el bloque de avisos.
- **No hay avisos por SMS ni WhatsApp automático**, y el correo tampoco funciona hoy. Conviene tenerlo claro porque es fácil creer lo
  contrario: `supabase/functions/notificar/index.ts` está escrita pero **no está conectada
  a nada** — no hay disparador en el esquema, ningún `webhook`, y `app.js` nunca la llama.
  Para que enviara correos habría que desplegarla, crear un Database Webhook sobre
  `insert` en `pistas`, y configurar `RESEND_API_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.
  Lo que sí existe y funciona: la revelación instantánea del contacto (el mecanismo
  principal), el aviso "¿Ya apareció?" en la portada y el contador de novedades en "Mis
  publicaciones" — los tres **solo aparecen cuando la persona vuelve a abrir la página**,
  porque viven en `localStorage`, no en un servidor que avise.
- Mapa con todos los reportes visibles a la vez (los datos de lat/lng ya existen en la
  base, solo falta la vista).
- Cuentas para instituciones (albergues, veterinarias) que necesiten publicar y
  administrar muchos animales a la vez — hoy cada publicación es independiente.
- Detección de duplicados cuando varias personas reportan al mismo animal callejero.

---

## 6. Cómo se está organizando la colaboración (a partir de ahora)

El proyecto se mueve de un chat en claude.ai a Claude Code, y varios amigos del dueño
van a colaborar, cada uno con su propia sesión de Claude Code en su propio computador.

- **GitHub es la casa compartida del código.** Netlify se conecta al repositorio y
  publica automáticamente lo que llega a la rama principal.
- **Cada colaborador clona el repositorio** y trabaja sobre su propia copia local.
- **Cada cambio va en una rama nueva**, no directo sobre la rama principal — con varias
  personas tocando `app.js` a la vez, trabajar todos en la misma rama genera
  conflictos innecesarios.
- **Los cambios entran por Pull Request**, revisados antes de mezclarse a la rama
  principal. No es burocracia: esto va a estar en manos de familias buscando a su
  mascota, y un despliegue roto no lo puede arreglar cualquiera a cualquier hora.
- **La clave pública de Supabase (`config.js`) sí puede vivir en el repositorio** — es
  pública por diseño, viaja en el navegador de cualquier visitante, y lo que protege
  los datos son los permisos de las funciones SQL, no el secreto de esa clave.
- **La clave `service_role` de Supabase y la clave de Resend NUNCA van al
  repositorio**, ni siquiera en un commit viejo. Esas sí pueden leer y borrar todo.
- **Idealmente hay un segundo proyecto de Supabase para pruebas**, separado del de
  producción, para que nadie experimente sobre datos reales de mascotas que gente está
  buscando de verdad.

## 7. Cómo pedirle cosas a este proyecto

Este es un producto en producción real, no un ejercicio. Antes de cambiar algo que
toque el esquema de datos, el algoritmo de cruce, o el manejo del contacto/privacidad,
vale la pena releer la sección 2 completa. Para cambios de esos, prueba contra una base
de datos real si es posible (levantar Postgres local es rápido) antes de aplicarlos a
producción — así se hizo la primera vez y así se detectaron los bugs reales que se
mencionan arriba.

Para cambios de contenido, estilos, o funcionalidades nuevas que no toquen las reglas
de la sección 2, adelante sin restricciones especiales.
