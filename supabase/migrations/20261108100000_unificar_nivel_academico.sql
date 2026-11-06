-- UNIVERSA · Unificación de la clasificación académica: el nivel (tabla niveles) reemplaza al programa en los salones.
--
-- Decisión: la clasificación oficial es Funcional, Básico, Intermedio, Intermedio Alto, Avanzado, Proficiente y Master
-- (tabla niveles). Esta migración NO inventa equivalencias entre los programas antiguos y los niveles.
--
--  * salones.nivel_id (FK a niveles). Los salones que ya tienen plan académico reciben el nivel de su plan (dato explícito,
--    no una suposición). Los demás quedan con nivel_id NULL = «Sin nivel asignado»: se reclasifican al editarlos.
--  * salones.programa_id deja de ser obligatorio y deja de escribirse. La columna y la tabla programas se CONSERVAN
--    (con los valores antiguos) como referencia para la reclasificación; no se elimina nada.
--  * guardar_salon exige nivel_id y comprueba que el plan elegido pertenezca a ese nivel. Sesiones, ciclos, evaluaciones,
--    recesos, frecuencias y horarios no cambian.
--
-- Repetible: cada paso es idempotente (el SQL Editor no ejecuta el archivo como una sola transacción).
-- Requiere las migraciones 20261105 (catálogo), 20261106 (plan en salón) y 20261107 (frecuencias).

alter table public.salones add column if not exists nivel_id uuid;

alter table public.salones drop constraint if exists salones_nivel_fk;
alter table public.salones
  add constraint salones_nivel_fk foreign key (nivel_id) references public.niveles(id);

create index if not exists salones_nivel_idx on public.salones (nivel_id);

-- Salones con plan: su nivel es el del plan.
update public.salones s
   set nivel_id = p.nivel_id
  from public.planes_academicos p
 where s.plan_id = p.id and s.nivel_id is null;

-- El programa antiguo ya no es obligatorio (se conserva para consulta).
alter table public.salones alter column programa_id drop not null;

-- guardar_salon: igual que la versión con frecuencias, pero con nivel_id en lugar de programa_id.
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
  v_plan uuid;
  v_desde smallint;
  v_hasta smallint;
  v_frec uuid;
  v_frec_ant uuid;
  v_n_ciclos integer;
  v_cuota integer;
  v_errores text;
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
    insert into public.salones (
      codigo, nombre, nivel_id, curso, docente_id, fecha_inicio,
      fecha_fin_estimada, capacidad, estado, observaciones, total_sesiones,
      plan_id, ciclo_desde, ciclo_hasta, frecuencia_id
    ) values (
      btrim(p_salon->>'codigo'),
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
      codigo = btrim(p_salon->>'codigo'),
      nombre = btrim(p_salon->>'nombre'),
      nivel_id = v_nivel,
      curso = nullif(btrim(p_salon->>'curso'), ''),
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

  return v_id;
end $$;

revoke execute on function public.guardar_salon(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.guardar_salon(uuid, jsonb, jsonb) to authenticated;
