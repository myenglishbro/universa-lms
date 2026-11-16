-- UNIVERSA · Crear el salón de un paquete que se registró antes de que los paquetes tuvieran salón.
-- Mismas validaciones que registrar_paquete_salon (guardar_salon: plan, frecuencia, choque de docente). Todo o nada.
-- Repetible. Requiere 20261206100000 y 20261206110000.
create or replace function public.crear_salon_paquete(p_paquete uuid, p_salon jsonb, p_horarios jsonb default '[]'::jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.paquetes_horas;
  v_nombre text;
  v_datos jsonb;
  v_clase integer;
  v_salon uuid;
begin
  perform public.cal_exigir_admin();
  select * into v_p from public.paquetes_horas where id = p_paquete for update;
  if not found then raise exception 'El paquete no existe'; end if;
  if v_p.salon_id is not null then raise exception 'Este paquete ya tiene salón'; end if;
  if v_p.anulado then raise exception 'El paquete está anulado'; end if;
  select nombre into v_nombre from public.alumnos where id = v_p.alumno_id;
  v_datos := jsonb_set(
    jsonb_set(p_salon, '{capacidad}', '1'::jsonb),
    '{nombre}', to_jsonb(coalesce(nullif(btrim(p_salon->>'nombre'), ''), 'Private · ' || v_nombre)));
  if nullif(p_salon->>'total_sesiones', '') is null and nullif(p_salon->>'plan_id', '') is null
     and jsonb_array_length(coalesce(p_horarios, '[]'::jsonb)) > 0 then
    v_clase := (extract(epoch from ((p_horarios->0->>'hora_fin')::time - (p_horarios->0->>'hora_inicio')::time)) / 60)::integer;
    if v_clase > 0 then
      v_datos := jsonb_set(v_datos, '{total_sesiones}', to_jsonb(ceil(v_p.minutos_contratados::numeric / v_clase)::integer));
    end if;
  end if;
  v_salon := public.guardar_salon(null, v_datos, p_horarios);
  perform public.matricular_alumnos(v_salon, array[v_p.alumno_id]);
  update public.paquetes_horas set salon_id = v_salon where id = p_paquete;
  return v_salon;
end $$;
revoke execute on function public.crear_salon_paquete(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.crear_salon_paquete(uuid, jsonb, jsonb) to authenticated;
