-- UNIVERSA · Formative Assessment continuo: 3 unidades × 5 criterios + participación por clase.
--
-- Antes el Formative era SOLO participación por clase (clases cumplidas ÷ clases del módulo). Ahora mide el progreso del estudiante
-- de forma continua en cada módulo:
--
--  * 3 UNIDADES (Unit 1, Unit 2, Unit 3) con la rúbrica «Formative Assessment» de 5 criterios: Use of English, Listening, Writing,
--    Speaking y Reading (20 puntos cada uno). Total de la unidad = suma de sus 5 criterios (sobre 100). Lo califica el docente
--    cuando termina la unidad, con el flujo de siempre (borrador → publicada, corrección con motivo e historial).
--  * PARTICIPACIÓN por clase (✓ / ✗ por cada clase del módulo): se mantiene y sigue protegida. Su nota = cumplidas ÷ clases × 100.
--  * NOTA DEL FORMATIVE = (1 − p) × promedio de las 3 unidades + p × participación, con p = «peso_participacion» del componente
--    (por defecto 20 %). Se configura en la plantilla y queda versionado. Con p = 0 el Formative es solo las unidades.
--  * El componente cuenta para el módulo cuando están publicadas las 3 unidades y la participación (nunca como cero). Mientras
--    tanto la matriz y el portal muestran un AVANCE provisional con lo ya registrado, que no suma al módulo.
--
-- Compatibilidad: los módulos que ya tienen notas o participación registradas siguen con la versión 1 de «Grade Chart Universa»
-- (sin cambios). Los módulos sin ninguna nota pasan a la versión 2, y los salones nuevos nacen con ella.
-- Repetible. Va después de 20261124110000_gestion_personal.sql.

-- ============================================================
-- 1. Estructura
-- ============================================================
alter table public.eval_componentes add column if not exists peso_participacion numeric(5,2);
alter table public.eval_componentes drop constraint if exists eval_componentes_peso_part_ck;
alter table public.eval_componentes add constraint eval_componentes_peso_part_ck
  check (peso_participacion is null or (peso_participacion >= 0 and peso_participacion <= 100));

-- Una evaluación Formative nace con sus 3 unidades.
create or replace function public.eval_formative_unidades() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if cardinality(new.unidades) = 0
     and exists (select 1 from public.eval_componentes c where c.id = new.componente_id and c.tipo = 'formative') then
    new.unidades := array['Unit 1', 'Unit 2', 'Unit 3'];
  end if;
  return new;
end $$;
drop trigger if exists eval_evaluaciones_formative on public.eval_evaluaciones;
create trigger eval_evaluaciones_formative before insert on public.eval_evaluaciones
  for each row execute function public.eval_formative_unidades();

-- ¿La evaluación lleva participación por clase? Componente «participacion», o «formative» con peso de participación > 0.
create or replace function public.eval_es_participacion(p_evaluacion uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.tipo = 'participacion' or (c.tipo = 'formative' and coalesce(c.peso_participacion, 0) > 0)
                     from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id where e.id = p_evaluacion), false)
$$;

-- La nota de participación se DERIVA de las clases marcadas: nadie la escribe a mano. En «formative» es la fila de unidad vacía.
create or replace function public.eval_proteger_participacion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('universa.participacion', true), '') <> 'on'
     and exists (select 1 from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id
                  where e.id = new.evaluacion_id and (c.tipo = 'participacion' or (c.tipo = 'formative' and new.unidad = ''))) then
    raise exception 'La participación se registra por clase, no con una nota directa';
  end if;
  return new;
end $$;

-- ============================================================
-- 2. Participación: en «formative» conviven las filas de unidades y la de participación (unidad vacía)
-- ============================================================
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
        'publicada', exists (select 1 from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = a.id and k.unidad = '' and k.estado = 'publicada'),
        'puntaje', (select k.puntaje from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = a.id and k.unidad = '' and k.estado = 'publicada' limit 1),
        'corregida', exists (select 1 from public.eval_calificaciones k join public.eval_historial h on h.calificacion_id = k.id where k.evaluacion_id = p_evaluacion and k.alumno_id = a.id and k.unidad = '')) order by a.nombre)
      from public.alumnos a where a.id in (select m2.alumno_id from public.matriculas m2 where m2.salon_id = v_salon and m2.estado = 'activa')), '[]'::jsonb));
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
      if not v_hecha then raise exception 'La clase aún no se realizó: no se puede registrar participación'; end if;
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
  v_salon uuid := public.eval_salon_de(p_evaluacion); v_modulo uuid; v_a uuid; v_r jsonb; v_n integer := 0; v_total integer; v_det jsonb;
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
    if (v_r->>'hechas')::integer < v_total or (v_r->>'registradas')::integer < v_total then continue; end if;
    if exists (select 1 from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = v_a and k.unidad = '' and k.estado = 'publicada') then continue; end if;
    v_det := jsonb_build_object('tipo', 'participacion', 'cumplidas', (v_r->>'cumplidas')::integer, 'total', v_total,
      'clases', (select jsonb_agg(jsonb_build_object('fecha', s.fecha, 'cumplio', p.cumplio) order by s.numero)
                   from public.eval_sesiones_modulo(v_modulo) s join public.eval_participaciones p on p.evaluacion_id = p_evaluacion and p.sesion_id = s.sesion_id and p.alumno_id = v_a));
    insert into public.eval_calificaciones (evaluacion_id, alumno_id, unidad, puntaje, detalle, estado, publicada_at, updated_by)
    values (p_evaluacion, v_a, '', round((v_r->>'cumplidas')::numeric / v_total * 100, 2), v_det, 'publicada', now(), (select auth.uid()))
    on conflict (evaluacion_id, alumno_id, unidad) do update
      set puntaje = excluded.puntaje, detalle = excluded.detalle, estado = 'publicada', publicada_at = now(), updated_at = now(), updated_by = excluded.updated_by;
    v_n := v_n + 1;
  end loop;
  perform set_config('universa.participacion', 'off', true);
  if v_n = 0 then raise exception 'Ningún estudiante tiene la participación completa: faltan clases por realizar o por registrar'; end if;
  return v_n;
end $$;

-- ============================================================
-- 3. Cálculo del módulo: el componente «formative» combina unidades y participación
-- ============================================================
-- Un componente cuenta cuando TODAS sus partes están publicadas (unidades y, si el peso de participación es > 0, la participación).
-- Si no, figura como faltante/incompleto y no suma (nunca como cero). Para «formative»: nota = (1-p) × promedio de unidades + p × participación.
create or replace function public.eval_calc_modulo(p_modulo uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_m public.eval_modulos; v_v public.eval_versiones; v_nombre text;
  v_comp jsonb; v_total numeric; v_eval numeric; v_puntos numeric; v_faltan jsonb;
begin
  select * into v_m from public.eval_modulos where id = p_modulo;
  if not found then return null; end if;
  if v_m.version_id is null then
    return jsonb_build_object('modulo_id', v_m.id, 'nombre', v_m.nombre, 'ciclo', v_m.ciclo, 'sin_plantilla', true, 'parcial', true,
                              'nota', null, 'puntos', 0, 'escala', null, 'peso_total', 0, 'peso_evaluado', 0, 'componentes', '[]'::jsonb, 'faltan', '[]'::jsonb);
  end if;
  select * into v_v from public.eval_versiones where id = v_m.version_id;
  select p.nombre into v_nombre from public.eval_plantillas p where p.id = v_v.plantilla_id;

  with c as (
    select c.id, c.nombre, c.tipo, c.peso, c.orden,
           (c.tipo = 'formative' and e.id is not null and cardinality(e.unidades) > 0) as es_form,
           case when c.tipo = 'formative' then coalesce(c.peso_participacion, 0) / 100 else 0 end as p_part,
           coalesce(cardinality(e.unidades), 0) as n_uni,
           u.n as u_pub, u.nota as u_nota, pa.nota as part_nota,
           case when e.id is null or cardinality(e.unidades) = 0 then 1 else cardinality(e.unidades) end as n_simple,
           coalesce(k.n, 0) as k_pub, k.nota as k_nota
      from public.eval_componentes c
      left join public.eval_evaluaciones e on e.componente_id = c.id and e.modulo_id = p_modulo
      left join lateral (
        select count(*)::integer n, avg(x.puntaje) nota
          from public.eval_calificaciones x
         where x.evaluacion_id = e.id and x.alumno_id = p_alumno and x.estado = 'publicada'
           and x.unidad = any (case when cardinality(e.unidades) = 0 then array[''] else e.unidades end)) k on true
      left join lateral (
        select count(*)::integer n, avg(x.puntaje) nota
          from public.eval_calificaciones x
         where x.evaluacion_id = e.id and x.alumno_id = p_alumno and x.estado = 'publicada' and x.unidad = any (e.unidades)) u on true
      left join lateral (
        select x.puntaje nota from public.eval_calificaciones x
         where x.evaluacion_id = e.id and x.alumno_id = p_alumno and x.estado = 'publicada' and x.unidad = '' limit 1) pa on true
     where c.version_id = v_m.version_id
  ), d as (
    select *,
           case when es_form then n_uni + (case when p_part > 0 then 1 else 0 end) else n_simple end as n_total,
           case when es_form then coalesce(u_pub, 0) + (case when p_part > 0 and part_nota is not null then 1 else 0 end) else k_pub end as n_pub,
           case when es_form then (1 - p_part) * u_nota + p_part * coalesce(part_nota, 0) else k_nota end as nota
      from c
  ), t as (
    select *, case when n_pub >= n_total then 'completo' when n_pub = 0 then 'falta' else 'incompleto' end as estado from d
  )
  select jsonb_agg(jsonb_build_object('componente_id', id, 'nombre', nombre, 'tipo', tipo, 'peso', peso, 'estado', estado,
                                      'unidades_publicadas', n_pub, 'unidades_total', n_total,
                                      'nota', case when estado = 'completo' then round(nota, 2) end) order by orden),
         coalesce(sum(peso), 0),
         coalesce(sum(peso) filter (where estado = 'completo'), 0),
         coalesce(sum(peso * nota / 100) filter (where estado = 'completo'), 0),
         coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'estado', estado, 'unidades_publicadas', n_pub, 'unidades_total', n_total) order by orden)
                  filter (where estado <> 'completo'), '[]'::jsonb)
    into v_comp, v_total, v_eval, v_puntos, v_faltan from t;

  return jsonb_build_object(
    'modulo_id', v_m.id, 'nombre', v_m.nombre, 'ciclo', v_m.ciclo, 'plantilla', v_nombre, 'version', v_v.version,
    'escala', v_v.escala_puntos, 'peso_total', v_total, 'peso_evaluado', v_eval,
    'puntos', round(v_puntos, 2),
    'nota', case when v_eval > 0 then round(v_puntos / v_eval * 100, 2) end,
    'parcial', v_eval < v_total, 'sin_plantilla', false,
    'componentes', coalesce(v_comp, '[]'::jsonb), 'faltan', v_faltan);
end $$;

-- ============================================================
-- 4. Celda de la matriz: el Formative muestra el avance en vivo (unidades + participación) además del resultado
-- ============================================================
create or replace function public.eval_celda(p_evaluacion uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_e public.eval_evaluaciones; v_c public.eval_componentes; v_n integer; v_pub integer; v_bor integer; v_prom numeric; v_pt numeric; v_r jsonb; v_estado text;
  v_pp numeric; v_uni jsonb; v_nu integer; v_nu_reg integer; v_nu_pub integer; v_prom_u numeric; v_part_pub numeric; v_part_prov numeric;
  v_hay_part boolean; v_completa boolean; v_prov numeric; v_wu numeric; v_wp numeric;
begin
  select * into v_e from public.eval_evaluaciones where id = p_evaluacion;
  select * into v_c from public.eval_componentes where id = v_e.componente_id;
  if v_c.tipo = 'participacion' then
    v_r := public.eval_part_resumen(p_evaluacion, p_alumno);
    select k.puntaje into v_pt from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = p_alumno and k.unidad = '' and k.estado = 'publicada';
    if v_pt is not null then v_estado := 'publicada';
    elsif (v_r->>'total')::integer = 0 then v_estado := 'sin_clases';
    elsif (v_r->>'registradas')::integer = 0 then v_estado := 'sin_nota';
    elsif (v_r->>'registradas')::integer < (v_r->>'total')::integer then v_estado := 'en_curso';
    else v_estado := 'listo'; v_pt := round((v_r->>'cumplidas')::numeric / (v_r->>'total')::numeric * 100, 2);
    end if;
    return v_r || jsonb_build_object('tipo', 'participacion', 'estado', v_estado, 'puntaje', v_pt, 'aporte', case when v_pt is not null then round(v_c.peso * v_pt / 100, 2) end);
  end if;

  if v_c.tipo = 'formative' and cardinality(v_e.unidades) > 0 then
    v_pp := coalesce(v_c.peso_participacion, 0) / 100;
    v_hay_part := v_pp > 0;
    v_nu := cardinality(v_e.unidades);
    select count(*) filter (where k.estado = 'publicada'), count(*), avg(k.puntaje), avg(k.puntaje) filter (where k.estado = 'publicada')
      into v_nu_pub, v_nu_reg, v_prom_u, v_pt
      from public.eval_calificaciones k
     where k.evaluacion_id = p_evaluacion and k.alumno_id = p_alumno and k.puntaje is not null and k.unidad = any (v_e.unidades);
    select coalesce(jsonb_agg(jsonb_build_object('unidad', u.nombre, 'puntaje', k.puntaje, 'estado', coalesce(k.estado, 'sin_nota')) order by u.n), '[]'::jsonb)
      into v_uni
      from unnest(v_e.unidades) with ordinality u(nombre, n)
      left join public.eval_calificaciones k on k.evaluacion_id = p_evaluacion and k.alumno_id = p_alumno and k.unidad = u.nombre;
    v_r := case when v_hay_part then public.eval_part_resumen(p_evaluacion, p_alumno) else jsonb_build_object('total', 0, 'hechas', 0, 'registradas', 0, 'cumplidas', 0) end;
    select k.puntaje into v_part_pub from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = p_alumno and k.unidad = '' and k.estado = 'publicada';
    v_part_prov := case when v_part_pub is not null then v_part_pub
                        when (v_r->>'registradas')::integer > 0 then round((v_r->>'cumplidas')::numeric / (v_r->>'registradas')::numeric * 100, 2) end;
    v_completa := v_nu_pub >= v_nu and (not v_hay_part or v_part_pub is not null);
    -- Avance provisional con lo ya registrado (borradores incluidos); las partes que faltan no cuentan como cero.
    v_wu := case when v_nu_reg > 0 then 1 - v_pp end;
    v_wp := case when v_hay_part and v_part_prov is not null then v_pp end;
    v_prov := case when coalesce(v_wu, 0) + coalesce(v_wp, 0) > 0
                   then round((coalesce(v_wu * v_prom_u, 0) + coalesce(v_wp * v_part_prov, 0)) / (coalesce(v_wu, 0) + coalesce(v_wp, 0)), 2) end;
    -- listo = todo registrado pero falta publicar; en_curso = hay avance; sin_nota = nada registrado.
    v_estado := case when v_completa then 'publicada'
                     when v_nu_reg >= v_nu and (not v_hay_part or ((v_r->>'total')::integer > 0 and (v_r->>'registradas')::integer >= (v_r->>'total')::integer)) then 'listo'
                     when v_prov is not null then 'en_curso'
                     else 'sin_nota' end;
    return jsonb_build_object('tipo', 'formative', 'estado', v_estado,
      'puntaje', case when v_completa then round((1 - v_pp) * v_pt + v_pp * coalesce(v_part_pub, 0), 2) else v_prov end,
      'aporte', case when v_completa then round(v_c.peso * ((1 - v_pp) * v_pt + v_pp * coalesce(v_part_pub, 0)) / 100, 2) end,
      'provisional', not v_completa,
      'peso_participacion', v_c.peso_participacion,
      'unidades', v_uni, 'unidades_total', v_nu, 'unidades_registradas', v_nu_reg, 'unidades_publicadas', v_nu_pub,
      'promedio_unidades', round(v_prom_u, 2),
      'participacion', v_r || jsonb_build_object('puntaje', v_part_prov, 'publicada', v_part_pub is not null, 'aplica', v_hay_part));
  end if;

  v_n := greatest(1, cardinality(v_e.unidades));
  select count(*) filter (where k.estado = 'publicada'), count(*) filter (where k.estado = 'borrador'), avg(k.puntaje)
    into v_pub, v_bor, v_prom
    from public.eval_calificaciones k
   where k.evaluacion_id = p_evaluacion and k.alumno_id = p_alumno and k.puntaje is not null
     and k.unidad = any (case when cardinality(v_e.unidades) = 0 then array[''] else v_e.unidades end);
  v_estado := case when v_pub >= v_n then 'publicada' when v_pub + v_bor >= v_n then 'borrador' when v_pub + v_bor > 0 then 'parcial' else 'sin_nota' end;
  v_pt := case when v_pub + v_bor >= v_n then round(v_prom, 2) end;
  return jsonb_build_object('tipo', v_c.tipo, 'estado', v_estado, 'puntaje', v_pt, 'aporte', case when v_pt is not null then round(v_c.peso * v_pt / 100, 2) end,
                            'unidades_total', v_n, 'unidades_registradas', v_pub + v_bor, 'unidades_publicadas', v_pub);
end $$;

-- ============================================================
-- 5. Pendientes de administración: el Formative espera sus unidades y, si aplica, la participación
-- ============================================================
create or replace function public.eval_pendientes() returns table (
  salon_id uuid, salon text, docente text, modulo text, evaluacion text, tipo text, estudiantes integer, publicadas integer, borradores integer, faltantes integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  return query
  select q.salon_id, q.salon, q.docente, q.modulo, q.evaluacion, q.tipo, q.est, q.pub, q.bor, greatest(q.est * q.n - q.pub - q.bor, 0)
    from (
      select s.id salon_id, s.nombre salon, coalesce(d.nombre, 'Sin docente') docente, m.nombre modulo, e.nombre evaluacion, c.tipo,
             (select count(*)::integer from public.matriculas x where x.salon_id = s.id and x.estado = 'activa') est,
             case when c.tipo = 'participacion' then 1
                  else greatest(1, cardinality(e.unidades)) + (case when c.tipo = 'formative' and coalesce(c.peso_participacion, 0) > 0 then 1 else 0 end) end n,
             case when c.tipo = 'participacion'
                  then (select count(*)::integer from public.eval_calificaciones k join public.matriculas x on x.alumno_id = k.alumno_id and x.salon_id = s.id and x.estado = 'activa' where k.evaluacion_id = e.id and k.estado = 'publicada')
                  else (select count(*)::integer from public.eval_calificaciones k join public.matriculas x on x.alumno_id = k.alumno_id and x.salon_id = s.id and x.estado = 'activa' where k.evaluacion_id = e.id and k.estado = 'publicada' and k.puntaje is not null) end pub,
             case when c.tipo = 'participacion'
                  then (select count(*)::integer from public.matriculas x where x.salon_id = s.id and x.estado = 'activa'
                           and not exists (select 1 from public.eval_calificaciones k where k.evaluacion_id = e.id and k.alumno_id = x.alumno_id and k.estado = 'publicada')
                           and (public.eval_part_resumen(e.id, x.alumno_id)->>'total')::integer > 0
                           and (public.eval_part_resumen(e.id, x.alumno_id)->>'registradas')::integer = (public.eval_part_resumen(e.id, x.alumno_id)->>'total')::integer)
                  else (select count(*)::integer from public.eval_calificaciones k join public.matriculas x on x.alumno_id = k.alumno_id and x.salon_id = s.id and x.estado = 'activa' where k.evaluacion_id = e.id and k.estado = 'borrador' and k.puntaje is not null) end bor,
             (exists (select 1 from public.eval_calificaciones k join public.eval_evaluaciones e2 on e2.id = k.evaluacion_id where e2.modulo_id = m.id)
              or exists (select 1 from public.eval_sesiones_modulo(m.id) z where z.hecha)) en_marcha
        from public.salones s
        join public.eval_modulos m on m.salon_id = s.id
        join public.eval_evaluaciones e on e.modulo_id = m.id
        join public.eval_componentes c on c.id = e.componente_id
        left join public.docentes d on d.id = s.docente_id
       where s.estado = 'en_curso') q
   where q.en_marcha and (q.est * q.n - q.pub - q.bor > 0 or q.bor > 0)
   order by q.docente, q.salon, q.modulo, q.evaluacion;
end $$;

-- ============================================================
-- 5b. Matriz del salón: cada evaluación indica el porcentaje de participación (para la captura rápida)
-- ============================================================
create or replace function public.eval_matriz_salon(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_s public.salones; v_c public.eval_consolidacion; v_nivel text;
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_s from public.salones where id = p_salon;
  if not found then raise exception 'El salón no existe'; end if;
  select n.nombre into v_nivel from public.niveles n where n.id = v_s.nivel_id;
  select * into v_c from public.eval_consolidacion where salon_id = p_salon;
  return jsonb_build_object(
    'salon', jsonb_build_object('id', v_s.id, 'nombre', v_s.nombre, 'nivel', v_nivel, 'ciclo_desde', v_s.ciclo_desde, 'ciclo_hasta', v_s.ciclo_hasta),
    'consolidacion', jsonb_build_object('metodo', coalesce(v_c.metodo, 'sin_definir'), 'confirmada', coalesce(v_c.confirmada, false)),
    'modulos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'nombre', m.nombre, 'orden', m.orden, 'ciclo', m.ciclo, 'version_id', m.version_id, 'plantilla', p.nombre, 'version', v.version, 'escala', v.escala_puntos,
        'sesion_desde', m.sesion_desde, 'sesion_hasta', m.sesion_hasta, 'clases', (select count(*) from public.eval_sesiones_modulo(m.id)),
        'evaluaciones', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'tipo', c.tipo, 'peso', c.peso, 'unidades', to_jsonb(e.unidades),
                                                                       'con_rubrica', c.rubrica_id is not null, 'peso_participacion', c.peso_participacion) order by c.orden)
                                    from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id where e.modulo_id = m.id), '[]'::jsonb))
        order by m.orden)
      from public.eval_modulos m left join public.eval_versiones v on v.id = m.version_id left join public.eval_plantillas p on p.id = v.plantilla_id
     where m.salon_id = p_salon), '[]'::jsonb),
    'alumnos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'alumno_id', a.id, 'nombre', a.nombre,
        'celdas', coalesce((select jsonb_object_agg(e.id::text, public.eval_celda(e.id, a.id))
                              from public.eval_evaluaciones e join public.eval_modulos m on m.id = e.modulo_id where m.salon_id = p_salon), '{}'::jsonb),
        'resumen', public.eval_resumen_alumno(p_salon, a.id),
        'nivel', public.eval_calc_nivel(p_salon, a.id)) order by a.nombre)
      from public.alumnos a
     where a.id in (select m2.alumno_id from public.matriculas m2 where m2.salon_id = p_salon and m2.estado = 'activa')), '[]'::jsonb));
end $$;

-- ============================================================
-- 6. Informe del estudiante: criterios por unidad y detalle de participación del Formative
-- ============================================================
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
                                                                  'criterios', case when c.tipo = 'formative' and k.unidad <> '' then k.detalle end)
                                                                  order by k.unidad)
                                 from public.eval_calificaciones k where k.evaluacion_id = e.id and k.alumno_id = p_alumno and k.estado = 'publicada'), '[]'::jsonb))
            order by c.orden)
          from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id where e.modulo_id = m.id), '[]'::jsonb))
        order by m.orden)
      from public.eval_modulos m where m.salon_id = p_salon), '[]'::jsonb));
end $$;

-- ============================================================
-- 7. Plantillas: el peso de participación viaja con el componente (editar, nueva versión, copia del módulo final)
-- ============================================================
create or replace function public.guardar_version(p_version uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_v public.eval_versiones;
  v_escala numeric;
  v_comp jsonb := coalesce(p_datos->'componentes', '[]'::jsonb);
  v_c jsonb; v_nom text; v_peso numeric; v_pf numeric; v_nf text; v_tipo text; v_rub uuid; v_pp numeric;
  v_nombres text[] := '{}'; v_nombres_f text[] := '{}'; v_orden integer := 0; v_con_final integer := 0;
begin
  perform public.cal_exigir_admin();
  select * into v_v from public.eval_versiones where id = p_version for update;
  if not found then raise exception 'La versión no existe'; end if;
  if v_v.variante <> 'normal' then raise exception 'Esta es una copia interna del módulo final; edita la versión principal'; end if;
  if v_v.estado <> 'borrador' then raise exception 'Solo se puede editar una versión en borrador; crea una versión nueva para cambiar pesos'; end if;
  begin v_escala := coalesce((p_datos->>'escala_puntos')::numeric, v_v.escala_puntos); exception when others then v_escala := null; end;
  if v_escala is null or v_escala <= 0 or v_escala > 1000 then raise exception 'La escala de puntos debe ser mayor que 0'; end if;
  if jsonb_typeof(v_comp) <> 'array' or jsonb_array_length(v_comp) > 12 then raise exception 'Una plantilla admite hasta 12 componentes'; end if;

  select count(*) into v_con_final from jsonb_array_elements(v_comp) x where nullif(btrim(coalesce(x->>'peso_final', '')), '') is not null;
  if v_con_final > 0 and v_con_final <> jsonb_array_length(v_comp) then
    raise exception 'Si defines pesos para el módulo final, deben estar todos los componentes (o ninguno)';
  end if;

  for v_c in select * from jsonb_array_elements(v_comp) loop
    v_nom := btrim(coalesce(v_c->>'nombre', ''));
    if v_nom = '' then raise exception 'Todos los componentes necesitan nombre'; end if;
    if lower(v_nom) = any(v_nombres) then raise exception 'El componente «%» está repetido', v_nom; end if;
    v_nombres := v_nombres || lower(v_nom);
    begin v_peso := (v_c->>'peso')::numeric; exception when others then v_peso := null; end;
    if v_peso is null or v_peso <= 0 then raise exception 'El peso de «%» debe ser mayor que 0', v_nom; end if;
    if v_peso > v_escala then raise exception 'El peso de «%» no puede superar la escala (%)', v_nom, v_escala; end if;
    if v_con_final > 0 then
      begin v_pf := (v_c->>'peso_final')::numeric; exception when others then v_pf := null; end;
      if v_pf is null or v_pf <= 0 then raise exception 'El peso de «%» en el módulo final debe ser mayor que 0', v_nom; end if;
      if v_pf > v_escala then raise exception 'El peso de «%» en el módulo final no puede superar la escala (%)', v_nom, v_escala; end if;
      v_nf := coalesce(nullif(btrim(coalesce(v_c->>'nombre_final', '')), ''), v_nom);
      if lower(v_nf) = any(v_nombres_f) then raise exception 'El nombre «%» está repetido en el módulo final', v_nf; end if;
      v_nombres_f := v_nombres_f || lower(v_nf);
    end if;
    v_tipo := coalesce(nullif(v_c->>'tipo', ''), 'otro');
    if v_tipo not in ('test', 'writing', 'project', 'formative', 'spark', 'speaking', 'participacion', 'otro') then raise exception 'Tipo de componente no válido'; end if;
    v_rub := nullif(v_c->>'rubrica_id', '')::uuid;
    if v_rub is not null and v_tipo = 'participacion' then raise exception '«%» es una participación por clase y no usa rúbrica', v_nom; end if;
    if v_rub is not null and not exists (select 1 from public.eval_rubricas where id = v_rub and activa) then
      raise exception 'La rúbrica elegida para «%» no existe o está inactiva', v_nom;
    end if;
    begin v_pp := nullif(btrim(coalesce(v_c->>'peso_participacion', '')), '')::numeric; exception when others then raise exception 'El porcentaje de participación de «%» no es un número', v_nom; end;
    if v_pp is not null and v_tipo <> 'formative' then raise exception 'Solo el Formative lleva porcentaje de participación («%»)', v_nom; end if;
    if v_pp is not null and (v_pp < 0 or v_pp > 100) then raise exception 'El porcentaje de participación de «%» debe estar entre 0 y 100', v_nom; end if;
  end loop;

  update public.eval_versiones set escala_puntos = v_escala, notas = nullif(btrim(coalesce(p_datos->>'notas', '')), '') where id = p_version;
  delete from public.eval_componentes where version_id = p_version;
  for v_c in select * from jsonb_array_elements(v_comp) loop
    v_orden := v_orden + 1;
    insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id, peso_final, nombre_final, peso_participacion)
    values (p_version, btrim(v_c->>'nombre'), coalesce(nullif(v_c->>'tipo', ''), 'otro'), (v_c->>'peso')::numeric, v_orden, nullif(v_c->>'rubrica_id', '')::uuid,
            case when v_con_final > 0 then (v_c->>'peso_final')::numeric end,
            case when v_con_final > 0 then nullif(btrim(coalesce(v_c->>'nombre_final', '')), '') end,
            case when coalesce(nullif(v_c->>'tipo', ''), 'otro') = 'formative' then coalesce(nullif(btrim(coalesce(v_c->>'peso_participacion', '')), '')::numeric, 20) end);
  end loop;
end $$;

create or replace function public.nueva_version(p_plantilla uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_ult public.eval_versiones; v_id uuid;
begin
  perform public.cal_exigir_admin();
  perform 1 from public.eval_plantillas where id = p_plantilla for update;
  if not found then raise exception 'La plantilla no existe'; end if;
  if exists (select 1 from public.eval_versiones where plantilla_id = p_plantilla and estado = 'borrador' and variante = 'normal') then
    raise exception 'Ya hay una versión en borrador: edítala o actívala';
  end if;
  select * into v_ult from public.eval_versiones where plantilla_id = p_plantilla and variante = 'normal' order by version desc limit 1;
  insert into public.eval_versiones (plantilla_id, version, escala_puntos, notas)
  values (p_plantilla, v_ult.version + 1, v_ult.escala_puntos, v_ult.notas) returning id into v_id;
  insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id, peso_final, nombre_final, peso_participacion)
  select v_id, nombre, tipo, peso, orden, rubrica_id, peso_final, nombre_final, peso_participacion from public.eval_componentes where version_id = v_ult.id;
  return v_id;
end $$;

create or replace function public.eval_generar_final(p_version uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_v public.eval_versiones; v_id uuid;
begin
  select * into v_v from public.eval_versiones where id = p_version;
  if not found or v_v.variante <> 'normal' then return null; end if;
  delete from public.eval_versiones where origen_id = p_version and variante = 'final';
  if not exists (select 1 from public.eval_componentes where version_id = p_version and peso_final is not null) then return null; end if;
  insert into public.eval_versiones (plantilla_id, version, estado, escala_puntos, notas, activada_at, variante, origen_id)
  values (v_v.plantilla_id, v_v.version, v_v.estado, v_v.escala_puntos, v_v.notas, v_v.activada_at, 'final', p_version) returning id into v_id;
  insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id, peso_participacion)
  select v_id, coalesce(nombre_final, nombre), tipo, peso_final, orden, rubrica_id, peso_participacion from public.eval_componentes where version_id = p_version;
  return v_id;
end $$;

-- ============================================================
-- 8. Grade Chart Universa v2: Formative = 3 unidades × 5 criterios + 20 % de participación
-- ============================================================
do $$
declare
  v_p uuid; v_v1 uuid; v_v2 uuid; v_rub uuid; v_mod record; v_nuevo boolean;
begin
  select id into v_p from public.eval_plantillas where nombre = 'Grade Chart Universa';
  select id into v_rub from public.eval_rubricas where lower(nombre) = 'formative assessment';
  if v_p is null or v_rub is null then return; end if;
  -- Ya migrado (una versión con Formative de unidades): no se repite.
  if exists (select 1 from public.eval_componentes c join public.eval_versiones v on v.id = c.version_id where v.plantilla_id = v_p and c.tipo = 'formative') then return; end if;
  select id into v_v1 from public.eval_versiones where plantilla_id = v_p and estado = 'vigente' and variante = 'normal';
  if v_v1 is null then return; end if;

  update public.eval_rubricas set descripcion = 'Formative continuo: 5 criterios de 20 puntos por unidad (Unit 1, 2 y 3). Total de la unidad = suma de los 5 criterios.' where id = v_rub;
  update public.eval_plantillas set descripcion = 'Cada módulo vale 100. Dos columnas de peso: módulos 1 a 3 y módulo final (el último del nivel). Formative = 3 unidades de 5 criterios + participación por clase.' where id = v_p;

  update public.eval_versiones set estado = 'archivada' where plantilla_id = v_p and estado = 'vigente';
  insert into public.eval_versiones (plantilla_id, version, estado, escala_puntos, notas, activada_at)
  select plantilla_id, version + 1, 'vigente', escala_puntos,
         'Formative continuo: 3 unidades × 5 criterios (Use of English, Listening, Writing, Speaking, Reading) con 20 % de participación por clase.', now()
    from public.eval_versiones where id = v_v1
  returning id into v_v2;
  insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id, peso_final, nombre_final, peso_participacion)
  select v_v2, nombre,
         case when tipo = 'participacion' then 'formative' else tipo end, peso, orden,
         case when tipo = 'participacion' then v_rub else rubrica_id end, peso_final, nombre_final,
         case when tipo = 'participacion' then 20 end
    from public.eval_componentes where version_id = v_v1;
  perform public.eval_generar_final(v_v2);

  -- Módulos sin ninguna nota ni participación pasan a la versión 2; los que ya tienen datos conservan la versión 1.
  for v_mod in
    select m.id from public.eval_modulos m
     where m.version_id in (select id from public.eval_versiones where plantilla_id = v_p and estado = 'archivada')
       and not exists (select 1 from public.eval_calificaciones k join public.eval_evaluaciones e on e.id = k.evaluacion_id where e.modulo_id = m.id)
       and not exists (select 1 from public.eval_participaciones x join public.eval_evaluaciones e on e.id = x.evaluacion_id where e.modulo_id = m.id)
  loop
    perform public.eval_aplicar_version(v_mod.id, v_v2);
  end loop;
end $$;

-- ============================================================
-- 9. Permisos de ejecución
-- ============================================================
revoke execute on function
  public.eval_formative_unidades(), public.eval_es_participacion(uuid), public.eval_proteger_participacion(),
  public.eval_participacion_detalle(uuid), public.guardar_participacion(uuid, jsonb), public.publicar_participacion(uuid, uuid[]),
  public.eval_calc_modulo(uuid, uuid), public.eval_celda(uuid, uuid), public.eval_matriz_salon(uuid), public.eval_pendientes(), public.eval_informe(uuid, uuid),
  public.guardar_version(uuid, jsonb), public.nueva_version(uuid), public.eval_generar_final(uuid)
  from public, anon, authenticated;
grant execute on function
  public.eval_participacion_detalle(uuid), public.guardar_participacion(uuid, jsonb), public.publicar_participacion(uuid, uuid[]),
  public.eval_matriz_salon(uuid), public.eval_pendientes(), public.guardar_version(uuid, jsonb), public.nueva_version(uuid)
  to authenticated;
