-- UNIVERSA · Bloqueo de docentes por horario (salones y clases de paquetes de horas).
--
-- Un docente asignado a un salón queda ocupado en los días y horas de ese salón durante su rango de fechas
-- (fecha_inicio → fecha_fin_estimada, o sin fin si no hay). No puede asignarse a otro salón ni programarse una clase
-- particular que se cruce. Reglas:
--   * Cruce de horas: a.inicio < b.fin y b.inicio < a.fin (horarios contiguos, p. ej. 18–20 y 20–22, NO chocan).
--   * Cruce de fechas: los rangos deben solaparse (dos salones con el mismo horario en ciclos distintos NO chocan).
--   * No bloquean: salones finalizados, sesiones/clases canceladas, clases de paquete ya pasadas.
--   * Salón nuevo (planificado) vs. salones existentes: patrón semanal + rango de fechas.
--   * Clase de paquete vs. salón: si el salón ya tiene calendario se mira su sesión de ese día; si no, su patrón semanal.
-- La fecha de fin ya no se escribe: un salón sin sesiones recibe un fin proyectado al guardarse (inicio + horario + total de
-- sesiones, la misma lógica de huecos de "Generar calendario"); sin esos datos sigue contando como "sin fin".
-- La validación vive en guardar_salon, programar_clase y reprogramar_clase (rechazan con un mensaje claro).
-- choques_horario_salon también se consulta desde la pantalla para marcar «ocupado en…» en el selector de docente.
-- El estado «pendiente» de un salón se muestra ahora como «Planificado» (solo cambia la etiqueta en la interfaz).
--
-- Repetible. Requiere calendario (20261104), paquetes (20261110) y matrículas (20261112).

create or replace function public.dia_corto(p_dia integer) returns text
language sql immutable set search_path = '' as $$
  select (array['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'])[p_dia]
$$;

-- ------------------------------------------------------------
-- Reservas de docente: bloques puntuales (examen de nivel, entrevista, reunión…) que ocupan al docente como una clase.
-- Solo se escriben con crear/reprogramar/cancelar_reserva_docente (validan choques, feriados y fechas pasadas).
-- ------------------------------------------------------------
create table if not exists public.reservas_docente (
  id uuid primary key default gen_random_uuid(),
  docente_id uuid not null references public.docentes(id),
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  tipo text not null check (tipo in ('examen_nivel', 'entrevista', 'reunion', 'otro')),
  titulo text,
  nota text,
  estado text not null default 'programada' check (estado in ('programada', 'cancelada')),
  motivo_cancelacion text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (hora_fin > hora_inicio),
  check (tipo <> 'otro' or btrim(coalesce(titulo, '')) <> '')
);
create index if not exists reservas_docente_docente_fecha_idx on public.reservas_docente (docente_id, fecha) where estado = 'programada';
create index if not exists reservas_docente_fecha_idx on public.reservas_docente (fecha);

drop trigger if exists reservas_docente_updated_at on public.reservas_docente;
create trigger reservas_docente_updated_at before update on public.reservas_docente
  for each row execute function public.set_updated_at();

alter table public.reservas_docente enable row level security;
revoke all on public.reservas_docente from anon, authenticated;
grant select on public.reservas_docente to authenticated;
drop policy if exists "consultar reservas de docentes" on public.reservas_docente;
create policy "consultar reservas de docentes" on public.reservas_docente for select to authenticated using ((select public.tiene_perfil()));

-- Texto legible de una reserva: «Examen de nivel», «Entrevista · Ana Pérez»…
create or replace function public.reserva_titulo(p_tipo text, p_titulo text) returns text
language sql immutable set search_path = '' as $$
  select concat_ws(' · ',
    case p_tipo when 'examen_nivel' then 'Examen de nivel' when 'entrevista' then 'Entrevista' when 'reunion' then 'Reunión' else null end,
    nullif(btrim(p_titulo), ''))
$$;

-- Fecha de la última clase de un horario semanal que aún no tiene calendario: cuenta p_total clases desde p_inicio,
-- saltando feriados (misma lógica que cal_slots, pero con el horario en JSON). null si faltan datos.
create or replace function public.proyectar_fin_horarios(p_horarios jsonb, p_inicio date, p_total integer)
returns date
language plpgsql stable security definer set search_path = '' as $$
declare
  v_semana integer[] := array[0,0,0,0,0,0,0];  -- clases por día ISO (1 = lunes)
  v_por_semana integer;
  v_feriados date[];
  v_dia date;
  v_n integer := 0;
begin
  if p_inicio is null or p_total is null or p_total <= 0 then return null; end if;

  -- Se calcula una sola vez: clases por día de la semana y feriados del tramo a recorrer.
  select coalesce(array_agg(n order by dia), v_semana) into v_semana
    from (select g as dia, coalesce(c.n, 0) as n
            from generate_series(1, 7) g
            left join (select (h->>'dia')::integer as dia, count(distinct h->>'hora_inicio')::integer as n
                         from jsonb_array_elements(coalesce(p_horarios, '[]'::jsonb)) h
                        where nullif(h->>'hora_inicio', '') is not null and nullif(h->>'hora_fin', '') is not null
                        group by 1) c on c.dia = g) t;
  v_por_semana := (select sum(x) from unnest(v_semana) x);
  if coalesce(v_por_semana, 0) = 0 then return null; end if;

  select coalesce(array_agg(fecha), '{}') into v_feriados from public.feriados where fecha between p_inicio and p_inicio + 1500;

  for i in 0..1500 loop
    v_dia := p_inicio + i;
    continue when v_dia = any (v_feriados);
    v_n := v_n + v_semana[extract(isodow from v_dia)::integer];
    if v_n >= p_total then return v_dia; end if;
  end loop;
  return null;
end $$;

-- Las consultas de bloqueo filtran por docente y fecha: sin este índice recorrerían todas las clases de paquete.
create index if not exists paquete_clases_docente_fecha_idx on public.paquete_clases (docente_id, fecha) where estado <> 'cancelada';

-- Choques de un horario semanal candidato (con su rango de fechas) contra lo que ya ocupa a los docentes.
-- p_docente null = todos los docentes (sirve para marcar el selector). p_excluir = salón que se está editando.
-- Si no hay p_fin pero sí p_total (salón sin calendario), el fin se proyecta con proyectar_fin_horarios.
drop function if exists public.choques_horario_salon(jsonb, date, date, uuid, uuid);
create or replace function public.choques_horario_salon(p_horarios jsonb, p_inicio date, p_fin date, p_docente uuid default null, p_excluir uuid default null, p_total integer default null)
returns table (docente_id uuid, origen text, titulo text, fecha date, dia smallint, hora_inicio time, hora_fin time)
language plpgsql stable security definer set search_path = '' as $$
declare v_d1 date := p_inicio; v_d2 date;
begin
  perform public.cal_exigir_admin();
  if v_d1 is null then return; end if;
  v_d2 := coalesce(p_fin, public.proyectar_fin_horarios(p_horarios, p_inicio, p_total), 'infinity'::date);
  return query
  with cand as (
    select (h->>'dia')::smallint as dia, (h->>'hora_inicio')::time as hi, (h->>'hora_fin')::time as hf
      from jsonb_array_elements(coalesce(p_horarios, '[]'::jsonb)) h
     where nullif(h->>'hora_inicio', '') is not null and nullif(h->>'hora_fin', '') is not null
  )
  select s.docente_id, 'salon'::text, s.nombre, null::date, sh.dia, sh.hora_inicio, sh.hora_fin
    from cand c
    join public.salon_horarios sh on sh.dia = c.dia and sh.hora_inicio < c.hf and c.hi < sh.hora_fin
    join public.salones s on s.id = sh.salon_id
   where s.docente_id is not null
     and (p_docente is null or s.docente_id = p_docente)
     and s.estado <> 'finalizado'
     and (p_excluir is null or s.id <> p_excluir)
     and s.fecha_inicio <= v_d2
     and coalesce(s.fecha_fin_estimada, 'infinity'::date) >= v_d1
  union all
  select pc.docente_id, 'paquete'::text, 'Clase particular · ' || coalesce(a.nombre, 'alumno'), pc.fecha,
         extract(isodow from pc.fecha)::smallint, pc.hora_inicio, pc.hora_fin
    from cand c
    join public.paquete_clases pc on extract(isodow from pc.fecha)::smallint = c.dia and pc.hora_inicio < c.hf and c.hi < pc.hora_fin
    join public.paquetes_horas p on p.id = pc.paquete_id and not p.anulado
    left join public.alumnos a on a.id = p.alumno_id
   where pc.docente_id is not null
     and (p_docente is null or pc.docente_id = p_docente)
     and pc.estado = 'programada'
     and pc.fecha >= public.hoy_lima()
     and pc.fecha between v_d1 and v_d2
  union all
  select r.docente_id, 'reserva'::text, public.reserva_titulo(r.tipo, r.titulo), r.fecha,
         extract(isodow from r.fecha)::smallint, r.hora_inicio, r.hora_fin
    from cand c
    join public.reservas_docente r on extract(isodow from r.fecha)::smallint = c.dia and r.hora_inicio < c.hf and c.hi < r.hora_fin
   where (p_docente is null or r.docente_id = p_docente)
     and r.estado = 'programada'
     and r.fecha >= public.hoy_lima()
     and r.fecha between v_d1 and v_d2;
end $$;

-- Choques de una clase puntual (clase de paquete) contra otras clases y contra los salones del docente.
-- p_excluir_salon: salón que se está moviendo (no choca consigo mismo).
drop function if exists public.texto_choques_clase(uuid, date, time, time, uuid);
drop function if exists public.texto_choques_clase(uuid, date, time, time, uuid, uuid);
drop function if exists public.choques_clase_docente(uuid, date, time, time, uuid);
drop function if exists public.choques_clase_docente(uuid, date, time, time, uuid, uuid);
create or replace function public.choques_clase_docente(p_docente uuid, p_fecha date, p_inicio time, p_fin time, p_excluir_clase uuid default null, p_excluir_salon uuid default null, p_excluir_reserva uuid default null)
returns table (origen text, titulo text, fecha date, hora_inicio time, hora_fin time)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  if p_docente is null or p_fecha is null or p_inicio is null or p_fin is null then return; end if;
  return query
  select 'paquete'::text, 'Clase particular · ' || coalesce(a.nombre, 'alumno'), pc.fecha, pc.hora_inicio, pc.hora_fin
    from public.paquete_clases pc
    join public.paquetes_horas p on p.id = pc.paquete_id and not p.anulado
    left join public.alumnos a on a.id = p.alumno_id
   where pc.docente_id = p_docente and pc.fecha = p_fecha and pc.estado <> 'cancelada'
     and (p_excluir_clase is null or pc.id <> p_excluir_clase)
     and pc.hora_inicio < p_fin and p_inicio < pc.hora_fin
  union all
  select 'reserva'::text, public.reserva_titulo(r.tipo, r.titulo), r.fecha, r.hora_inicio, r.hora_fin
    from public.reservas_docente r
   where r.docente_id = p_docente and r.fecha = p_fecha and r.estado = 'programada'
     and (p_excluir_reserva is null or r.id <> p_excluir_reserva)
     and r.hora_inicio < p_fin and p_inicio < r.hora_fin
  union all
  select 'salon'::text, s.nombre, p_fecha,
         coalesce(x.hora_inicio, y.hora_inicio), coalesce(x.hora_fin, y.hora_fin)
    from public.salones s
    left join lateral (
      select ss.hora_inicio, ss.hora_fin from public.salon_sesiones ss
       where ss.salon_id = s.id and ss.fecha = p_fecha and ss.estado <> 'cancelada'
         and ss.hora_inicio < p_fin and p_inicio < ss.hora_fin limit 1
    ) x on true
    left join lateral (
      select sh.hora_inicio, sh.hora_fin from public.salon_horarios sh
       where sh.salon_id = s.id and sh.dia = extract(isodow from p_fecha)::smallint
         and sh.hora_inicio < p_fin and p_inicio < sh.hora_fin
         and not exists (select 1 from public.salon_sesiones z where z.salon_id = s.id) limit 1
    ) y on true
   where s.docente_id = p_docente and s.estado <> 'finalizado'
     and (p_excluir_salon is null or s.id <> p_excluir_salon)
     and s.fecha_inicio <= p_fecha and coalesce(s.fecha_fin_estimada, 'infinity'::date) >= p_fecha
     and (x.hora_inicio is not null or y.hora_inicio is not null);
end $$;

-- Texto legible de los choques de una clase puntual (para los mensajes de error).
create or replace function public.texto_choques_clase(p_docente uuid, p_fecha date, p_inicio time, p_fin time, p_excluir_clase uuid default null, p_excluir_salon uuid default null, p_excluir_reserva uuid default null)
returns text
language sql stable security definer set search_path = '' as $$
  select string_agg(format('%s (%s–%s)', c.titulo, to_char(c.hora_inicio, 'HH24:MI'), to_char(c.hora_fin, 'HH24:MI')), ', ')
    from public.choques_clase_docente(p_docente, p_fecha, p_inicio, p_fin, p_excluir_clase, p_excluir_salon, p_excluir_reserva) c
$$;

-- Calendario: tras mover una sesión, cancelarla o crear una recuperación, el docente del salón no puede quedar ocupado
-- a la vez en otro salón o clase particular. Se valida (1) la sesión que queda en p_fecha/hora y (2) el tramo en que el fin
-- del salón se corrió (p_fin_anterior → fin nuevo). Si choca, la función que llama se revierte entera.
create or replace function public.cal_validar_docente_salon(p_salon uuid, p_fin_anterior date, p_fecha date default null, p_inicio time default null, p_fin time default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_doc uuid; v_est text; v_fin date; v_choques text; v_horarios jsonb;
begin
  select docente_id, estado, fecha_fin_estimada into v_doc, v_est, v_fin from public.salones where id = p_salon;
  if v_doc is null or v_est = 'finalizado' then return; end if;

  if p_fecha is not null then
    v_choques := public.texto_choques_clase(v_doc, p_fecha, p_inicio, p_fin, null, p_salon);
    if v_choques is not null then
      raise exception 'El docente ya está ocupado el % a esa hora: %', to_char(p_fecha, 'DD/MM/YYYY'), v_choques;
    end if;
  end if;

  if p_fin_anterior is not null and v_fin is not null and v_fin > p_fin_anterior then
    select coalesce(jsonb_agg(jsonb_build_object('dia', h.dia, 'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin)), '[]'::jsonb)
      into v_horarios from public.salon_horarios h where h.salon_id = p_salon;
    select string_agg(format('%s (%s %s–%s%s)', c.titulo, public.dia_corto(c.dia), to_char(c.hora_inicio, 'HH24:MI'),
                             to_char(c.hora_fin, 'HH24:MI'), case when c.fecha is not null then ' el ' || to_char(c.fecha, 'DD/MM/YYYY') else '' end), ', ')
      into v_choques
      from public.choques_horario_salon(v_horarios, p_fin_anterior + 1, v_fin, v_doc, p_salon) c;
    if v_choques is not null then
      raise exception 'El salón terminaría el %, pero el docente ya está ocupado después de %: %',
        to_char(v_fin, 'DD/MM/YYYY'), to_char(p_fin_anterior, 'DD/MM/YYYY'), v_choques;
    end if;
  end if;
end $$;

revoke execute on function public.dia_corto(integer), public.proyectar_fin_horarios(jsonb, date, integer),
  public.choques_horario_salon(jsonb, date, date, uuid, uuid, integer),
  public.choques_clase_docente(uuid, date, time, time, uuid, uuid, uuid), public.texto_choques_clase(uuid, date, time, time, uuid, uuid, uuid),
  public.cal_validar_docente_salon(uuid, date, date, time, time) from public, anon, authenticated;
grant execute on function public.dia_corto(integer), public.proyectar_fin_horarios(jsonb, date, integer),
  public.choques_horario_salon(jsonb, date, date, uuid, uuid, integer),
  public.choques_clase_docente(uuid, date, time, time, uuid, uuid, uuid), public.texto_choques_clase(uuid, date, time, time, uuid, uuid, uuid) to authenticated;

-- ============================================================
-- guardar_salon: igual que la versión anterior + bloqueo de docente (al final: si choca, se revierte todo)
-- ============================================================
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
  v_nivel uuid;
  v_codigo text;
  v_plan uuid;
  v_desde smallint;
  v_hasta smallint;
  v_frec uuid;
  v_frec_ant uuid;
  v_n_ciclos integer;
  v_cuota integer;
  v_errores text;
  v_choques text;
  v_doc uuid;
  v_est text;
  v_ini date;
  v_fin date;
begin
  perform public.cal_exigir_admin();

  if p_id is not null then
    perform 1 from public.salones where id = p_id for update;
    select total_sesiones, fecha_inicio, frecuencia_id into v_total_ant, v_inicio_ant, v_frec_ant from public.salones where id = p_id;
    if not found then
      raise exception 'El salón no existe' using errcode = 'P0002';
    end if;
    select count(*) > 0, count(*) filter (where estado = 'realizada')
      into v_hay, v_real from public.salon_sesiones where salon_id = p_id;
  end if;

  -- Nivel académico (obligatorio; si la clave no viene al editar se conserva el actual)
  if p_salon ? 'nivel_id' then
    v_nivel := nullif(p_salon->>'nivel_id', '')::uuid;
  elsif p_id is not null then
    select nivel_id into v_nivel from public.salones where id = p_id;
  end if;
  if v_nivel is null then
    raise exception 'Selecciona el nivel académico del salón';
  end if;
  if not exists (select 1 from public.niveles where id = v_nivel) then
    raise exception 'El nivel académico seleccionado no existe';
  end if;

  -- Plan académico
  if p_salon ? 'plan_id' then
    v_plan := nullif(p_salon->>'plan_id', '')::uuid;
    v_desde := nullif(p_salon->>'ciclo_desde', '')::smallint;
    v_hasta := nullif(p_salon->>'ciclo_hasta', '')::smallint;
  elsif p_id is not null then
    select plan_id, ciclo_desde, ciclo_hasta into v_plan, v_desde, v_hasta from public.salones where id = p_id;
  end if;

  -- Frecuencia
  if p_salon ? 'frecuencia_id' then
    v_frec := nullif(p_salon->>'frecuencia_id', '')::uuid;
  else
    v_frec := v_frec_ant;
  end if;
  if v_frec is not null and v_frec is distinct from v_frec_ant then
    if not exists (select 1 from public.frecuencias where id = v_frec) then
      raise exception 'La frecuencia seleccionada no existe';
    end if;
    if not exists (select 1 from public.frecuencias where id = v_frec and activa and estado_dato = 'confirmado') then
      raise exception 'La frecuencia seleccionada está inactiva o pendiente de confirmación';
    end if;
  end if;

  if v_plan is not null then
    if not exists (select 1 from public.planes_academicos where id = v_plan) then
      raise exception 'El plan académico seleccionado no existe';
    end if;
    if not exists (select 1 from public.planes_academicos where id = v_plan and nivel_id = v_nivel) then
      raise exception 'El plan académico seleccionado no corresponde al nivel del salón';
    end if;
    if v_desde is null then select min(ciclo) into v_desde from public.plan_ciclos where plan_id = v_plan; end if;
    if v_hasta is null then select max(ciclo) into v_hasta from public.plan_ciclos where plan_id = v_plan; end if;
    select count(*), sum(sesiones) into v_n_ciclos, v_cuota
      from public.plan_ciclos where plan_id = v_plan and ciclo between v_desde and v_hasta;
    if v_desde > v_hasta or v_n_ciclos <> v_hasta - v_desde + 1 then
      raise exception 'Los ciclos seleccionados (% a %) no pertenecen al plan', v_desde, v_hasta;
    end if;
    if not v_hay then
      v_total := v_cuota;
    end if;
  else
    v_desde := null;
    v_hasta := null;
  end if;

  if v_plan is not null or v_frec is not null then
    select string_agg(mensaje, ' ') into v_errores from public.validar_horarios_salon(v_plan, v_frec, p_horarios) where severidad = 'error';
    if v_errores is not null then
      raise exception 'Los horarios no corresponden al plan o a la frecuencia. %', v_errores;
    end if;
  end if;

  if p_id is null then
    -- Código automático SAL-0001, SAL-0002… La secuencia es atómica (creaciones simultáneas no repiten número) y el
    -- bucle salta cualquier código ya existente; el índice único sigue siendo la garantía final.
    loop
      v_codigo := 'SAL-' || lpad(nextval('public.salon_codigo_seq')::text, 4, '0');
      exit when not exists (select 1 from public.salones where lower(btrim(codigo)) = lower(v_codigo));
    end loop;

    insert into public.salones (
      codigo, nombre, nivel_id, curso, docente_id, fecha_inicio,
      fecha_fin_estimada, capacidad, estado, observaciones, total_sesiones,
      plan_id, ciclo_desde, ciclo_hasta, frecuencia_id
    ) values (
      v_codigo,
      btrim(p_salon->>'nombre'),
      v_nivel,
      nullif(btrim(p_salon->>'curso'), ''),
      nullif(p_salon->>'docente_id', '')::uuid,
      v_inicio,
      nullif(p_salon->>'fecha_fin_estimada', '')::date,
      (p_salon->>'capacidad')::integer,
      coalesce(nullif(p_salon->>'estado', ''), 'pendiente'),
      nullif(btrim(p_salon->>'observaciones'), ''),
      v_total,
      v_plan, v_desde, v_hasta, v_frec
    ) returning id into v_id;
  else
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
      nombre = btrim(p_salon->>'nombre'),
      nivel_id = v_nivel,
      curso = case when p_salon ? 'curso' then nullif(btrim(p_salon->>'curso'), '') else curso end,
      docente_id = nullif(p_salon->>'docente_id', '')::uuid,
      fecha_inicio = v_inicio,
      fecha_fin_estimada = case when v_hay then fecha_fin_estimada
                                else nullif(p_salon->>'fecha_fin_estimada', '')::date end,
      capacidad = (p_salon->>'capacidad')::integer,
      estado = coalesce(nullif(p_salon->>'estado', ''), 'pendiente'),
      observaciones = nullif(btrim(p_salon->>'observaciones'), ''),
      total_sesiones = v_total,
      plan_id = v_plan, ciclo_desde = v_desde, ciclo_hasta = v_hasta, frecuencia_id = v_frec
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

  -- La fecha de fin nunca se escribe a mano: mientras el salón no tenga sesiones se proyecta desde la fecha de inicio, el
  -- horario y el total de sesiones, con los mismos huecos que usará "Generar calendario" (sin feriados). Si faltan esos datos
  -- queda vacía. Con sesiones la calcula y mantiene el calendario (reprogramaciones, cancelaciones, feriados…).
  if not v_hay then
    select max(fecha_slot) into v_fin from public.cal_slots(v_id, v_inicio, v_total);
    update public.salones set fecha_fin_estimada = v_fin where id = v_id;
  end if;

  -- Bloqueo de docente: no puede estar en dos salones (ni en una clase particular) a la misma hora dentro del mismo rango de fechas.
  select docente_id, estado, fecha_inicio, fecha_fin_estimada into v_doc, v_est, v_ini, v_fin from public.salones where id = v_id;
  if v_doc is not null and v_est <> 'finalizado' then
    select string_agg(format('%s (%s %s–%s%s)', c.titulo, public.dia_corto(c.dia), to_char(c.hora_inicio, 'HH24:MI'),
                             to_char(c.hora_fin, 'HH24:MI'), case when c.fecha is not null then ' el ' || to_char(c.fecha, 'DD/MM/YYYY') else '' end), ', ')
      into v_choques
      from public.choques_horario_salon(
             (select coalesce(jsonb_agg(jsonb_build_object('dia', h.dia, 'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin)), '[]'::jsonb)
                from public.salon_horarios h where h.salon_id = v_id),
             v_ini, v_fin, v_doc, v_id) c;
    if v_choques is not null then
      raise exception 'El docente ya está ocupado en ese horario: %', v_choques;
    end if;
  end if;

  return v_id;
end $$;

revoke execute on function public.guardar_salon(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.guardar_salon(uuid, jsonb, jsonb) to authenticated;

-- ============================================================
-- Clases de paquetes: el docente no puede tener otra clase ni un salón a esa hora
-- ============================================================
create or replace function public.programar_clase(p_paquete uuid, p_fecha date, p_inicio time, p_fin time, p_docente uuid default null, p_nota text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_p public.paquetes_horas; v_id uuid; v_doc uuid; v_choques text;
begin
  perform public.cal_exigir_admin();
  select * into v_p from public.paquetes_horas where id = p_paquete for update;
  if not found then raise exception 'El paquete no existe'; end if;
  if v_p.anulado then raise exception 'El paquete está anulado'; end if;
  if p_fecha is null or p_inicio is null or p_fin is null then raise exception 'Indica fecha y horario de la clase'; end if;
  if p_fin <= p_inicio then raise exception 'La hora de fin debe ser posterior a la de inicio'; end if;
  if v_p.vigencia_hasta is not null and p_fecha > v_p.vigencia_hasta then
    raise exception 'La fecha de la clase es posterior a la vigencia del paquete (%)', v_p.vigencia_hasta;
  end if;
  if exists (select 1 from public.paquete_clases where paquete_id = p_paquete and fecha = p_fecha and estado <> 'cancelada'
             and hora_inicio < p_fin and hora_fin > p_inicio) then
    raise exception 'Ya hay una clase de este paquete que se cruza con ese horario';
  end if;
  v_doc := coalesce(p_docente, v_p.docente_id);
  v_choques := public.texto_choques_clase(v_doc, p_fecha, p_inicio, p_fin, null);
  if v_choques is not null then
    raise exception 'El docente ya está ocupado a esa hora: %', v_choques;
  end if;
  insert into public.paquete_clases (paquete_id, docente_id, fecha, hora_inicio, hora_fin, nota)
  values (p_paquete, v_doc, p_fecha, p_inicio, p_fin, nullif(btrim(p_nota), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.reprogramar_clase(p_clase uuid, p_fecha date, p_inicio time, p_fin time, p_docente uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_c public.paquete_clases; v_p public.paquetes_horas; v_choques text;
begin
  perform public.cal_exigir_admin();
  select paquete_id into v_c.paquete_id from public.paquete_clases where id = p_clase;
  if not found then raise exception 'La clase no existe'; end if;
  select * into v_p from public.paquetes_horas where id = v_c.paquete_id for update;
  select * into v_c from public.paquete_clases where id = p_clase for update;
  if v_c.estado <> 'programada' then raise exception 'Solo se puede reprogramar una clase programada'; end if;
  if p_fin <= p_inicio then raise exception 'La hora de fin debe ser posterior a la de inicio'; end if;
  if v_p.vigencia_hasta is not null and p_fecha > v_p.vigencia_hasta then
    raise exception 'La fecha de la clase es posterior a la vigencia del paquete (%)', v_p.vigencia_hasta;
  end if;
  if exists (select 1 from public.paquete_clases where paquete_id = v_c.paquete_id and id <> p_clase and fecha = p_fecha and estado <> 'cancelada'
             and hora_inicio < p_fin and hora_fin > p_inicio) then
    raise exception 'Ya hay una clase de este paquete que se cruza con ese horario';
  end if;
  v_choques := public.texto_choques_clase(coalesce(p_docente, v_c.docente_id), p_fecha, p_inicio, p_fin, p_clase);
  if v_choques is not null then
    raise exception 'El docente ya está ocupado a esa hora: %', v_choques;
  end if;
  update public.paquete_clases set fecha = p_fecha, hora_inicio = p_inicio, hora_fin = p_fin, docente_id = coalesce(p_docente, docente_id)
   where id = p_clase;
end $$;

-- ============================================================
-- Calendario: cancelar, recuperar y reprogramar sesiones respetan el bloqueo del docente.
-- Igual que las versiones anteriores (20261104) + cal_validar_docente_salon al final.
-- ============================================================
create or replace function public.cancelar_sesion(p_sesion_id uuid, p_nota text default null, p_recuperacion jsonb default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_s record;
  v_fin_ant date;
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

  select fecha_fin_estimada into v_fin_ant from public.salones where id = v_s.salon_id;

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
  perform public.cal_validar_docente_salon(
    v_s.salon_id, v_fin_ant,
    (p_recuperacion->>'fecha')::date, (p_recuperacion->>'hora_inicio')::time, (p_recuperacion->>'hora_fin')::time);
end $$;

create or replace function public.crear_recuperacion(p_cancelada_id uuid, p_fecha date, p_hora_inicio time, p_hora_fin time)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_salon uuid;
  v_fin_ant date;
begin
  perform public.cal_exigir_admin();
  select salon_id into v_salon from public.salon_sesiones where id = p_cancelada_id;
  if not found then
    raise exception 'La sesión no existe';
  end if;
  perform 1 from public.salones where id = v_salon for update;
  select fecha_fin_estimada into v_fin_ant from public.salones where id = v_salon;

  perform public.cal_crear_recuperacion(p_cancelada_id, p_fecha, p_hora_inicio, p_hora_fin);
  perform public.cal_actualizar_fin(v_salon);
  perform public.cal_validar_docente_salon(v_salon, v_fin_ant, p_fecha, p_hora_inicio, p_hora_fin);
end $$;

create or replace function public.reprogramar_sesion(p_sesion_id uuid, p_fecha date, p_hora_inicio time, p_hora_fin time, p_nota text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_s record;
  v_inicio date;
  v_feriado text;
  v_fin_ant date;
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
  select fecha_inicio, fecha_fin_estimada into v_inicio, v_fin_ant from public.salones where id = v_s.salon_id;
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
  perform public.cal_validar_docente_salon(v_s.salon_id, v_fin_ant, p_fecha, p_hora_inicio, p_hora_fin);
end $$;

revoke execute on function public.cancelar_sesion(uuid, text, jsonb), public.crear_recuperacion(uuid, date, time, time),
  public.reprogramar_sesion(uuid, date, time, time, text) from public, anon;
grant execute on function public.cancelar_sesion(uuid, text, jsonb), public.crear_recuperacion(uuid, date, time, time),
  public.reprogramar_sesion(uuid, date, time, time, text) to authenticated;

-- ============================================================
-- Estados automáticos: Planificado → En curso al llegar la fecha de inicio.
-- «Finalizado» NO es automático (libera al docente y cierra matrículas): la interfaz lo sugiere y lo confirma una persona.
-- Sin pg_cron: la pantalla de salones la ejecuta al cargar. Idempotente; si no eres admin no hace nada.
-- ============================================================
create or replace function public.sincronizar_estados_salones() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  if not (select public.es_admin()) then return 0; end if;
  update public.salones set estado = 'en_curso'
   where estado = 'pendiente' and archivado_at is null and fecha_inicio <= public.hoy_lima();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke execute on function public.sincronizar_estados_salones() from public, anon;
grant execute on function public.sincronizar_estados_salones() to authenticated;

-- ============================================================
-- Buscador de docente libre: quién está ocupado en una fecha y franja concretas (examen de nivel, entrevista, etc.).
-- Misma lógica que choques_clase_docente pero para todos los docentes: clases particulares, sesiones reales de salones
-- con calendario y, si el salón aún no tiene calendario, su horario semanal. Solo lectura.
-- ============================================================
create or replace function public.docentes_ocupados_franja(p_fecha date, p_inicio time, p_fin time)
returns table (docente_id uuid, origen text, titulo text, hora_inicio time, hora_fin time)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  if p_fecha is null or p_inicio is null or p_fin is null or p_fin <= p_inicio then return; end if;
  return query
  select pc.docente_id, 'paquete'::text, 'Clase particular · ' || coalesce(a.nombre, 'alumno'), pc.hora_inicio, pc.hora_fin
    from public.paquete_clases pc
    join public.paquetes_horas p on p.id = pc.paquete_id and not p.anulado
    left join public.alumnos a on a.id = p.alumno_id
   where pc.docente_id is not null and pc.fecha = p_fecha and pc.estado <> 'cancelada'
     and pc.hora_inicio < p_fin and p_inicio < pc.hora_fin
  union all
  select r.docente_id, 'reserva'::text, public.reserva_titulo(r.tipo, r.titulo), r.hora_inicio, r.hora_fin
    from public.reservas_docente r
   where r.fecha = p_fecha and r.estado = 'programada' and r.hora_inicio < p_fin and p_inicio < r.hora_fin
  union all
  select s.docente_id, 'salon'::text, s.nombre, coalesce(x.hora_inicio, y.hora_inicio), coalesce(x.hora_fin, y.hora_fin)
    from public.salones s
    left join lateral (
      select ss.hora_inicio, ss.hora_fin from public.salon_sesiones ss
       where ss.salon_id = s.id and ss.fecha = p_fecha and ss.estado <> 'cancelada'
         and ss.hora_inicio < p_fin and p_inicio < ss.hora_fin limit 1
    ) x on true
    left join lateral (
      select sh.hora_inicio, sh.hora_fin from public.salon_horarios sh
       where sh.salon_id = s.id and sh.dia = extract(isodow from p_fecha)::smallint
         and sh.hora_inicio < p_fin and p_inicio < sh.hora_fin
         and not exists (select 1 from public.salon_sesiones z where z.salon_id = s.id) limit 1
    ) y on true
   where s.docente_id is not null and s.estado <> 'finalizado'
     and s.fecha_inicio <= p_fecha and coalesce(s.fecha_fin_estimada, 'infinity'::date) >= p_fecha
     and (x.hora_inicio is not null or y.hora_inicio is not null);
end $$;

revoke execute on function public.docentes_ocupados_franja(date, time, time) from public, anon;
grant execute on function public.docentes_ocupados_franja(date, time, time) to authenticated;

-- ============================================================
-- Reservas de docente: crear, reprogramar y cancelar
-- Reglas (todas rechazan con un mensaje claro y no dejan nada a medias):
--   * docente existente y activo · fecha y horas completas · fin posterior al inicio
--   * no en el pasado (hoy solo si la hora de fin aún no pasó, hora de Lima) · no en feriado
--   * el docente no puede tener a esa hora una clase particular, una sesión de salón ni otra reserva
-- La disponibilidad semanal que marcó el docente es solo informativa: la muestra la pantalla, no bloquea.
-- ============================================================
create or replace function public.reserva_validar(p_docente uuid, p_fecha date, p_inicio time, p_fin time, p_excluir uuid default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_activo boolean; v_feriado text; v_choques text; v_ahora time := (now() at time zone 'America/Lima')::time;
begin
  if p_docente is null then raise exception 'Elige el docente'; end if;
  if p_fecha is null or p_inicio is null or p_fin is null then raise exception 'Indica la fecha y el horario'; end if;
  if p_fin <= p_inicio then raise exception 'La hora de fin debe ser posterior a la de inicio'; end if;

  select activo into v_activo from public.docentes where id = p_docente;
  if not found then raise exception 'El docente no existe'; end if;
  if not v_activo then raise exception 'El docente está inactivo'; end if;

  if p_fecha < public.hoy_lima() or (p_fecha = public.hoy_lima() and p_fin <= v_ahora) then
    raise exception 'No se puede reservar en el pasado';
  end if;
  select nombre into v_feriado from public.feriados where fecha = p_fecha;
  if found then raise exception 'La fecha elegida es feriado (%)', v_feriado; end if;

  v_choques := public.texto_choques_clase(p_docente, p_fecha, p_inicio, p_fin, null, null, p_excluir);
  if v_choques is not null then
    raise exception 'El docente ya está ocupado a esa hora: %', v_choques;
  end if;
end $$;

create or replace function public.crear_reserva_docente(p_docente uuid, p_fecha date, p_inicio time, p_fin time, p_tipo text, p_titulo text default null, p_nota text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.cal_exigir_admin();
  if p_tipo is null or p_tipo not in ('examen_nivel', 'entrevista', 'reunion', 'otro') then raise exception 'Elige el tipo de reserva'; end if;
  if p_tipo = 'otro' and nullif(btrim(p_titulo), '') is null then raise exception 'Indica el motivo de la reserva'; end if;
  -- Se bloquea la fila del docente: dos reservas simultáneas para la misma persona se procesan una tras otra.
  perform 1 from public.docentes where id = p_docente for update;
  perform public.reserva_validar(p_docente, p_fecha, p_inicio, p_fin, null);
  insert into public.reservas_docente (docente_id, fecha, hora_inicio, hora_fin, tipo, titulo, nota)
  values (p_docente, p_fecha, p_inicio, p_fin, p_tipo, nullif(btrim(p_titulo), ''), nullif(btrim(p_nota), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.reprogramar_reserva_docente(p_reserva uuid, p_fecha date, p_inicio time, p_fin time)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_r public.reservas_docente;
begin
  perform public.cal_exigir_admin();
  select * into v_r from public.reservas_docente where id = p_reserva;
  if not found then raise exception 'La reserva no existe'; end if;
  perform 1 from public.docentes where id = v_r.docente_id for update;
  select * into v_r from public.reservas_docente where id = p_reserva for update;
  if v_r.estado <> 'programada' then raise exception 'Solo se puede reprogramar una reserva programada'; end if;
  perform public.reserva_validar(v_r.docente_id, p_fecha, p_inicio, p_fin, p_reserva);
  update public.reservas_docente set fecha = p_fecha, hora_inicio = p_inicio, hora_fin = p_fin where id = p_reserva;
end $$;

create or replace function public.cancelar_reserva_docente(p_reserva uuid, p_motivo text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_estado text;
begin
  perform public.cal_exigir_admin();
  select estado into v_estado from public.reservas_docente where id = p_reserva for update;
  if not found then raise exception 'La reserva no existe'; end if;
  if v_estado <> 'programada' then raise exception 'La reserva ya estaba cancelada'; end if;
  update public.reservas_docente set estado = 'cancelada', motivo_cancelacion = nullif(btrim(p_motivo), '') where id = p_reserva;
end $$;

revoke execute on function public.reserva_titulo(text, text), public.reserva_validar(uuid, date, time, time, uuid),
  public.crear_reserva_docente(uuid, date, time, time, text, text, text),
  public.reprogramar_reserva_docente(uuid, date, time, time), public.cancelar_reserva_docente(uuid, text) from public, anon, authenticated;
grant execute on function public.crear_reserva_docente(uuid, date, time, time, text, text, text),
  public.reprogramar_reserva_docente(uuid, date, time, time), public.cancelar_reserva_docente(uuid, text) to authenticated;
