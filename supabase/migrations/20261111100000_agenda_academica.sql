-- UNIVERSA · Agenda académica unificada: sesiones grupales (salon_sesiones) y clases particulares (paquete_clases) en una sola lectura.
--
-- Solo LECTURA: dos vistas con security_invoker (respetan las políticas RLS de las tablas de origen: cualquier usuario con perfil puede
-- consultar; la escritura sigue exclusivamente en las funciones de administrador existentes). No se duplica ninguna sesión, no se
-- modifica ninguna tabla ni función y no se tocan las reglas de ciclos, evaluaciones ni recesos.
--
--  * agenda_sesiones   : una fila por sesión, con el mismo vocabulario de estados (programada / realizada / cancelada;
--                        una clase particular «dictada» se muestra como «realizada»). Las clases de paquetes anulados no aparecen.
--  * agenda_conflictos : sesiones programadas de un docente que se cruzan con otra sesión no cancelada del MISMO docente,
--                        sea grupal o particular. Es una advertencia: no bloquea nada.
--
-- Repetible. Requiere las migraciones de calendario (20261104) y paquetes de horas (20261110).

create index if not exists paquete_clases_fecha_idx on public.paquete_clases (fecha);
create index if not exists salon_sesiones_fecha_idx on public.salon_sesiones (fecha);

create or replace view public.agenda_sesiones with (security_invoker = true) as
select 'grupal'::text as origen,
       s.id,
       s.salon_id,
       null::uuid as paquete_id,
       sa.docente_id,
       d.nombre as docente,
       s.fecha,
       s.hora_inicio,
       s.hora_fin,
       (extract(epoch from (s.hora_fin - s.hora_inicio)) / 60)::integer as minutos,
       s.estado,
       s.tipo,
       sa.nombre as titulo,
       sa.codigo as detalle
  from public.salon_sesiones s
  join public.salones sa on sa.id = s.salon_id
  left join public.docentes d on d.id = sa.docente_id
union all
select 'particular'::text,
       c.id,
       null::uuid,
       c.paquete_id,
       coalesce(c.docente_id, p.docente_id),
       d.nombre,
       c.fecha,
       c.hora_inicio,
       c.hora_fin,
       c.minutos,
       case c.estado when 'dictada' then 'realizada' else c.estado end,
       'regular'::text,
       a.nombre,
       'Clase particular'::text
  from public.paquete_clases c
  join public.paquetes_horas p on p.id = c.paquete_id and not p.anulado
  join public.alumnos a on a.id = p.alumno_id
  left join public.docentes d on d.id = coalesce(c.docente_id, p.docente_id);

create or replace view public.agenda_conflictos with (security_invoker = true) as
select a.origen,
       a.id as sesion_id,
       a.fecha,
       b.origen as otro_origen,
       b.id as otra_sesion_id,
       b.titulo as otro_titulo,
       b.hora_inicio as otra_hora_inicio,
       b.hora_fin as otra_hora_fin
  from public.agenda_sesiones a
  join public.agenda_sesiones b
    on b.docente_id = a.docente_id
   and b.fecha = a.fecha
   and b.estado <> 'cancelada'
   and b.hora_inicio < a.hora_fin
   and a.hora_inicio < b.hora_fin
   and (b.origen, b.id) <> (a.origen, a.id)
 where a.docente_id is not null
   and a.estado = 'programada';

revoke all on public.agenda_sesiones, public.agenda_conflictos from anon, authenticated;
grant select on public.agenda_sesiones, public.agenda_conflictos to authenticated;
