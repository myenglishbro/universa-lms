-- UNIVERSA · Borrado controlado del historial de movimientos de un paquete.
-- Error corregido: «El historial de movimientos no se puede modificar ni borrar» al eliminar un paquete (o un salón con paquete).
-- El historial sigue siendo inmutable para modificaciones y para cualquier borrado normal. Solo se permite borrar cuando la
-- transacción activa la marca local `universa.borrado_paquetes` (la activan únicamente las funciones eliminar_paquete y
-- eliminar_salon, que son solo de administradores, y dura lo que la transacción).
-- Repetible. Requiere 20261206130000 y 20261206140000 (las vuelve a definir con esta marca).

create or replace function public.paquete_movimientos_inmutable() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('universa.borrado_paquetes', true) = 'on' then
    return old;
  end if;
  raise exception 'El historial de movimientos no se puede modificar ni borrar; registra un ajuste o una corrección';
end $$;

-- Borra los datos de los paquetes indicados (historial incluido). Interna: la llaman las funciones de administración.
create or replace function public.borrar_datos_paquetes(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('universa.borrado_paquetes', 'on', true);
  update public.paquetes_horas set paquete_origen_id = null where paquete_origen_id = any(p_ids);
  delete from public.paquete_movimientos where paquete_id = any(p_ids);
  delete from public.paquete_pagos where paquete_id = any(p_ids);
  delete from public.paquete_clases where paquete_id = any(p_ids);
  delete from public.paquetes_horas where id = any(p_ids);
  perform set_config('universa.borrado_paquetes', 'off', true);
end $$;
revoke all on function public.borrar_datos_paquetes(uuid[]) from public, anon, authenticated;

create or replace function public.eliminar_paquete(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.paquetes_horas;
  v_resultado text := 'eliminado';
begin
  perform public.cal_exigir_admin();
  select * into v_p from public.paquetes_horas where id = p_id for update;
  if not found then raise exception 'El paquete no existe'; end if;

  perform public.borrar_datos_paquetes(array[p_id]);

  if v_p.salon_id is not null and not exists (select 1 from public.paquetes_horas where salon_id = v_p.salon_id) then
    update public.matriculas set estado = 'retirada', fecha_fin = public.hoy_lima(), motivo_retiro = 'Paquete eliminado'
     where salon_id = v_p.salon_id and estado = 'activa';
    begin
      perform public.eliminar_salon(v_p.salon_id);
    exception when others then
      update public.salones set estado = 'finalizado' where id = v_p.salon_id;
      v_resultado := 'finalizado';
    end;
  end if;
  return v_resultado;
end $$;
revoke execute on function public.eliminar_paquete(uuid) from public, anon;
grant execute on function public.eliminar_paquete(uuid) to authenticated;

create or replace function public.eliminar_salon(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();

  perform 1 from public.salones where id = p_id for update;
  if not found then
    raise exception 'El salón no existe' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.matriculas where salon_id = p_id and estado = 'activa')
     and not exists (select 1 from public.paquetes_horas where salon_id = p_id) then
    raise exception 'No se puede eliminar: el salón tiene estudiantes activos. Retíralos primero.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.ejercicio_asignaciones where salon_id = p_id) then
    raise exception 'No se puede eliminar: el salón tiene ejercicios asignados.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.archivo_alumnos where salon_id = p_id) then
    raise exception 'No se puede eliminar: el salón tiene historial archivado.' using errcode = 'P0001';
  end if;

  perform public.borrar_datos_paquetes(array(select id from public.paquetes_horas where salon_id = p_id));

  update public.matriculas set matricula_origen_id = null
   where matricula_origen_id in (select id from public.matriculas where salon_id = p_id);
  delete from public.matriculas where salon_id = p_id;
  delete from public.salones where id = p_id;
end $$;
