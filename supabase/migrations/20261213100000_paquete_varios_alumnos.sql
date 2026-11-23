-- UNIVERSA · Un paquete de horas privado puede tener más de un estudiante (pareja, hermanos, grupo pequeño).
--
--  * El paquete sigue teniendo un titular (paquetes_horas.alumno_id: quien lo compra). Los demás estudiantes se matriculan en
--    el salón del paquete; las horas son del salón (se descuentan una vez por clase, no por estudiante).
--  * registrar_paquete_salon y crear_salon_paquete reciben los estudiantes adicionales (p_extra) y fijan la capacidad del salón
--    en 1 + adicionales (antes siempre 1).
--  * agregar_alumnos_paquete: suma estudiantes a un paquete que ya tiene salón (sube la capacidad lo necesario).
--
-- Repetible. Requiere 20261206100000, 20261206110000 y 20261206120000.

drop function if exists public.registrar_paquete_salon(jsonb, jsonb, jsonb);
create or replace function public.registrar_paquete_salon(p_paquete jsonb, p_salon jsonb default null, p_horarios jsonb default '[]'::jsonb, p_extra uuid[] default '{}')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_alumno uuid := nullif(p_paquete->>'alumno_id', '')::uuid;
  v_origen uuid := nullif(p_paquete->>'paquete_origen_id', '')::uuid;
  v_extra uuid[];
  v_salon uuid;
  v_nombre text;
  v_datos jsonb;
  v_clase integer;
  v_id uuid;
begin
  perform public.cal_exigir_admin();
  if v_alumno is null or not exists (select 1 from public.alumnos where id = v_alumno) then raise exception 'Selecciona un alumno'; end if;
  v_extra := array(select distinct x from unnest(coalesce(p_extra, '{}')) x where x is not null and x <> v_alumno);

  if p_salon is null then
    if v_origen is not null then
      select salon_id into v_salon from public.paquetes_horas where id = v_origen;
    end if;
  else
    select nombre into v_nombre from public.alumnos where id = v_alumno;
    v_datos := jsonb_set(
      jsonb_set(p_salon, '{capacidad}', to_jsonb(1 + coalesce(array_length(v_extra, 1), 0))),
      '{nombre}', to_jsonb(coalesce(nullif(btrim(p_salon->>'nombre'), ''), 'Private · ' || v_nombre
        || case when coalesce(array_length(v_extra, 1), 0) > 0 then ' +' || array_length(v_extra, 1) else '' end)));
    if nullif(p_salon->>'total_sesiones', '') is null and nullif(p_salon->>'plan_id', '') is null
       and coalesce(nullif(p_paquete->>'horas', '')::numeric, 0) > 0 and jsonb_array_length(coalesce(p_horarios, '[]'::jsonb)) > 0 then
      v_clase := (extract(epoch from ((p_horarios->0->>'hora_fin')::time - (p_horarios->0->>'hora_inicio')::time)) / 60)::integer;
      if v_clase > 0 then
        v_datos := jsonb_set(v_datos, '{total_sesiones}', to_jsonb(ceil((p_paquete->>'horas')::numeric * 60 / v_clase)::integer));
      end if;
    end if;
    v_salon := public.guardar_salon(null, v_datos, p_horarios);
    perform public.matricular_alumnos(v_salon, array[v_alumno] || v_extra);
  end if;

  v_id := public.registrar_paquete(p_paquete);
  if v_salon is not null then
    update public.paquetes_horas set salon_id = v_salon where id = v_id;
  end if;
  return v_id;
end $$;

revoke execute on function public.registrar_paquete_salon(jsonb, jsonb, jsonb, uuid[]) from public, anon;
grant execute on function public.registrar_paquete_salon(jsonb, jsonb, jsonb, uuid[]) to authenticated;

drop function if exists public.crear_salon_paquete(uuid, jsonb, jsonb);
create or replace function public.crear_salon_paquete(p_paquete uuid, p_salon jsonb, p_horarios jsonb default '[]'::jsonb, p_extra uuid[] default '{}') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.paquetes_horas;
  v_nombre text;
  v_datos jsonb;
  v_clase integer;
  v_salon uuid;
  v_extra uuid[];
begin
  perform public.cal_exigir_admin();
  select * into v_p from public.paquetes_horas where id = p_paquete for update;
  if not found then raise exception 'El paquete no existe'; end if;
  if v_p.salon_id is not null then raise exception 'Este paquete ya tiene salón'; end if;
  if v_p.anulado then raise exception 'El paquete está anulado'; end if;
  v_extra := array(select distinct x from unnest(coalesce(p_extra, '{}')) x where x is not null and x <> v_p.alumno_id);
  select nombre into v_nombre from public.alumnos where id = v_p.alumno_id;
  v_datos := jsonb_set(
    jsonb_set(p_salon, '{capacidad}', to_jsonb(1 + coalesce(array_length(v_extra, 1), 0))),
    '{nombre}', to_jsonb(coalesce(nullif(btrim(p_salon->>'nombre'), ''), 'Private · ' || v_nombre
      || case when coalesce(array_length(v_extra, 1), 0) > 0 then ' +' || array_length(v_extra, 1) else '' end)));
  if nullif(p_salon->>'total_sesiones', '') is null and nullif(p_salon->>'plan_id', '') is null
     and jsonb_array_length(coalesce(p_horarios, '[]'::jsonb)) > 0 then
    v_clase := (extract(epoch from ((p_horarios->0->>'hora_fin')::time - (p_horarios->0->>'hora_inicio')::time)) / 60)::integer;
    if v_clase > 0 then
      v_datos := jsonb_set(v_datos, '{total_sesiones}', to_jsonb(ceil(v_p.minutos_contratados::numeric / v_clase)::integer));
    end if;
  end if;
  v_salon := public.guardar_salon(null, v_datos, p_horarios);
  perform public.matricular_alumnos(v_salon, array[v_p.alumno_id] || v_extra);
  update public.paquetes_horas set salon_id = v_salon where id = p_paquete;
  return v_salon;
end $$;

revoke execute on function public.crear_salon_paquete(uuid, jsonb, jsonb, uuid[]) from public, anon;
grant execute on function public.crear_salon_paquete(uuid, jsonb, jsonb, uuid[]) to authenticated;

-- Suma estudiantes a un paquete que ya tiene salón. La capacidad sube lo necesario (los paquetes no tienen cupos fijos).
create or replace function public.agregar_alumnos_paquete(p_paquete uuid, p_alumnos uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.paquetes_horas;
  v_ids uuid[] := array(select distinct x from unnest(coalesce(p_alumnos, '{}')) x where x is not null);
  v_activos integer;
begin
  perform public.cal_exigir_admin();
  if coalesce(array_length(v_ids, 1), 0) = 0 then raise exception 'Selecciona al menos un estudiante'; end if;
  select * into v_p from public.paquetes_horas where id = p_paquete;
  if not found then raise exception 'El paquete no existe'; end if;
  if v_p.anulado then raise exception 'El paquete está anulado'; end if;
  if v_p.salon_id is null then raise exception 'Este paquete aún no tiene salón: créalo primero'; end if;
  perform 1 from public.salones where id = v_p.salon_id for update;
  select count(*) into v_activos from public.matriculas where salon_id = v_p.salon_id and estado = 'activa';
  update public.salones set capacidad = greatest(capacidad, v_activos + array_length(v_ids, 1)) where id = v_p.salon_id;
  return public.matricular_alumnos(v_p.salon_id, v_ids);
end $$;

revoke execute on function public.agregar_alumnos_paquete(uuid, uuid[]) from public, anon;
grant execute on function public.agregar_alumnos_paquete(uuid, uuid[]) to authenticated;
