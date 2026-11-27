-- UNIVERSA · Pago de los docentes: tarifa por hora según el servicio del salón y su número de alumnos.
--
--  * PAGO = horas a pagar (clases con entrada marcada, ver horas_docentes) × tarifa por hora del salón.
--  * La tarifa sale de `tarifas_docente` (tabla referencial de la empresa): depende del servicio del salón (salones.servicio_pago),
--    del número de alumnos matriculados y, en Flex Signature Premium, de si el docente es nativo (docentes.nativo).
--  * Alumnos = matriculados vigentes al cierre del periodo (o hoy, si el periodo sigue abierto). Si hay más alumnos que el último
--    tramo de la tarifa, se usa el último tramo; un salón sin alumnos se paga con el primer tramo.
--  * ANTES de que existieran las marcas (fechas anteriores a config_app 'marcas_desde', hoy 28-nov-2026) una clase cuenta como dictada
--    si está en estado «realizada» (tiene asistencia registrada). Desde esa fecha se exige la entrada marcada.
--  * Los salones que ya existen quedan en «Programa Continuo»; administración puede cambiar el servicio de cada salón.
--  * Los precios se corrigen editando `tarifas_docente` (no se pisan al repetir este archivo).
--
-- Repetible (idempotente). Aplicar con `supabase db query --remote --yes --file` (nunca db push).

-- ============================================================
-- 1. Datos nuevos
-- ============================================================
alter table public.docentes add column if not exists nativo boolean not null default false;
alter table public.salones add column if not exists servicio_pago text not null default 'continuo';

create table if not exists public.tarifas_docente (
  id uuid primary key default gen_random_uuid(),
  servicio text not null,
  servicio_nombre text not null,
  alumnos_min integer not null check (alumnos_min >= 1),
  alumnos_max integer check (alumnos_max is null or alumnos_max >= alumnos_min), -- null = sin tope
  nativo boolean not null default false, -- true = tarifa solo para docentes nativos
  precio_hora numeric(8, 2) not null check (precio_hora >= 0),
  orden smallint not null default 0,
  unique (servicio, alumnos_min, nativo)
);
alter table public.tarifas_docente enable row level security;
revoke all on public.tarifas_docente from anon, authenticated;
-- Sin políticas: se lee por tarifas_pago().

-- Tarifa referencial por hora efectiva dictada (hora cronológica de 60 minutos).
insert into public.tarifas_docente (servicio, servicio_nombre, alumnos_min, alumnos_max, nativo, precio_hora, orden) values
  ('conversation_club', 'Conversation Club', 1, 6, false, 13.00, 1),
  ('sessions_demand', 'Sessions on demand', 1, 6, false, 14.00, 2),
  ('dynamic', 'Programa Dynamic', 1, 6, false, 13.00, 3),
  ('continuo', 'Programa Continuo', 1, 1, false, 13.50, 4),
  ('continuo', 'Programa Continuo', 2, 7, false, 14.00, 4),
  ('continuo', 'Programa Continuo', 8, 11, false, 15.00, 4),
  ('continuo', 'Programa Continuo', 12, null, false, 16.00, 4),
  ('flex_premium', 'Flex Signature Premium', 1, 1, false, 18.00, 5),
  ('flex_premium', 'Flex Signature Premium', 1, 1, true, 30.00, 5),
  ('mastery_lab', 'Professional Mastery Lab', 1, null, false, 19.00, 6)
on conflict (servicio, alumnos_min, nativo) do nothing;

-- Fecha desde la cual se exige marcar entrada para que la clase se pague (antes, basta que la clase esté «realizada»).
insert into public.config_app (clave, valor) values ('marcas_desde', '2026-11-28') on conflict (clave) do nothing;

-- ============================================================
-- 2. Funciones de configuración (administración y RR. HH. leen; solo administración cambia)
-- ============================================================
create or replace function public.tarifas_pago() returns table (servicio text, servicio_nombre text, alumnos_min integer, alumnos_max integer, nativo boolean, precio_hora numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.ve_personas()) then raise exception 'No tienes acceso a las tarifas' using errcode = '42501'; end if;
  return query select t.servicio, t.servicio_nombre, t.alumnos_min, t.alumnos_max, t.nativo, t.precio_hora
    from public.tarifas_docente t order by t.orden, t.alumnos_min, t.nativo;
end $$;

create or replace function public.asignar_servicio_salon(p_salon uuid, p_servicio text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.es_admin()) then raise exception 'Solo administración puede cambiar el servicio de un salón' using errcode = '42501'; end if;
  if not exists (select 1 from public.tarifas_docente where servicio = p_servicio) then raise exception 'Servicio no válido'; end if;
  update public.salones set servicio_pago = p_servicio where id = p_salon;
  if not found then raise exception 'El salón no existe'; end if;
end $$;

create or replace function public.marcar_docente_nativo(p_docente uuid, p_nativo boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.es_admin()) then raise exception 'Solo administración puede marcar a un docente como nativo' using errcode = '42501'; end if;
  update public.docentes set nativo = coalesce(p_nativo, false) where id = p_docente;
  if not found then raise exception 'El docente no existe'; end if;
end $$;

-- ============================================================
-- 3. Resumen por periodo con tarifa y monto
-- ============================================================
-- Cambia el tipo de resultado (columnas nuevas al final): hay que borrar la función anterior.
drop function if exists public.horas_resumen(date, date);
create function public.horas_resumen(p_desde date, p_hasta date) returns table (
  docente_id uuid, docente text, salon_id uuid, salon text,
  programadas integer, dictadas integer, sin_marca integer, minutos_programados integer, minutos_pagables integer, minutos_tarde integer,
  nativo boolean, servicio_codigo text, servicio text, alumnos integer, precio_hora numeric, monto numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_ref date := least(p_hasta, public.hoy_lima());
  v_corte date := coalesce((select c.valor::date from public.config_app c where c.clave = 'marcas_desde'), date '2026-11-28');
begin
  if not (select public.ve_personas()) then raise exception 'No tienes acceso a este reporte' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 120 then raise exception 'Periodo no válido'; end if;
  return query
    with base as (
      select d.id as b_docente_id, d.nombre as b_docente, d.nativo as b_nativo, sa.id as b_salon_id, sa.nombre as b_salon, sa.servicio_pago as b_servicio,
             count(*)::integer as b_programadas,
             (count(*) filter (where m.sesion_id is not null or (s.estado = 'realizada' and s.fecha < v_corte)))::integer as b_dictadas,
             (count(*) filter (where m.sesion_id is null and not (s.estado = 'realizada' and s.fecha < v_corte) and s.fecha < public.hoy_lima()))::integer as b_sin_marca,
             (sum(extract(epoch from (s.hora_fin - s.hora_inicio)) / 60))::integer as b_min_prog,
             (coalesce(sum(extract(epoch from (s.hora_fin - s.hora_inicio)) / 60) filter (where m.sesion_id is not null or (s.estado = 'realizada' and s.fecha < v_corte)), 0))::integer as b_min_pag,
             (coalesce(sum(greatest(0, extract(epoch from (((m.entrada at time zone 'America/Lima')::time) - s.hora_inicio)) / 60)) filter (where m.sesion_id is not null), 0))::integer as b_min_tarde
        from public.salon_sesiones s
        join public.salones sa on sa.id = s.salon_id
        left join public.docente_marcas m on m.sesion_id = s.id
        join public.docentes d on d.id = coalesce(m.docente_id, sa.docente_id)
       where s.fecha between p_desde and p_hasta and s.estado <> 'cancelada'
       group by d.id, d.nombre, d.nativo, sa.id, sa.nombre, sa.servicio_pago
    )
    select b.b_docente_id, b.b_docente, b.b_salon_id, b.b_salon,
           b.b_programadas, b.b_dictadas, b.b_sin_marca, b.b_min_prog, b.b_min_pag, b.b_min_tarde,
           b.b_nativo, b.b_servicio, tf.servicio_nombre, al.n, tf.precio_hora,
           case when tf.precio_hora is null then null else round(b.b_min_pag / 60.0 * tf.precio_hora, 2) end
      from base b
      cross join lateral (
        select count(*)::integer as n from public.matriculas mt
         where mt.salon_id = b.b_salon_id and mt.fecha_inicio <= v_ref and (mt.fecha_fin is null or mt.fecha_fin >= v_ref)
      ) al
      left join lateral (
        select t.servicio_nombre, t.precio_hora from public.tarifas_docente t
         where t.servicio = b.b_servicio and t.alumnos_min <= greatest(al.n, 1) and (not t.nativo or b.b_nativo)
         order by t.nativo desc, t.alumnos_min desc limit 1
      ) tf on true
     order by b.b_docente, b.b_salon;
end $$;

-- Detalle por clase: igual que antes más `dictada` (con entrada, o realizada antes de que existieran las marcas).
drop function if exists public.horas_detalle(date, date, uuid);
create function public.horas_detalle(p_desde date, p_hasta date, p_docente uuid) returns table (
  sesion_id uuid, fecha date, hora_inicio time, hora_fin time, salon_id uuid, salon text, tipo text,
  entrada timestamptz, salida timestamptz, ajustada boolean, nota text, minutos_programados integer, minutos_tarde integer, dictada boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_corte date := coalesce((select c.valor::date from public.config_app c where c.clave = 'marcas_desde'), date '2026-11-28');
begin
  if not (select public.ve_personas()) then raise exception 'No tienes acceso a este reporte' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 120 then raise exception 'Periodo no válido'; end if;
  return query
    select s.id, s.fecha, s.hora_inicio, s.hora_fin, sa.id, sa.nombre, s.tipo, m.entrada, m.salida, coalesce(m.ajustada, false), m.nota,
           (extract(epoch from (s.hora_fin - s.hora_inicio)) / 60)::integer,
           case when m.sesion_id is null then null
                else greatest(0, extract(epoch from (((m.entrada at time zone 'America/Lima')::time) - s.hora_inicio)) / 60)::integer end,
           (m.sesion_id is not null or (s.estado = 'realizada' and s.fecha < v_corte))
      from public.salon_sesiones s
      join public.salones sa on sa.id = s.salon_id
      left join public.docente_marcas m on m.sesion_id = s.id
     where s.fecha between p_desde and p_hasta and s.estado <> 'cancelada' and coalesce(m.docente_id, sa.docente_id) = p_docente
     order by s.fecha, s.hora_inicio;
end $$;

-- ============================================================
-- 4. Permisos de ejecución
-- ============================================================
revoke execute on function
  public.tarifas_pago(), public.asignar_servicio_salon(uuid, text), public.marcar_docente_nativo(uuid, boolean), public.horas_resumen(date, date), public.horas_detalle(date, date, uuid)
  from public, anon;
grant execute on function
  public.tarifas_pago(), public.asignar_servicio_salon(uuid, text), public.marcar_docente_nativo(uuid, boolean), public.horas_resumen(date, date), public.horas_detalle(date, date, uuid)
  to authenticated;
