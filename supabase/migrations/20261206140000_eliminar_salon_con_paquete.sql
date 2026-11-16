-- UNIVERSA · Eliminar un salón que pertenece a un paquete de horas.
-- Error corregido: «update or delete on table "salones" violates foreign key constraint "paquetes_horas_salon_id_fkey»:
-- eliminar_salon intentaba borrar el salón mientras su paquete seguía apuntando a él.
-- Ahora, al eliminar el salón también se eliminan los paquetes enlazados (con su historial), igual que eliminar_paquete
-- elimina el salón del paquete. Sigue rechazando salones con ejercicios asignados o historial archivado (todo o nada).
-- Igual que 20261204120000_eliminar_salon_retirados.sql + borrado de los paquetes del salón.
-- Repetible. Requiere 20261206100000.
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

  -- Paquetes del salón: se borran con su historial (el estudiante de un salón de paquete se retira solo).
  update public.paquetes_horas set paquete_origen_id = null
   where paquete_origen_id in (select id from public.paquetes_horas where salon_id = p_id);
  delete from public.paquete_movimientos where paquete_id in (select id from public.paquetes_horas where salon_id = p_id);
  delete from public.paquete_pagos where paquete_id in (select id from public.paquetes_horas where salon_id = p_id);
  delete from public.paquete_clases where paquete_id in (select id from public.paquetes_horas where salon_id = p_id);
  delete from public.paquetes_horas where salon_id = p_id;

  update public.matriculas set matricula_origen_id = null
   where matricula_origen_id in (select id from public.matriculas where salon_id = p_id);
  delete from public.matriculas where salon_id = p_id;
  delete from public.salones where id = p_id;
end $$;
