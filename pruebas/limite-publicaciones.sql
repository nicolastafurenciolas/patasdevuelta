-- ============================================================
--  FRENO DE ABUSO AL PUBLICAR
--  Pégalo en el SQL Editor de Supabase y ejecútalo. Es seguro
--  reejecutarlo: reemplaza la función, no borra ni toca datos.
-- ============================================================
--
--  POR QUÉ
--  Hoy lo único que frena el spam es el campo trampa y la espera de 2.5
--  segundos del formulario, y las dos cosas viven en el navegador. Cualquiera
--  que abra el código puede llamar crear_publicacion() directamente y meter
--  miles de fichas en un rato. Con un video viral eso deja de ser teórico:
--  llena la base (500 MB en el plan gratuito), gasta el ancho de banda y
--  entierra las mascotas de verdad.
--
--  QUÉ HACE
--  Dos frenos, los dos dentro de la función (que es el único sitio donde no
--  se pueden saltar):
--
--   1. Por teléfono: máximo 8 publicaciones en 6 horas desde el mismo número.
--      Una familia que perdió tres perros en el terremoto cabe de sobra.
--      Un guion que quiere meter mil, no.
--
--   2. Global: máximo 120 publicaciones en 10 minutos en toda la plataforma.
--      Es un cortacircuitos. Doce por minuto sostenidos es muchísimo más de
--      lo que da un lanzamiento normal, así que solo salta si algo se
--      desbordó de verdad, y protege la base entera mientras te das cuenta.
--
--  Los mensajes de error son en español y sin tecnicismos, porque si una
--  persona real llega a toparse con uno tiene que entender qué pasó.
-- ============================================================

create or replace function crear_publicacion(p jsonb)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v_codigo text; v_token text; v_id uuid; i int := 0;
  v_tel text; v_delmismo int; v_global int;
begin
  if coalesce(p->>'especie','') = '' then raise exception 'Falta la especie'; end if;
  if (p->>'tipo') not in ('perdida','encontrada') then raise exception 'Tipo invalido'; end if;
  if normalizar_tel(p->>'contacto_tel') is null then raise exception 'Falta el telefono de contacto'; end if;
  if coalesce(jsonb_array_length(p->'fotos'),0) = 0 then raise exception 'Falta al menos una foto'; end if;

  -- ---------- frenos de abuso ----------
  v_tel := normalizar_tel(p->>'contacto_tel');

  select count(*) into v_delmismo
    from mascotas
   where normalizar_tel(contacto_tel) = v_tel
     and creado > now() - interval '6 hours';

  if v_delmismo >= 8 then
    raise exception 'Ya publicaste varias mascotas con este número hace poco. Espera un rato antes de publicar otra, o escríbenos si de verdad necesitas publicar más.';
  end if;

  select count(*) into v_global
    from mascotas
   where creado > now() - interval '10 minutes';

  if v_global >= 120 then
    raise exception 'Estamos recibiendo muchísimas publicaciones en este momento. Intenta de nuevo en unos minutos, tu información no se perdió.';
  end if;
  -- ---------- fin de los frenos ----------

  loop
    i := i + 1;
    v_codigo := codigo_corto(5);
    exit when not exists (select 1 from mascotas where codigo = v_codigo) or i > 25;
  end loop;
  v_token := encode(gen_random_bytes(18), 'hex');

  insert into mascotas (
    codigo, token_gestion, tipo, estado, especie, raza, nombre, tamano, colores,
    pelo, sexo, edad_aprox, collar, microchip, rasgos, descripcion, rasgo_verificacion,
    fecha, lat, lng, precision_ubicacion, lugar, municipio, departamento, fotos,
    contacto_nombre, contacto_tel, contacto_email
  ) values (
    v_codigo, v_token, p->>'tipo', 'activo',
    p->>'especie', nullif(p->>'raza',''), nullif(p->>'nombre',''), nullif(p->>'tamano',''),
    coalesce((select array_agg(value) from jsonb_array_elements_text(p->'colores')), '{}'),
    nullif(p->>'pelo',''), nullif(p->>'sexo',''), nullif(p->>'edad_aprox',''),
    nullif(p->>'collar',''), nullif(p->>'microchip',''), nullif(p->>'rasgos',''),
    nullif(p->>'descripcion',''), nullif(p->>'rasgo_verificacion',''),
    coalesce((p->>'fecha')::date, current_date),
    (p->>'lat')::double precision, (p->>'lng')::double precision,
    coalesce(nullif(p->>'precision_ubicacion',''), 'aproximada'),
    nullif(p->>'lugar',''), nullif(p->>'municipio',''), nullif(p->>'departamento',''),
    coalesce((select array_agg(value) from jsonb_array_elements_text(p->'fotos')), '{}'),
    nullif(p->>'contacto_nombre',''), normalizar_tel(p->>'contacto_tel'),
    nullif(p->>'contacto_email','')
  ) returning id into v_id;

  return json_build_object('codigo', v_codigo, 'token', v_token, 'id', v_id);
end; $$;

grant execute on function crear_publicacion(jsonb) to anon, authenticated;

-- Sin este índice, cada publicación nueva tendría que recorrer la tabla
-- entera dos veces para contar. Con él las dos cuentas son instantáneas.
create index if not exists idx_mascotas_creado on mascotas (creado desc);

-- ---------- COMPROBAR QUE QUEDÓ BIEN ----------
-- Debe devolver la función con los dos frenos adentro.
select count(*) as tiene_frenos
  from pg_proc
 where proname = 'crear_publicacion'
   and prosrc like '%Estamos recibiendo muchísimas publicaciones%';


-- ============================================================
--  VUELTA ATRÁS
--  Si algo sale mal, pega y ejecuta ESTO y la función queda
--  exactamente como estaba antes (sin los frenos). Publicar
--  vuelve a funcionar al instante.
-- ============================================================
/*
create or replace function crear_publicacion(p jsonb)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v_codigo text; v_token text; v_id uuid; i int := 0;
begin
  if coalesce(p->>'especie','') = '' then raise exception 'Falta la especie'; end if;
  if (p->>'tipo') not in ('perdida','encontrada') then raise exception 'Tipo invalido'; end if;
  if normalizar_tel(p->>'contacto_tel') is null then raise exception 'Falta el telefono de contacto'; end if;
  if coalesce(jsonb_array_length(p->'fotos'),0) = 0 then raise exception 'Falta al menos una foto'; end if;

  loop
    i := i + 1;
    v_codigo := codigo_corto(5);
    exit when not exists (select 1 from mascotas where codigo = v_codigo) or i > 25;
  end loop;
  v_token := encode(gen_random_bytes(18), 'hex');

  insert into mascotas (
    codigo, token_gestion, tipo, estado, especie, raza, nombre, tamano, colores,
    pelo, sexo, edad_aprox, collar, microchip, rasgos, descripcion, rasgo_verificacion,
    fecha, lat, lng, precision_ubicacion, lugar, municipio, departamento, fotos,
    contacto_nombre, contacto_tel, contacto_email
  ) values (
    v_codigo, v_token, p->>'tipo', 'activo',
    p->>'especie', nullif(p->>'raza',''), nullif(p->>'nombre',''), nullif(p->>'tamano',''),
    coalesce((select array_agg(value) from jsonb_array_elements_text(p->'colores')), '{}'),
    nullif(p->>'pelo',''), nullif(p->>'sexo',''), nullif(p->>'edad_aprox',''),
    nullif(p->>'collar',''), nullif(p->>'microchip',''), nullif(p->>'rasgos',''),
    nullif(p->>'descripcion',''), nullif(p->>'rasgo_verificacion',''),
    coalesce((p->>'fecha')::date, current_date),
    (p->>'lat')::double precision, (p->>'lng')::double precision,
    coalesce(nullif(p->>'precision_ubicacion',''), 'aproximada'),
    nullif(p->>'lugar',''), nullif(p->>'municipio',''), nullif(p->>'departamento',''),
    coalesce((select array_agg(value) from jsonb_array_elements_text(p->'fotos')), '{}'),
    nullif(p->>'contacto_nombre',''), normalizar_tel(p->>'contacto_tel'),
    nullif(p->>'contacto_email','')
  ) returning id into v_id;

  return json_build_object('codigo', v_codigo, 'token', v_token, 'id', v_id);
end; $$;

grant execute on function crear_publicacion(jsonb) to anon, authenticated;
*/
