-- Fase 2 · Integración del catálogo académico con los salones.
-- Aditiva y repetible (idempotente): añade 3 columnas NULAS a salones (los salones existentes quedan sin plan, igual que hoy),
-- una función de validación de horarios (solo lectura) y reemplaza guardar_salon conservando todo su comportamiento anterior.
-- No se modifica ni se regenera ningún calendario al ejecutar esto.
begin;

-- ============================================================
-- 1. Vínculo del salón con un plan académico y los ciclos que cursa
-- ============================================================
alter table public.salones
  add column if not exists plan_id uuid,
  add column if not exists ciclo_desde smallint,
  add column if not exists ciclo_hasta smallint;

alter table public.salones drop constraint if exists salones_plan_ciclos_ck;
alter table public.salones add constraint salones_plan_ciclos_ck check (
  (plan_id is null and ciclo_desde is null and ciclo_hasta is null)
  or (plan_id is not null and ciclo_desde is not null and ciclo_hasta is not null and ciclo_desde <= ciclo_hasta)
);

-- Sin ON DELETE: un plan usado por un salón no puede borrarse (la historia se conserva con versiones nuevas).
alter table public.salones drop constraint if exists salones_plan_fk;
alter table public.salones add constraint salones_plan_fk
  foreign key (plan_id) references public.planes_academicos(id);
-- Los ciclos elegidos deben pertenecer al nivel del plan (cuotas definidas en plan_ciclos).
alter table public.salones drop constraint if exists salones_ciclo_desde_fk;
alter table public.salones add constraint salones_ciclo_desde_fk
  foreign key (plan_id, ciclo_desde) references public.plan_ciclos(plan_id, ciclo);
alter table public.salones drop constraint if exists salones_ciclo_hasta_fk;
alter table public.salones add constraint salones_ciclo_hasta_fk
  foreign key (plan_id, ciclo_hasta) references public.plan_ciclos(plan_id, ciclo);

create index if not exists salones_plan_idx on public.salones (plan_id);

-- ============================================================
-- 2. Validación de horarios contra un plan (solo lectura; no cambia nada)
-- ============================================================
-- p_horarios: [{"dia":1,"hora_inicio":"18:00","hora_fin":"19:30"}, ...] (mismo formato que guardar_salon).
-- 'error'       la duración de la clase o las clases por semana no corresponden al plan.
-- 'advertencia' la duración y la cantidad son correctas pero los días no coinciden con un horario estándar del plan.
create or replace function public.validar_horarios_plan(p_plan_id uuid, p_horarios jsonb)
returns table (severidad text, mensaje text)
language plpgsql stable set search_path = '' as $$
declare
  v_min smallint;
  v_spw smallint;
  v_n integer;
  v_malas integer;
  v_dias smallint[];
  v_patrones text;
begin
  select p.minutos_clase, p.sesiones_semana into v_min, v_spw from public.planes_academicos p where p.id = p_plan_id;
  if not found then
    raise exception 'El plan académico no existe';
  end if;

  select count(*) into v_n from jsonb_array_elements(coalesce(p_horarios, '[]'::jsonb));
  if v_n = 0 then
    return;
  end if;

  select count(*) into v_malas from jsonb_array_elements(p_horarios) h
  where extract(epoch from ((h->>'hora_fin')::time - (h->>'hora_inicio')::time)) / 60 <> v_min;
  if v_malas > 0 then
    return query select 'error'::text,
      format('%s clase(s) no duran %s minutos, que es la duración del plan.', v_malas, v_min);
  end if;

  if v_n <> v_spw then
    return query select 'error'::text,
      format('El plan exige %s clase(s) por semana y el salón tiene %s.', v_spw, v_n);
  end if;

  if v_malas = 0 and v_n = v_spw then
    select array_agg(d order by d) into v_dias from (select distinct (h->>'dia')::smallint as d from jsonb_array_elements(p_horarios) h) x;
    if not exists (
      select 1 from public.horario_patrones hp
      where hp.minutos_clase = v_min and hp.sesiones_semana = v_spw and hp.dias @> v_dias and hp.dias <@ v_dias
    ) then
      select string_agg(hp.nombre, ' o ' order by hp.codigo) into v_patrones
      from public.horario_patrones hp where hp.minutos_clase = v_min and hp.sesiones_semana = v_spw;
      return query select 'advertencia'::text,
        format('Los días no coinciden con un horario estándar del plan (%s).', coalesce(v_patrones, 'sin horario definido'));
    end if;
  end if;
end $$;

revoke execute on function public.validar_horarios_plan(uuid, jsonb) from public, anon;
grant execute on function public.validar_horarios_plan(uuid, jsonb) to authenticated;

-- ============================================================
-- 3. guardar_salon con plan académico
-- ============================================================
-- Mismo contrato y mismas reglas de calendario que la versión anterior, más:
--  * plan_id / ciclo_desde / ciclo_hasta opcionales. Si la clave plan_id no viene en p_salon, se conserva el plan actual.
--  * Con plan: los ciclos deben pertenecer al plan (por omisión, el nivel completo) y los horarios no pueden contradecir
--    la duración ni las clases por semana del plan.
--  * Con plan y SIN sesiones registradas: total_sesiones = suma de sesiones de los ciclos elegidos (la fuente es el catálogo).
--  * Con sesiones registradas el total NO se cambia solo (no se regenera el calendario por vincular un plan):
--    se respeta el valor enviado y sus validaciones habituales.
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
  v_plan uuid;
  v_desde smallint;
  v_hasta smallint;
  v_n_ciclos integer;
  v_cuota integer;
  v_errores text;
begin
  perform public.cal_exigir_admin();

  if p_id is not null then
    perform 1 from public.salones where id = p_id for update;
    select total_sesiones, fecha_inicio into v_total_ant, v_inicio_ant from public.salones where id = p_id;
    if not found then
      raise exception 'El salón no existe' using errcode = 'P0002';
    end if;
    select count(*) > 0, count(*) filter (where estado = 'realizada')
      into v_hay, v_real from public.salon_sesiones where salon_id = p_id;
  end if;

  -- Plan académico
  if p_salon ? 'plan_id' then
    v_plan := nullif(p_salon->>'plan_id', '')::uuid;
    v_desde := nullif(p_salon->>'ciclo_desde', '')::smallint;
    v_hasta := nullif(p_salon->>'ciclo_hasta', '')::smallint;
  elsif p_id is not null then
    select plan_id, ciclo_desde, ciclo_hasta into v_plan, v_desde, v_hasta from public.salones where id = p_id;
  end if;

  if v_plan is not null then
    if not exists (select 1 from public.planes_academicos where id = v_plan) then
      raise exception 'El plan académico seleccionado no existe';
    end if;
    if v_desde is null then select min(ciclo) into v_desde from public.plan_ciclos where plan_id = v_plan; end if;
    if v_hasta is null then select max(ciclo) into v_hasta from public.plan_ciclos where plan_id = v_plan; end if;
    select count(*), sum(sesiones) into v_n_ciclos, v_cuota
      from public.plan_ciclos where plan_id = v_plan and ciclo between v_desde and v_hasta;
    if v_desde > v_hasta or v_n_ciclos <> v_hasta - v_desde + 1 then
      raise exception 'Los ciclos seleccionados (% a %) no pertenecen al plan', v_desde, v_hasta;
    end if;

    select string_agg(mensaje, ' ') into v_errores from public.validar_horarios_plan(v_plan, p_horarios) where severidad = 'error';
    if v_errores is not null then
      raise exception 'Los horarios no corresponden al plan académico. %', v_errores;
    end if;

    if not v_hay then
      v_total := v_cuota;
    end if;
  else
    v_desde := null;
    v_hasta := null;
  end if;

  if p_id is null then
    insert into public.salones (
      codigo, nombre, programa_id, curso, docente_id, fecha_inicio,
      fecha_fin_estimada, capacidad, estado, observaciones, total_sesiones,
      plan_id, ciclo_desde, ciclo_hasta
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
      v_total,
      v_plan, v_desde, v_hasta
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
      total_sesiones = v_total,
      plan_id = v_plan, ciclo_desde = v_desde, ciclo_hasta = v_hasta
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

revoke execute on function public.guardar_salon(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.guardar_salon(uuid, jsonb, jsonb) to authenticated;

commit;
