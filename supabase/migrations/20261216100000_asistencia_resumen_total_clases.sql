-- UNIVERSA · El 25 % de inasistencias se mide sobre el TOTAL de clases del curso: la ficha del estudiante necesita ese total por salón.
-- Repetible. Solo agrega la columna total_sesiones (null si el salón no lo tiene definido).
begin;
drop function if exists public.asistencia_resumen_alumno(uuid);
create or replace function public.asistencia_resumen_alumno(p_alumno uuid) returns table (
  salon_id uuid, codigo text, nombre text, matricula text, presentes integer, ausentes integer, tardanzas integer, justificados integer, total_sesiones integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.tiene_perfil() then raise exception 'No tienes permisos para consultar la asistencia' using errcode = '42501'; end if;
  return query
    select s.id, s.codigo, s.nombre,
           case when exists (select 1 from public.matriculas m where m.alumno_id = p_alumno and m.salon_id = s.id and m.estado = 'activa') then 'activa' else 'retirada' end,
           (select count(*)::integer from public.asistencias x join public.salon_sesiones q on q.id = x.sesion_id where q.salon_id = s.id and x.alumno_id = p_alumno and x.estado = 'presente'),
           (select count(*)::integer from public.asistencias x join public.salon_sesiones q on q.id = x.sesion_id where q.salon_id = s.id and x.alumno_id = p_alumno and x.estado = 'ausente'),
           (select count(*)::integer from public.asistencias x join public.salon_sesiones q on q.id = x.sesion_id where q.salon_id = s.id and x.alumno_id = p_alumno and x.estado = 'tardanza'),
           (select count(*)::integer from public.asistencias x join public.salon_sesiones q on q.id = x.sesion_id where q.salon_id = s.id and x.alumno_id = p_alumno and x.estado = 'justificado'),
           s.total_sesiones
      from public.salones s
     where s.id in (select m.salon_id from public.matriculas m where m.alumno_id = p_alumno)
     order by s.nombre;
end $$;
revoke execute on function public.asistencia_resumen_alumno(uuid) from public, anon;
grant execute on function public.asistencia_resumen_alumno(uuid) to authenticated;
commit;
