-- UNIVERSA · Horas del docente: marcar entrada y salida de cada clase y reporte por periodo de pago.
--
--  * El docente marca ENTRADA en la clase (se abre el Zoom) y SALIDA al terminar. La hora la pone el servidor, nunca el navegador.
--  * Una marca por sesión (docente_marcas). Se puede marcar entrada desde 60 minutos antes de la clase hasta el final del día.
--  * Solo escriben las funciones de este archivo. Administración puede corregir una marca (ajustar_marca) con una nota.
--  * HORAS A PAGAR = horas PROGRAMADAS de las clases en las que el docente marcó entrada. La entrada y la salida sirven para verificar
--    puntualidad y que la clase se dio; no cambian el total. Sesiones canceladas no cuentan.
--  * El periodo de pago (del 28 al 27, ambos días incluidos) lo calcula la pantalla y se pasa como p_desde / p_hasta.
--  * Zoom: un solo enlace para todas las clases (config_app, clave 'zoom_docentes'). Lo escribe administración desde la pantalla;
--    NO se guarda en el repositorio porque incluye la contraseña de la sala.
--
-- Repetible (idempotente). Aplicar con `supabase db query --remote --yes --file` (nunca db push).

-- ============================================================
-- 1. Tablas
-- ============================================================
create table if not exists public.config_app (
  clave text primary key,
  valor text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.docente_marcas (
  sesion_id uuid primary key references public.salon_sesiones(id) on delete cascade,
  docente_id uuid not null references public.docentes(id),
  entrada timestamptz not null,
  salida timestamptz,
  ajustada boolean not null default false, -- true = la corrigió administración
  nota text check (length(nota) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salida is null or salida >= entrada)
);
create index if not exists docente_marcas_docente_idx on public.docente_marcas (docente_id, entrada);

alter table public.config_app enable row level security;
alter table public.docente_marcas enable row level security;
revoke all on public.config_app, public.docente_marcas from anon, authenticated;
-- Sin políticas: todo pasa por las funciones (security definer).

-- ============================================================
-- 2. Zoom (un enlace para todos)
-- ============================================================
create or replace function public.zoom_clase() returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not ((select public.es_admin()) or (select public.docente_actual()) is not null) then
    raise exception 'No tienes acceso al enlace de la clase' using errcode = '42501';
  end if;
  return (select valor from public.config_app where clave = 'zoom_docentes');
end $$;

create or replace function public.guardar_zoom(p_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if not (select public.es_admin()) then raise exception 'Solo administración puede cambiar el enlace de Zoom' using errcode = '42501'; end if;
  if v is null then
    delete from public.config_app where clave = 'zoom_docentes';
    return;
  end if;
  if length(v) > 500 or v !~* '^https://([a-z0-9-]+\.)?zoom\.us/' then raise exception 'El enlace debe ser de Zoom (https://…zoom.us/…)'; end if;
  insert into public.config_app (clave, valor) values ('zoom_docentes', v)
  on conflict (clave) do update set valor = excluded.valor, updated_at = now();
end $$;

-- ============================================================
-- 3. Marcar entrada y salida (solo el docente del salón)
-- ============================================================
-- Devuelve {entrada, salida, zoom}. Si ya había entrada, no la pisa: devuelve la existente (marcar dos veces no cambia la hora).
create or replace function public.marcar_entrada(p_sesion uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_s public.salon_sesiones;
  v_doc uuid := public.docente_actual();
  v_sal public.salones;
  v_m public.docente_marcas;
  v_ahora timestamp := now() at time zone 'America/Lima';
begin
  select * into v_s from public.salon_sesiones where id = p_sesion;
  if not found then raise exception 'La clase no existe'; end if;
  select * into v_sal from public.salones where id = v_s.salon_id;
  if v_doc is null or v_sal.docente_id is distinct from v_doc then raise exception 'Solo el docente del salón puede marcar su entrada' using errcode = '42501'; end if;
  if v_s.estado = 'cancelada' then raise exception 'Esta clase está cancelada'; end if;
  if v_s.fecha <> v_ahora::date then raise exception 'Solo puedes marcar la entrada el día de la clase'; end if;
  if v_ahora::time < v_s.hora_inicio - interval '60 minutes' then raise exception 'Todavía es muy temprano: puedes marcar entrada desde 1 hora antes de la clase'; end if;

  insert into public.docente_marcas (sesion_id, docente_id, entrada) values (p_sesion, v_doc, now())
  on conflict (sesion_id) do nothing;
  select * into v_m from public.docente_marcas where sesion_id = p_sesion;
  return jsonb_build_object('entrada', v_m.entrada, 'salida', v_m.salida, 'zoom', (select valor from public.config_app where clave = 'zoom_docentes'));
end $$;

create or replace function public.marcar_salida(p_sesion uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_doc uuid := public.docente_actual();
  v_m public.docente_marcas;
begin
  select * into v_m from public.docente_marcas where sesion_id = p_sesion for update;
  if not found then raise exception 'Primero marca la entrada de esta clase'; end if;
  if v_doc is null or v_m.docente_id <> v_doc then raise exception 'Solo el docente de la clase puede marcar su salida' using errcode = '42501'; end if;
  if v_m.salida is not null then return jsonb_build_object('entrada', v_m.entrada, 'salida', v_m.salida); end if;
  update public.docente_marcas set salida = now(), updated_at = now() where sesion_id = p_sesion returning * into v_m;
  return jsonb_build_object('entrada', v_m.entrada, 'salida', v_m.salida);
end $$;

-- Marcas de las clases de un salón (docente del salón o administración).
create or replace function public.marcas_salon(p_salon uuid) returns table (sesion_id uuid, entrada timestamptz, salida timestamptz, ajustada boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return query select m.sesion_id, m.entrada, m.salida, m.ajustada
    from public.docente_marcas m join public.salon_sesiones s on s.id = m.sesion_id where s.salon_id = p_salon;
end $$;

-- Administración corrige o crea la marca (por ejemplo, el docente olvidó marcar). Los horarios llegan como fecha y hora de Lima.
create or replace function public.ajustar_marca(p_sesion uuid, p_entrada timestamptz, p_salida timestamptz, p_nota text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_s public.salon_sesiones;
  v_doc uuid;
begin
  if not (select public.es_admin()) then raise exception 'Solo administración puede corregir marcas' using errcode = '42501'; end if;
  select * into v_s from public.salon_sesiones where id = p_sesion;
  if not found then raise exception 'La clase no existe'; end if;
  select docente_id into v_doc from public.salones where id = v_s.salon_id;
  if p_entrada is null then
    delete from public.docente_marcas where sesion_id = p_sesion;
    return;
  end if;
  if p_salida is not null and p_salida < p_entrada then raise exception 'La salida no puede ser antes que la entrada'; end if;
  if v_doc is null and not exists (select 1 from public.docente_marcas where sesion_id = p_sesion) then raise exception 'El salón no tiene docente asignado'; end if;
  insert into public.docente_marcas (sesion_id, docente_id, entrada, salida, ajustada, nota)
  values (p_sesion, coalesce(v_doc, (select docente_id from public.docente_marcas where sesion_id = p_sesion)), p_entrada, p_salida, true, nullif(btrim(coalesce(p_nota, '')), ''))
  on conflict (sesion_id) do update set entrada = excluded.entrada, salida = excluded.salida, ajustada = true, nota = excluded.nota, updated_at = now();
end $$;

-- ============================================================
-- 4. Reportes por periodo (administración y RR. HH.)
-- ============================================================
-- Resumen por docente y salón. p_desde y p_hasta incluidos. Las clases canceladas no cuentan.
--  * programadas = clases del calendario en el periodo; dictadas = con entrada marcada; sin_marca = ya pasaron y no hay entrada.
--  * minutos_programados = de todas las clases; minutos_pagables = de las dictadas (lo que se paga).
--  * minutos_tarde = suma de los minutos que el docente entró después de la hora de inicio.
create or replace function public.horas_resumen(p_desde date, p_hasta date) returns table (
  docente_id uuid, docente text, salon_id uuid, salon text,
  programadas integer, dictadas integer, sin_marca integer, minutos_programados integer, minutos_pagables integer, minutos_tarde integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.ve_personas()) then raise exception 'No tienes acceso a este reporte' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 120 then raise exception 'Periodo no válido'; end if;
  return query
    select d.id, d.nombre, sa.id, sa.nombre,
           count(*)::integer,
           (count(m.sesion_id))::integer,
           (count(*) filter (where m.sesion_id is null and s.fecha < public.hoy_lima()))::integer,
           (sum(extract(epoch from (s.hora_fin - s.hora_inicio)) / 60))::integer,
           (coalesce(sum(extract(epoch from (s.hora_fin - s.hora_inicio)) / 60) filter (where m.sesion_id is not null), 0))::integer,
           (coalesce(sum(greatest(0, extract(epoch from (((m.entrada at time zone 'America/Lima')::time) - s.hora_inicio)) / 60)) filter (where m.sesion_id is not null), 0))::integer
      from public.salon_sesiones s
      join public.salones sa on sa.id = s.salon_id
      left join public.docente_marcas m on m.sesion_id = s.id
      join public.docentes d on d.id = coalesce(m.docente_id, sa.docente_id)
     where s.fecha between p_desde and p_hasta and s.estado <> 'cancelada'
     group by d.id, d.nombre, sa.id, sa.nombre
     order by d.nombre, sa.nombre;
end $$;

-- Detalle clase por clase de un docente en el periodo (entrada, salida y minutos de tardanza).
create or replace function public.horas_detalle(p_desde date, p_hasta date, p_docente uuid) returns table (
  sesion_id uuid, fecha date, hora_inicio time, hora_fin time, salon_id uuid, salon text, tipo text,
  entrada timestamptz, salida timestamptz, ajustada boolean, nota text, minutos_programados integer, minutos_tarde integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.ve_personas()) then raise exception 'No tienes acceso a este reporte' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 120 then raise exception 'Periodo no válido'; end if;
  return query
    select s.id, s.fecha, s.hora_inicio, s.hora_fin, sa.id, sa.nombre, s.tipo, m.entrada, m.salida, coalesce(m.ajustada, false), m.nota,
           (extract(epoch from (s.hora_fin - s.hora_inicio)) / 60)::integer,
           case when m.sesion_id is null then null
                else greatest(0, extract(epoch from (((m.entrada at time zone 'America/Lima')::time) - s.hora_inicio)) / 60)::integer end
      from public.salon_sesiones s
      join public.salones sa on sa.id = s.salon_id
      left join public.docente_marcas m on m.sesion_id = s.id
     where s.fecha between p_desde and p_hasta and s.estado <> 'cancelada' and coalesce(m.docente_id, sa.docente_id) = p_docente
     order by s.fecha, s.hora_inicio;
end $$;

-- ============================================================
-- 5. Permisos de ejecución
-- ============================================================
revoke execute on function
  public.zoom_clase(), public.guardar_zoom(text), public.marcar_entrada(uuid), public.marcar_salida(uuid), public.marcas_salon(uuid),
  public.ajustar_marca(uuid, timestamptz, timestamptz, text), public.horas_resumen(date, date), public.horas_detalle(date, date, uuid)
  from public, anon;
grant execute on function
  public.zoom_clase(), public.guardar_zoom(text), public.marcar_entrada(uuid), public.marcar_salida(uuid), public.marcas_salon(uuid),
  public.ajustar_marca(uuid, timestamptz, timestamptz, text), public.horas_resumen(date, date), public.horas_detalle(date, date, uuid)
  to authenticated;
