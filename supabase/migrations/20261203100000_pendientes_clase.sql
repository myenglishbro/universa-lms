-- UNIVERSA · Pendientes por clase: asistencia y grabación.
--
--  * Cada clase que ya ocurrió debe tener su asistencia registrada Y su grabación subida al portal del curso.
--  * pendientes_salones(): por salón, cuántas clases pasadas no tienen registro (asistencia/tema) y cuántas no tienen grabación.
--      - Sin registro  = misma regla de «pendiente» que portal_clases_salon (no cancelada, fecha <= hoy y sin registrar_clase).
--      - Sin grabación = no cancelada, fecha < hoy (la de hoy aún puede estar en curso) y sin lección tipo «grabacion» vinculada.
--    Solo personal con perfil. Excluye salones archivados.
--  * clases_con_grabacion(salon): ids de las sesiones del salón que ya tienen grabación (para marcar cada clase en el seguimiento).
--
-- Solo lectura; no modifica tablas ni políticas. Repetible.

create or replace function public.pendientes_salones() returns table (
  salon_id uuid, sin_registro integer, sin_grabacion integer, primera_fecha date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.tiene_perfil()) then raise exception 'No tienes acceso' using errcode = '42501'; end if;
  return query
    select s.salon_id,
           (count(*) filter (where s.fecha <= public.hoy_lima() and not (s.estado = 'realizada' and r.sesion_id is not null)))::integer,
           (count(*) filter (where s.fecha < public.hoy_lima()
                               and not exists (select 1 from public.curso_lecciones l where l.sesion_id = s.id and l.tipo = 'grabacion')))::integer,
           min(s.fecha) filter (where s.fecha <= public.hoy_lima()
                                  and (not (s.estado = 'realizada' and r.sesion_id is not null)
                                       or (s.fecha < public.hoy_lima()
                                           and not exists (select 1 from public.curso_lecciones l where l.sesion_id = s.id and l.tipo = 'grabacion'))))
      from public.salon_sesiones s
      join public.salones z on z.id = s.salon_id and z.archivado_at is null
      left join public.clase_registros r on r.sesion_id = s.id
     where s.estado <> 'cancelada'
     group by s.salon_id;
end $$;

create or replace function public.clases_con_grabacion(p_salon uuid) returns table (sesion_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return query
    select distinct l.sesion_id from public.curso_lecciones l
     where l.salon_id = p_salon and l.tipo = 'grabacion' and l.sesion_id is not null;
end $$;

revoke execute on function public.pendientes_salones(), public.clases_con_grabacion(uuid) from public, anon;
grant execute on function public.pendientes_salones(), public.clases_con_grabacion(uuid) to authenticated;
