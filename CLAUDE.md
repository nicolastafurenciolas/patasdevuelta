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

Hay dos suites de pruebas, ambas en Node puro sin tocar la base de datos:
`node pruebas/cruce.test.js` (20 casos de mano + simulacro de 90 fichas) y
`node pruebas/adversario.test.js` (34 parejas que **sí** son la misma mascota, cada una
degradada de una forma realista, midiendo si alcanzan a salir en pantalla contra 10, 30
y 150 fichas rivales). Si tocas `puntuar()`, corre las dos. `pruebas/algoritmo.js` tiene
una copia ejecutable de la función y un `verificarSincronia()` que avisa si esa copia se
desincroniza de `app.js`.

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

- Avisos por notificación push (el correo por Resend es un complemento opcional, no
  reemplaza la revelación instantánea de contacto que ya es el mecanismo principal).
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
