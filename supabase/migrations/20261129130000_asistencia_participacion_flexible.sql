-- UNIVERSA · Asistencia y participación sin atarse al día de la clase.
--
-- REGLAS DE NEGOCIO
--  1. Se puede registrar la asistencia de una clase y marcar la participación POR ADELANTADO (clases futuras). Sirve para probar notas y para
--     adelantar trabajo. Una clase registrada por adelantado NO pasa a «realizada» hasta que llegue su fecha; mientras tanto no cuenta como realizada.
--  2. La participación de un estudiante se calcula sobre SUS clases aplicables:
--        total aplicable = clases del módulo − clases excluidas
--     Se EXCLUYEN automáticamente (ni suman ni restan):
--        · las clases con asistencia «justificado»;
--        · las clases anteriores a su fecha de matrícula en el salón (alumno que entra tarde).
--     Nota de participación = cumplidas ÷ total aplicable × 100.
--  3. La participación se puede publicar cuando todas las clases aplicables tienen marca, aunque alguna sea futura.
--  Las notas de participación ya publicadas NO se recalculan solas (solo cambian si se corrigen con motivo, como siempre).
--
-- Requiere 20261115 (asistencia), 20261117 (matriz) y 20261125 (formative con unidades). Repetible. Una sola transacción.

begin;

-- Clases del módulo que no cuentan para un estudiante, con el motivo: 'matricula' (anterior a su ingreso) o 'justificado'.
create or replace function public.eval_part_excluidas(p_modulo uuid, p_alumno uuid) returns table (sesion_id uuid, motivo text)
language sql stable security definer set search_path = '' as $$
  select s.sesion_id, case when d.f is not null and s.fecha < d.f then 'matricula' else 'justificado' end
    from public.eval_sesiones_modulo(p_modulo) s
    left join lateral (select min(x.fecha_inicio) f from public.matriculas x join public.eval_modulos m on m.salon_id = x.salon_id
                        where m.id = p_modulo and x.alumno_id = p_alumno) d on true
   where (d.f is not null and s.fecha < d.f)
      or exists (select 1 from public.asistencias a where a.sesion_id = s.sesion_id and a.alumno_id = p_alumno and a.estado = 'justificado')
$$;

-- Resumen de participación: total = clases aplicables (sin excluidas). Una clase marcada por adelantado cuenta como hecha.
create or replace function public.eval_part_resumen(p_evaluacion uuid, p_alumno uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with ev as (select e.modulo_id from public.eval_evaluaciones e where e.id = p_evaluacion),
  t as (
    select s.sesion_id, s.hecha, p.cumplio,
           exists (select 1 from public.eval_part_excluidas((select modulo_id from ev), p_alumno) x where x.sesion_id = s.sesion_id) excluida
      from public.eval_sesiones_modulo((select modulo_id from ev)) s
      left join public.eval_participaciones p on p.evaluacion_id = p_evaluacion and p.sesion_id = s.sesion_id and p.alumno_id = p_alumno)
  select jsonb_build_object(
    'total', count(*) filter (where not excluida),
    'hechas', count(*) filter (where not excluida and (hecha or cumplio is not null)),
    'registradas', count(*) filter (where not excluida and cumplio is not null),
    'cumplidas', count(*) filter (where not excluida and cumplio),
    'excluidas', count(*) filter (where excluida))
    from t
$$;

create or replace function public.registrar_clase(
  p_sesion uuid, p_asistencia jsonb, p_tema text default null, p_observaciones text default null, p_materiales uuid[] default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_s public.salon_sesiones;
  v_tema text := nullif(btrim(coalesce(p_tema, '')), '');
  v_obs text := nullif(btrim(coalesce(p_observaciones, '')), '');
  v_item jsonb;
  v_vistos uuid[] := '{}';
  v_alumno uuid;
  v_estado text;
begin
  select * into v_s from public.salon_sesiones where id = p_sesion;
  if not found then raise exception 'La sesión no existe'; end if;
  if not public.puede_gestionar_curso(v_s.salon_id) then raise exception 'No tienes permisos para registrar esta clase' using errcode = '42501'; end if;
  perform 1 from public.salones where id = v_s.salon_id for update;
  select * into v_s from public.salon_sesiones where id = p_sesion;

  if v_s.estado = 'cancelada' then raise exception 'Una sesión cancelada no tiene asistencia'; end if;
  if length(coalesce(v_tema, '')) > 300 then raise exception 'El tema es demasiado largo (máximo 300 caracteres)'; end if;
  if length(coalesce(v_obs, '')) > 3000 then raise exception 'Las observaciones son demasiado largas (máximo 3000 caracteres)'; end if;
  if p_asistencia is null or jsonb_typeof(p_asistencia) <> 'array' then raise exception 'La asistencia debe ser una lista'; end if;

  for v_item in select * from jsonb_array_elements(p_asistencia) loop
    begin
      v_alumno := (v_item->>'alumno_id')::uuid;
    exception when others then
      raise exception 'Identificador de estudiante no válido';
    end;
    v_estado := v_item->>'estado';
    if v_estado is null or v_estado not in ('presente', 'ausente', 'tardanza', 'justificado') then
      raise exception 'Estado de asistencia no válido (usa presente, ausente, tardanza o justificado)';
    end if;
    if v_alumno = any(v_vistos) then raise exception 'Un estudiante está repetido en la asistencia'; end if;
    if not exists (select 1 from public.asist_roster(p_sesion) r where r.alumno_id = v_alumno) then
      raise exception 'Un estudiante de la lista no está matriculado en este salón en la fecha de la clase';
    end if;
    v_vistos := v_vistos || v_alumno;
  end loop;
  if exists (select 1 from public.asist_roster(p_sesion) r where r.alumno_id <> all (v_vistos)) then
    raise exception 'Falta marcar la asistencia de uno o más estudiantes';
  end if;

  if p_materiales is not null and exists (
       select 1 from unnest(p_materiales) m(id)
        where not exists (select 1 from public.curso_lecciones l where l.id = m.id and l.salon_id = v_s.salon_id)) then
    raise exception 'Un material elegido no pertenece a este salón';
  end if;

  insert into public.asistencias (sesion_id, alumno_id, estado)
  select p_sesion, (e->>'alumno_id')::uuid, e->>'estado' from jsonb_array_elements(p_asistencia) e
  on conflict (sesion_id, alumno_id) do update set estado = excluded.estado, updated_at = now();

  insert into public.clase_registros (sesion_id, tema, observaciones, registrado_por)
  values (p_sesion, v_tema, v_obs, (select auth.uid()))
  on conflict (sesion_id) do update set tema = excluded.tema, observaciones = excluded.observaciones, updated_at = now();

  if p_materiales is not null then
    update public.curso_lecciones set sesion_id = null where sesion_id = p_sesion and id <> all (p_materiales);
    update public.curso_lecciones set sesion_id = p_sesion where salon_id = v_s.salon_id and id = any (p_materiales);
  end if;

  -- Una clase registrada por adelantado conserva su estado hasta que llegue su fecha (no cuenta como realizada antes).
  if v_s.estado = 'programada' and v_s.fecha <= public.hoy_lima() then
    update public.salon_sesiones set estado = 'realizada' where id = p_sesion;
    perform public.cal_actualizar_fin(v_s.salon_id);
  end if;
end $$;

create or replace function public.guardar_participacion(p_evaluacion uuid, p_filas jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_salon uuid := public.eval_salon_de(p_evaluacion); v_modulo uuid; v_f jsonb; v_alumno uuid; v_ses uuid; v_cum boolean; v_n integer := 0; v_hecha boolean;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes permisos para registrar participación en este salón' using errcode = '42501'; end if;
  if not public.eval_es_participacion(p_evaluacion) then raise exception 'Esta evaluación no es de participación por clase'; end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then raise exception 'La participación debe enviarse como lista'; end if;
  select modulo_id into v_modulo from public.eval_evaluaciones where id = p_evaluacion;
  for v_f in select * from jsonb_array_elements(p_filas) loop
    begin v_alumno := (v_f->>'alumno_id')::uuid; v_ses := (v_f->>'sesion_id')::uuid; exception when others then raise exception 'Estudiante o clase no válidos'; end;
    if jsonb_typeof(v_f->'cumplio') not in ('boolean', 'null') and v_f ? 'cumplio' then raise exception 'La participación debe ser cumplida, no cumplida o pendiente'; end if;
    v_cum := case when jsonb_typeof(v_f->'cumplio') = 'boolean' then (v_f->>'cumplio')::boolean end;
    select s.hecha into v_hecha from public.eval_sesiones_modulo(v_modulo) s where s.sesion_id = v_ses;
    if not found then raise exception 'Esa clase no pertenece a este módulo'; end if;
    if not exists (select 1 from public.matriculas m where m.alumno_id = v_alumno and m.salon_id = v_salon and m.estado = 'activa') then
      raise exception 'Un estudiante de la lista no está matriculado en este salón';
    end if;
    if exists (select 1 from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = v_alumno and k.unidad = '' and k.estado = 'publicada') then
      raise exception 'La participación ya está publicada: usa «Corregir» e indica el motivo';
    end if;
    if v_cum is null then
      delete from public.eval_participaciones where evaluacion_id = p_evaluacion and sesion_id = v_ses and alumno_id = v_alumno;
    else
      insert into public.eval_participaciones (evaluacion_id, sesion_id, alumno_id, cumplio, updated_by)
      values (p_evaluacion, v_ses, v_alumno, v_cum, (select auth.uid()))
      on conflict (evaluacion_id, sesion_id, alumno_id) do update set cumplio = excluded.cumplio, updated_at = now(), updated_by = excluded.updated_by;
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function public.publicar_participacion(p_evaluacion uuid, p_alumnos uuid[] default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_salon uuid := public.eval_salon_de(p_evaluacion); v_modulo uuid; v_a uuid; v_r jsonb; v_n integer := 0; v_total integer; v_det jsonb; v_tot_a integer;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes permisos para publicar en este salón' using errcode = '42501'; end if;
  if not public.eval_es_participacion(p_evaluacion) then raise exception 'Esta evaluación no es de participación por clase'; end if;
  select modulo_id into v_modulo from public.eval_evaluaciones where id = p_evaluacion;
  select count(*) into v_total from public.eval_sesiones_modulo(v_modulo);
  if v_total = 0 then raise exception 'El módulo no tiene clases asignadas: administración debe indicar sus clases'; end if;
  perform set_config('universa.participacion', 'on', true);
  for v_a in select m.alumno_id from public.matriculas m where m.salon_id = v_salon and m.estado = 'activa' and (p_alumnos is null or m.alumno_id = any (p_alumnos)) loop
    v_r := public.eval_part_resumen(p_evaluacion, v_a);
    v_tot_a := (v_r->>'total')::integer; -- clases del módulo menos las excluidas de este estudiante
    if v_tot_a = 0 or (v_r->>'hechas')::integer < v_tot_a or (v_r->>'registradas')::integer < v_tot_a then continue; end if;
    if exists (select 1 from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = v_a and k.unidad = '' and k.estado = 'publicada') then continue; end if;
    v_det := jsonb_build_object('tipo', 'participacion', 'cumplidas', (v_r->>'cumplidas')::integer, 'total', v_tot_a, 'excluidas', (v_r->>'excluidas')::integer,
      'clases', (select jsonb_agg(jsonb_build_object('fecha', s.fecha, 'cumplio', p.cumplio) order by s.numero)
                   from public.eval_sesiones_modulo(v_modulo) s join public.eval_participaciones p on p.evaluacion_id = p_evaluacion and p.sesion_id = s.sesion_id and p.alumno_id = v_a));
    insert into public.eval_calificaciones (evaluacion_id, alumno_id, unidad, puntaje, detalle, estado, publicada_at, updated_by)
    values (p_evaluacion, v_a, '', round((v_r->>'cumplidas')::numeric / v_tot_a * 100, 2), v_det, 'publicada', now(), (select auth.uid()))
    on conflict (evaluacion_id, alumno_id, unidad) do update
      set puntaje = excluded.puntaje, detalle = excluded.detalle, estado = 'publicada', publicada_at = now(), updated_at = now(), updated_by = excluded.updated_by;
    v_n := v_n + 1;
  end loop;
  perform set_config('universa.participacion', 'off', true);
  if v_n = 0 then raise exception 'Ningún estudiante tiene la participación completa: faltan clases por realizar o por registrar'; end if;
  return v_n;
end $$;

create or replace function public.eval_participacion_detalle(p_evaluacion uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_salon uuid := public.eval_salon_de(p_evaluacion); v_e public.eval_evaluaciones; v_c public.eval_componentes; v_m public.eval_modulos;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  if not public.eval_es_participacion(p_evaluacion) then raise exception 'Esta evaluación no es de participación por clase'; end if;
  select * into v_e from public.eval_evaluaciones where id = p_evaluacion;
  select * into v_c from public.eval_componentes where id = v_e.componente_id;
  select * into v_m from public.eval_modulos where id = v_e.modulo_id;
  return jsonb_build_object(
    'evaluacion', jsonb_build_object('id', v_e.id, 'nombre', v_e.nombre, 'modulo', v_m.nombre, 'modulo_id', v_m.id, 'peso', v_c.peso, 'tipo', v_c.tipo, 'salon_id', v_salon),
    'sesiones', coalesce((select jsonb_agg(jsonb_build_object('id', s.sesion_id, 'numero', s.numero, 'fecha', s.fecha, 'hora_inicio', s.hora_inicio, 'hecha', s.hecha) order by s.numero)
                            from public.eval_sesiones_modulo(v_m.id) s), '[]'::jsonb),
    'alumnos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'alumno_id', a.id, 'nombre', a.nombre,
        'marcas', coalesce((select jsonb_object_agg(p.sesion_id::text, p.cumplio) from public.eval_participaciones p where p.evaluacion_id = p_evaluacion and p.alumno_id = a.id), '{}'::jsonb),
        'resumen', public.eval_part_resumen(p_evaluacion, a.id),
        'excluidas', coalesce((select jsonb_object_agg(x.sesion_id::text, x.motivo) from public.eval_part_excluidas(v_m.id, a.id) x), '{}'::jsonb),
        'publicada', exists (select 1 from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = a.id and k.unidad = '' and k.estado = 'publicada'),
        'puntaje', (select k.puntaje from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = a.id and k.unidad = '' and k.estado = 'publicada' limit 1),
        'corregida', exists (select 1 from public.eval_calificaciones k join public.eval_historial h on h.calificacion_id = k.id where k.evaluacion_id = p_evaluacion and k.alumno_id = a.id and k.unidad = '')) order by a.nombre)
      from public.alumnos a where a.id in (select m2.alumno_id from public.matriculas m2 where m2.salon_id = v_salon and m2.estado = 'activa')), '[]'::jsonb));
end $$;

revoke execute on function public.eval_part_excluidas(uuid, uuid) from public, anon, authenticated;

commit;
