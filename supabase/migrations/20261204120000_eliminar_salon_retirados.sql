-- eliminar_salon: solo bloquea si hay estudiantes ACTIVOS. Las matrículas retiradas se borran junto con el salón.
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
    raise exception 'No se puede eliminar: el salón tiene estudiantes activos. Retíralos primero.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.ejercicio_asignaciones where salon_id = p_id) then
    raise exception 'No se puede eliminar: el salón tiene ejercicios asignados.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.archivo_alumnos where salon_id = p_id) then
    raise exception 'No se puede eliminar: el salón tiene historial archivado.' using errcode = 'P0001';
  end if;

  update public.matriculas set matricula_origen_id = null
   where matricula_origen_id in (select id from public.matriculas where salon_id = p_id);
  delete from public.matriculas where salon_id = p_id;
  delete from public.salones where id = p_id;
end $$;
