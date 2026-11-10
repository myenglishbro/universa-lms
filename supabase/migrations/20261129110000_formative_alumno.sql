-- UNIVERSA · Avance en vivo del Formative de UN estudiante (para la ficha de la matriz de notas).
-- Requiere 20261129100000_formative_automatico.sql. Repetible. No cambia notas.
create or replace function public.formative_alumno(p_evaluacion uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_salon uuid := public.eval_salon_de(p_evaluacion); v_e public.eval_evaluaciones; v_u text; v_c jsonb; v_k record; v_res jsonb := '[]'::jsonb;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_e from public.eval_evaluaciones where id = p_evaluacion;
  if not exists (select 1 from public.eval_componentes c where c.id = v_e.componente_id and c.tipo = 'formative') then return '[]'::jsonb; end if;
  if not exists (select 1 from public.matriculas m where m.alumno_id = p_alumno and m.salon_id = v_salon and m.estado = 'activa') then return '[]'::jsonb; end if;
  foreach v_u in array v_e.unidades loop
    v_c := public.formative_celda_banco(p_evaluacion, p_alumno, v_u, null);
    select k.puntaje, k.estado into v_k from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = p_alumno and k.unidad = v_u;
    v_res := v_res || (jsonb_build_object('unidad', v_u, 'registrada', case when v_k.estado is null then null else jsonb_build_object('puntaje', v_k.puntaje, 'estado', v_k.estado) end)
                       || (v_c - 'valores'));
  end loop;
  return v_res;
end $$;

revoke execute on function public.formative_alumno(uuid, uuid) from public, anon;
grant execute on function public.formative_alumno(uuid, uuid) to authenticated;
