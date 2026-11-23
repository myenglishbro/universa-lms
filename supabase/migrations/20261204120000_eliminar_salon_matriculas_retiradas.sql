-- Eliminar salón: las matrículas retiradas ya no lo bloquean; se borran junto con el salón.
-- Solo se rechaza si hay estudiantes con matrícula activa, ejercicios activos o historial archivado.
create or replace function public.eliminar_salon(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();

  perform 1 from public.salones where id = p_id for update;
  if not found then
    raise exception 'El salón no existe' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.matriculas where salon_id = p_id and estado = 'activa') then
    raise exception 'No se puede eliminar: el salón tiene estudiantes matriculados. Retíralos primero o cambia el estado a Finalizado.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.ejercicio_asignaciones where salon_id = p_id and activa) then
    raise exception 'No se puede eliminar: el salón tiene ejercicios asignados.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.archivo_alumnos where salon_id = p_id) then
    raise exception 'No se puede eliminar: el salón tiene historial archivado.' using errcode = 'P0001';
  end if;

  delete from public.ejercicio_asignaciones where salon_id = p_id and not activa;
  -- Matrículas retiradas: se desvincula cualquier matrícula posterior que viniera de ellas y se borran.
  update public.matriculas set matricula_origen_id = null
   where matricula_origen_id in (select id from public.matriculas where salon_id = p_id);
  delete from public.matriculas where salon_id = p_id;
  delete from public.salones where id = p_id;
end $$;

revoke all on function public.eliminar_salon(uuid) from public, anon;
grant execute on function public.eliminar_salon(uuid) to authenticated;
