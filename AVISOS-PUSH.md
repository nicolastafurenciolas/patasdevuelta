# Activar los avisos push

Son cuatro pasos y se hacen una sola vez. Todo el código ya está en el
repositorio; falta conectarlo, y eso solo lo puedes hacer tú porque implica
entrar a tu cuenta de Supabase.

Mientras no hagas esto, **la página funciona igual que siempre**: el botón de
avisos simplemente no aparece o dice que no se pudieron activar. Nada se rompe.

---

## Paso 1 — Actualizar la base de datos

En Supabase, entra a **SQL Editor** y crea un *snippet* nuevo. Copia y pega el
contenido completo de `supabase-schema.sql` y dale **Run**.

El archivo está hecho para poder ejecutarse encima de lo que ya existe sin
borrar nada (usa `create or replace` y `if not exists`). Lo nuevo que agrega
son dos tablas —`suscripciones_push` y `avisos_enviados`— y tres funciones.

Para comprobar que quedó, corre esto:

```sql
select count(*) from suscripciones_push;
```

Si responde `0` en vez de un error, quedó bien.

---

## Paso 2 — Generar las llaves de firma

Los avisos van firmados para que el navegador sepa que salen de tu servidor y
no de un desconocido. Necesitas generar ese par de llaves una sola vez.

Si tienes Deno instalado, en tu computador:

```bash
deno run https://raw.githubusercontent.com/negrel/webpush/master/cmd/generate-vapid-keys.ts
```

Si no lo tienes, se instala en un minuto desde <https://deno.com>.

Te va a imprimir un bloque en formato JSON. **Cópialo completo**, empezando por
`{` y terminando en `}`. Guárdalo también en tus notas: si lo pierdes, hay que
generar otro par y todos los que ya activaron avisos dejan de recibirlos.

---

## Paso 3 — Desplegar la función que envía

En Supabase, en el menú de la izquierda, entra a **Edge Functions** y dale a
**Deploy a new function**. Ponle exactamente este nombre:

```
avisar
```

Pega dentro el contenido de `supabase/functions/avisar/index.ts` y despliégala.

Después, en **Edge Functions → Secrets** (o *Manage secrets*), agrega:

| Nombre | Valor |
|---|---|
| `VAPID_LLAVES` | El JSON completo del paso 2 |
| `SITIO_URL` | `https://patasdevuelta.netlify.app` |
| `CORREO_ADMIN` | Tu correo (lo exigen los servicios de push para poder avisarte si algo va mal) |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya están puestos por Supabase; no
los agregues a mano.

> **La clave `service_role` nunca sale de ahí.** Vive solo dentro de la función,
> nunca llega al navegador y nunca va al repositorio.

---

## Paso 4 — Comprobar que responde

Abre esta dirección en el navegador, reemplazando `TU-PROYECTO` y `TU-CLAVE-ANON`
(la clave anónima es la que está en `config.js`, es pública):

```
https://TU-PROYECTO.supabase.co/functions/v1/avisar?apikey=TU-CLAVE-ANON
```

Debe responder algo así:

```json
{"clave":"BEl62iUYgUivxIkv69yViEuiBIa..."}
```

Si responde eso, ya está todo conectado.

Si dice `Falta el secreto VAPID_LLAVES`, revisa el paso 3.

---

## Cómo probarlo de verdad

1. Entra a la página **desde el celular** (tiene que ser el sitio publicado, no
   el del computador: los avisos exigen conexión segura).
2. Publica una mascota perdida.
3. En el panel que sale después, toca **"Activar avisos"** y acepta el permiso.
4. Desde **otro** teléfono o computador, publica una mascota encontrada que se
   parezca mucho: misma especie, mismo tamaño, colores parecidos y el punto del
   mapa cerca del primero.
5. Al primer teléfono le debe sonar el aviso, incluso con la página cerrada.

**En iPhone hay un paso extra:** antes de activar los avisos hay que agregar la
página a la pantalla de inicio (compartir → *Añadir a pantalla de inicio*) y
abrirla desde ahí. Safari no permite avisos de otro modo. En Android y en
computador funciona directo.

---

## Cosas que conviene saber

- **El permiso se pide una sola vez.** Si alguien lo niega, el navegador no deja
  volver a preguntar con un botón; hay que habilitarlo a mano desde el candado
  de la barra de direcciones. Por eso el permiso se pide justo después de
  publicar, que es cuando la persona más lo quiere.
- **A la misma pareja nunca se le avisa dos veces**, aunque quien publicó el
  hallazgo recargue la página.
- **El aviso solo puede salir en los 30 minutos siguientes a publicar.** Es a
  propósito: evita que alguien use esto para molestar a desconocidos.
- **Las suscripciones vencidas se borran solas** cuando el servicio de push
  responde que ya no existen (teléfono cambiado, página desinstalada).
- La librería que firma los envíos (`@negrel/webpush`) advierte en su
  documentación que **no ha sido auditada por expertos en criptografía**. Se usa
  igual porque el contenido del aviso no es sensible: dice que hay una mascota
  parecida, sin datos de contacto ni ubicación exacta.
