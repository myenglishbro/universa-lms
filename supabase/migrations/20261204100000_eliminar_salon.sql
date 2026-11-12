-- Eliminar un salón creado por error. Libera su horario y docente (horarios y calendario se borran en cascada).
-- Se rechaza si el salón ya tiene estudiantes matriculados, ejercicios asignados o archivo de ciclo: ahí hay datos de alumnos.
create or replace function public.eliminar_salon(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();

  perform 1 from public.salones where id = p_id for update;
  if not found then
    raise exception 'El salón no existe' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.matriculas where salon_id = p_id) then
    raise exception 'No se puede eliminar: el salón tiene estudiantes matriculados. Retíralos primero o cambia el estado a Finalizado.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.ejercicio_asignaciones where salon_id = p_id) then
    raise exception 'No se puede eliminar: el salón tiene ejercicios asignados.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.archivo_alumnos where salon_id = p_id) then
    raise exception 'No se puede eliminar: el salón tiene historial archivado.' using errcode = 'P0001';
  end if;

  delete from public.salones where id = p_id;
end $$;

revoke all on function public.eliminar_salon(uuid) from public, anon;
grant execute on function public.eliminar_salon(uuid) to authenticated;
