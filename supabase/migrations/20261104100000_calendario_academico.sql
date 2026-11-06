-- UNIVERSA · Calendario académico (Fase 1)
-- Sesiones por salón, progreso, feriados, cancelaciones/recuperaciones y fecha de fin calculada.
--
-- Principios:
--  * Una sesión = una clase. total_sesiones cuenta clases (no horas).
--  * Las sesiones y los feriados SOLO se escriben mediante las funciones de este archivo
--    (SECURITY DEFINER con verificación de admin). No hay políticas de escritura directa.
--  * Las sesiones pasadas nunca se marcan solas: quedan 'programada' (por registrar) hasta que un admin las valida.
--  * El recálculo solo regenera sesiones futuras, regulares y no manuales. Nunca toca realizadas,
--    canceladas, pasadas ni las que el admin fijó a mano.
--  * Los estudiantes no participan: ni el calendario ni la fecha de fin dependen de la matrícula.
--  * "Hoy" es la fecha de America/Lima.
--
-- Se ejecuta como una sola transacción.
begin;

-- ============================================================
-- 1. Estructura
-- ============================================================
alter table public.salones
  add column total_sesiones integer check (total_sesiones is null or total_sesiones > 0);

create table public.feriados (
  fecha date primary key,
  nombre text not null,
  created_at timestamptz not null default now()
);

create table public.salon_sesiones (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salones(id) on delete cascade,
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  estado text not null default 'programada' check (estado in ('programada', 'realizada', 'cancelada')),
  tipo text not null default 'regular' check (tipo in ('regular', 'recuperacion')),
  recupera_a uuid references public.salon_sesiones(id) on delete set null,
  manual boolean not null default false, -- fecha fijada por un admin: el recálculo no la mueve
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (hora_fin > hora_inicio),
  constraint salon_sesiones_slot_unico unique (salon_id, fecha, hora_inicio)
);
create index salon_sesiones_salon_fecha_idx on public.salon_sesiones (salon_id, fecha);
-- Una sesión cancelada solo puede tener una recuperación activa.
create unique index salon_sesiones_recuperacion_unica on public.salon_sesiones (recupera_a)
  where recupera_a is not null and estado <> 'cancelada';

create trigger salon_sesiones_updated_at before update on public.salon_sesiones
  for each row execute function public.set_updated_at();

-- Feriados nacionales de Perú 2026 (Decreto Legislativo 713, art. 6, y leyes modificatorias 31381, 31530, 31788, 31822).
-- Verificados con El Peruano (elperuano.pe). 2027 NO se carga aquí: ver supabase/seeds/feriados_2027_provisional.sql.
insert into public.feriados (fecha, nombre) values
  ('2026-01-01', 'Año Nuevo'),
  ('2026-04-02', 'Jueves Santo'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Día del Trabajo'),
  ('2026-06-07', 'Batalla de Arica y Día de la Bandera'),
  ('2026-06-29', 'San Pedro y San Pablo'),
  ('2026-07-23', 'Día de la Fuerza Aérea del Perú'),
  ('2026-07-28', 'Fiestas Patrias'),
  ('2026-07-29', 'Fiestas Patrias'),
  ('2026-08-06', 'Batalla de Junín'),
  ('2026-08-30', 'Santa Rosa de Lima'),
  ('2026-10-08', 'Combate de Angamos'),
  ('2026-11-01', 'Todos los Santos'),
  ('2026-12-08', 'Inmaculada Concepción'),
  ('2026-12-09', 'Batalla de Ayacucho'),
  ('2026-12-25', 'Navidad');

-- ============================================================
-- 2. Seguridad de tablas: solo lectura directa
-- ============================================================
revoke all on public.feriados, public.salon_sesiones from anon, authenticated;
grant select on public.feriados, public.salon_sesiones to authenticated;

alter table public.feriados enable row level security;
alter table public.salon_sesiones enable row level security;

create policy "consultar feriados" on public.feriados for select to authenticated
  using ((select public.tiene_perfil()));
create policy "consultar sesiones" on public.salon_sesiones for select to authenticated
  using ((select public.tiene_perfil()));
-- Sin políticas INSERT/UPDATE/DELETE: la única vía de escritura son las funciones de abajo.

-- ============================================================
-- 3. Vistas de lectura (respetan RLS de quien consulta)
-- ============================================================
create function public.hoy_lima() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Lima')::date
$$;
revoke execute on function public.hoy_lima() from public, anon;
grant execute on function public.hoy_lima() to authenticated;

-- Progreso por salón. restantes = total - realizadas; sin_programar = restantes que no tienen sesión programada.
create view public.salon_progreso with (security_invoker = true) as
select c.*,
       greatest(c.total_sesiones - c.realizadas, 0) as restantes,
       greatest(c.total_sesiones - c.realizadas - c.programadas, 0) as sin_programar
from (
  select s.id as salon_id,
         s.total_sesiones,
         count(q.id) as sesiones,
         count(q.id) filter (where q.estado = 'realizada') as realizadas,
         count(q.id) filter (where q.estado = 'programada') as programadas,
         count(q.id) filter (where q.estado = 'cancelada') as canceladas,
         count(q.id) filter (where q.estado = 'programada' and q.fecha < public.hoy_lima()) as por_registrar,
         min(q.fecha) filter (where q.estado = 'programada' and q.fecha >= public.hoy_lima()) as proxima_fecha
  from public.salones s
  left join public.salon_sesiones q on q.salon_id = s.id
  where s.total_sesiones is not null
  group by s.id, s.total_sesiones
) c;

-- Advertencia (no bloquea): sesiones pendientes de un docente que se superponen con otro salón del mismo docente.
create view public.sesiones_con_conflicto with (security_invoker = true) as
select s.id as sesion_id,
       s.salon_id,
       o.id as otra_sesion_id,
       os.codigo as otro_salon_codigo,
       os.nombre as otro_salon_nombre,
       o.hora_inicio as otra_hora_inicio,
       o.hora_fin as otra_hora_fin
from public.salon_sesiones s
join public.salones sa on sa.id = s.salon_id
join public.salones os on os.docente_id = sa.docente_id and os.id <> sa.id
join public.salon_sesiones o on o.salon_id = os.id
  and o.fecha = s.fecha
  and o.estado <> 'cancelada'
  and o.hora_inicio < s.hora_fin
  and s.hora_inicio < o.hora_fin
where sa.docente_id is not null
  and s.estado = 'programada';

revoke all on public.salon_progreso, public.sesiones_con_conflicto from anon, authenticated;
grant select on public.salon_progreso, public.sesiones_con_conflicto to authenticated;

-- ============================================================
-- 4. Funciones internas (no ejecutables desde la API)
-- ============================================================
create function public.cal_exigir_admin() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.es_admin()) then
    raise exception 'No tienes permisos para realizar esta acción' using errcode = '42501';
  end if;
end $$;

-- Próximos p_cantidad huecos libres del patrón semanal desde p_desde: omite feriados y horarios ya ocupados
-- por una sesión (de cualquier estado), lo que evita duplicados.
create function public.cal_slots(p_salon uuid, p_desde date, p_cantidad integer)
returns table (fecha_slot date, inicio time, fin time)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_dia date;
  v_n integer := 0;
  v_h record;
begin
  if p_cantidad is null or p_cantidad <= 0 then
    return;
  end if;
  for i in 0..1500 loop
    v_dia := p_desde + i;
    continue when exists (select 1 from public.feriados f where f.fecha = v_dia);
    for v_h in
      select h.hora_inicio as hi, max(h.hora_fin) as hf
      from public.salon_horarios h
      where h.salon_id = p_salon and h.dia = extract(isodow from v_dia)::integer
      group by h.hora_inicio
      order by h.hora_inicio
    loop
      continue when exists (
        select 1 from public.salon_sesiones s
        where s.salon_id = p_salon and s.fecha = v_dia and s.hora_inicio = v_h.hi
      );
      fecha_slot := v_dia;
      inicio := v_h.hi;
      fin := v_h.hf;
      return next;
      v_n := v_n + 1;
      exit when v_n >= p_cantidad;
    end loop;
    exit when v_n >= p_cantidad;
  end loop;
end $$;

-- Recalcula salones.fecha_fin_estimada a partir de las sesiones. Si faltan sesiones por programar,
-- proyecta (sin guardar) los huecos necesarios. Un salón sin sesiones conserva su fecha manual.
create function public.cal_actualizar_fin(p_salon uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_total integer;
  v_inicio date;
  v_hay boolean;
  v_real integer;
  v_prog integer;
  v_max_prog date;
  v_max_real date;
  v_falta integer;
  v_fin date;
  v_proj date;
begin
  select total_sesiones, fecha_inicio into v_total, v_inicio from public.salones where id = p_salon;
  select count(*) > 0,
         count(*) filter (where estado = 'realizada'),
         count(*) filter (where estado = 'programada'),
         max(fecha) filter (where estado = 'programada'),
         max(fecha) filter (where estado = 'realizada')
    into v_hay, v_real, v_prog, v_max_prog, v_max_real
  from public.salon_sesiones where salon_id = p_salon;

  if not v_hay or v_total is null then
    return;
  end if;

  v_fin := coalesce(v_max_prog, v_max_real);
  v_falta := v_total - v_real - v_prog;
  if v_falta > 0 then
    select max(fecha_slot) into v_proj
    from public.cal_slots(p_salon, greatest(public.hoy_lima(), v_inicio), v_falta);
    v_fin := greatest(v_fin, v_proj);
  end if;

  update public.salones set fecha_fin_estimada = v_fin
  where id = p_salon and fecha_fin_estimada is distinct from v_fin;
end $$;

-- Crea las sesiones que faltan para llegar al total (realizadas + programadas). Idempotente.
create function public.cal_completar(p_salon uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_total integer;
  v_inicio date;
  v_hay boolean;
  v_real integer;
  v_prog integer;
  v_falta integer;
  v_desde date;
begin
  select total_sesiones, fecha_inicio into v_total, v_inicio from public.salones where id = p_salon;
  if v_total is null then
    raise exception 'El salón no tiene total de sesiones definido';
  end if;

  select count(*) > 0,
         count(*) filter (where estado = 'realizada'),
         count(*) filter (where estado = 'programada')
    into v_hay, v_real, v_prog
  from public.salon_sesiones where salon_id = p_salon;

  v_falta := v_total - v_real - v_prog;
  if v_falta > 0 then
    -- Primera generación: desde la fecha de inicio (si ya pasó, las sesiones quedan por registrar).
    -- Después: nunca se crean sesiones en el pasado.
    v_desde := case when v_hay then greatest(public.hoy_lima(), v_inicio) else v_inicio end;
    insert into public.salon_sesiones (salon_id, fecha, hora_inicio, hora_fin)
    select p_salon, fecha_slot, inicio, fin from public.cal_slots(p_salon, v_desde, v_falta);
  end if;

  perform public.cal_actualizar_fin(p_salon);
end $$;

-- Regenera SOLO sesiones futuras, regulares, programadas y no manuales; luego completa.
create function public.cal_recalcular(p_salon uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.salon_sesiones
  where salon_id = p_salon
    and estado = 'programada'
    and tipo = 'regular'
    and manual = false
    and fecha >= public.hoy_lima();
  perform public.cal_completar(p_salon);
end $$;

create function public.cal_recalcular_todos() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_s record;
begin
  for v_s in
    select s.id from public.salones s
    where s.total_sesiones is not null
      and exists (select 1 from public.salon_sesiones q where q.salon_id = s.id)
    order by s.id
  loop
    perform 1 from public.salones where id = v_s.id for update;
    perform public.cal_recalcular(v_s.id);
  end loop;
end $$;

-- Valida y crea una recuperación para una sesión cancelada (misma sala, sesión cancelada, sin duplicar).
create function public.cal_crear_recuperacion(p_cancelada uuid, p_fecha date, p_ini time, p_fin time)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c record;
  v_total integer;
  v_real integer;
  v_prog integer;
  v_feriado text;
begin
  select * into v_c from public.salon_sesiones where id = p_cancelada;
  if not found or v_c.estado <> 'cancelada' then
    raise exception 'La recuperación debe corresponder a una sesión cancelada';
  end if;
  if exists (select 1 from public.salon_sesiones r where r.recupera_a = p_cancelada and r.estado <> 'cancelada') then
    raise exception 'Esta sesión cancelada ya tiene una recuperación';
  end if;
  if p_fecha is null or p_ini is null or p_fin is null then
    raise exception 'Indica la fecha y el horario de la recuperación';
  end if;
  if p_fin <= p_ini then
    raise exception 'La hora de fin debe ser posterior a la de inicio';
  end if;
  if p_fecha < public.hoy_lima() then
    raise exception 'La recuperación no puede programarse en una fecha pasada';
  end if;
  if p_fecha < v_c.fecha then
    raise exception 'La recuperación debe ser posterior a la sesión cancelada';
  end if;
  select nombre into v_feriado from public.feriados where fecha = p_fecha;
  if found then
    raise exception 'La fecha elegida es feriado (%)', v_feriado;
  end if;
  if exists (
    select 1 from public.salon_sesiones s
    where s.salon_id = v_c.salon_id and s.fecha = p_fecha and s.hora_inicio = p_ini
  ) then
    raise exception 'Ya existe una sesión de este salón en esa fecha y hora';
  end if;

  select total_sesiones into v_total from public.salones where id = v_c.salon_id;
  select count(*) filter (where estado = 'realizada'), count(*) filter (where estado = 'programada')
    into v_real, v_prog from public.salon_sesiones where salon_id = v_c.salon_id;
  if v_total is null or v_total - v_real - v_prog <= 0 then
    raise exception 'El calendario ya tiene todas las sesiones necesarias';
  end if;

  insert into public.salon_sesiones (salon_id, fecha, hora_inicio, hora_fin, tipo, recupera_a, manual)
  values (v_c.salon_id, p_fecha, p_ini, p_fin, 'recuperacion', p_cancelada, true);
end $$;

revoke execute on function
  public.cal_exigir_admin(), public.cal_slots(uuid, date, integer), public.cal_actualizar_fin(uuid),
  public.cal_completar(uuid), public.cal_recalcular(uuid), public.cal_recalcular_todos(),
  public.cal_crear_recuperacion(uuid, date, time, time)
  from public, anon, authenticated;

-- ============================================================
-- 5. API transaccional (admin)
-- ============================================================

-- Guardado de salón + horarios (reemplaza la versión anterior). Ahora es SECURITY DEFINER con verificación de admin.
-- Reglas del calendario:
--  * total_sesiones no puede ser menor que las sesiones ya realizadas ni quitarse si hay sesiones.
--  * Con sesiones registradas, la fecha de inicio no cambia y fecha_fin_estimada la calcula el calendario.
--  * Si cambian horarios o total, se regeneran solo las sesiones futuras regulares no manuales.
create or replace function public.guardar_salon(p_id uuid, p_salon jsonb, p_horarios jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_total integer := nullif(p_salon->>'total_sesiones', '')::integer;
  v_inicio date := (p_salon->>'fecha_inicio')::date;
  v_total_ant integer;
  v_inicio_ant date;
  v_hay boolean := false;
  v_real integer := 0;
  v_old jsonb;
  v_new jsonb;
begin
  perform public.cal_exigir_admin();

  if p_id is null then
    insert into public.salones (
      codigo, nombre, programa_id, curso, docente_id, fecha_inicio,
      fecha_fin_estimada, capacidad, estado, observaciones, total_sesiones
    ) values (
      btrim(p_salon->>'codigo'),
      btrim(p_salon->>'nombre'),
      (p_salon->>'programa_id')::uuid,
      nullif(btrim(p_salon->>'curso'), ''),
      nullif(p_salon->>'docente_id', '')::uuid,
      v_inicio,
      nullif(p_salon->>'fecha_fin_estimada', '')::date,
      (p_salon->>'capacidad')::integer,
      coalesce(nullif(p_salon->>'estado', ''), 'pendiente'),
      nullif(btrim(p_salon->>'observaciones'), ''),
      v_total
    ) returning id into v_id;
  else
    perform 1 from public.salones where id = p_id for update;
    select total_sesiones, fecha_inicio into v_total_ant, v_inicio_ant from public.salones where id = p_id;
    if not found then
      raise exception 'El salón no existe' using errcode = 'P0002';
    end if;

    select count(*) > 0, count(*) filter (where estado = 'realizada')
      into v_hay, v_real from public.salon_sesiones where salon_id = p_id;

    if v_hay then
      if v_total is null then
        raise exception 'No se puede quitar el total de sesiones: el salón ya tiene sesiones registradas';
      end if;
      if v_total < v_real then
        raise exception 'El total de sesiones (%) no puede ser menor que las sesiones ya realizadas (%)', v_total, v_real;
      end if;
      if v_inicio <> v_inicio_ant then
        raise exception 'La fecha de inicio no puede cambiarse cuando el salón ya tiene sesiones registradas';
      end if;
    end if;

    select coalesce(jsonb_agg(jsonb_build_array(h.dia, h.hora_inicio, h.hora_fin) order by h.dia, h.hora_inicio, h.hora_fin), '[]'::jsonb)
      into v_old from public.salon_horarios h where h.salon_id = p_id;

    update public.salones set
      codigo = btrim(p_salon->>'codigo'),
      nombre = btrim(p_salon->>'nombre'),
      programa_id = (p_salon->>'programa_id')::uuid,
      curso = nullif(btrim(p_salon->>'curso'), ''),
      docente_id = nullif(p_salon->>'docente_id', '')::uuid,
      fecha_inicio = v_inicio,
      fecha_fin_estimada = case when v_hay then fecha_fin_estimada
                                else nullif(p_salon->>'fecha_fin_estimada', '')::date end,
      capacidad = (p_salon->>'capacidad')::integer,
      estado = coalesce(nullif(p_salon->>'estado', ''), 'pendiente'),
      observaciones = nullif(btrim(p_salon->>'observaciones'), ''),
      total_sesiones = v_total
    where id = p_id
    returning id into v_id;
  end if;

  delete from public.salon_horarios where salon_id = v_id;
  insert into public.salon_horarios (salon_id, dia, hora_inicio, hora_fin)
  select v_id, (h->>'dia')::smallint, (h->>'hora_inicio')::time, (h->>'hora_fin')::time
  from jsonb_array_elements(coalesce(p_horarios, '[]'::jsonb)) as h;

  if p_id is not null and v_hay then
    select coalesce(jsonb_agg(jsonb_build_array(h.dia, h.hora_inicio, h.hora_fin) order by h.dia, h.hora_inicio, h.hora_fin), '[]'::jsonb)
      into v_new from public.salon_horarios h where h.salon_id = v_id;
    if v_total is distinct from v_total_ant or v_old is distinct from v_new then
      perform public.cal_recalcular(v_id);
    end if;
  end if;

  return v_id;
end $$;

-- Genera el calendario o completa las sesiones faltantes. Devuelve cuántas sesiones creó.
create function public.generar_calendario(p_salon_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_total integer;
  v_antes integer;
  v_despues integer;
begin
  perform public.cal_exigir_admin();
  perform 1 from public.salones where id = p_salon_id for update;
  select total_sesiones into v_total from public.salones where id = p_salon_id;
  if not found then
    raise exception 'El salón no existe' using errcode = 'P0002';
  end if;
  if v_total is null then
    raise exception 'Define el total de sesiones del salón antes de generar el calendario';
  end if;
  if not exists (select 1 from public.salon_horarios where salon_id = p_salon_id) then
    raise exception 'Registra al menos un horario semanal antes de generar el calendario';
  end if;

  select count(*) into v_antes from public.salon_sesiones where salon_id = p_salon_id;
  perform public.cal_completar(p_salon_id);
  select count(*) into v_despues from public.salon_sesiones where salon_id = p_salon_id;
  return v_despues - v_antes;
end $$;

-- Valida una sesión pasada o de hoy como realizada. Nunca ocurre automáticamente.
create function public.registrar_realizada(p_sesion_id uuid, p_nota text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_s record;
begin
  perform public.cal_exigir_admin();
  select * into v_s from public.salon_sesiones where id = p_sesion_id;
  if not found then
    raise exception 'La sesión no existe';
  end if;
  perform 1 from public.salones where id = v_s.salon_id for update;
  select * into v_s from public.salon_sesiones where id = p_sesion_id;

  if v_s.estado <> 'programada' then
    raise exception 'Solo se puede registrar como realizada una sesión programada';
  end if;
  if v_s.fecha > public.hoy_lima() then
    raise exception 'No se puede registrar como realizada una sesión futura';
  end if;

  update public.salon_sesiones
  set estado = 'realizada', nota = coalesce(nullif(btrim(p_nota), ''), nota)
  where id = p_sesion_id;
  perform public.cal_actualizar_fin(v_s.salon_id);
end $$;

-- Fecha y horario propuestos para recuperar una sesión (el siguiente hueco libre del patrón). No escribe nada.
create function public.proponer_recuperacion(p_sesion_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_s record;
  v_slot record;
begin
  perform public.cal_exigir_admin();
  select * into v_s from public.salon_sesiones where id = p_sesion_id;
  if not found then
    raise exception 'La sesión no existe';
  end if;
  if v_s.estado = 'realizada' then
    raise exception 'Una sesión realizada no necesita recuperación';
  end if;

  select * into v_slot
  from public.cal_slots(v_s.salon_id, greatest(public.hoy_lima(), v_s.fecha), 1);
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'fecha', v_slot.fecha_slot,
    'hora_inicio', to_char(v_slot.inicio, 'HH24:MI'),
    'hora_fin', to_char(v_slot.fin, 'HH24:MI')
  );
end $$;

-- Cancela una sesión programada. p_recuperacion = {"fecha","hora_inicio","hora_fin"} confirma una recuperación
-- en la misma transacción; null la deja pendiente (queda como "sin programar").
create function public.cancelar_sesion(p_sesion_id uuid, p_nota text default null, p_recuperacion jsonb default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_s record;
begin
  perform public.cal_exigir_admin();
  select * into v_s from public.salon_sesiones where id = p_sesion_id;
  if not found then
    raise exception 'La sesión no existe';
  end if;
  perform 1 from public.salones where id = v_s.salon_id for update;
  select * into v_s from public.salon_sesiones where id = p_sesion_id;

  if v_s.estado <> 'programada' then
    raise exception 'Solo se puede cancelar una sesión programada';
  end if;

  update public.salon_sesiones
  set estado = 'cancelada', nota = coalesce(nullif(btrim(p_nota), ''), nota)
  where id = p_sesion_id;

  if p_recuperacion is not null then
    perform public.cal_crear_recuperacion(
      p_sesion_id,
      (p_recuperacion->>'fecha')::date,
      (p_recuperacion->>'hora_inicio')::time,
      (p_recuperacion->>'hora_fin')::time
    );
  end if;

  perform public.cal_actualizar_fin(v_s.salon_id);
end $$;

-- Programa la recuperación de una sesión ya cancelada que quedó pendiente.
create function public.crear_recuperacion(p_cancelada_id uuid, p_fecha date, p_hora_inicio time, p_hora_fin time)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_salon uuid;
begin
  perform public.cal_exigir_admin();
  select salon_id into v_salon from public.salon_sesiones where id = p_cancelada_id;
  if not found then
    raise exception 'La sesión no existe';
  end if;
  perform 1 from public.salones where id = v_salon for update;

  perform public.cal_crear_recuperacion(p_cancelada_id, p_fecha, p_hora_inicio, p_hora_fin);
  perform public.cal_actualizar_fin(v_salon);
end $$;

-- Mueve una sesión programada. Queda marcada como manual: los recálculos no la tocan.
create function public.reprogramar_sesion(p_sesion_id uuid, p_fecha date, p_hora_inicio time, p_hora_fin time, p_nota text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_s record;
  v_inicio date;
  v_feriado text;
begin
  perform public.cal_exigir_admin();
  select * into v_s from public.salon_sesiones where id = p_sesion_id;
  if not found then
    raise exception 'La sesión no existe';
  end if;
  perform 1 from public.salones where id = v_s.salon_id for update;
  select * into v_s from public.salon_sesiones where id = p_sesion_id;

  if v_s.estado <> 'programada' then
    raise exception 'Solo se puede reprogramar una sesión programada. Para modificar una realizada o cancelada usa la corrección';
  end if;
  if p_fecha is null or p_hora_inicio is null or p_hora_fin is null then
    raise exception 'Indica la fecha y el horario';
  end if;
  if p_hora_fin <= p_hora_inicio then
    raise exception 'La hora de fin debe ser posterior a la de inicio';
  end if;
  select fecha_inicio into v_inicio from public.salones where id = v_s.salon_id;
  if p_fecha < v_inicio then
    raise exception 'La sesión no puede ser anterior a la fecha de inicio del salón';
  end if;
  select nombre into v_feriado from public.feriados where fecha = p_fecha;
  if found then
    raise exception 'La fecha elegida es feriado (%)', v_feriado;
  end if;
  if exists (
    select 1 from public.salon_sesiones s
    where s.salon_id = v_s.salon_id and s.fecha = p_fecha and s.hora_inicio = p_hora_inicio and s.id <> p_sesion_id
  ) then
    raise exception 'Ya existe una sesión de este salón en esa fecha y hora';
  end if;

  update public.salon_sesiones
  set fecha = p_fecha, hora_inicio = p_hora_inicio, hora_fin = p_hora_fin, manual = true,
      nota = coalesce(nullif(btrim(p_nota), ''), nota)
  where id = p_sesion_id;
  perform public.cal_actualizar_fin(v_s.salon_id);
end $$;

-- Corrección EXPLÍCITA de una sesión realizada o cancelada (exige motivo). Es la única forma de cambiarlas.
create function public.corregir_sesion(p_sesion_id uuid, p_nuevo_estado text, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_s record;
  v_total integer;
  v_real integer;
  v_prog integer;
begin
  perform public.cal_exigir_admin();
  if nullif(btrim(p_motivo), '') is null then
    raise exception 'Indica el motivo de la corrección';
  end if;
  if p_nuevo_estado not in ('programada', 'realizada', 'cancelada') then
    raise exception 'Estado no válido';
  end if;
  select * into v_s from public.salon_sesiones where id = p_sesion_id;
  if not found then
    raise exception 'La sesión no existe';
  end if;
  perform 1 from public.salones where id = v_s.salon_id for update;
  select * into v_s from public.salon_sesiones where id = p_sesion_id;

  if v_s.estado = 'programada' then
    raise exception 'La corrección aplica a sesiones realizadas o canceladas';
  end if;
  if p_nuevo_estado = v_s.estado then
    raise exception 'La sesión ya tiene ese estado';
  end if;
  if v_s.estado = 'cancelada' then
    if exists (select 1 from public.salon_sesiones r where r.recupera_a = p_sesion_id and r.estado <> 'cancelada') then
      raise exception 'Esta sesión cancelada ya tiene una recuperación activa; cancélala primero';
    end if;
    -- Reactivarla suma una sesión al conteo: solo si falta alguna por programar.
    select total_sesiones into v_total from public.salones where id = v_s.salon_id;
    select count(*) filter (where estado = 'realizada'), count(*) filter (where estado = 'programada')
      into v_real, v_prog from public.salon_sesiones where salon_id = v_s.salon_id;
    if v_total is null or v_total - v_real - v_prog <= 0 then
      raise exception 'El calendario ya tiene todas las sesiones necesarias; no se puede reactivar esta sesión';
    end if;
  end if;
  if p_nuevo_estado = 'realizada' and v_s.fecha > public.hoy_lima() then
    raise exception 'No se puede registrar como realizada una sesión futura';
  end if;

  update public.salon_sesiones
  set estado = p_nuevo_estado,
      manual = true,
      nota = concat_ws(E'\n', nota,
        'Corrección (' || to_char(public.hoy_lima(), 'DD/MM/YYYY') || '): ' || v_s.estado || ' → ' || p_nuevo_estado
        || '. Motivo: ' || btrim(p_motivo))
  where id = p_sesion_id;
  perform public.cal_actualizar_fin(v_s.salon_id);
end $$;

create function public.guardar_feriado(p_fecha date, p_nombre text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  if p_fecha is null or nullif(btrim(p_nombre), '') is null then
    raise exception 'Indica la fecha y el nombre del feriado';
  end if;
  insert into public.feriados (fecha, nombre) values (p_fecha, btrim(p_nombre))
  on conflict (fecha) do update set nombre = excluded.nombre;
  perform public.cal_recalcular_todos();
end $$;

create function public.eliminar_feriado(p_fecha date) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  delete from public.feriados where fecha = p_fecha;
  perform public.cal_recalcular_todos();
end $$;

revoke execute on function
  public.guardar_salon(uuid, jsonb, jsonb), public.generar_calendario(uuid),
  public.registrar_realizada(uuid, text), public.proponer_recuperacion(uuid),
  public.cancelar_sesion(uuid, text, jsonb), public.crear_recuperacion(uuid, date, time, time),
  public.reprogramar_sesion(uuid, date, time, time, text), public.corregir_sesion(uuid, text, text),
  public.guardar_feriado(date, text), public.eliminar_feriado(date)
  from public, anon;
grant execute on function
  public.guardar_salon(uuid, jsonb, jsonb), public.generar_calendario(uuid),
  public.registrar_realizada(uuid, text), public.proponer_recuperacion(uuid),
  public.cancelar_sesion(uuid, text, jsonb), public.crear_recuperacion(uuid, date, time, time),
  public.reprogramar_sesion(uuid, date, time, time, text), public.corregir_sesion(uuid, text, text),
  public.guardar_feriado(date, text), public.eliminar_feriado(date)
  to authenticated;

commit;
