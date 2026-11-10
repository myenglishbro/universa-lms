-- UNIVERSA · PRUEBAS (NO EJECUTADAS) de la migración 20261128100000_formative_banco.sql
--
-- Dónde correrlas: SOLO en el proyecto de PRUEBAS (el marcado con 00_marcar_entorno_de_pruebas.sql), DESPUÉS de aplicar allí las migraciones hasta
-- 20261128100000_formative_banco.sql y los pasos 2 y 3 de supabase/propuestas/entorno_prueba (perfil admin y programas). Nunca en producción.
-- Todo ocurre dentro de una transacción que termina en ROLLBACK: no deja salón, estudiantes, ejercicios ni notas.
--
-- Formative por unidad = Listening / Lessons, Writing, Reading, Speaking (del banco) y SPARK Homework (manual 0–5) · cada uno de 0 a 5, mismo peso
-- + participación 20 % del Formative. Salón ficticio con 4 estudiantes y un módulo con el Grade Chart vigente (versión nueva). Actividades oficiales de Unit 1:
--   L1 multiple_choice → Listening / Lessons · R1 fill_gap → Reading · W1 writing (rúbrica de prueba 20 + 10) → Writing · S1 speaking (rúbrica de prueba 10 + 10) → Speaking
--   Ana    L 4/5 = 80 → 4.0 · R 3/3 = 100 → 5.0 · W 22.5/30 = 75 → 3.75 · S 18/20 = 90 → 4.5 · SPARK 4.5   → Σ 21.75 / 25 = 87.00
--   Beto   L 1/2 = 50 → 2.5, R sin entrega, W por revisar, S sin actividad calificada, SPARK 3  → PARCIAL (2 de 5): no se publica y no es cero
--   Carla  sin entregas ni SPARK; además notas 100 en las 3 unidades + participación 0 → verifica 80 % unidades + 20 % participación
--   Diego  hace una actividad de PRÁCTICA → no cuenta
-- Se prueba: versión del Grade Chart (SPARK no se cuenta dos veces), rúbrica de 5 elementos, asignar práctica u oficial, validaciones (módulo, unidad,
-- habilidad, rúbrica: Project no sustituye a Speaking), calificar con rúbrica sin mínimos, SPARK manual, propuesta parcial/completa, confirmar,
-- corregir con motivo e historial, borrador de otra unidad, cálculo del módulo y que no cambian notas existentes.
--
-- Limitación (dicha con claridad): el script corre como dueño de la base con las claims del admin de pruebas, así que NO prueba RLS, ni la ruta de un
-- docente asignado, ni la vista del estudiante (portal_ejercicios exige una cuenta de estudiante). Las entregas se insertan directamente para simular
-- lo que hace entregar_ejercicio, y la participación publicada se inserta con la misma señal interna que usa publicar_participacion. Varias funciones de apoyo
-- (guardar_salon, generar_calendario, guardar_alumno, matricular_alumnos) se tomaron de migraciones anteriores y no se ejecutaron aquí.
-- Resultado esperado: una tabla con todas las filas en «ok = true». Si algo falla, el script aborta con la prueba que falló.

begin;

do $$
begin
  if to_regclass('public._entorno_prueba') is null then
    raise exception 'ABORTADO: este proyecto no está marcado como entorno de pruebas (public._entorno_prueba).';
  end if;
  if to_regprocedure('public.confirmar_formative(uuid, text, uuid[], text)') is null then
    raise exception 'ABORTADO: aplica primero la migración 20261128100000_formative_banco.sql en este proyecto de pruebas.';
  end if;
end $$;

create temp table _res (n serial, ok boolean, prueba text);
create function pg_temp.chk(p_ok boolean, p_prueba text) returns void language plpgsql as $$
begin insert into _res (ok, prueba) values (coalesce(p_ok, false), p_prueba); end $$;
create function pg_temp.casi(a numeric, b numeric) returns boolean language sql as $$ select a is not null and abs(a - b) < 1e-8 $$;
-- Devuelve el mensaje de error de una sentencia (null si no falló).
create function pg_temp.falla(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return null; exception when others then return sqlerrm; end $$;
-- Fila de la propuesta de un estudiante en una unidad.
create function pg_temp.fila(p_ev uuid, p_alumno uuid, p_unidad text) returns jsonb language sql as $$
  select x from jsonb_array_elements(public.formative_propuesta(p_ev)->'filas') x where x->>'alumno_id' = p_alumno::text and x->>'unidad' = p_unidad
$$;
create function pg_temp.entrega_auto(p_asig uuid, p_alumno uuid, p_ok integer, p_total integer) returns void language plpgsql as $$
begin
  insert into public.ejercicio_entregas (asignacion_id, alumno_id, respuestas, estado, puntaje, correctas, total, detalle)
  values (p_asig, p_alumno, '[]'::jsonb, 'autocalificada', round(100.0 * p_ok / p_total, 2), p_ok, p_total, '[]'::jsonb);
end $$;
create function pg_temp.entrega_manual(p_asig uuid, p_alumno uuid, p_tipo text) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.ejercicio_entregas (asignacion_id, alumno_id, respuestas, audio_path, estado)
  values (p_asig, p_alumno, case when p_tipo = 'writing' then '{"texto":"My week"}'::jsonb else '{}'::jsonb end, case when p_tipo = 'speaking' then 'prueba/audio.webm' end, 'pendiente')
  returning id into v_id;
  return v_id;
end $$;
create function pg_temp.ejercicio(p_titulo text, p_tipo text) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.ejercicios (titulo, tipo, datos, contenido, clave, publico, autor_nombre)
  values (p_titulo, p_tipo, '{}'::jsonb, '{}'::jsonb, case when p_tipo in ('writing', 'speaking') then null else '{"items":[["a"]]}'::jsonb end, true, 'Prueba')
  returning id into v_id;
  return v_id;
end $$;
create function pg_temp.rubrica(p_det jsonb, p_c1 uuid, p_v1 numeric, p_c2 uuid, p_v2 numeric) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('criterio_id', p_c1, 'puntaje', p_v1), jsonb_build_object('criterio_id', p_c2, 'puntaje', p_v2))
$$;

do $$
declare
  v_admin uuid; v_hoy date := public.hoy_lima(); v_salon uuid; v_otro uuid; v_ver uuid; v_prev public.eval_versiones; v_mod uuid; v_mod_otro uuid; v_ev uuid; v_ev_test uuid; v_ev_otro uuid; v_rub_for uuid;
  a uuid[] := '{}'; v_id uuid; i integer; ana uuid; beto uuid; carla uuid; diego uuid; nombres text[] := array['Ana', 'Beto', 'Carla', 'Diego'];
  e_l uuid; e_r uuid; e_w uuid; e_s uuid; e_pr uuid; as_l uuid; as_r uuid; as_w uuid; as_s uuid; as_pr uuid;
  r_wri uuid; r_spk uuid; r_pro uuid; w1 uuid; w2 uuid; s1 uuid; s2 uuid; ent_w uuid; ent_s uuid; ent_w_beto uuid;
  v_f jsonb; v_r jsonb; v_msg text; v_calif integer; v_suma numeric; v_hist integer; v_comp jsonb; v_k public.eval_calificaciones;
begin
  select id into v_admin from auth.users where email = 'admin-prueba@universa.test';
  if v_admin is null then raise exception 'Ejecuta primero el paso 2 de entorno_prueba (perfil admin de pruebas).'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  -- ---------------------------------------------------------------- salones, estudiantes y módulos con la versión nueva del Grade Chart
  for i in 1..2 loop
    v_id := public.guardar_salon(null, jsonb_build_object('codigo', 'FORM-PRUEBA-' || i, 'nombre', 'Salón Formative de prueba ' || i, 'programa_id', (select id from public.programas order by nombre limit 1),
              'fecha_inicio', (v_hoy - 60)::text, 'fecha_fin_estimada', (v_hoy + 30)::text, 'capacidad', 8, 'estado', 'en_curso', 'total_sesiones', 6),
              '[{"dia":1,"hora_inicio":"18:00","hora_fin":"19:30"},{"dia":3,"hora_inicio":"18:00","hora_fin":"19:30"}]'::jsonb);
    if i = 1 then v_salon := v_id; else v_otro := v_id; end if;
  end loop;
  for i in 1..4 loop
    v_id := public.guardar_alumno(null, jsonb_build_object('nombre', nombres[i] || ' Prueba Formative'));
    a := a || v_id;
  end loop;
  perform public.matricular_alumnos(v_salon, a);
  ana := a[1]; beto := a[2]; carla := a[3]; diego := a[4];

  select id into v_rub_for from public.eval_rubricas where lower(btrim(nombre)) = lower('Formative Assessment · elementos');
  select v.id into v_ver from public.eval_versiones v join public.eval_plantillas p on p.id = v.plantilla_id
   where p.nombre = 'Grade Chart Universa' and v.estado = 'vigente' and v.variante = 'normal';
  select * into v_prev from public.eval_versiones where plantilla_id = (select plantilla_id from public.eval_versiones where id = v_ver) and variante = 'normal' and version = (select version - 1 from public.eval_versiones where id = v_ver);

  -- ---------------------------------------------------------------- plantilla: SPARK dentro del Formative, sin contarlo dos veces
  perform pg_temp.chk(exists (select 1 from public.eval_componentes where version_id = v_ver and tipo = 'formative' and rubrica_id = v_rub_for), 'versión vigente: el Formative usa la rúbrica de 5 elementos');
  perform pg_temp.chk(not exists (select 1 from public.eval_componentes where version_id = v_ver and tipo = 'spark'), 'versión vigente: NO hay componente SPARK aparte (no se cuenta dos veces)');
  perform pg_temp.chk((select sum(peso) from public.eval_componentes where version_id = v_ver) = (select escala_puntos from public.eval_versiones where id = v_ver), 'versión vigente: los pesos suman la escala (módulos 1 a 3)');
  perform pg_temp.chk((select peso from public.eval_componentes where version_id = v_ver and tipo = 'formative')
                      = (select coalesce(sum(peso) filter (where tipo in ('formative', 'participacion')), 0) + coalesce(sum(peso) filter (where tipo = 'spark'), 0) from public.eval_componentes where version_id = v_prev.id),
                      'versión vigente: peso del Formative = peso anterior del Formative + peso del SPARK');
  perform pg_temp.chk((select sum(peso_final) from public.eval_componentes where version_id = v_ver) = (select escala_puntos from public.eval_versiones where id = v_ver), 'versión vigente: los pesos del módulo final también suman la escala');
  perform pg_temp.chk((select peso_participacion from public.eval_componentes where version_id = v_ver and tipo = 'formative') = 20, 'versión vigente: participación = 20 % del Formative (5 elementos × 16 % + 20 %)');
  perform pg_temp.chk(exists (select 1 from public.eval_versiones where origen_id = v_ver and variante = 'final' and estado = 'vigente'), 'versión vigente: tiene su variante de módulo final');
  perform pg_temp.chk(not exists (select 1 from public.eval_versiones where plantilla_id = v_prev.plantilla_id and variante = 'normal' and estado = 'vigente' and id <> v_ver), 'plantilla: una sola versión vigente');
  perform pg_temp.chk((select count(*) from public.eval_rubrica_criterios where rubrica_id = v_rub_for) = 5 and (select count(distinct max_puntaje) from public.eval_rubrica_criterios where rubrica_id = v_rub_for) = 1
                      and (select max(max_puntaje) from public.eval_rubrica_criterios where rubrica_id = v_rub_for) = 5, 'rúbrica: 5 criterios, todos de 0 a 5 (mismo peso)');
  perform pg_temp.chk((select array_agg(lower(nombre) order by orden) from public.eval_rubrica_criterios where rubrica_id = v_rub_for) = array['listening / lessons', 'writing', 'reading', 'speaking', 'spark homework'], 'rúbrica: Listening / Lessons, Writing, Reading, Speaking y SPARK Homework');

  v_mod := public.guardar_modulo(null, v_salon, 'Módulo 1', 1::smallint, 1);
  perform public.asignar_plantilla(v_mod, v_ver);
  v_mod_otro := public.guardar_modulo(null, v_otro, 'Módulo otro salón', 1::smallint, 1);
  perform public.asignar_plantilla(v_mod_otro, v_ver);
  select e.id into v_ev from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id where e.modulo_id = v_mod and c.tipo = 'formative';
  select e.id into v_ev_test from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id where e.modulo_id = v_mod and c.tipo = 'test';
  select e.id into v_ev_otro from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id where e.modulo_id = v_mod_otro and c.tipo = 'formative';
  perform pg_temp.chk((select unidades from public.eval_evaluaciones where id = v_ev) = array['Unit 1', 'Unit 2', 'Unit 3'], 'el Formative nace con Unit 1, Unit 2 y Unit 3 (misma estructura en cada unidad)');
  perform pg_temp.chk(public.formative_criterios(v_ev) is not null and public.formative_criterios(v_ev_test) is null, 'formative_criterios: reconoce el Formative de 5 elementos y rechaza otros componentes');

  -- Notas históricas de referencia (una nota publicada de Test) para comprobar que nada existente cambia.
  perform public.guardar_calificaciones(v_ev_test, jsonb_build_array(jsonb_build_object('alumno_id', ana, 'unidad', '', 'puntaje', 88)));
  perform public.publicar_evaluacion(v_ev_test, array[ana]);
  select count(*), coalesce(sum(puntaje), 0) into v_calif, v_suma from public.eval_calificaciones where evaluacion_id <> v_ev;
  select count(*) into v_hist from public.eval_historial;

  -- Rúbricas de prueba: Writing (20 + 10), Speaking (10 + 10) y Project (para comprobar que NO sustituye a Speaking).
  insert into public.eval_rubricas (nombre, tipo, descripcion) values ('Writing prueba Formative', 'writing', 'prueba') returning id into r_wri;
  insert into public.eval_rubrica_criterios (rubrica_id, nombre, max_puntaje, orden) values (r_wri, 'Contenido', 20, 1) returning id into w1;
  insert into public.eval_rubrica_criterios (rubrica_id, nombre, max_puntaje, orden) values (r_wri, 'Lenguaje', 10, 2) returning id into w2;
  insert into public.eval_rubricas (nombre, tipo, descripcion) values ('Speaking prueba Formative', 'speaking', 'prueba') returning id into r_spk;
  insert into public.eval_rubrica_criterios (rubrica_id, nombre, max_puntaje, orden) values (r_spk, 'Fluidez', 10, 1) returning id into s1;
  insert into public.eval_rubrica_criterios (rubrica_id, nombre, max_puntaje, orden) values (r_spk, 'Pronunciación', 10, 2) returning id into s2;
  insert into public.eval_rubricas (nombre, tipo, descripcion) values ('Project prueba Formative', 'project', 'prueba') returning id into r_pro;
  insert into public.eval_rubrica_criterios (rubrica_id, nombre, max_puntaje, orden) values (r_pro, 'Criterio único', 10, 1);

  e_l := pg_temp.ejercicio('L1 lessons', 'multiple_choice'); e_r := pg_temp.ejercicio('R1 reading', 'fill_gap');
  e_w := pg_temp.ejercicio('W1 writing', 'writing'); e_s := pg_temp.ejercicio('S1 speaking', 'speaking'); e_pr := pg_temp.ejercicio('Práctica libre', 'multiple_choice');

  -- ---------------------------------------------------------------- asignar: práctica u oficial (unidad y habilidad)
  as_pr := public.asignar_ejercicio(e_pr, v_salon, null);
  perform pg_temp.chk(public.formative_etiqueta(as_pr) is null, 'práctica: la asignación normal no tiene vínculo con el Formative');
  as_l := public.asignar_ejercicio_formative(e_l, v_salon, null, v_ev, 'Unit 1', 'listening', null);
  as_r := public.asignar_ejercicio_formative(e_r, v_salon, null, v_ev, 'Unit 1', 'reading', null);
  as_w := public.asignar_ejercicio_formative(e_w, v_salon, null, v_ev, 'Unit 1', 'writing', r_wri);
  as_s := public.asignar_ejercicio_formative(e_s, v_salon, null, v_ev, 'Unit 1', 'speaking', r_spk);
  perform pg_temp.chk((select count(*) from public.eval_formative_vinculos where evaluacion_id = v_ev) = 4, 'oficial: 4 vínculos creados (Listening / Lessons, Reading, Writing, Speaking)');
  perform pg_temp.chk(public.formative_etiqueta(as_r)->>'habilidad' = 'reading' and public.formative_etiqueta(as_r)->>'unidad' = 'Unit 1' and public.formative_etiqueta(as_r)->>'modulo' = 'Módulo 1', 'oficial: la etiqueta trae módulo, unidad y habilidad');
  perform pg_temp.chk((select rubrica_id from public.eval_formative_vinculos where asignacion_id = as_w) = r_wri and (select rubrica_id from public.eval_formative_vinculos where asignacion_id = as_l) is null, 'rúbrica solo en writing / speaking');

  v_msg := pg_temp.falla(format('select public.asignar_ejercicio_formative(%L, %L, null, %L, %L, %L, null)', e_l, v_salon, v_ev_otro, 'Unit 1', 'listening'));
  perform pg_temp.chk(v_msg like '%módulo de este salón%', 'validación: el Formative de OTRO salón se rechaza');
  v_msg := pg_temp.falla(format('select public.asignar_ejercicio_formative(%L, %L, null, %L, %L, %L, null)', e_l, v_salon, v_ev, 'Unit 9', 'listening'));
  perform pg_temp.chk(v_msg like '%unidad%', 'validación: una unidad inexistente se rechaza');
  v_msg := pg_temp.falla(format('select public.asignar_ejercicio_formative(%L, %L, null, %L, %L, %L, null)', e_l, v_salon, v_ev, 'Unit 1', 'spark'));
  perform pg_temp.chk(v_msg like '%habilidad%', 'validación: SPARK no es una habilidad del banco (es nota manual)');
  v_msg := pg_temp.falla(format('select public.asignar_ejercicio_formative(%L, %L, null, %L, %L, %L, null)', e_l, v_salon, v_ev_test, 'Unit 1', 'listening'));
  perform pg_temp.chk(v_msg like '%plantilla de Formative anterior%', 'validación: un componente sin los 5 elementos no recibe actividades del banco');
  v_msg := pg_temp.falla(format('select public.asignar_ejercicio_formative(%L, %L, null, %L, %L, %L, %L)', e_s, v_salon, v_ev, 'Unit 1', 'speaking', r_pro));
  perform pg_temp.chk(v_msg like '%rúbrica activa%', 'rúbricas: Project NO sustituye a una rúbrica de Speaking');
  v_msg := pg_temp.falla(format('select public.asignar_ejercicio_formative(%L, %L, null, %L, %L, %L, %L)', e_s, v_salon, v_ev, 'Unit 1', 'speaking', r_wri));
  perform pg_temp.chk(v_msg like '%rúbrica activa%', 'rúbricas: una rúbrica de Writing tampoco sirve para un ejercicio de Speaking');
  perform pg_temp.chk(jsonb_array_length(public.formative_opciones(v_salon)->'destinos') = 1, 'opciones: el salón ofrece su módulo con Formative de 5 elementos');
  perform pg_temp.chk(not exists (select 1 from jsonb_array_elements(public.formative_opciones(v_salon)->'rubricas') r where r->>'tipo' not in ('writing', 'speaking')), 'opciones: solo rúbricas writing / speaking (nunca Project)');

  -- ---------------------------------------------------------------- entregas
  perform pg_temp.entrega_auto(as_l, ana, 4, 5); perform pg_temp.entrega_auto(as_r, ana, 3, 3);
  ent_w := pg_temp.entrega_manual(as_w, ana, 'writing'); ent_s := pg_temp.entrega_manual(as_s, ana, 'speaking');
  perform pg_temp.entrega_auto(as_l, beto, 1, 2); ent_w_beto := pg_temp.entrega_manual(as_w, beto, 'writing');
  perform pg_temp.entrega_auto(as_pr, diego, 3, 3); -- práctica

  -- ---------------------------------------------------------------- calificar con rúbrica (sin mínimos)
  v_msg := pg_temp.falla(format('select public.calificar_entrega(%L, 80, null)', ent_w));
  perform pg_temp.chk(v_msg like '%Formative%rúbrica%', 'writing oficial: la nota libre 0–100 se rechaza, se usa la rúbrica');
  v_msg := pg_temp.falla(format('select public.calificar_entrega_rubrica(%L, %L::jsonb, null)', ent_w, jsonb_build_array(jsonb_build_object('criterio_id', w1, 'puntaje', 15))));
  perform pg_temp.chk(v_msg like '%Faltan criterios%', 'rúbrica: faltan criterios → se rechaza (no se rellena con cero)');
  v_msg := pg_temp.falla(format('select public.calificar_entrega_rubrica(%L, %L::jsonb, null)', ent_w, pg_temp.rubrica(null, w1, 21, w2, 5)));
  perform pg_temp.chk(v_msg like '%entre 0 y 20%', 'rúbrica: un criterio no puede pasar su máximo');
  perform pg_temp.chk(pg_temp.casi(public.calificar_entrega_rubrica(ent_w, pg_temp.rubrica(null, w1, 15, w2, 7.5), 'Bien'), 75), 'Writing: 15/20 + 7.5/10 = 22.5/30 = 75');
  perform pg_temp.chk(pg_temp.casi(public.calificar_entrega_rubrica(ent_s, pg_temp.rubrica(null, s1, 9, s2, 9), null), 90), 'Speaking: 9/10 + 9/10 = 18/20 = 90');
  perform pg_temp.chk((select estado from public.ejercicio_entregas where id = ent_w) = 'revisada' and (select detalle->'criterios'->0->>'criterio' from public.ejercicio_entregas where id = ent_w) = 'Contenido', 'rúbrica: la entrega queda revisada con copia de los criterios');
  perform pg_temp.chk(public.ej_nota_entrega('writing', (select e from public.ejercicio_entregas e where e.id = ent_w_beto)) is null, 'writing por revisar: sin nota (null), no cero');

  -- ---------------------------------------------------------------- SPARK manual
  v_msg := pg_temp.falla(format('select public.guardar_spark_manual(%L, %L::jsonb)', v_ev, jsonb_build_array(jsonb_build_object('alumno_id', ana, 'unidad', 'Unit 1', 'puntaje', 5.5))));
  perform pg_temp.chk(v_msg like '%entre 0 y 5%', 'SPARK manual: más de 5 se rechaza');
  v_msg := pg_temp.falla(format('select public.guardar_spark_manual(%L, %L::jsonb)', v_ev, jsonb_build_array(jsonb_build_object('alumno_id', ana, 'unidad', 'Unit 8', 'puntaje', 4))));
  perform pg_temp.chk(v_msg like '%unidad%', 'SPARK manual: unidad inexistente se rechaza');
  v_msg := pg_temp.falla(format('select public.guardar_spark_manual(%L, %L::jsonb)', v_ev, jsonb_build_array(jsonb_build_object('alumno_id', gen_random_uuid(), 'unidad', 'Unit 1', 'puntaje', 4))));
  perform pg_temp.chk(v_msg like '%matriculado%', 'SPARK manual: un estudiante que no es del salón se rechaza');
  perform public.guardar_spark_manual(v_ev, jsonb_build_array(jsonb_build_object('alumno_id', ana, 'unidad', 'Unit 1', 'puntaje', 4.5), jsonb_build_object('alumno_id', beto, 'unidad', 'Unit 1', 'puntaje', 3)));
  perform pg_temp.chk((select puntaje from public.eval_formative_spark where evaluacion_id = v_ev and alumno_id = ana and unidad = 'Unit 1') = 4.5, 'SPARK manual: Ana 4.5 guardado');
  perform public.guardar_spark_manual(v_ev, jsonb_build_array(jsonb_build_object('alumno_id', diego, 'unidad', 'Unit 1', 'puntaje', 2)));
  perform public.guardar_spark_manual(v_ev, jsonb_build_array(jsonb_build_object('alumno_id', diego, 'unidad', 'Unit 1', 'puntaje', '')));
  perform pg_temp.chk(not exists (select 1 from public.eval_formative_spark where evaluacion_id = v_ev and alumno_id = diego), 'SPARK manual: vaciar la nota la borra (queda pendiente, no cero)');
  perform pg_temp.chk(not exists (select 1 from public.eval_calificaciones where evaluacion_id = v_ev), 'SPARK manual y propuesta no escriben notas oficiales todavía');

  -- ---------------------------------------------------------------- propuesta
  v_f := pg_temp.fila(v_ev, ana, 'Unit 1');
  perform pg_temp.chk((v_f->>'completos')::int = 5, 'Ana: 5 de 5 elementos');
  perform pg_temp.chk(pg_temp.casi((v_f->'elementos'->'listening'->>'valor')::numeric, 4) and pg_temp.casi((v_f->'elementos'->'reading'->>'valor')::numeric, 5)
                      and pg_temp.casi((v_f->'elementos'->'writing'->>'valor')::numeric, 3.75) and pg_temp.casi((v_f->'elementos'->'speaking'->>'valor')::numeric, 4.5), 'Ana: valores 4, 5, 3.75 y 4.5 (promedio 0–100 → 0–5)');
  perform pg_temp.chk(pg_temp.casi((v_f->>'valor')::numeric, 87), 'Ana: la unidad resulta 87.00 = 21.75 / 25 × 100');
  v_f := pg_temp.fila(v_ev, beto, 'Unit 1');
  perform pg_temp.chk((v_f->>'completos')::int = 2 and v_f->'valor' = 'null'::jsonb, 'Beto: 2 de 5 elementos → sin nota de unidad (parcial, no cero)');
  perform pg_temp.chk(pg_temp.casi((v_f->>'provisional')::numeric, (2.5 + 3) / 10 * 100), 'Beto: avance provisional 55 = promedio de los elementos disponibles (no es una nota)');
  perform pg_temp.chk(exists (select 1 from jsonb_array_elements(v_f->'elementos'->'writing'->'actividades') x where x->>'estado' = 'por_revisar') and (v_f->'elementos'->'reading'->>'n_calificadas')::int = 0, 'Beto: distingue «por revisar» y «sin calificar» (nunca cero)');
  v_f := pg_temp.fila(v_ev, carla, 'Unit 1');
  perform pg_temp.chk((v_f->>'completos')::int = 0 and v_f->'valor' = 'null'::jsonb and v_f->'provisional' = 'null'::jsonb, 'Carla: sin nada → sin valor ni avance (no cero)');
  perform pg_temp.chk(not exists (select 1 from jsonb_array_elements(public.formative_propuesta(v_ev)->'actividades') x where x->>'asignacion_id' = as_pr::text), 'la actividad de práctica no figura entre las oficiales');
  perform pg_temp.chk(jsonb_array_length(public.formative_propuesta(v_ev)->'filas') = 12, 'propuesta: 4 estudiantes × 3 unidades (la misma estructura en cada unidad)');

  -- ---------------------------------------------------------------- confirmar
  v_msg := pg_temp.falla(format('select public.confirmar_formative(%L, %L, array[%L, %L]::uuid[], null)', v_ev, 'Unit 1', beto, carla));
  perform pg_temp.chk(v_msg like '%sigue parcial%', 'Beto y Carla: con elementos pendientes no se publica nada (parcial)');
  perform pg_temp.chk(not exists (select 1 from public.eval_calificaciones where evaluacion_id = v_ev and alumno_id in (beto, carla)), 'Beto y Carla: no se creó ninguna nota (ni cero)');

  perform public.guardar_calificaciones(v_ev, jsonb_build_array(jsonb_build_object('alumno_id', ana, 'unidad', 'Unit 2', 'puntaje', 50)));
  v_msg := pg_temp.falla(format('select public.confirmar_formative(%L, %L, array[%L]::uuid[], null)', v_ev, 'Unit 1', ana));
  perform pg_temp.chk(v_msg like '%borrador%otra unidad%', 'un borrador manual de otra unidad bloquea la confirmación (no se publica por accidente)');
  perform public.guardar_calificaciones(v_ev, jsonb_build_array(jsonb_build_object('alumno_id', ana, 'unidad', 'Unit 2', 'puntaje', null)));
  perform pg_temp.chk(not exists (select 1 from public.eval_calificaciones where evaluacion_id = v_ev and alumno_id = ana), 'se borró el borrador de prueba de Unit 2');

  v_r := public.confirmar_formative(v_ev, 'Unit 1', array[ana, beto], null);
  perform pg_temp.chk((v_r->>'publicadas')::int = 1 and (v_r->>'parciales')::int = 1, 'confirmar: publica a Ana y deja a Beto parcial');
  select * into v_k from public.eval_calificaciones where evaluacion_id = v_ev and alumno_id = ana and unidad = 'Unit 1';
  perform pg_temp.chk(v_k.estado = 'publicada' and v_k.puntaje = 87, 'Ana: la nota de la unidad queda publicada (87.00)');
  perform pg_temp.chk(jsonb_array_length(v_k.detalle) = 5 and (select array_agg(x->>'criterio' order by ord) from jsonb_array_elements(v_k.detalle) with ordinality t(x, ord)) = array['Listening / Lessons', 'Writing', 'Reading', 'Speaking', 'SPARK Homework'],
                      'Ana: la nota guarda la copia de los 5 criterios');
  perform pg_temp.chk(not exists (select 1 from public.eval_calificaciones where evaluacion_id = v_ev and alumno_id = beto), 'Beto: sigue sin nota publicada');
  perform pg_temp.chk((select count(*) from public.eval_formative_confirmaciones where evaluacion_id = v_ev and alumno_id = ana and accion = 'publicada') = 1, 'auditoría: se guardó qué elementos se usaron');
  v_r := public.confirmar_formative(v_ev, 'Unit 1', array[ana], null);
  perform pg_temp.chk((v_r->>'sin_cambios')::int = 1 and (v_r->>'publicadas')::int = 0, 'confirmar otra vez sin cambios no escribe nada');

  -- ---------------------------------------------------------------- cálculo del módulo: SPARK no se cuenta dos veces; 80 % unidades + 20 % participación
  perform pg_temp.chk(not exists (select 1 from jsonb_array_elements(public.eval_calc_modulo(v_mod, ana)->'componentes') x where x->>'tipo' = 'spark'), 'módulo: no hay componente SPARK que sume otra vez');
  v_comp := (select x from jsonb_array_elements(public.eval_calc_modulo(v_mod, ana)->'componentes') x where x->>'tipo' = 'formative');
  perform pg_temp.chk(v_comp->>'estado' = 'incompleto' and v_comp->'nota' = 'null'::jsonb, 'módulo: con solo Unit 1 publicada el Formative figura incompleto (parcial, no cero)');
  perform public.guardar_calificaciones(v_ev, jsonb_build_array(jsonb_build_object('alumno_id', ana, 'unidad', 'Unit 2', 'puntaje', 87), jsonb_build_object('alumno_id', ana, 'unidad', 'Unit 3', 'puntaje', 87)));
  perform public.publicar_evaluacion(v_ev, array[ana]);
  perform set_config('universa.participacion', 'on', true);
  insert into public.eval_calificaciones (evaluacion_id, alumno_id, unidad, puntaje, estado, publicada_at) values (v_ev, ana, '', 50, 'publicada', now());
  perform set_config('universa.participacion', 'off', true);
  v_comp := (select x from jsonb_array_elements(public.eval_calc_modulo(v_mod, ana)->'componentes') x where x->>'tipo' = 'formative');
  perform pg_temp.chk(v_comp->>'estado' = 'completo' and pg_temp.casi((v_comp->>'nota')::numeric, 0.8 * 87 + 0.2 * 50), 'módulo: Formative = 80 % × promedio de unidades (87) + 20 % × participación (50) = 79.60');

  -- Carla: unidades al 100 y participación 0 → el Formative vale 80 (5 elementos = 80 %) y la participación aporta el 20 % restante.
  perform public.guardar_calificaciones(v_ev, jsonb_build_array(jsonb_build_object('alumno_id', carla, 'unidad', 'Unit 1', 'puntaje', 100), jsonb_build_object('alumno_id', carla, 'unidad', 'Unit 2', 'puntaje', 100), jsonb_build_object('alumno_id', carla, 'unidad', 'Unit 3', 'puntaje', 100)));
  perform public.publicar_evaluacion(v_ev, array[carla]);
  perform set_config('universa.participacion', 'on', true);
  insert into public.eval_calificaciones (evaluacion_id, alumno_id, unidad, puntaje, estado, publicada_at) values (v_ev, carla, '', 0, 'publicada', now());
  perform set_config('universa.participacion', 'off', true);
  v_comp := (select x from jsonb_array_elements(public.eval_calc_modulo(v_mod, carla)->'componentes') x where x->>'tipo' = 'formative');
  perform pg_temp.chk(pg_temp.casi((v_comp->>'nota')::numeric, 80), 'reparto: unidades al 100 y participación 0 → Formative 80 (los 5 elementos pesan 80 %, 16 % cada uno)');

  -- ---------------------------------------------------------------- corrección posterior con motivo e historial
  perform public.calificar_entrega_rubrica(ent_w, pg_temp.rubrica(null, w1, 20, w2, 10), 'Reentrega');
  v_f := pg_temp.fila(v_ev, ana, 'Unit 1');
  perform pg_temp.chk(pg_temp.casi((v_f->>'valor')::numeric, 89), 'Ana: tras recalificar Writing, la unidad resulta 89.00');
  perform pg_temp.chk((v_f->'registrada'->>'estado') = 'publicada' and round((v_f->>'valor')::numeric, 2) <> (v_f->'registrada'->>'puntaje')::numeric, 'Ana: la propuesta detecta que difiere de la nota publicada');
  v_msg := pg_temp.falla(format('select public.confirmar_formative(%L, %L, array[%L]::uuid[], null)', v_ev, 'Unit 1', ana));
  perform pg_temp.chk(v_msg like '%motivo%', 'Ana: corregir una nota publicada exige motivo');
  v_r := public.confirmar_formative(v_ev, 'Unit 1', array[ana], 'Reentrega del writing');
  perform pg_temp.chk((v_r->>'corregidas')::int = 1, 'Ana: la corrección se aplica con corregir_calificacion');
  perform pg_temp.chk((select puntaje from public.eval_calificaciones where evaluacion_id = v_ev and alumno_id = ana and unidad = 'Unit 1') = 89, 'Ana: nota corregida 89.00');
  perform pg_temp.chk((select count(*) from public.eval_historial h join public.eval_calificaciones k on k.id = h.calificacion_id
                        where k.evaluacion_id = v_ev and k.alumno_id = ana and k.unidad = 'Unit 1' and h.puntaje_anterior = 87 and h.puntaje_nuevo = 89 and h.motivo = 'Reentrega del writing') = 1,
                      'historial: queda 87 → 89 con el motivo');

  -- ---------------------------------------------------------------- listados y notas existentes
  perform public.quitar_asignacion(as_r);
  perform pg_temp.chk(not exists (select 1 from jsonb_array_elements(public.formative_propuesta(v_ev)->'actividades') x where x->>'asignacion_id' = as_r::text), 'quitar una asignación la saca de la propuesta');
  perform pg_temp.chk(exists (select 1 from jsonb_array_elements(public.ejercicios_salon(v_salon)) x where x->>'id' = as_l::text and x->'formative'->>'habilidad' = 'listening')
                      and exists (select 1 from jsonb_array_elements(public.ejercicios_salon(v_salon)) x where x->>'id' = as_pr::text and x->'formative' = 'null'::jsonb), 'ejercicios_salon: marca oficial (módulo, unidad, habilidad) o práctica');
  perform pg_temp.chk(jsonb_array_length(public.entregas_ejercicio(as_w)->'asignacion'->'formative'->'rubrica'->'criterios') = 2, 'entregas_ejercicio: trae la rúbrica del vínculo con sus 2 criterios');
  perform pg_temp.chk((select count(*) from public.eval_calificaciones where evaluacion_id <> v_ev) = v_calif
                      and (select coalesce(sum(puntaje), 0) from public.eval_calificaciones where evaluacion_id <> v_ev) = v_suma, 'notas de otros componentes: sin cambios (cantidad y suma)');
  perform pg_temp.chk((select count(*) from public.eval_historial) = v_hist + 1, 'historial: solo se agregó la corrección de Ana');
end $$;

select n, ok, prueba from _res order by n;
rollback;
