-- El informe del estudiante (y del docente) incluye el detalle por criterio de Writing y Project, para el seguimiento por habilidad.
-- Solo amplía lo que ya devuelve eval_informe: antes `criterios` salía solo en las unidades del Formative; ahora también en Writing (Task 1 / Task 2) y Project.
-- No cambia notas, rúbricas ni permisos. Idempotente (create or replace).
begin;

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
            'nombre', e.nombre, 'peso', c.peso, 'tipo', c.tipo, 'peso_participacion', c.peso_participacion,
            'notas', coalesce((select jsonb_agg(jsonb_build_object('unidad', k.unidad, 'puntaje', k.puntaje, 'comentario', k.comentario,
                                                                  'corregida', exists (select 1 from public.eval_historial h where h.calificacion_id = k.id),
                                                                  'fecha', k.publicada_at,
                                                                  'participacion', case when c.tipo = 'participacion' or (c.tipo = 'formative' and k.unidad = '') then k.detalle end,
                                                                  'criterios', case when (c.tipo = 'formative' and k.unidad <> '') or c.tipo in ('writing', 'project') then k.detalle end)
                                                                  order by k.unidad)
                                 from public.eval_calificaciones k where k.evaluacion_id = e.id and k.alumno_id = p_alumno and k.estado = 'publicada'), '[]'::jsonb))
            order by c.orden)
          from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id where e.modulo_id = m.id), '[]'::jsonb))
        order by m.orden)
      from public.eval_modulos m where m.salon_id = p_salon), '[]'::jsonb));
end $$;

-- Las funciones internas siguen sin exponerse.
revoke execute on function public.eval_informe(uuid, uuid) from public, anon, authenticated;

commit;
