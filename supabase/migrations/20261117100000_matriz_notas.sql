-- UNIVERSA · Matriz de calificaciones (rediseño del módulo de Evaluaciones).
--
-- Reutiliza lo que ya existe (plantillas versionadas, rúbricas, módulos, evaluaciones y notas de 20261116100000_evaluaciones.sql).
-- No crea otro sistema de notas. Agrega lo mínimo:
--
--  * PLANTILLAS de Universa según Grades Chart, ya vigentes y SEPARADAS de las referencias históricas (que no se tocan):
--      «Universa · Módulos 1 a 3 (25 puntos)»: Test 7, Writing 6, Project 7, Formative 3, SPARK 2.
--      «Universa · Módulo 4 final (25 puntos)»: Final Test 8, Writing 6, Final Project 8, Formative 2, SPARK 1.
--    Cuatro módulos = 100 puntos. Sigue siendo configurable y versionado: los pesos se cambian con una versión nueva.
--  * FORMATIVE ASSESSMENT pasa a ser PARTICIPACIÓN POR CLASE (componente de tipo «participacion», sin rúbrica). Cada clase del
--    módulo se marca como cumplida o no cumplida; una clase sin marcar queda PENDIENTE (nunca cuenta como no cumplida) y la
--    asistencia no se usa como participación. Nota = clases cumplidas / clases del módulo × 100; se publica cuando todas las clases
--    del módulo se realizaron y se registraron. Corregir una participación publicada exige motivo y deja historial.
--  * Vínculo MÍNIMO sesión → módulo: cada módulo guarda desde qué clase hasta qué clase del salón abarca (número de clase
--    dentro del calendario del salón, sin contar canceladas). No se toca la tabla de sesiones ni la agenda.
--  * EXAMEN REMEDIAL: se registra, y SOLO un administrador lo aplica explícitamente sobre un módulo o un ciclo. Conserva el
--    resultado original y se puede anular. No se inventan nota mínima, intentos ni condiciones: quedan pendientes de Coordinación.
--  * Lecturas: matriz del salón (docente asignado o administración), pendientes de registro (administración) y vista del estudiante
--    con ciclos y remedial. Los módulos sin notas publicadas no muestran ceros.
--
-- Repetible. Requiere 20261116100000_evaluaciones.sql.

-- ============================================================
-- 1. Componente de participación y rango de clases por módulo
-- ============================================================
alter table public.eval_componentes drop constraint if exists eval_componentes_tipo_check;
alter table public.eval_componentes add constraint eval_componentes_tipo_check
  check (tipo in ('test', 'writing', 'project', 'formative', 'spark', 'speaking', 'participacion', 'otro'));

alter table public.eval_modulos add column if not exists sesion_desde integer;
alter table public.eval_modulos add column if not exists sesion_hasta integer;
alter table public.eval_modulos drop constraint if exists eval_modulos_sesiones_ck;
alter table public.eval_modulos add constraint eval_modulos_sesiones_ck
  check ((sesion_desde is null and sesion_hasta is null) or (sesion_desde >= 1 and sesion_hasta >= sesion_desde));

-- ============================================================
-- 2. Tablas nuevas: participación por clase y remediales
-- ============================================================
create table if not exists public.eval_participaciones (
  evaluacion_id uuid not null references public.eval_evaluaciones(id) on delete cascade,
  sesion_id uuid not null references public.salon_sesiones(id) on delete cascade,
  alumno_id uuid not null references public.alumnos(id),
  cumplio boolean not null, -- sin fila = pendiente de registrar (no es «no cumplió»)
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (evaluacion_id, sesion_id, alumno_id)
);
create index if not exists eval_participaciones_alumno_idx on public.eval_participaciones (alumno_id);

create table if not exists public.eval_remediales (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salones(id) on delete cascade,
  alumno_id uuid not null references public.alumnos(id),
  ambito text not null check (ambito in ('modulo', 'ciclo')), -- qué resultado reemplaza
  modulo_id uuid references public.eval_modulos(id) on delete cascade,
  ciclo smallint,
  nota numeric(5,2) not null check (nota >= 0 and nota <= 100),
  comentario text check (length(comentario) <= 1000),
  estado text not null default 'registrado' check (estado in ('registrado', 'aplicado', 'anulado')),
  original jsonb, -- resultado que se reemplazó, tal como estaba al aplicar
  motivo_anulacion text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  aplicado_por uuid references auth.users(id) on delete set null,
  aplicado_at timestamptz,
  check ((ambito = 'modulo' and modulo_id is not null and ciclo is null) or (ambito = 'ciclo' and ciclo is not null and modulo_id is null))
);
create index if not exists eval_remediales_salon_idx on public.eval_remediales (salon_id, alumno_id);
create unique index if not exists eval_remediales_modulo_aplicado on public.eval_remediales (alumno_id, modulo_id) where estado = 'aplicado' and ambito = 'modulo';
create unique index if not exists eval_remediales_ciclo_aplicado on public.eval_remediales (alumno_id, salon_id, ciclo) where estado = 'aplicado' and ambito = 'ciclo';

do $$
declare t text;
begin
  foreach t in array array['eval_participaciones', 'eval_remediales'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists "admin consulta" on public.%I', t);
    execute format('create policy "admin consulta" on public.%I for select to authenticated using ((select public.es_admin()))', t);
  end loop;
end $$;

-- La nota de una participación se DERIVA de las clases marcadas: nadie la escribe a mano (ni por guardar_calificaciones ni por
-- corregir_calificacion). Solo las funciones de participación activan la bandera local.
create or replace function public.eval_proteger_participacion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('universa.participacion', true), '') <> 'on'
     and exists (select 1 from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id
                  where e.id = new.evaluacion_id and c.tipo = 'participacion') then
    raise exception 'La participación se registra por clase, no con una nota directa';
  end if;
  return new;
end $$;
drop trigger if exists eval_calificaciones_participacion on public.eval_calificaciones;
create trigger eval_calificaciones_participacion before insert or update on public.eval_calificaciones
  for each row execute function public.eval_proteger_participacion();

-- ============================================================
-- 3. Plantillas: aceptar el tipo «participacion» (sin rúbrica)
-- ============================================================
create or replace function public.guardar_version(p_version uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_v public.eval_versiones;
  v_escala numeric;
  v_comp jsonb := coalesce(p_datos->'componentes', '[]'::jsonb);
  v_c jsonb; v_nom text; v_peso numeric; v_tipo text; v_rub uuid;
  v_nombres text[] := '{}'; v_orden integer := 0;
begin
  perform public.cal_exigir_admin();
  select * into v_v from public.eval_versiones where id = p_version for update;
  if not found then raise exception 'La versión no existe'; end if;
  if v_v.estado <> 'borrador' then raise exception 'Solo se puede editar una versión en borrador; crea una versión nueva para cambiar pesos'; end if;
  begin v_escala := coalesce((p_datos->>'escala_puntos')::numeric, v_v.escala_puntos); exception when others then v_escala := null; end;
  if v_escala is null or v_escala <= 0 or v_escala > 1000 then raise exception 'La escala de puntos debe ser mayor que 0'; end if;
  if jsonb_typeof(v_comp) <> 'array' or jsonb_array_length(v_comp) > 12 then raise exception 'Una plantilla admite hasta 12 componentes'; end if;

  for v_c in select * from jsonb_array_elements(v_comp) loop
    v_nom := btrim(coalesce(v_c->>'nombre', ''));
    if v_nom = '' then raise exception 'Todos los componentes necesitan nombre'; end if;
    if lower(v_nom) = any(v_nombres) then raise exception 'El componente «%» está repetido', v_nom; end if;
    v_nombres := v_nombres || lower(v_nom);
    begin v_peso := (v_c->>'peso')::numeric; exception when others then v_peso := null; end;
    if v_peso is null or v_peso <= 0 then raise exception 'El peso de «%» debe ser mayor que 0', v_nom; end if;
    if v_peso > v_escala then raise exception 'El peso de «%» no puede superar la escala (%)', v_nom, v_escala; end if;
    v_tipo := coalesce(nullif(v_c->>'tipo', ''), 'otro');
    if v_tipo not in ('test', 'writing', 'project', 'formative', 'spark', 'speaking', 'participacion', 'otro') then raise exception 'Tipo de componente no válido'; end if;
    v_rub := nullif(v_c->>'rubrica_id', '')::uuid;
    if v_rub is not null and v_tipo = 'participacion' then raise exception '«%» es una participación por clase y no usa rúbrica', v_nom; end if;
    if v_rub is not null and not exists (select 1 from public.eval_rubricas where id = v_rub and activa) then
      raise exception 'La rúbrica elegida para «%» no existe o está inactiva', v_nom;
    end if;
  end loop;

  update public.eval_versiones set escala_puntos = v_escala, notas = nullif(btrim(coalesce(p_datos->>'notas', '')), '') where id = p_version;
  delete from public.eval_componentes where version_id = p_version;
  for v_c in select * from jsonb_array_elements(v_comp) loop
    v_orden := v_orden + 1;
    insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id)
    values (p_version, btrim(v_c->>'nombre'), coalesce(nullif(v_c->>'tipo', ''), 'otro'), (v_c->>'peso')::numeric, v_orden, nullif(v_c->>'rubrica_id', '')::uuid);
  end loop;
end $$;

-- ============================================================
-- 4. Rúbrica Writing con los criterios que usa Coordinación; plantillas de Universa (Grades Chart)
-- ============================================================
update public.eval_rubrica_criterios c set nombre = 'Content'
  from public.eval_rubricas r where r.id = c.rubrica_id and lower(r.nombre) = 'writing' and c.nombre = 'Content / Ideas';
update public.eval_rubrica_criterios c set nombre = 'Coherence and Cohesion'
  from public.eval_rubricas r where r.id = c.rubrica_id and lower(r.nombre) = 'writing' and c.nombre = 'Coherence and cohesion';
update public.eval_rubrica_criterios c set nombre = 'Spelling and Punctuation'
  from public.eval_rubricas r where r.id = c.rubrica_id and lower(r.nombre) = 'writing' and c.nombre = 'Spelling and punctuation';

do $$
declare v_wri uuid; v_pro uuid; v_p uuid; v_v uuid;
begin
  select id into v_wri from public.eval_rubricas where lower(nombre) = 'writing';
  select id into v_pro from public.eval_rubricas where lower(nombre) = 'project';
  if not exists (select 1 from public.eval_plantillas where nombre = 'Universa · Módulos 1 a 3 (25 puntos)') then
    insert into public.eval_plantillas (nombre, descripcion) values ('Universa · Módulos 1 a 3 (25 puntos)', 'Grades Chart: Test 7, Writing 6, Project 7, Formative (participación por clase) 3, SPARK 2.') returning id into v_p;
    insert into public.eval_versiones (plantilla_id, version, estado, escala_puntos, notas, activada_at)
    values (v_p, 1, 'vigente', 25, 'Formative = participación por clase. Cambios de pesos: crear una versión nueva.', now()) returning id into v_v;
    insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id) values
      (v_v, 'Test', 'test', 7, 1, null), (v_v, 'Writing', 'writing', 6, 2, v_wri), (v_v, 'Project', 'project', 7, 3, v_pro),
      (v_v, 'Formative Assessment', 'participacion', 3, 4, null), (v_v, 'SPARK Homework', 'spark', 2, 5, null);
  end if;
  if not exists (select 1 from public.eval_plantillas where nombre = 'Universa · Módulo 4 final (25 puntos)') then
    insert into public.eval_plantillas (nombre, descripcion) values ('Universa · Módulo 4 final (25 puntos)', 'Grades Chart: Final Test 8, Writing 6, Final Project 8, Formative (participación por clase) 2, SPARK 1.') returning id into v_p;
    insert into public.eval_versiones (plantilla_id, version, estado, escala_puntos, notas, activada_at)
    values (v_p, 1, 'vigente', 25, 'Formative = participación por clase. Cambios de pesos: crear una versión nueva.', now()) returning id into v_v;
    insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id) values
      (v_v, 'Final Test', 'test', 8, 1, null), (v_v, 'Writing', 'writing', 6, 2, v_wri), (v_v, 'Final Project', 'project', 8, 3, v_pro),
      (v_v, 'Formative Assessment', 'participacion', 2, 4, null), (v_v, 'SPARK Homework', 'spark', 1, 5, null);
  end if;
end $$;

-- ============================================================
-- 5. Clases de un módulo y estructura estándar de 4 módulos
-- ============================================================
-- Las clases del módulo son las del calendario del salón (sin canceladas) entre sesion_desde y sesion_hasta, en orden de fecha.
-- «hecha» = ya realizada, o con fecha de hoy o anterior: desde ese momento se puede registrar la participación.
create or replace function public.eval_sesiones_modulo(p_modulo uuid)
returns table (sesion_id uuid, numero integer, fecha date, hora_inicio time, hecha boolean)
language sql stable security definer set search_path = '' as $$
  select s.id, s.n::integer, s.fecha, s.hora_inicio, (s.estado = 'realizada' or s.fecha <= public.hoy_lima())
    from (select q.id, q.fecha, q.hora_inicio, q.estado, row_number() over (order by q.fecha, q.hora_inicio) n
            from public.salon_sesiones q join public.eval_modulos mm on mm.salon_id = q.salon_id
           where mm.id = p_modulo and q.estado <> 'cancelada') s
    join public.eval_modulos m on m.id = p_modulo
   where m.sesion_desde is not null and s.n between m.sesion_desde and m.sesion_hasta
   order by s.n
$$;

create or replace function public.definir_sesiones_modulo(p_modulo uuid, p_desde integer, p_hasta integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_m public.eval_modulos;
begin
  perform public.cal_exigir_admin();
  select * into v_m from public.eval_modulos where id = p_modulo for update;
  if not found then raise exception 'El módulo no existe'; end if;
  if (p_desde is null) <> (p_hasta is null) then raise exception 'Indica la clase inicial y la final'; end if;
  if p_desde is not null and (p_desde < 1 or p_hasta < p_desde) then raise exception 'El rango de clases no es válido'; end if;
  if p_desde is not null and exists (select 1 from public.eval_modulos o where o.salon_id = v_m.salon_id and o.id <> p_modulo
                                      and o.sesion_desde is not null and p_desde <= o.sesion_hasta and p_hasta >= o.sesion_desde) then
    raise exception 'Esas clases se cruzan con las de otro módulo del salón';
  end if;
  if (v_m.sesion_desde is distinct from p_desde or v_m.sesion_hasta is distinct from p_hasta)
     and exists (select 1 from public.eval_participaciones x join public.eval_evaluaciones e on e.id = x.evaluacion_id where e.modulo_id = p_modulo) then
    raise exception 'Ya hay participación registrada en este módulo; no se pueden cambiar sus clases';
  end if;
  update public.eval_modulos set sesion_desde = p_desde, sesion_hasta = p_hasta where id = p_modulo;
end $$;

-- Solo para niveles de 2 ciclos: 2 módulos por ciclo (4 en total), con las plantillas de Grades Chart y las clases de cada ciclo
-- repartidas en dos mitades. Es una acción explícita de administración; nada se crea solo.
create or replace function public.crear_estructura_estandar(p_salon uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_s public.salones; v_v13 uuid; v_v4 uuid; v_ciclo integer; v_q integer; v_mitad integer; v_i integer := 0; v_ini integer := 1;
  v_k integer; v_desde integer; v_hasta integer; v_id uuid;
begin
  perform public.cal_exigir_admin();
  select * into v_s from public.salones where id = p_salon for update;
  if not found then raise exception 'El salón no existe'; end if;
  if v_s.plan_id is null then raise exception 'El salón no tiene plan académico: crea los módulos a mano'; end if;
  if v_s.ciclo_hasta - v_s.ciclo_desde + 1 <> 2 then raise exception 'Esta estructura es solo para niveles de 2 ciclos; configura los módulos a mano'; end if;
  if exists (select 1 from public.eval_modulos where salon_id = p_salon) then raise exception 'El salón ya tiene módulos'; end if;
  select v.id into v_v13 from public.eval_versiones v join public.eval_plantillas p on p.id = v.plantilla_id
   where p.nombre = 'Universa · Módulos 1 a 3 (25 puntos)' and v.estado = 'vigente';
  select v.id into v_v4 from public.eval_versiones v join public.eval_plantillas p on p.id = v.plantilla_id
   where p.nombre = 'Universa · Módulo 4 final (25 puntos)' and v.estado = 'vigente';
  if v_v13 is null or v_v4 is null then raise exception 'Faltan las plantillas vigentes de Universa (Módulos 1 a 3 y Módulo 4)'; end if;
  for v_ciclo in v_s.ciclo_desde..v_s.ciclo_hasta loop
    select sesiones into v_q from public.plan_ciclos where plan_id = v_s.plan_id and ciclo = v_ciclo;
    v_mitad := case when v_q >= 2 then ceil(v_q / 2.0)::integer end;
    for v_k in 1..2 loop
      v_i := v_i + 1;
      if v_mitad is null then v_desde := null; v_hasta := null;
      elsif v_k = 1 then v_desde := v_ini; v_hasta := v_ini + v_mitad - 1;
      else v_desde := v_ini + v_mitad; v_hasta := v_ini + v_q - 1; end if;
      insert into public.eval_modulos (salon_id, nombre, orden, ciclo, sesion_desde, sesion_hasta)
      values (p_salon, 'Módulo ' || v_i, v_i, v_ciclo, v_desde, v_hasta) returning id into v_id;
      perform public.asignar_plantilla(v_id, case when v_i = 4 then v_v4 else v_v13 end);
    end loop;
    v_ini := v_ini + coalesce(v_q, 0);
  end loop;
  return v_i;
end $$;

-- ============================================================
-- 6. Participación por clase (Formative Assessment)
-- ============================================================
-- Resumen de un estudiante: clases del módulo, clases ya hechas, clases con registro y clases cumplidas. Uso interno.
create or replace function public.eval_part_resumen(p_evaluacion uuid, p_alumno uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('total', count(*), 'hechas', count(*) filter (where s.hecha),
                            'registradas', count(p.cumplio), 'cumplidas', count(*) filter (where p.cumplio))
    from public.eval_sesiones_modulo((select e.modulo_id from public.eval_evaluaciones e where e.id = p_evaluacion)) s
    left join public.eval_participaciones p on p.evaluacion_id = p_evaluacion and p.sesion_id = s.sesion_id and p.alumno_id = p_alumno
$$;

create or replace function public.eval_es_participacion(p_evaluacion uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.tipo = 'participacion' from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id where e.id = p_evaluacion), false)
$$;

-- Clases del módulo con la marca de cada estudiante (true = cumplió, false = no cumplió, ausente = pendiente).
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
    'evaluacion', jsonb_build_object('id', v_e.id, 'nombre', v_e.nombre, 'modulo', v_m.nombre, 'modulo_id', v_m.id, 'peso', v_c.peso, 'salon_id', v_salon),
    'sesiones', coalesce((select jsonb_agg(jsonb_build_object('id', s.sesion_id, 'numero', s.numero, 'fecha', s.fecha, 'hora_inicio', s.hora_inicio, 'hecha', s.hecha) order by s.numero)
                            from public.eval_sesiones_modulo(v_m.id) s), '[]'::jsonb),
    'alumnos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'alumno_id', a.id, 'nombre', a.nombre,
        'marcas', coalesce((select jsonb_object_agg(p.sesion_id::text, p.cumplio) from public.eval_participaciones p where p.evaluacion_id = p_evaluacion and p.alumno_id = a.id), '{}'::jsonb),
        'resumen', public.eval_part_resumen(p_evaluacion, a.id),
        'publicada', exists (select 1 from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = a.id and k.estado = 'publicada'),
        'puntaje', (select k.puntaje from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = a.id and k.estado = 'publicada' limit 1),
        'corregida', exists (select 1 from public.eval_calificaciones k join public.eval_historial h on h.calificacion_id = k.id where k.evaluacion_id = p_evaluacion and k.alumno_id = a.id)) order by a.nombre)
      from public.alumnos a where a.id in (select m2.alumno_id from public.matriculas m2 where m2.salon_id = v_salon and m2.estado = 'activa')), '[]'::jsonb));
end $$;

-- p_filas: [{alumno_id, sesion_id, cumplio: true | false | null}]. null = volver a «pendiente».
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
    if exists (select 1 from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = v_alumno and k.estado = 'publicada') then
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

-- Publica la participación de los estudiantes cuyo módulo ya terminó y tiene TODAS las clases registradas.
-- Calcula y guarda la nota (clases cumplidas / clases del módulo × 100) con el detalle clase por clase.
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
    if exists (select 1 from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = v_a and k.estado = 'publicada') then continue; end if;
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

-- Cambia una clase de una participación ya publicada. Exige motivo y deja historial; recalcula la nota.
create or replace function public.corregir_participacion(p_evaluacion uuid, p_alumno uuid, p_sesion uuid, p_cumplio boolean, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_salon uuid := public.eval_salon_de(p_evaluacion); v_modulo uuid; v_k public.eval_calificaciones; v_motivo text := btrim(coalesce(p_motivo, ''));
  v_r jsonb; v_total integer; v_p numeric; v_fecha date; v_hecha boolean; v_antes boolean;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes permisos para corregir notas de este salón' using errcode = '42501'; end if;
  if not public.eval_es_participacion(p_evaluacion) then raise exception 'Esta evaluación no es de participación por clase'; end if;
  if length(v_motivo) < 3 then raise exception 'Indica el motivo de la corrección'; end if;
  if p_cumplio is null then raise exception 'Indica si la participación fue cumplida o no'; end if;
  select modulo_id into v_modulo from public.eval_evaluaciones where id = p_evaluacion;
  select * into v_k from public.eval_calificaciones where evaluacion_id = p_evaluacion and alumno_id = p_alumno and unidad = '' for update;
  if not found or v_k.estado <> 'publicada' then raise exception 'La participación aún no está publicada: edítala y publícala'; end if;
  select s.fecha, s.hecha into v_fecha, v_hecha from public.eval_sesiones_modulo(v_modulo) s where s.sesion_id = p_sesion;
  if not found then raise exception 'Esa clase no pertenece a este módulo'; end if;
  select cumplio into v_antes from public.eval_participaciones where evaluacion_id = p_evaluacion and sesion_id = p_sesion and alumno_id = p_alumno;
  if v_antes is not distinct from p_cumplio then raise exception 'No hay cambios que guardar'; end if;
  perform set_config('universa.participacion', 'on', true);
  insert into public.eval_participaciones (evaluacion_id, sesion_id, alumno_id, cumplio, updated_by)
  values (p_evaluacion, p_sesion, p_alumno, p_cumplio, (select auth.uid()))
  on conflict (evaluacion_id, sesion_id, alumno_id) do update set cumplio = excluded.cumplio, updated_at = now(), updated_by = excluded.updated_by;
  v_r := public.eval_part_resumen(p_evaluacion, p_alumno);
  v_total := (v_r->>'total')::integer;
  v_p := round((v_r->>'cumplidas')::numeric / v_total * 100, 2);
  insert into public.eval_historial (calificacion_id, puntaje_anterior, puntaje_nuevo, comentario_anterior, comentario_nuevo, motivo, por)
  values (v_k.id, v_k.puntaje, v_p, v_k.comentario, v_k.comentario, v_motivo || ' (clase del ' || to_char(v_fecha, 'DD/MM/YYYY') || ': ' || case when p_cumplio then 'cumplió' else 'no cumplió' end || ')', (select auth.uid()));
  update public.eval_calificaciones
     set puntaje = v_p, updated_at = now(), updated_by = (select auth.uid()),
         detalle = jsonb_build_object('tipo', 'participacion', 'cumplidas', (v_r->>'cumplidas')::integer, 'total', v_total,
           'clases', (select jsonb_agg(jsonb_build_object('fecha', s.fecha, 'cumplio', p.cumplio) order by s.numero)
                        from public.eval_sesiones_modulo(v_modulo) s join public.eval_participaciones p on p.evaluacion_id = p_evaluacion and p.sesion_id = s.sesion_id and p.alumno_id = p_alumno))
   where id = v_k.id;
  perform set_config('universa.participacion', 'off', true);
end $$;

-- ============================================================
-- 7. Remedial: registrar, aplicar (explícito, solo administración) y anular
-- ============================================================
-- Resultado del módulo para un estudiante incluyendo el remedial APLICADO que lo reemplaza (del módulo o de su ciclo). Uso interno.
-- Conserva el resultado original dentro del mismo objeto. Un remedial solo registrado o anulado no cambia nada.
create or replace function public.eval_modulo_efectivo(p_modulo uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_r jsonb := public.eval_calc_modulo(p_modulo, p_alumno); v_m public.eval_modulos; v_rem public.eval_remediales; v_escala numeric;
begin
  if v_r is null then return null; end if;
  if coalesce((v_r->>'sin_plantilla')::boolean, false) then return v_r || jsonb_build_object('remedial', false); end if;
  select * into v_m from public.eval_modulos where id = p_modulo;
  select * into v_rem from public.eval_remediales r
   where r.alumno_id = p_alumno and r.estado = 'aplicado'
     and ((r.ambito = 'modulo' and r.modulo_id = p_modulo) or (r.ambito = 'ciclo' and r.salon_id = v_m.salon_id and v_m.ciclo is not null and r.ciclo = v_m.ciclo))
   order by (r.ambito = 'modulo') desc limit 1;
  if not found then return v_r || jsonb_build_object('remedial', false); end if;
  v_escala := (v_r->>'peso_total')::numeric;
  return v_r || jsonb_build_object('remedial', true, 'remedial_id', v_rem.id, 'remedial_ambito', v_rem.ambito, 'remedial_nota', v_rem.nota,
    'puntos_original', v_r->'puntos', 'nota_original', v_r->'nota', 'parcial_original', v_r->'parcial',
    'puntos', round(v_rem.nota / 100 * v_escala, 2), 'nota', v_rem.nota, 'parcial', false, 'peso_evaluado', v_escala, 'faltan', '[]'::jsonb);
end $$;

create or replace function public.registrar_remedial(p_salon uuid, p_alumno uuid, p_ambito text, p_modulo uuid, p_ciclo smallint, p_nota numeric, p_comentario text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes permisos para registrar un remedial en este salón' using errcode = '42501'; end if;
  if p_ambito not in ('modulo', 'ciclo') then raise exception 'Indica si el remedial reemplaza un módulo o un ciclo'; end if;
  if p_nota is null or p_nota < 0 or p_nota > 100 then raise exception 'La nota del remedial debe estar entre 0 y 100'; end if;
  if not exists (select 1 from public.matriculas m where m.alumno_id = p_alumno and m.salon_id = p_salon and m.estado = 'activa') then
    raise exception 'El estudiante no está matriculado en este salón';
  end if;
  if p_ambito = 'modulo' then
    if p_modulo is null or not exists (select 1 from public.eval_modulos where id = p_modulo and salon_id = p_salon) then raise exception 'Elige el módulo que reemplaza'; end if;
    p_ciclo := null;
  else
    if p_ciclo is null or not exists (select 1 from public.eval_modulos where salon_id = p_salon and ciclo = p_ciclo) then raise exception 'Elige un ciclo que tenga módulos en este salón'; end if;
    p_modulo := null;
  end if;
  insert into public.eval_remediales (salon_id, alumno_id, ambito, modulo_id, ciclo, nota, comentario, created_by)
  values (p_salon, p_alumno, p_ambito, p_modulo, p_ciclo, round(p_nota, 2), nullif(btrim(coalesce(p_comentario, '')), ''), (select auth.uid())) returning id into v_id;
  return v_id;
end $$;

-- Aplicar es una confirmación explícita (solo administración): guarda el resultado original y desde ese momento reemplaza.
create or replace function public.aplicar_remedial(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_r public.eval_remediales; v_orig jsonb; v_x jsonb;
begin
  perform public.cal_exigir_admin();
  select * into v_r from public.eval_remediales where id = p_id for update;
  if not found then raise exception 'El remedial no existe'; end if;
  if v_r.estado <> 'registrado' then raise exception 'Solo se puede aplicar un remedial en estado registrado'; end if;
  if v_r.ambito = 'modulo' then
    if exists (select 1 from public.eval_remediales o where o.alumno_id = v_r.alumno_id and o.modulo_id = v_r.modulo_id and o.estado = 'aplicado') then
      raise exception 'Ese módulo ya tiene un remedial aplicado: anúlalo primero';
    end if;
    v_x := public.eval_calc_modulo(v_r.modulo_id, v_r.alumno_id);
    if coalesce((v_x->>'sin_plantilla')::boolean, true) then raise exception 'El módulo no tiene plantilla de evaluación'; end if;
    v_orig := jsonb_build_object('puntos', v_x->'puntos', 'nota', v_x->'nota', 'escala', v_x->'peso_total', 'parcial', v_x->'parcial');
  else
    if exists (select 1 from public.eval_remediales o where o.alumno_id = v_r.alumno_id and o.salon_id = v_r.salon_id and o.ciclo = v_r.ciclo and o.estado = 'aplicado') then
      raise exception 'Ese ciclo ya tiene un remedial aplicado: anúlalo primero';
    end if;
    select jsonb_build_object('puntos', round(coalesce(sum((x->>'puntos')::numeric), 0), 2), 'escala', coalesce(sum((x->>'peso_total')::numeric), 0),
                              'evaluado', coalesce(sum((x->>'peso_evaluado')::numeric), 0))
      into v_orig
      from (select public.eval_calc_modulo(m.id, v_r.alumno_id) x from public.eval_modulos m where m.salon_id = v_r.salon_id and m.ciclo = v_r.ciclo) q
     where not coalesce((x->>'sin_plantilla')::boolean, false);
    if (v_orig->>'escala')::numeric = 0 then raise exception 'Los módulos de ese ciclo no tienen plantilla de evaluación'; end if;
  end if;
  update public.eval_remediales set estado = 'aplicado', original = v_orig, aplicado_por = (select auth.uid()), aplicado_at = now() where id = p_id;
end $$;

create or replace function public.anular_remedial(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  perform public.cal_exigir_admin();
  if length(v_motivo) < 3 then raise exception 'Indica el motivo de la anulación'; end if;
  update public.eval_remediales set estado = 'anulado', motivo_anulacion = v_motivo where id = p_id and estado in ('registrado', 'aplicado');
  if not found then raise exception 'El remedial no existe o ya está anulado'; end if;
end $$;

create or replace function public.eval_remediales_salon(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', r.id, 'alumno_id', r.alumno_id, 'alumno', a.nombre, 'ambito', r.ambito, 'modulo_id', r.modulo_id, 'modulo', m.nombre,
             'ciclo', r.ciclo, 'nota', r.nota, 'comentario', r.comentario, 'estado', r.estado, 'original', r.original, 'motivo_anulacion', r.motivo_anulacion,
             'creado', r.created_at, 'aplicado', r.aplicado_at) order by r.created_at desc)
      from public.eval_remediales r join public.alumnos a on a.id = r.alumno_id left join public.eval_modulos m on m.id = r.modulo_id
     where r.salon_id = p_salon), '[]'::jsonb);
end $$;

-- ============================================================
-- 8. Cálculo: el nivel usa el resultado efectivo (con remedial aplicado)
-- ============================================================
create or replace function public.eval_calc_nivel(p_salon uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_c public.eval_consolidacion; v_m record; v_r jsonb; v_mods jsonb := '[]'::jsonb;
  v_puntos numeric := 0; v_escala_total numeric := 0; v_escala_eval numeric := 0;
  v_suma_nota numeric := 0; v_suma_aporte numeric := 0; v_parcial boolean := false; v_sin integer := 0; v_nota numeric;
begin
  select * into v_c from public.eval_consolidacion where salon_id = p_salon;
  if not found or v_c.metodo = 'sin_definir' then
    return jsonb_build_object('definido', false, 'metodo', 'sin_definir', 'confirmada', false);
  end if;
  for v_m in select id, aporte_nivel from public.eval_modulos where salon_id = p_salon order by orden loop
    v_r := public.eval_modulo_efectivo(v_m.id, p_alumno);
    if (v_r->>'sin_plantilla')::boolean then v_sin := v_sin + 1; v_parcial := true; continue; end if;
    v_mods := v_mods || jsonb_build_object('modulo_id', v_m.id, 'nombre', v_r->>'nombre', 'nota', v_r->'nota', 'parcial', v_r->'parcial');
    v_puntos := v_puntos + (v_r->>'puntos')::numeric;
    v_escala_total := v_escala_total + (v_r->>'peso_total')::numeric;
    v_escala_eval := v_escala_eval + (v_r->>'peso_evaluado')::numeric;
    if (v_r->>'parcial')::boolean then v_parcial := true; end if;
    if (v_r->>'peso_evaluado')::numeric > 0 then
      v_suma_nota := v_suma_nota + v_m.aporte_nivel * (v_r->>'nota')::numeric;
      v_suma_aporte := v_suma_aporte + v_m.aporte_nivel;
    end if;
  end loop;
  if v_c.metodo = 'suma_puntos' then
    v_nota := case when v_escala_eval > 0 then round(v_puntos / v_escala_eval * 100, 2) end;
  else
    v_nota := case when v_suma_aporte > 0 then round(v_suma_nota / v_suma_aporte, 2) end;
  end if;
  return jsonb_build_object('definido', true, 'metodo', v_c.metodo, 'confirmada', v_c.confirmada, 'nota', v_nota,
                            'parcial', v_parcial or jsonb_array_length(v_mods) = 0, 'modulos_sin_plantilla', v_sin, 'modulos', v_mods);
end $$;

-- Módulos, subtotales por ciclo y acumulado de un estudiante (solo notas publicadas; remedial aplicado incluido).
-- «Acumulado» es la suma simple de los puntos publicados: NO es una regla de aprobación ni la nota final del nivel.
create or replace function public.eval_resumen_alumno(p_salon uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_mods jsonb; v_ciclos jsonb; v_acum jsonb;
begin
  select coalesce(jsonb_agg(public.eval_modulo_efectivo(m.id, p_alumno) order by m.orden), '[]'::jsonb) into v_mods from public.eval_modulos m where m.salon_id = p_salon;
  select coalesce(jsonb_agg(jsonb_build_object('ciclo', q.ciclo, 'puntos', round(q.p, 2), 'escala', q.t, 'escala_evaluada', q.ev, 'parcial', q.par, 'remedial', q.rem, 'modulos', q.n)
                           order by q.ciclo nulls last), '[]'::jsonb)
    into v_ciclos
    from (select (e->>'ciclo')::smallint ciclo, sum((e->>'puntos')::numeric) p, sum((e->>'peso_total')::numeric) t, sum((e->>'peso_evaluado')::numeric) ev,
                 bool_or(coalesce((e->>'parcial')::boolean, true) or coalesce((e->>'sin_plantilla')::boolean, false)) par,
                 bool_or(coalesce((e->>'remedial')::boolean, false)) rem, count(*) n
            from jsonb_array_elements(v_mods) e group by 1) q;
  select jsonb_build_object('puntos', round(coalesce(sum((e->>'puntos')::numeric), 0), 2), 'escala', coalesce(sum((e->>'peso_total')::numeric), 0),
                            'escala_evaluada', coalesce(sum((e->>'peso_evaluado')::numeric), 0),
                            'parcial', coalesce(bool_or(coalesce((e->>'parcial')::boolean, true) or coalesce((e->>'sin_plantilla')::boolean, false)), true),
                            'remedial', coalesce(bool_or(coalesce((e->>'remedial')::boolean, false)), false))
    into v_acum from jsonb_array_elements(v_mods) e;
  return jsonb_build_object('modulos', v_mods, 'ciclos', v_ciclos, 'acumulado', v_acum);
end $$;

-- ============================================================
-- 9. Matriz del salón (docente asignado o administración)
-- ============================================================
-- Una celda: estado y valor de un estudiante en una evaluación. Incluye borradores (para quien registra); los subtotales NO.
create or replace function public.eval_celda(p_evaluacion uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_e public.eval_evaluaciones; v_c public.eval_componentes; v_n integer; v_pub integer; v_bor integer; v_prom numeric; v_pt numeric; v_r jsonb; v_estado text;
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
        'evaluaciones', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'tipo', c.tipo, 'peso', c.peso, 'unidades', to_jsonb(e.unidades), 'con_rubrica', c.rubrica_id is not null) order by c.orden)
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
-- 10. Administración: qué falta por registrar o publicar, por salón y docente
-- ============================================================
-- Solo módulos «en marcha» (con alguna nota registrada o alguna clase ya realizada) de salones en curso.
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
             case when c.tipo = 'participacion' then 1 else greatest(1, cardinality(e.unidades)) end n,
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
-- 11. Estudiante: SUS notas publicadas por módulo y ciclo (sin ceros inventados) y resultados de remedial
-- ============================================================
create or replace function public.portal_mis_calificaciones(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_alumno uuid; v_c public.eval_consolidacion; v_nivel jsonb; v_res jsonb;
begin
  select cr.alumno_id into v_alumno from public.cuenta_roles cr where cr.user_id = (select auth.uid()) and cr.rol = 'estudiante';
  if v_alumno is null or not public.es_estudiante_de(p_salon) then raise exception 'No tienes acceso a este curso' using errcode = '42501'; end if;
  select * into v_c from public.eval_consolidacion where salon_id = p_salon;
  -- La nota del nivel solo se muestra cuando Coordinación confirmó la consolidación.
  v_nivel := case when coalesce(v_c.confirmada, false) then public.eval_calc_nivel(p_salon, v_alumno) else jsonb_build_object('definido', false, 'confirmada', false) end;
  v_res := public.eval_resumen_alumno(p_salon, v_alumno);
  return jsonb_build_object(
    'nivel', v_nivel, 'ciclos', v_res->'ciclos', 'acumulado', v_res->'acumulado',
    'modulos', coalesce((
      select jsonb_agg(public.eval_modulo_efectivo(m.id, v_alumno) || jsonb_build_object(
        'evaluaciones', coalesce((
          select jsonb_agg(jsonb_build_object(
            'nombre', e.nombre, 'peso', c.peso, 'tipo', c.tipo,
            'notas', coalesce((select jsonb_agg(jsonb_build_object('unidad', k.unidad, 'puntaje', k.puntaje, 'comentario', k.comentario,
                                                                  'corregida', exists (select 1 from public.eval_historial h where h.calificacion_id = k.id),
                                                                  'fecha', k.publicada_at,
                                                                  'participacion', case when c.tipo = 'participacion' then k.detalle end) order by k.unidad)
                                 from public.eval_calificaciones k where k.evaluacion_id = e.id and k.alumno_id = v_alumno and k.estado = 'publicada'), '[]'::jsonb))
            order by c.orden)
          from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id where e.modulo_id = m.id), '[]'::jsonb))
        order by m.orden)
      from public.eval_modulos m where m.salon_id = p_salon), '[]'::jsonb));
end $$;

-- Resultados del salón (vista anterior «Resultados»): ahora con el remedial aplicado.
create or replace function public.eval_resultados_salon(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_c public.eval_consolidacion;
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_c from public.eval_consolidacion where salon_id = p_salon;
  return jsonb_build_object(
    'consolidacion', jsonb_build_object('metodo', coalesce(v_c.metodo, 'sin_definir'), 'confirmada', coalesce(v_c.confirmada, false)),
    'alumnos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'alumno_id', a.id, 'nombre', a.nombre,
        'modulos', coalesce((select jsonb_agg(public.eval_modulo_efectivo(m.id, a.id) order by m.orden) from public.eval_modulos m where m.salon_id = p_salon), '[]'::jsonb),
        'nivel', public.eval_calc_nivel(p_salon, a.id)) order by a.nombre)
      from public.alumnos a
     where a.id in (select m2.alumno_id from public.matriculas m2 where m2.salon_id = p_salon and m2.estado = 'activa'
                    union select k.alumno_id from public.eval_calificaciones k join public.eval_evaluaciones e on e.id = k.evaluacion_id
                                                 join public.eval_modulos mm on mm.id = e.modulo_id where mm.salon_id = p_salon)), '[]'::jsonb));
end $$;

-- Estructura del salón (igual que antes) con las clases que abarca cada módulo.
create or replace function public.eval_estructura_salon(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_c public.eval_consolidacion;
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_c from public.eval_consolidacion where salon_id = p_salon;
  return jsonb_build_object(
    'consolidacion', jsonb_build_object('metodo', coalesce(v_c.metodo, 'sin_definir'), 'confirmada', coalesce(v_c.confirmada, false)),
    'modulos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'nombre', m.nombre, 'orden', m.orden, 'ciclo', m.ciclo, 'aporte_nivel', m.aporte_nivel, 'version_id', m.version_id,
        'plantilla', p.nombre, 'version', v.version, 'escala', v.escala_puntos,
        'sesion_desde', m.sesion_desde, 'sesion_hasta', m.sesion_hasta, 'clases', (select count(*) from public.eval_sesiones_modulo(m.id)),
        'evaluaciones', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', e.id, 'nombre', e.nombre, 'tipo', c.tipo, 'peso', c.peso, 'unidades', to_jsonb(e.unidades), 'con_rubrica', c.rubrica_id is not null,
            'borradores', (select count(*) from public.eval_calificaciones k where k.evaluacion_id = e.id and k.estado = 'borrador'),
            'publicadas', (select count(*) from public.eval_calificaciones k where k.evaluacion_id = e.id and k.estado = 'publicada'))
            order by c.orden)
          from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id where e.modulo_id = m.id), '[]'::jsonb))
        order by m.orden)
      from public.eval_modulos m
      left join public.eval_versiones v on v.id = m.version_id
      left join public.eval_plantillas p on p.id = v.plantilla_id
     where m.salon_id = p_salon), '[]'::jsonb),
    'estudiantes', (select count(*) from public.matriculas where salon_id = p_salon and estado = 'activa'));
end $$;

-- ============================================================
-- 12. Permisos de ejecución (los auxiliares internos NO son ejecutables por usuarios)
-- ============================================================
revoke execute on function
  public.eval_proteger_participacion(), public.eval_sesiones_modulo(uuid), public.definir_sesiones_modulo(uuid, integer, integer),
  public.crear_estructura_estandar(uuid), public.eval_part_resumen(uuid, uuid), public.eval_es_participacion(uuid),
  public.eval_participacion_detalle(uuid), public.guardar_participacion(uuid, jsonb), public.publicar_participacion(uuid, uuid[]),
  public.corregir_participacion(uuid, uuid, uuid, boolean, text), public.eval_modulo_efectivo(uuid, uuid),
  public.registrar_remedial(uuid, uuid, text, uuid, smallint, numeric, text), public.aplicar_remedial(uuid), public.anular_remedial(uuid, text),
  public.eval_remediales_salon(uuid), public.eval_calc_nivel(uuid, uuid), public.eval_resumen_alumno(uuid, uuid), public.eval_celda(uuid, uuid),
  public.eval_matriz_salon(uuid), public.eval_pendientes(), public.portal_mis_calificaciones(uuid), public.eval_resultados_salon(uuid),
  public.guardar_version(uuid, jsonb), public.eval_estructura_salon(uuid)
  from public, anon, authenticated;
grant execute on function
  public.definir_sesiones_modulo(uuid, integer, integer), public.crear_estructura_estandar(uuid),
  public.eval_participacion_detalle(uuid), public.guardar_participacion(uuid, jsonb), public.publicar_participacion(uuid, uuid[]),
  public.corregir_participacion(uuid, uuid, uuid, boolean, text),
  public.registrar_remedial(uuid, uuid, text, uuid, smallint, numeric, text), public.aplicar_remedial(uuid), public.anular_remedial(uuid, text),
  public.eval_remediales_salon(uuid), public.eval_matriz_salon(uuid), public.eval_pendientes(),
  public.portal_mis_calificaciones(uuid), public.eval_resultados_salon(uuid), public.guardar_version(uuid, jsonb), public.eval_estructura_salon(uuid)
  to authenticated;
