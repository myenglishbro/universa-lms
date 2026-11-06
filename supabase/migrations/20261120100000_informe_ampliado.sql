-- Informe de notas ampliado: los datos que ya están en el salón salen solos en el Report Card.
-- Idempotente. Solo agrega datos al jsonb del informe: nada cambia para quien no los use.
--   nivel (nombre, MCER), modalidad, horario, periodo, ciclos del salón, siguiente nivel y asistencia del estudiante.

create or replace function public.eval_informe_salon(p_salon uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_s record; v_n record; v_sig text; v_hor text; v_as jsonb;
  v_dias text[] := array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
begin
  select s.fecha_inicio, s.fecha_fin_estimada, s.ciclo_desde, s.ciclo_hasta, s.nivel_id, s.plan_id,
         (select m.nombre from public.planes_academicos p join public.modalidades m on m.id = p.modalidad_id where p.id = s.plan_id) modalidad,
         (select p.nivel_id from public.planes_academicos p where p.id = s.plan_id) plan_nivel
    into v_s from public.salones s where s.id = p_salon;
  select n.nombre, n.nombre_en, n.mcer, n.orden into v_n from public.niveles n where n.id = coalesce(v_s.nivel_id, v_s.plan_nivel);
  select n.nombre into v_sig from public.niveles n where n.orden = v_n.orden + 1;

  -- «Monday, Wednesday and Friday 19:00–20:30»: los días que comparten hora se agrupan.
  select string_agg(g.txt, ' · ' order by g.primero) into v_hor
  from (
    select min(h.dia) primero,
           (select string_agg(v_dias[x.dia], ', ' order by x.dia) from public.salon_horarios x
             where x.salon_id = p_salon and x.hora_inicio = h.hora_inicio and x.hora_fin = h.hora_fin)
           || ' ' || to_char(h.hora_inicio, 'HH24:MI') || '–' || to_char(h.hora_fin, 'HH24:MI') txt
    from public.salon_horarios h where h.salon_id = p_salon group by h.hora_inicio, h.hora_fin
  ) g;

  -- Asistencia: «programadas» = clases no canceladas; solo se cuentan las clases realizadas.
  select jsonb_build_object(
    'programadas', (select count(*) from public.salon_sesiones s where s.salon_id = p_salon and s.estado <> 'cancelada'),
    'presentes',   count(*) filter (where a.estado = 'presente'),
    'tardanzas',   count(*) filter (where a.estado = 'tardanza'),
    'ausencias',   count(*) filter (where a.estado = 'ausente'),
    'justificadas', count(*) filter (where a.estado = 'justificado'))
    into v_as
  from public.asistencias a join public.salon_sesiones s on s.id = a.sesion_id
  where s.salon_id = p_salon and a.alumno_id = p_alumno and s.estado = 'realizada';

  return jsonb_build_object(
    'nivel_nombre', v_n.nombre, 'nivel_en', v_n.nombre_en, 'mcer', v_n.mcer, 'modalidad', v_s.modalidad,
    'horario', v_hor, 'periodo', jsonb_build_object('desde', v_s.fecha_inicio, 'hasta', v_s.fecha_fin_estimada),
    'ciclo_desde', v_s.ciclo_desde, 'ciclo_hasta', v_s.ciclo_hasta, 'siguiente_nivel', v_sig,
    'asistencia', coalesce(v_as, '{}'::jsonb));
end $$;

-- eval_informe: el mismo contenido de antes, más los datos del salón.
create or replace function public.eval_informe(p_salon uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_c public.eval_consolidacion; v_nivel jsonb; v_res jsonb; v_s record; v_a record;
begin
  select s.nombre, s.codigo, d.nombre docente into v_s from public.salones s left join public.docentes d on d.id = s.docente_id where s.id = p_salon;
  select nombre into v_a from public.alumnos where id = p_alumno;
  select * into v_c from public.eval_consolidacion where salon_id = p_salon;
  v_nivel := case when coalesce(v_c.confirmada, false) then public.eval_calc_nivel(p_salon, p_alumno) else jsonb_build_object('definido', false, 'confirmada', false) end;
  v_res := public.eval_resumen_alumno(p_salon, p_alumno);
  return public.eval_informe_salon(p_salon, p_alumno) || jsonb_build_object(
    'estudiante', v_a.nombre, 'salon', v_s.nombre, 'codigo', v_s.codigo, 'docente', v_s.docente, 'generado', public.hoy_lima(),
    'nivel', v_nivel, 'ciclos', v_res->'ciclos', 'acumulado', v_res->'acumulado',
    'modulos', coalesce((
      select jsonb_agg(public.eval_modulo_efectivo(m.id, p_alumno) || jsonb_build_object(
        'ciclo', m.ciclo,
        'evaluaciones', coalesce((
          select jsonb_agg(jsonb_build_object(
            'nombre', e.nombre, 'peso', c.peso, 'tipo', c.tipo,
            'notas', coalesce((select jsonb_agg(jsonb_build_object('unidad', k.unidad, 'puntaje', k.puntaje, 'comentario', k.comentario,
                                                                  'corregida', exists (select 1 from public.eval_historial h where h.calificacion_id = k.id),
                                                                  'fecha', k.publicada_at,
                                                                  'participacion', case when c.tipo = 'participacion' then k.detalle end) order by k.unidad)
                                 from public.eval_calificaciones k where k.evaluacion_id = e.id and k.alumno_id = p_alumno and k.estado = 'publicada'), '[]'::jsonb))
            order by c.orden)
          from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id where e.modulo_id = m.id), '[]'::jsonb))
        order by m.orden)
      from public.eval_modulos m where m.salon_id = p_salon), '[]'::jsonb));
end $$;

-- Funciones internas: solo las llaman las funciones con permisos (portal e informe de docente/administración).
revoke execute on function public.eval_informe_salon(uuid, uuid), public.eval_informe(uuid, uuid) from public, anon, authenticated;
