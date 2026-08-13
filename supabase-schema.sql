-- ============================================================
--  PATAS DE VUELTA — esquema v2
--  Pégalo completo en Supabase → SQL Editor → Run.
--  Es seguro volver a ejecutarlo: reemplaza sin borrar datos.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- TABLA PRINCIPAL ----------
create table if not exists mascotas (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text unique not null,
  token_gestion       text unique not null,

  tipo                text not null check (tipo in ('perdida','encontrada')),
  estado              text not null default 'activo'
                      check (estado in ('activo','resuelto','oculto')),

  especie             text not null,
  raza                text,
  nombre              text,
  tamano              text,
  colores             text[] default '{}',
  pelo                text,
  sexo                text,
  edad_aprox          text,
  collar              text,
  microchip           text,
  rasgos              text,
  descripcion         text,
  rasgo_verificacion  text,          -- privado: llave de verificación

  fecha               date not null,
  lat                 double precision,
  lng                 double precision,
  precision_ubicacion text default 'aproximada',
  lugar               text,
  municipio           text,
  departamento        text,

  fotos               text[] default '{}',
  reencuentro_foto    text,

  contacto_nombre     text,
  contacto_tel        text,          -- privado: se revela por función
  contacto_email      text,          -- privado: solo para avisos

  vistas              integer default 0,
  pistas_nuevas       integer default 0,
  creado              timestamptz default now(),
  actualizado         timestamptz default now(),
  ultima_confirmacion timestamptz default now()
);

-- columnas nuevas si vienes de la versión anterior
alter table mascotas add column if not exists raza text;
alter table mascotas add column if not exists fotos text[] default '{}';
alter table mascotas add column if not exists municipio text;
alter table mascotas add column if not exists departamento text;
alter table mascotas add column if not exists contacto_email text;
alter table mascotas add column if not exists pistas_nuevas integer default 0;
alter table mascotas add column if not exists precision_ubicacion text default 'aproximada';
alter table mascotas add column if not exists reencuentro_foto text;

create index if not exists idx_mascotas_busqueda on mascotas (estado, tipo, especie);
create index if not exists idx_mascotas_geo      on mascotas (lat, lng);
create index if not exists idx_mascotas_fecha    on mascotas (fecha desc);

-- ---------- PISTAS ----------
create table if not exists pistas (
  id                 uuid primary key default gen_random_uuid(),
  mascota_id         uuid references mascotas(id) on delete cascade,
  clase              text default 'avistamiento',
  mensaje            text not null,
  fecha_avistamiento date,
  lugar              text,
  lat                double precision,
  lng                double precision,
  autor              text,
  contacto           text,           -- privado
  publico            boolean default true,
  creado             timestamptz default now()
);

alter table pistas add column if not exists clase text default 'avistamiento';
create index if not exists idx_pistas_mascota on pistas (mascota_id, creado desc);

-- ---------- VISTAS PÚBLICAS ----------
-- El estado 'sin_confirmar' se calcula al leer: no hace falta una tarea programada.
drop view if exists mascotas_publicas cascade;
create view mascotas_publicas as
  select id, codigo, tipo,
         case
           when estado = 'activo'
            and ultima_confirmacion < now() - interval '12 days' then 'sin_confirmar'
           else estado
         end                                        as estado,
         extract(day from now() - ultima_confirmacion)::int as dias_sin_confirmar,
         especie, raza, nombre, tamano, colores, pelo, sexo, edad_aprox,
         collar, microchip, rasgos, descripcion,
         fecha, lat, lng, precision_ubicacion, lugar, municipio, departamento,
         fotos, reencuentro_foto,
         contacto_nombre,
         (contacto_tel is not null and contacto_tel <> '') as tiene_contacto,
         vistas, creado, actualizado, ultima_confirmacion
  from mascotas
  where estado <> 'oculto';

drop view if exists pistas_publicas cascade;
create view pistas_publicas as
  select id, mascota_id, clase, mensaje, fecha_avistamiento, lugar, lat, lng, autor, creado
  from pistas
  where publico = true;

-- ---------- PERMISOS ----------
alter table mascotas enable row level security;
alter table pistas   enable row level security;

-- Nada se escribe ni se lee directamente: todo pasa por funciones controladas.
revoke all on mascotas from anon, authenticated;
revoke all on pistas   from anon, authenticated;
grant select on mascotas_publicas to anon, authenticated;
grant select on pistas_publicas   to anon, authenticated;

-- ---------- AUXILIARES ----------
create or replace function codigo_corto(n int default 5)
returns text language plpgsql as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- sin 0,O,1,I,L: se confunden al teclear
  r text := ''; i int;
begin
  for i in 1..n loop
    r := r || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
  end loop;
  return r;
end; $$;

create or replace function normalizar_tel(t text)
returns text language sql immutable as $$
  select nullif(regexp_replace(coalesce(t,''), '[^0-9+]', '', 'g'), '');
$$;

-- ---------- PUBLICAR ----------
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

-- ---------- EDITAR ----------
create or replace function editar_publicacion(p_token text, p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare v_m mascotas;
begin
  update mascotas set
    nombre       = coalesce(nullif(p->>'nombre',''), nombre),
    raza         = coalesce(nullif(p->>'raza',''), raza),
    tamano       = coalesce(nullif(p->>'tamano',''), tamano),
    colores      = coalesce((select array_agg(value) from jsonb_array_elements_text(p->'colores')), colores),
    pelo         = coalesce(nullif(p->>'pelo',''), pelo),
    sexo         = coalesce(nullif(p->>'sexo',''), sexo),
    edad_aprox   = coalesce(nullif(p->>'edad_aprox',''), edad_aprox),
    collar       = coalesce(nullif(p->>'collar',''), collar),
    microchip    = coalesce(nullif(p->>'microchip',''), microchip),
    rasgos       = coalesce(nullif(p->>'rasgos',''), rasgos),
    descripcion  = coalesce(nullif(p->>'descripcion',''), descripcion),
    rasgo_verificacion = coalesce(nullif(p->>'rasgo_verificacion',''), rasgo_verificacion),
    fecha        = coalesce((p->>'fecha')::date, fecha),
    lat          = coalesce((p->>'lat')::double precision, lat),
    lng          = coalesce((p->>'lng')::double precision, lng),
    precision_ubicacion = coalesce(nullif(p->>'precision_ubicacion',''), precision_ubicacion),
    lugar        = coalesce(nullif(p->>'lugar',''), lugar),
    municipio    = coalesce(nullif(p->>'municipio',''), municipio),
    departamento = coalesce(nullif(p->>'departamento',''), departamento),
    fotos        = coalesce((select array_agg(value) from jsonb_array_elements_text(p->'fotos')), fotos),
    contacto_nombre = coalesce(nullif(p->>'contacto_nombre',''), contacto_nombre),
    contacto_tel    = coalesce(normalizar_tel(p->>'contacto_tel'), contacto_tel),
    contacto_email  = coalesce(nullif(p->>'contacto_email',''), contacto_email),
    actualizado = now(), ultima_confirmacion = now()
  where token_gestion = p_token
  returning * into v_m;

  if not found then return null; end if;
  return row_to_json(v_m);
end; $$;

-- ---------- ESTADO ----------
create or replace function actualizar_estado(p_token text, p_estado text, p_foto text default null)
returns json language plpgsql security definer set search_path = public as $$
declare v_m mascotas;
begin
  if p_estado not in ('activo','resuelto','oculto') then raise exception 'Estado invalido'; end if;
  update mascotas set
    estado = p_estado,
    reencuentro_foto = coalesce(nullif(p_foto,''), reencuentro_foto),
    actualizado = now(), ultima_confirmacion = now()
  where token_gestion = p_token
  returning * into v_m;
  if not found then return null; end if;
  return row_to_json(v_m);
end; $$;

-- Renueva la vigencia sin cambiar nada mas ("todavia no aparece")
create or replace function confirmar_vigencia(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update mascotas set ultima_confirmacion = now() where token_gestion = p_token;
  return found;
end; $$;

-- ---------- CONTACTO ----------
-- El telefono no viaja nunca en las consultas de listado: se pide de a uno,
-- con una accion explicita. Asi una persona lo consigue en un toque y un
-- recolector automatico no puede barrer la base entera.
create or replace function obtener_contacto(p_codigo text)
returns json language plpgsql security definer set search_path = public as $$
declare v_m mascotas;
begin
  select * into v_m from mascotas where codigo = p_codigo and estado <> 'oculto';
  if not found then return null; end if;
  return json_build_object(
    'nombre', v_m.contacto_nombre,
    'tel',    v_m.contacto_tel,
    'tipo',   v_m.tipo,
    'nombre_mascota', v_m.nombre
  );
end; $$;

-- ---------- PISTAS ----------
create or replace function agregar_pista(
  p_codigo text, p_mensaje text, p_clase text default 'avistamiento',
  p_lugar text default null, p_lat double precision default null,
  p_lng double precision default null, p_fecha date default null,
  p_autor text default null, p_contacto text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(trim(p_mensaje),'') = '' then raise exception 'El mensaje esta vacio'; end if;
  select id into v_id from mascotas where codigo = p_codigo and estado <> 'oculto';
  if not found then return false; end if;

  insert into pistas (mascota_id, clase, mensaje, fecha_avistamiento, lugar, lat, lng, autor, contacto, publico)
  values (v_id, coalesce(p_clase,'avistamiento'), trim(p_mensaje), p_fecha, nullif(p_lugar,''),
          p_lat, p_lng, nullif(p_autor,''), normalizar_tel(p_contacto),
          coalesce(p_clase,'avistamiento') <> 'posible_reencuentro');

  update mascotas set pistas_nuevas = pistas_nuevas + 1, actualizado = now() where id = v_id;
  return true;
end; $$;

-- ---------- GESTION ----------
create or replace function ficha_gestion(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare v_m mascotas; v_p json;
begin
  select * into v_m from mascotas where token_gestion = p_token;
  if not found then return null; end if;
  select coalesce(json_agg(row_to_json(x) order by x.creado desc), '[]'::json)
    into v_p from pistas x where x.mascota_id = v_m.id;
  return json_build_object('mascota', row_to_json(v_m), 'pistas', v_p);
end; $$;

create or replace function marcar_pistas_vistas(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update mascotas set pistas_nuevas = 0 where token_gestion = p_token;
  return found;
end; $$;

-- ---------- VARIOS ----------
create or replace function sumar_vista(p_codigo text)
returns void language sql security definer set search_path = public as $$
  update mascotas set vistas = vistas + 1 where codigo = p_codigo;
$$;

create or replace function estadisticas()
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'perdidas',    count(*) filter (where tipo='perdida'    and estado='activo'),
    'encontradas', count(*) filter (where tipo='encontrada' and estado='activo'),
    'resueltas',   count(*) filter (where estado='resuelto'),
    'total',       count(*)
  ) from mascotas where estado <> 'oculto';
$$;

-- ---------- PERMISOS DE EJECUCION ----------
grant execute on function crear_publicacion(jsonb)            to anon, authenticated;
grant execute on function editar_publicacion(text, jsonb)     to anon, authenticated;
grant execute on function actualizar_estado(text, text, text) to anon, authenticated;
grant execute on function confirmar_vigencia(text)            to anon, authenticated;
grant execute on function obtener_contacto(text)              to anon, authenticated;
grant execute on function ficha_gestion(text)                 to anon, authenticated;
grant execute on function marcar_pistas_vistas(text)          to anon, authenticated;
grant execute on function sumar_vista(text)                   to anon, authenticated;
grant execute on function estadisticas()                      to anon, authenticated;
grant execute on function agregar_pista(text,text,text,text,double precision,double precision,date,text,text)
                                                              to anon, authenticated;

-- ---------- FOTOS ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('fotos','fotos',true, 3145728)
on conflict (id) do update set public = true, file_size_limit = 3145728;

drop policy if exists "fotos lectura publica" on storage.objects;
create policy "fotos lectura publica" on storage.objects
  for select to anon, authenticated using (bucket_id = 'fotos');

drop policy if exists "fotos subida publica" on storage.objects;
create policy "fotos subida publica" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'fotos');

-- ============================================================
--  AVISOS PUSH
--  Es la única forma de avisarle a alguien sin que tenga que volver a
--  entrar por su cuenta. Sigue el mismo patrón que todo lo demás: la
--  tabla queda cerrada por completo para la clave pública y todo pasa
--  por funciones que validan antes de tocar los datos.
-- ============================================================

create table if not exists suscripciones_push (
  id          uuid primary key default gen_random_uuid(),
  mascota_id  uuid not null references mascotas(id) on delete cascade,
  endpoint    text not null,
  datos       jsonb not null,          -- la suscripción completa del navegador
  creado      timestamptz not null default now(),
  unique (mascota_id, endpoint)        -- el mismo teléfono no se suscribe dos veces
);
create index if not exists ix_suscripciones_mascota on suscripciones_push(mascota_id);

-- Deja constancia de a quién ya se le avisó por cuál hallazgo, para que la
-- misma pareja no vuelva a sonar nunca. Sin esto, recargar la página de quien
-- publicó el hallazgo le repetiría el aviso al dueño una y otra vez.
create table if not exists avisos_enviados (
  mascota_destino uuid not null references mascotas(id) on delete cascade,
  mascota_origen  uuid not null references mascotas(id) on delete cascade,
  creado          timestamptz not null default now(),
  primary key (mascota_destino, mascota_origen)
);

alter table suscripciones_push enable row level security;
alter table avisos_enviados    enable row level security;
revoke all on suscripciones_push from anon, authenticated;
revoke all on avisos_enviados    from anon, authenticated;

-- Guardar la suscripción: solo quien tiene el enlace de gestión puede pedir
-- que le avisen sobre ESA publicación.
create or replace function guardar_suscripcion(p_token text, p_suscripcion jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_endpoint text;
begin
  select id into v_id from mascotas where token_gestion = p_token;
  if v_id is null then return false; end if;

  v_endpoint := p_suscripcion->>'endpoint';
  if coalesce(v_endpoint,'') = '' then return false; end if;

  insert into suscripciones_push (mascota_id, endpoint, datos)
  values (v_id, v_endpoint, p_suscripcion)
  on conflict (mascota_id, endpoint) do update set datos = excluded.datos, creado = now();
  return true;
end; $$;

create or replace function quitar_suscripcion(p_token text, p_endpoint text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from mascotas where token_gestion = p_token;
  if v_id is null then return false; end if;
  delete from suscripciones_push where mascota_id = v_id and endpoint = p_endpoint;
  return true;
end; $$;

-- ¿Esta publicación tiene avisos activados en algún teléfono?
create or replace function tiene_suscripcion(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from mascotas where token_gestion = p_token;
  if v_id is null then return false; end if;
  return exists (select 1 from suscripciones_push where mascota_id = v_id);
end; $$;

grant execute on function guardar_suscripcion(text, jsonb) to anon, authenticated;
grant execute on function quitar_suscripcion(text, text)   to anon, authenticated;
grant execute on function tiene_suscripcion(text)          to anon, authenticated;
