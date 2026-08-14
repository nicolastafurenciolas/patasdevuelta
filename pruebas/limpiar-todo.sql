-- ============================================================
--  DEJAR LA BASE LIMPIA ANTES DEL LANZAMIENTO
--  Pégalo en el SQL Editor de Supabase (proyecto de producción).
--  Corre los pasos EN ORDEN y no sigas si el paso 1 muestra algo
--  que no reconoces como prueba.
--
--  Esto BORRA DE VERDAD y no se puede deshacer.
-- ============================================================


-- ── PASO 1 · MIRAR ANTES DE BORRAR ──────────────────────────
-- Revisa esta lista completa. Toda fila que salga aquí va a
-- desaparecer en el paso 3. Si aparece una mascota de una
-- persona real, PARA y usa el paso 4 en vez del 3.

select
  codigo,
  tipo,
  coalesce(nombre, '(sin nombre)') as nombre,
  municipio,
  estado,
  creado,
  case when contacto_email = 'ruido-de-prueba@patasdevuelta.test'
       then 'sembrada por el script'
       else 'creada a mano' end as origen
from mascotas
order by creado desc;


-- ── PASO 2 · CUÁNTAS SON ────────────────────────────────────
-- Un vistazo rápido para confirmar el total antes de borrar.

select
  count(*) filter (where contacto_email = 'ruido-de-prueba@patasdevuelta.test') as sembradas,
  count(*) filter (where contacto_email is distinct from 'ruido-de-prueba@patasdevuelta.test') as a_mano,
  count(*) as total
from mascotas;


-- ── PASO 3 · BORRAR TODO ────────────────────────────────────
-- Usa este paso solo si en el paso 1 NO había ninguna mascota real.
-- Las pistas, las suscripciones de avisos y el registro de avisos
-- enviados se van solos: cuelgan de mascotas con "on delete cascade".

delete from mascotas;


-- ── PASO 4 · ALTERNATIVA: BORRAR SOLO LO SEMBRADO ───────────
-- Si ya hay publicaciones reales y solo quieres quitar el ruido del
-- script, usa ESTAS DOS órdenes en vez del paso 3.
-- (contacto_email no está en la vista pública: es la marca que dejó
--  sembrar-ruido.js justamente para poder borrarlas de un solo golpe.)

-- delete from mascotas where contacto_email = 'ruido-de-prueba@patasdevuelta.test';
-- delete from mascotas where codigo in ('XU6EV','XLL3H','793V8','85QMU','Y2B2U','RAB3Q','WFXCT','549B2');


-- ── PASO 5 · LAS FOTOS ──────────────────────────────────────
-- Borrar las fichas NO borra los archivos del bucket "fotos": quedan
-- huérfanos ocupando espacio, sin ningún enlace que lleve a ellos.
-- Corre esto para dejar el bucket vacío también.

delete from storage.objects where bucket_id = 'fotos';


-- ── PASO 6 · COMPROBAR QUE QUEDÓ LIMPIO ─────────────────────
-- Las cuatro cuentas deben dar 0.

select
  (select count(*) from mascotas)            as mascotas,
  (select count(*) from pistas)              as pistas,
  (select count(*) from suscripciones_push)  as suscripciones,
  (select count(*) from storage.objects
     where bucket_id = 'fotos')              as fotos;
