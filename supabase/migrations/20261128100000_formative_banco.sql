-- UNIVERSA · Formative Assessment por elementos (banco de ejercicios + SPARK manual + participación).
--
-- DISTRIBUCIÓN INTERNA del Formative (cada unidad usa la misma estructura):
--   Listening / Lessons 16 % · Writing 16 % · Reading 16 % · Speaking 16 % · SPARK Homework 16 % · Participación por clase 20 %  = 100 %
-- Es el cálculo INTERNO del componente Formative; no son los puntos máximos del módulo ni del nivel.
--
-- CÓMO SE LOGRA CON EL MOTOR EXISTENTE (20261125100000_formative_unidades.sql, que NO se modifica):
--   nota del Formative = (1 − p) × promedio de las 3 unidades + p × participación, con p = peso_participacion = 20.
--   Cada unidad se califica con una rúbrica de 5 criterios del MISMO máximo (5): nota de la unidad = Σ criterios ÷ Σ máximos × 100,
--   así cada criterio pesa 20 % de la unidad y (1 − 0,20) × 20 % = 16 % del Formative. La participación sigue saliendo de los checks por clase.
--
-- QUÉ CAMBIA
--  1. Rúbrica «Formative Assessment · elementos» (5 criterios de 0 a 5): Listening / Lessons, Writing, Reading, Speaking, SPARK Homework.
--  2. Banco de ejercicios → Formative. El docente asigna un ejercicio como PRÁCTICA (no afecta notas) o como actividad OFICIAL de una unidad y habilidad
--     (Listening / Lessons, Writing, Reading o Speaking). La nota de cada habilidad = promedio simple de sus actividades calificadas (0–100 → 0–5).
--     Writing / speaking se califican con una rúbrica existente de ese tipo, sin mínimos nuevos.
--  3. SPARK Homework = nota MANUAL del docente de 0 a 5 por unidad (tabla eval_formative_spark), que equivale a 0–100 al calcular.
--  4. El servidor arma la nota de la unidad con los 5 elementos y la escribe SOLO con guardar_calificaciones + publicar_evaluacion
--     (corregir_calificacion con motivo e historial si ya estaba publicada). Con algún elemento pendiente la unidad queda PARCIAL: no se escribe
--     nada y nunca se convierte en cero. El estudiante solo ve notas publicadas.
--  5. Grade Chart Universa: versión NUEVA donde el componente SPARK separado desaparece y su peso pasa al Formative (para no contar SPARK dos veces):
--     peso del Formative = peso del Formative + peso del SPARK de la versión vigente (el total sigue sumando la escala). Solo la usan los salones y
--     módulos NUEVOS: los módulos existentes conservan su versión, sus notas y su historial.
--
-- Reemplaza un diseño anterior (banco → componente SPARK) que ya no existe en el repositorio. Si alguna vez se ejecutó, esta migración elimina sus
-- tablas y funciones (eval_spark_*, spark_*); si no, no hay nada que limpiar.
--
-- Requiere: 20261116 (evaluaciones), 20261119 (Grade Chart único), 20261123 (banco) y 20261125 (Formative con unidades y participación).
-- Repetible. Una sola transacción: si algo falla, no queda nada a medias. No cambia notas existentes (lo verifica al final).

begin;

-- ============================================================
-- 0. Requisitos y datos del diseño anterior
-- ============================================================
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'eval_componentes' and column_name = 'peso_participacion') then
    raise exception 'Falta aplicar 20261125100000_formative_unidades.sql antes de esta migración (Formative con unidades y participación).';
  end if;
  if to_regclass('public.ejercicio_asignaciones') is null then
    raise exception 'Falta aplicar 20261123100000_banco_ejercicios.sql antes de esta migración.';
  end if;
end $$;

-- Para comprobar al final que nada existente cambió.
create temp table _formative_antes as
select (select count(*) from public.eval_calificaciones) n_calif, (select coalesce(sum(puntaje), 0) from public.eval_calificaciones) suma_calif,
       (select count(*) from public.eval_historial) n_hist, (select count(*) from public.eval_modulos) n_mod,
       (select coalesce(string_agg(id::text || ':' || coalesce(version_id::text, '-'), ',' order by id), '') from public.eval_modulos) mod_versiones;

-- ============================================================
-- 1. Rúbrica de los 5 elementos del Formative (todos con el mismo máximo: 0 a 5)
-- ============================================================
insert into public.eval_rubricas (nombre, tipo, descripcion)
select 'Formative Assessment · elementos', 'formative',
       'Elementos de cada unidad del Formative, todos de 0 a 5 y con el mismo peso: Listening / Lessons, Writing, Reading y Speaking (del banco de ejercicios) y SPARK Homework (nota manual). La participación por clase se calcula aparte.'
 where not exists (select 1 from public.eval_rubricas where lower(btrim(nombre)) = lower('Formative Assessment · elementos'));

insert into public.eval_rubrica_criterios (rubrica_id, nombre, descripcion, max_puntaje, orden, bandas)
select r.id, t.n, t.d, 5, t.o, '[]'::jsonb
  from public.eval_rubricas r
  cross join (values
    (1, 'Listening / Lessons', 'Promedio de las actividades calificadas del banco (0–100 se convierte a 0–5)'),
    (2, 'Writing', 'Promedio de las actividades calificadas del banco (0–100 se convierte a 0–5)'),
    (3, 'Reading', 'Promedio de las actividades calificadas del banco (0–100 se convierte a 0–5)'),
    (4, 'Speaking', 'Promedio de las actividades calificadas del banco (0–100 se convierte a 0–5)'),
    (5, 'SPARK Homework', 'Nota manual del docente (0 a 5)')) t(o, n, d)
 where lower(btrim(r.nombre)) = lower('Formative Assessment · elementos')
   and not exists (select 1 from public.eval_rubrica_criterios c where c.rubrica_id = r.id);

-- ============================================================
-- 2. Tablas
-- ============================================================
-- Actividad oficial del banco: unidad y habilidad del Formative a la que alimenta. Sin fila = práctica.
create table if not exists public.eval_formative_vinculos (
  asignacion_id uuid primary key references public.ejercicio_asignaciones(id) on delete cascade,
  evaluacion_id uuid not null references public.eval_evaluaciones(id) on delete cascade,
  unidad text not null check (btrim(unidad) <> ''),
  habilidad text not null check (habilidad in ('listening', 'writing', 'reading', 'speaking')),
  rubrica_id uuid references public.eval_rubricas(id),   -- solo ejercicios writing / speaking (revisión del docente)
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists eval_formative_vinculos_idx on public.eval_formative_vinculos (evaluacion_id, unidad, habilidad);

-- SPARK Homework: nota manual por estudiante y unidad (0 a 5). Se publica dentro de la nota de la unidad.
create table if not exists public.eval_formative_spark (
  evaluacion_id uuid not null references public.eval_evaluaciones(id) on delete cascade,
  alumno_id uuid not null references public.alumnos(id),
  unidad text not null check (btrim(unidad) <> ''),
  puntaje numeric(6, 2) not null check (puntaje >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (evaluacion_id, alumno_id, unidad)
);

-- Qué se usó en cada confirmación (las notas y correcciones quedan en eval_calificaciones y eval_historial).
create table if not exists public.eval_formative_confirmaciones (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references public.eval_evaluaciones(id) on delete cascade,
  alumno_id uuid not null references public.alumnos(id),
  unidad text not null,
  nota numeric not null,
  elementos jsonb not null,
  accion text not null check (accion in ('publicada', 'corregida')),
  motivo text,
  por uuid references auth.users(id) on delete set null,
  cuando timestamptz not null default now()
);
create index if not exists eval_formative_confirmaciones_idx on public.eval_formative_confirmaciones (evaluacion_id, alumno_id, unidad, cuando desc);

alter table public.eval_formative_vinculos enable row level security;
alter table public.eval_formative_spark enable row level security;
alter table public.eval_formative_confirmaciones enable row level security;
revoke all on public.eval_formative_vinculos, public.eval_formative_spark, public.eval_formative_confirmaciones from anon, authenticated;

-- ============================================================
-- 3. Ayudas internas
-- ============================================================
-- Criterios de la rúbrica del Formative de una evaluación, SOLO si tiene la estructura de 5 elementos con el mismo máximo (si no, null:
-- los módulos con la plantilla anterior no usan el banco). Devuelve {listening, writing, reading, speaking, spark, max}.
create or replace function public.formative_criterios(p_evaluacion uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when count(*) = 5 and count(distinct lower(btrim(c.nombre))) = 5 and count(distinct c.max_puntaje) = 1
               and count(*) filter (where lower(btrim(c.nombre)) in ('listening / lessons', 'writing', 'reading', 'speaking', 'spark homework')) = 5
              then jsonb_build_object(
                'listening', (array_agg(c.id) filter (where lower(btrim(c.nombre)) = 'listening / lessons'))[1],
                'writing', (array_agg(c.id) filter (where lower(btrim(c.nombre)) = 'writing'))[1],
                'reading', (array_agg(c.id) filter (where lower(btrim(c.nombre)) = 'reading'))[1],
                'speaking', (array_agg(c.id) filter (where lower(btrim(c.nombre)) = 'speaking'))[1],
                'spark', (array_agg(c.id) filter (where lower(btrim(c.nombre)) = 'spark homework'))[1],
                'max', max(c.max_puntaje)) end
    from public.eval_evaluaciones e
    join public.eval_componentes k on k.id = e.componente_id and k.tipo = 'formative'
    join public.eval_rubrica_criterios c on c.rubrica_id = k.rubrica_id
   where e.id = p_evaluacion
$$;

-- Nota 0–100 de UNA entrega con precisión completa, o null si aún no tiene nota. Nunca devuelve cero por falta de entrega.
create or replace function public.ej_nota_entrega(p_tipo text, p_e public.ejercicio_entregas) returns numeric
language plpgsql stable set search_path = '' as $$
declare v_sum numeric; v_max numeric;
begin
  if p_e.id is null then return null; end if;
  if p_tipo in ('writing', 'speaking') then
    if p_e.estado <> 'revisada' then return null; end if;
    if jsonb_typeof(p_e.detalle->'criterios') = 'array' then
      select sum((c->>'puntaje')::numeric), sum((c->>'max')::numeric) into v_sum, v_max from jsonb_array_elements(p_e.detalle->'criterios') c;
      if v_max is not null and v_max > 0 then return 100 * v_sum / v_max; end if;
    end if;
    return p_e.puntaje;
  end if;
  if p_e.estado <> 'autocalificada' then return null; end if;
  if coalesce(p_e.total, 0) > 0 and p_e.correctas is not null then return 100.0 * p_e.correctas / p_e.total; end if;
  return p_e.puntaje;
end $$;

-- Etiqueta de una asignación oficial: {evaluacion_id, modulo, unidad, habilidad} (y la rúbrica con sus criterios si se pide). null = práctica.
create or replace function public.formative_etiqueta(p_asignacion uuid, p_con_rubrica boolean default false) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('evaluacion_id', v.evaluacion_id, 'modulo', m.nombre, 'unidad', v.unidad, 'habilidad', v.habilidad)
         || case when p_con_rubrica and r.id is not null then jsonb_build_object('rubrica', jsonb_build_object(
              'id', r.id, 'nombre', r.nombre,
              'criterios', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'descripcion', c.descripcion, 'max_puntaje', c.max_puntaje, 'bandas', c.bandas) order by c.orden), '[]'::jsonb)
                              from public.eval_rubrica_criterios c where c.rubrica_id = r.id)))
            else '{}'::jsonb end
    from public.eval_formative_vinculos v
    join public.eval_evaluaciones ev on ev.id = v.evaluacion_id
    join public.eval_modulos m on m.id = ev.modulo_id
    left join public.eval_rubricas r on r.id = v.rubrica_id
   where v.asignacion_id = p_asignacion
$$;

-- Valida que la evaluación sea el Formative (con los 5 elementos) de un módulo de ESE salón y que la unidad exista. Devuelve la unidad normalizada.
create or replace function public.formative_validar_destino(p_salon uuid, p_evaluacion uuid, p_unidad text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_e public.eval_evaluaciones; v_u text := coalesce(btrim(p_unidad), '');
begin
  select * into v_e from public.eval_evaluaciones where id = p_evaluacion;
  if v_e.id is null or public.eval_salon_de(p_evaluacion) is distinct from p_salon then raise exception 'Elige el Formative de un módulo de este salón'; end if;
  if public.formative_criterios(p_evaluacion) is null then
    raise exception 'Este módulo usa una plantilla de Formative anterior (sin los 5 elementos): el banco solo alimenta módulos con la versión nueva del Grade Chart';
  end if;
  if not (v_u = any (v_e.unidades)) then raise exception 'Elige la unidad del Formative'; end if;
  return v_u;
end $$;

-- Un elemento del banco (una habilidad) de un estudiante en una unidad: actividades oficiales, cuántas están calificadas y su promedio simple (0–100).
create or replace function public.formative_elemento(p_evaluacion uuid, p_alumno uuid, p_unidad text, p_habilidad text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('n_asignadas', count(t.asignacion_id), 'n_calificadas', count(t.nota), 'promedio', avg(t.nota),
           'actividades', coalesce(jsonb_agg(jsonb_build_object('asignacion_id', t.asignacion_id, 'titulo', t.titulo, 'tipo', t.tipo, 'estado', t.est, 'nota', t.nota) order by t.titulo)
                                   filter (where t.asignacion_id is not null), '[]'::jsonb))
    from (select v.asignacion_id, a.titulo, a.tipo, public.ej_nota_entrega(a.tipo, e) nota,
                 case when e.id is null then 'sin_entrega' when public.ej_nota_entrega(a.tipo, e) is null then 'por_revisar' else 'calificada' end est
            from public.eval_formative_vinculos v
            join public.ejercicio_asignaciones a on a.id = v.asignacion_id and a.activa
            left join public.ejercicio_entregas e on e.asignacion_id = v.asignacion_id and e.alumno_id = p_alumno
           where v.evaluacion_id = p_evaluacion and v.unidad = p_unidad and v.habilidad = p_habilidad) t
$$;

-- Los 5 elementos de un estudiante en una unidad y lo que resulta. Cada elemento se expresa de 0 a «max» (5): habilidad = promedio × max ÷ 100; SPARK = nota manual.
-- valor = nota de la unidad (0–100) solo si los 5 elementos existen; provisional = promedio de los elementos disponibles (no es una nota).
drop function if exists public.formative_celda_banco(uuid, uuid, text, jsonb);
create or replace function public.formative_celda_banco(p_evaluacion uuid, p_alumno uuid, p_unidad text, p_crit jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_max numeric := (p_crit->>'max')::numeric; v_h text; v_el jsonb; v_val numeric; v_sp numeric;
  v_elementos jsonb := '{}'::jsonb; v_valores jsonb := '{}'::jsonb; v_n integer := 0; v_sum numeric := 0;
begin
  foreach v_h in array array['listening', 'writing', 'reading', 'speaking'] loop
    v_el := public.formative_elemento(p_evaluacion, p_alumno, p_unidad, v_h);
    v_val := (v_el->>'promedio')::numeric * v_max / 100;
    v_elementos := v_elementos || jsonb_build_object(v_h, v_el || jsonb_build_object('valor', v_val));
    if v_val is not null then v_n := v_n + 1; v_sum := v_sum + v_val; v_valores := v_valores || jsonb_build_object(v_h, v_val); end if;
  end loop;
  select puntaje into v_sp from public.eval_formative_spark where evaluacion_id = p_evaluacion and alumno_id = p_alumno and unidad = p_unidad;
  v_elementos := v_elementos || jsonb_build_object('spark', jsonb_build_object('valor', v_sp));
  if v_sp is not null then v_n := v_n + 1; v_sum := v_sum + v_sp; v_valores := v_valores || jsonb_build_object('spark', v_sp); end if;
  return jsonb_build_object('elementos', v_elementos, 'valores', v_valores, 'completos', v_n,
    'valor', case when v_n = 5 then 100 * v_sum / (5 * v_max) end,
    'provisional', case when v_n > 0 then 100 * v_sum / (v_n * v_max) end);
end $$;

-- ============================================================
-- 4. Docente: opciones, asignar como oficial, calificar con rúbrica y SPARK manual
-- ============================================================
-- Módulos del salón con Formative de 5 elementos (con sus unidades), módulos con la plantilla anterior, y rúbricas existentes de writing / speaking.
create or replace function public.formative_opciones(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return jsonb_build_object(
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('evaluacion_id', e.id, 'modulo_id', m.id, 'modulo', m.nombre, 'unidades', to_jsonb(e.unidades), 'max', (public.formative_criterios(e.id)->>'max')::numeric) order by m.orden, m.nombre)
        from public.eval_evaluaciones e join public.eval_modulos m on m.id = e.modulo_id join public.eval_componentes c on c.id = e.componente_id
       where m.salon_id = p_salon and c.tipo = 'formative' and public.formative_criterios(e.id) is not null), '[]'::jsonb),
    'anteriores', coalesce((
      select jsonb_agg(m.nombre order by m.orden, m.nombre)
        from public.eval_evaluaciones e join public.eval_modulos m on m.id = e.modulo_id join public.eval_componentes c on c.id = e.componente_id
       where m.salon_id = p_salon and c.tipo = 'formative' and public.formative_criterios(e.id) is null), '[]'::jsonb),
    'rubricas', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'nombre', r.nombre, 'tipo', r.tipo, 'por_defecto', lower(btrim(r.nombre)) = r.tipo) order by r.tipo, r.nombre)
        from public.eval_rubricas r
       where r.activa and r.tipo in ('writing', 'speaking') and exists (select 1 from public.eval_rubrica_criterios c where c.rubrica_id = r.id)), '[]'::jsonb));
end $$;

-- Asigna un ejercicio al salón COMO ACTIVIDAD OFICIAL de una unidad y habilidad del Formative (en una sola operación).
-- Reutiliza asignar_ejercicio, que sigue siendo la asignación de práctica. Writing / speaking: rúbrica existente del mismo tipo (por defecto la que se llama Writing / Speaking).
create or replace function public.asignar_ejercicio_formative(
  p_ejercicio uuid, p_salon uuid, p_limite date, p_evaluacion uuid, p_unidad text, p_habilidad text, p_rubrica uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_tipo text; v_unidad text; v_rub uuid := null; v_id uuid;
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  if p_habilidad is null or p_habilidad not in ('listening', 'writing', 'reading', 'speaking') then
    raise exception 'Elige la habilidad: Listening / Lessons, Writing, Reading o Speaking';
  end if;
  select tipo into v_tipo from public.ejercicios where id = p_ejercicio and activo and (publico or autor_user_id = (select auth.uid()));
  if v_tipo is null then raise exception 'El ejercicio no está disponible'; end if;
  v_unidad := public.formative_validar_destino(p_salon, p_evaluacion, p_unidad);

  if v_tipo in ('writing', 'speaking') then
    if p_rubrica is not null then
      select r.id into v_rub from public.eval_rubricas r where r.id = p_rubrica and r.activa and r.tipo = v_tipo;
      if v_rub is null then raise exception 'La rúbrica elegida no es una rúbrica activa de %', v_tipo; end if;
    else
      select r.id into v_rub from public.eval_rubricas r where r.activa and r.tipo = v_tipo and lower(btrim(r.nombre)) = v_tipo;
      if v_rub is null then raise exception 'No hay una rúbrica activa «%»: créala en Rúbricas o elige otra de tipo %', v_tipo, v_tipo; end if;
    end if;
    if not exists (select 1 from public.eval_rubrica_criterios where rubrica_id = v_rub) then raise exception 'La rúbrica elegida no tiene criterios'; end if;
  end if;

  v_id := public.asignar_ejercicio(p_ejercicio, p_salon, p_limite);
  insert into public.eval_formative_vinculos (asignacion_id, evaluacion_id, unidad, habilidad, rubrica_id, creado_por)
  values (v_id, p_evaluacion, v_unidad, p_habilidad, v_rub, (select auth.uid()));
  return v_id;
end $$;

-- Writing y speaking oficiales se califican con la rúbrica del vínculo. p_detalle: [{criterio_id, puntaje}] con TODOS los criterios (de 0 a su máximo, sin mínimos).
create or replace function public.calificar_entrega_rubrica(p_entrega uuid, p_detalle jsonb, p_feedback text) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_e public.ejercicio_entregas; v_a public.ejercicio_asignaciones; v_v public.eval_formative_vinculos; v_r public.eval_rubricas;
  v_item jsonb; v_crit public.eval_rubrica_criterios; v_cid uuid; v_p numeric; v_vistos uuid[] := '{}';
  v_sum numeric := 0; v_max numeric; v_n integer; v_det jsonb := '[]'::jsonb; v_nota numeric;
begin
  select * into v_e from public.ejercicio_entregas where id = p_entrega for update;
  if not found then raise exception 'La entrega ya no existe'; end if;
  select * into v_a from public.ejercicio_asignaciones where id = v_e.asignacion_id;
  if not public.puede_gestionar_curso(v_a.salon_id) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_v from public.eval_formative_vinculos where asignacion_id = v_a.id;
  if not found or v_v.rubrica_id is null or v_a.tipo not in ('writing', 'speaking') then raise exception 'Esta actividad no se califica con rúbrica'; end if;
  select * into v_r from public.eval_rubricas where id = v_v.rubrica_id;
  if p_detalle is null or jsonb_typeof(p_detalle) <> 'array' then raise exception 'Califica todos los criterios de la rúbrica'; end if;

  for v_item in select * from jsonb_array_elements(p_detalle) loop
    begin v_cid := (v_item->>'criterio_id')::uuid; exception when others then raise exception 'Criterio no válido'; end;
    select * into v_crit from public.eval_rubrica_criterios where id = v_cid and rubrica_id = v_v.rubrica_id;
    if not found then raise exception 'Un criterio no pertenece a la rúbrica de esta actividad'; end if;
    if v_cid = any (v_vistos) then raise exception 'Un criterio está repetido'; end if;
    begin v_p := (v_item->>'puntaje')::numeric; exception when others then v_p := null; end;
    if v_p is null or v_p < 0 or v_p > v_crit.max_puntaje then
      raise exception 'El puntaje de «%» debe estar entre 0 y %', v_crit.nombre, v_crit.max_puntaje;
    end if;
    v_vistos := v_vistos || v_cid;
    v_sum := v_sum + v_p;
    v_det := v_det || jsonb_build_object('criterio', v_crit.nombre, 'max', v_crit.max_puntaje, 'puntaje', v_p);
  end loop;
  select count(*), sum(max_puntaje) into v_n, v_max from public.eval_rubrica_criterios where rubrica_id = v_v.rubrica_id;
  if cardinality(v_vistos) <> v_n then raise exception 'Faltan criterios por calificar en la rúbrica'; end if;

  v_nota := 100 * v_sum / v_max;
  update public.ejercicio_entregas
     set puntaje = round(v_nota, 2), estado = 'revisada', feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
         detalle = jsonb_build_object('rubrica', v_r.nombre, 'rubrica_id', v_r.id, 'criterios', v_det),
         calificado_por = (select auth.uid()), calificado_at = now()
   where id = p_entrega;
  return v_nota;
end $$;

-- calificar_entrega (nota libre 0–100) sigue igual para la práctica; si la actividad es oficial, se usa la rúbrica.
create or replace function public.calificar_entrega(p_entrega uuid, p_puntaje numeric, p_feedback text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_e public.ejercicio_entregas; v_a public.ejercicio_asignaciones;
begin
  select * into v_e from public.ejercicio_entregas where id = p_entrega for update;
  if not found then raise exception 'La entrega ya no existe'; end if;
  select * into v_a from public.ejercicio_asignaciones where id = v_e.asignacion_id;
  if not public.puede_gestionar_curso(v_a.salon_id) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  if v_a.tipo not in ('writing', 'speaking') then raise exception 'Este ejercicio se califica solo'; end if;
  if exists (select 1 from public.eval_formative_vinculos where asignacion_id = v_a.id) then
    raise exception 'Esta actividad cuenta para el Formative: califícala con la rúbrica';
  end if;
  if p_puntaje is null or p_puntaje < 0 or p_puntaje > 100 then raise exception 'La nota debe estar entre 0 y 100'; end if;
  update public.ejercicio_entregas
     set puntaje = p_puntaje, feedback = nullif(btrim(coalesce(p_feedback, '')), ''), estado = 'revisada',
         calificado_por = (select auth.uid()), calificado_at = now()
   where id = p_entrega;
end $$;

-- SPARK Homework manual: p_filas = [{alumno_id, unidad, puntaje}] con puntaje de 0 a 5 (el máximo de la rúbrica). Sin puntaje (vacío) borra la nota: queda pendiente, no cero.
create or replace function public.guardar_spark_manual(p_evaluacion uuid, p_filas jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_salon uuid := public.eval_salon_de(p_evaluacion); v_e public.eval_evaluaciones; v_crit jsonb := public.formative_criterios(p_evaluacion); v_max numeric;
  v_f jsonb; v_alumno uuid; v_u text; v_p numeric; v_n integer := 0;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes permisos para registrar notas en este salón' using errcode = '42501'; end if;
  if v_crit is null then raise exception 'Este módulo usa una plantilla de Formative anterior (sin SPARK dentro del Formative)'; end if;
  v_max := (v_crit->>'max')::numeric;
  select * into v_e from public.eval_evaluaciones where id = p_evaluacion;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then raise exception 'Las notas deben enviarse como lista'; end if;

  for v_f in select * from jsonb_array_elements(p_filas) loop
    begin v_alumno := (v_f->>'alumno_id')::uuid; exception when others then raise exception 'Identificador de estudiante no válido'; end;
    v_u := coalesce(btrim(v_f->>'unidad'), '');
    if not (v_u = any (v_e.unidades)) then raise exception 'La unidad «%» no existe en este Formative', v_u; end if;
    if not exists (select 1 from public.matriculas m where m.alumno_id = v_alumno and m.salon_id = v_salon and m.estado = 'activa') then
      raise exception 'Un estudiante de la lista no está matriculado en este salón';
    end if;
    begin v_p := nullif(btrim(coalesce(v_f->>'puntaje', '')), '')::numeric; exception when others then raise exception 'La nota de SPARK no es un número válido'; end;
    if v_p is null then
      delete from public.eval_formative_spark where evaluacion_id = p_evaluacion and alumno_id = v_alumno and unidad = v_u;
    else
      if v_p < 0 or v_p > v_max then raise exception 'La nota de SPARK Homework debe estar entre 0 y %', v_max; end if;
      insert into public.eval_formative_spark (evaluacion_id, alumno_id, unidad, puntaje, updated_by)
      values (p_evaluacion, v_alumno, v_u, v_p, (select auth.uid()))
      on conflict (evaluacion_id, alumno_id, unidad) do update set puntaje = excluded.puntaje, updated_by = excluded.updated_by, updated_at = now();
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ============================================================
-- 5. Listados del banco: se agrega «formative» (módulo, unidad y habilidad) a lo que ya devolvían. Todo lo demás queda igual.
-- ============================================================
create or replace function public.ejercicios_salon(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'titulo', a.titulo, 'tipo', a.tipo, 'fecha_limite', a.fecha_limite, 'creada', a.created_at,
      'entregas', (select count(*) from public.ejercicio_entregas e where e.asignacion_id = a.id),
      'pendientes', (select count(*) from public.ejercicio_entregas e where e.asignacion_id = a.id and e.estado = 'pendiente'),
      'promedio', (select round(avg(e.puntaje), 1) from public.ejercicio_entregas e where e.asignacion_id = a.id and e.puntaje is not null),
      'total', (select count(*) from public.matriculas m where m.salon_id = a.salon_id and m.estado = 'activa'),
      'formative', public.formative_etiqueta(a.id))
      order by a.created_at desc)
    from public.ejercicio_asignaciones a where a.salon_id = p_salon and a.activa), '[]'::jsonb);
end $$;

create or replace function public.entregas_ejercicio(p_asignacion uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_a public.ejercicio_asignaciones;
begin
  select * into v_a from public.ejercicio_asignaciones where id = p_asignacion and activa;
  if not found then raise exception 'La asignación ya no existe'; end if;
  if not public.puede_gestionar_curso(v_a.salon_id) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return jsonb_build_object(
    'asignacion', jsonb_build_object('id', v_a.id, 'titulo', v_a.titulo, 'tipo', v_a.tipo, 'contenido', v_a.contenido, 'fecha_limite', v_a.fecha_limite,
                                     'formative', public.formative_etiqueta(v_a.id, true)),
    'filas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'alumno_id', al.id, 'nombre', al.nombre,
        'entrega', case when e.id is null then null else jsonb_build_object(
          'id', e.id, 'estado', e.estado, 'puntaje', e.puntaje, 'correctas', e.correctas, 'total', e.total, 'respuestas', e.respuestas,
          'audio_path', e.audio_path, 'feedback', e.feedback, 'entregado_at', e.entregado_at, 'calificado_at', e.calificado_at,
          'detalle', case when v_a.tipo in ('writing', 'speaking') then e.detalle end) end)
        order by al.nombre)
      from public.matriculas m join public.alumnos al on al.id = m.alumno_id
      left join public.ejercicio_entregas e on e.asignacion_id = v_a.id and e.alumno_id = al.id
      where m.salon_id = v_a.salon_id and m.estado = 'activa'), '[]'::jsonb));
end $$;

create or replace function public.portal_ejercicios(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_alumno uuid := public.alumno_actual();
begin
  if not public.es_estudiante_de(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'titulo', a.titulo, 'tipo', a.tipo, 'contenido', a.contenido, 'fecha_limite', a.fecha_limite, 'creada', a.created_at,
      'formative', public.formative_etiqueta(a.id),
      'entrega', case when e.id is null then null else jsonb_build_object(
        'estado', e.estado, 'puntaje', e.puntaje, 'correctas', e.correctas, 'total', e.total, 'detalle', e.detalle,
        'respuestas', e.respuestas, 'audio_path', e.audio_path, 'feedback', e.feedback, 'entregado_at', e.entregado_at) end)
      order by a.created_at desc)
    from public.ejercicio_asignaciones a
    left join public.ejercicio_entregas e on e.asignacion_id = a.id and e.alumno_id = v_alumno
    where a.salon_id = p_salon and a.activa), '[]'::jsonb);
end $$;

-- ============================================================
-- 6. Propuesta de la unidad (solo lectura) y confirmación
-- ============================================================
-- Para cada estudiante matriculado y cada unidad: los 5 elementos, cuántos están completos, la nota resultante (solo con los 5), el avance provisional,
-- la nota ya registrada en la matriz (borrador o publicada) y la última confirmación.
create or replace function public.formative_propuesta(p_evaluacion uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_salon uuid := public.eval_salon_de(p_evaluacion); v_e public.eval_evaluaciones; v_crit jsonb := public.formative_criterios(p_evaluacion);
  v_mod text; v_filas jsonb := '[]'::jsonb; v_acts jsonb; v_a record; v_u text; v_c jsonb; v_k record; v_cf jsonb;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  if v_crit is null then raise exception 'Este módulo usa una plantilla de Formative anterior (sin los 5 elementos)'; end if;
  select * into v_e from public.eval_evaluaciones where id = p_evaluacion;
  select nombre into v_mod from public.eval_modulos where id = v_e.modulo_id;

  select coalesce(jsonb_agg(jsonb_build_object('asignacion_id', v.asignacion_id, 'titulo', a.titulo, 'tipo', a.tipo, 'unidad', v.unidad, 'habilidad', v.habilidad) order by v.unidad, v.habilidad, a.titulo), '[]'::jsonb)
    into v_acts
    from public.eval_formative_vinculos v join public.ejercicio_asignaciones a on a.id = v.asignacion_id and a.activa
   where v.evaluacion_id = p_evaluacion;

  for v_a in
    select al.id, al.nombre from public.matriculas m join public.alumnos al on al.id = m.alumno_id where m.salon_id = v_salon and m.estado = 'activa' order by al.nombre
  loop
    foreach v_u in array v_e.unidades loop
      v_c := public.formative_celda_banco(p_evaluacion, v_a.id, v_u, v_crit);
      select k.puntaje, k.estado into v_k from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = v_a.id and k.unidad = v_u;
      select jsonb_build_object('cuando', f.cuando, 'nota', f.nota, 'accion', f.accion) into v_cf
        from public.eval_formative_confirmaciones f where f.evaluacion_id = p_evaluacion and f.alumno_id = v_a.id and f.unidad = v_u order by f.cuando desc limit 1;
      v_filas := v_filas || (jsonb_build_object('alumno_id', v_a.id, 'nombre', v_a.nombre, 'unidad', v_u,
        'registrada', case when v_k.estado is null then null else jsonb_build_object('puntaje', v_k.puntaje, 'estado', v_k.estado) end,
        'confirmacion', v_cf) || (v_c - 'valores'));
    end loop;
  end loop;

  return jsonb_build_object('evaluacion_id', p_evaluacion, 'modulo', v_mod, 'unidades', to_jsonb(v_e.unidades), 'max', (v_crit->>'max')::numeric,
    'actividades', v_acts, 'filas', v_filas);
end $$;

-- El servidor recalcula (no confía en cifras del navegador) y escribe SOLO con las funciones de notas existentes:
--   sin nota o borrador   → guardar_calificaciones (con los 5 criterios) + publicar_evaluacion
--   ya publicada distinta → corregir_calificacion (exige motivo; queda en eval_historial)
--   ya publicada igual    → sin cambios
-- Un estudiante con algún elemento pendiente NO se publica (queda parcial): no se escribe nada ni se usa cero.
create or replace function public.confirmar_formative(p_evaluacion uuid, p_unidad text, p_alumnos uuid[], p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_salon uuid := public.eval_salon_de(p_evaluacion); v_u text := coalesce(btrim(p_unidad), ''); v_crit jsonb := public.formative_criterios(p_evaluacion);
  v_alumno uuid; v_c jsonb; v_det jsonb; v_k public.eval_calificaciones; v_hay boolean; v_nombre text; v_nota2 numeric;
  v_motivo text := btrim(coalesce(p_motivo, '')); v_pub uuid[] := '{}'; v_nuevas integer := 0; v_corr integer := 0; v_igual integer := 0; v_parciales integer := 0;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes permisos para confirmar notas en este salón' using errcode = '42501'; end if;
  perform public.formative_validar_destino(v_salon, p_evaluacion, v_u);
  if p_alumnos is null or cardinality(p_alumnos) = 0 then raise exception 'Elige al menos un estudiante'; end if;

  foreach v_alumno in array p_alumnos loop
    if not exists (select 1 from public.matriculas m where m.alumno_id = v_alumno and m.salon_id = v_salon and m.estado = 'activa') then continue; end if;
    select nombre into v_nombre from public.alumnos where id = v_alumno;
    v_c := public.formative_celda_banco(p_evaluacion, v_alumno, v_u, v_crit);
    if (v_c->>'completos')::integer < 5 then v_parciales := v_parciales + 1; continue; end if;
    -- publicar_evaluacion publica TODOS los borradores del estudiante en la evaluación: no se mezclan con borradores manuales de otras unidades.
    if exists (select 1 from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = v_alumno and k.estado = 'borrador' and k.puntaje is not null and k.unidad <> v_u) then
      raise exception '% tiene un borrador del Formative en otra unidad: publícalo o bórralo en la matriz antes de confirmar', v_nombre;
    end if;
    v_det := jsonb_build_array(
      jsonb_build_object('criterio_id', v_crit->>'listening', 'puntaje', (v_c->'valores'->>'listening')::numeric),
      jsonb_build_object('criterio_id', v_crit->>'writing', 'puntaje', (v_c->'valores'->>'writing')::numeric),
      jsonb_build_object('criterio_id', v_crit->>'reading', 'puntaje', (v_c->'valores'->>'reading')::numeric),
      jsonb_build_object('criterio_id', v_crit->>'speaking', 'puntaje', (v_c->'valores'->>'speaking')::numeric),
      jsonb_build_object('criterio_id', v_crit->>'spark', 'puntaje', (v_c->'valores'->>'spark')::numeric));
    -- Misma operación que eval_resolver_nota (Σ criterios ÷ Σ máximos × 100, redondeada a 2) para comparar con la nota ya guardada.
    select round(sum(x.value::numeric) / (5 * (v_crit->>'max')::numeric) * 100, 2) into v_nota2 from jsonb_each_text(v_c->'valores') x;

    select * into v_k from public.eval_calificaciones where evaluacion_id = p_evaluacion and alumno_id = v_alumno and unidad = v_u;
    v_hay := found;
    if v_hay and v_k.estado = 'publicada' then
      if v_nota2 = v_k.puntaje then v_igual := v_igual + 1; continue; end if;
      if length(v_motivo) < 3 then raise exception '% ya tiene una nota publicada distinta: indica el motivo de la corrección', v_nombre; end if;
      perform public.corregir_calificacion(p_evaluacion, v_alumno, v_u, null, v_k.comentario, v_motivo, v_det);
      v_corr := v_corr + 1;
      insert into public.eval_formative_confirmaciones (evaluacion_id, alumno_id, unidad, nota, elementos, accion, motivo, por)
      values (p_evaluacion, v_alumno, v_u, (v_c->>'valor')::numeric, v_c->'elementos', 'corregida', v_motivo, (select auth.uid()));
    else
      perform public.guardar_calificaciones(p_evaluacion, jsonb_build_array(jsonb_build_object(
        'alumno_id', v_alumno, 'unidad', v_u, 'detalle', v_det, 'comentario', case when v_hay then v_k.comentario end)));
      v_pub := v_pub || v_alumno;
      v_nuevas := v_nuevas + 1;
      insert into public.eval_formative_confirmaciones (evaluacion_id, alumno_id, unidad, nota, elementos, accion, motivo, por)
      values (p_evaluacion, v_alumno, v_u, (v_c->>'valor')::numeric, v_c->'elementos', 'publicada', null, (select auth.uid()));
    end if;
  end loop;

  if v_nuevas + v_corr + v_igual = 0 then
    raise exception 'Ninguno de los estudiantes elegidos tiene los 5 elementos de la unidad: sigue parcial hasta completarse (lo pendiente no cuenta como cero)';
  end if;
  if cardinality(v_pub) > 0 then perform public.publicar_evaluacion(p_evaluacion, v_pub); end if;
  return jsonb_build_object('publicadas', v_nuevas, 'corregidas', v_corr, 'sin_cambios', v_igual, 'parciales', v_parciales);
end $$;

-- ============================================================
-- 7. Grade Chart Universa: versión nueva con SPARK dentro del Formative (para no contarlo dos veces)
-- ============================================================
-- Toma la versión vigente y: quita el componente SPARK, suma su peso al del Formative (también en el módulo final), usa la rúbrica de los 5 elementos y
-- fija la participación en 20 %. Test, Writing y Project conservan sus pesos y rúbricas. Los módulos existentes NO se reasignan.
do $$
declare
  v_p uuid; v_old public.eval_versiones; v_new uuid; v_rub uuid; v_form public.eval_componentes; v_spark public.eval_componentes; v_n integer; v_ver integer;
  v_suma numeric; v_suma_f numeric; v_con_final integer;
begin
  select id into v_p from public.eval_plantillas where nombre = 'Grade Chart Universa';
  if v_p is null then raise exception 'No existe la plantilla «Grade Chart Universa»: no se puede crear la versión con SPARK dentro del Formative'; end if;
  select id into v_rub from public.eval_rubricas where lower(btrim(nombre)) = lower('Formative Assessment · elementos');
  if v_rub is null then raise exception 'Falta la rúbrica «Formative Assessment · elementos»'; end if;

  -- Ya creada: no se repite.
  if exists (select 1 from public.eval_componentes c join public.eval_versiones v on v.id = c.version_id
              where v.plantilla_id = v_p and v.variante = 'normal' and c.rubrica_id = v_rub) then
    return;
  end if;

  select * into v_old from public.eval_versiones where plantilla_id = v_p and estado = 'vigente' and variante = 'normal';
  if v_old.id is null then raise exception 'La plantilla «Grade Chart Universa» no tiene una versión vigente'; end if;
  select count(*) into v_n from public.eval_componentes where version_id = v_old.id and tipo in ('formative', 'participacion');
  if v_n <> 1 then raise exception 'La versión vigente debe tener exactamente un componente Formative (tiene %)', v_n; end if;
  select count(*) into v_n from public.eval_componentes where version_id = v_old.id and tipo = 'spark';
  if v_n > 1 then raise exception 'La versión vigente tiene % componentes SPARK; debe tener uno o ninguno', v_n; end if;
  select * into v_form from public.eval_componentes where version_id = v_old.id and tipo in ('formative', 'participacion');
  select * into v_spark from public.eval_componentes where version_id = v_old.id and tipo = 'spark';

  select coalesce(max(version), 0) + 1 into v_ver from public.eval_versiones where plantilla_id = v_p;
  update public.eval_versiones set estado = 'archivada' where plantilla_id = v_p and estado = 'vigente';
  insert into public.eval_versiones (plantilla_id, version, estado, escala_puntos, notas, activada_at)
  values (v_p, v_ver, 'vigente', v_old.escala_puntos,
          'Formative por elementos: Listening / Lessons, Writing, Reading, Speaking y SPARK Homework 16 % cada uno + participación por clase 20 %. SPARK ya no es un componente aparte: su peso pasa al Formative.',
          now())
  returning id into v_new;

  insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id, peso_final, nombre_final, peso_participacion)
  select v_new, c.nombre,
         case when c.id = v_form.id then 'formative' else c.tipo end,
         case when c.id = v_form.id then c.peso + coalesce(v_spark.peso, 0) else c.peso end,
         c.orden,
         case when c.id = v_form.id then v_rub else c.rubrica_id end,
         case when c.id = v_form.id and c.peso_final is not null then c.peso_final + coalesce(v_spark.peso_final, 0) else c.peso_final end,
         c.nombre_final,
         case when c.id = v_form.id then 20 end
    from public.eval_componentes c
   where c.version_id = v_old.id and (v_spark.id is null or c.id <> v_spark.id);

  -- Los pesos deben seguir sumando la escala (módulos 1 a 3 y módulo final).
  select coalesce(sum(peso), 0), coalesce(sum(peso_final), 0), count(peso_final) into v_suma, v_suma_f, v_con_final from public.eval_componentes where version_id = v_new;
  if v_suma <> v_old.escala_puntos then raise exception 'Los pesos de la versión nueva suman % y deben sumar %', v_suma, v_old.escala_puntos; end if;
  if v_con_final > 0 and v_suma_f <> v_old.escala_puntos then raise exception 'Los pesos del módulo final suman % y deben sumar %', v_suma_f, v_old.escala_puntos; end if;
  perform public.eval_generar_final(v_new);

  update public.eval_plantillas set descripcion = 'Cada módulo vale 100. Dos columnas de peso: módulos 1 a 3 y módulo final. Formative = 5 elementos de 16 % (Listening / Lessons, Writing, Reading, Speaking, SPARK Homework) + 20 % de participación por clase.'
   where id = v_p;
end $$;

-- ============================================================
-- 8. Limpieza del diseño anterior (banco → componente SPARK), solo si existía.
-- ============================================================
drop function if exists public.spark_opciones(uuid);
drop function if exists public.asignar_ejercicio_spark(uuid, uuid, date, uuid, text, uuid);
drop function if exists public.spark_propuesta(uuid);
drop function if exists public.confirmar_spark(uuid, text, uuid[], text, boolean);
drop function if exists public.spark_nota_entrega(text, public.ejercicio_entregas);
drop function if exists public.spark_etiqueta(uuid, boolean);
drop function if exists public.spark_validar_destino(uuid, uuid, text);
drop table if exists public.eval_spark_confirmaciones cascade;
drop table if exists public.eval_spark_vinculos cascade;
drop table if exists public.eval_spark_reglas cascade;

-- ============================================================
-- 9. Permisos de ejecución
-- ============================================================
revoke execute on function
  public.formative_criterios(uuid), public.ej_nota_entrega(text, public.ejercicio_entregas), public.formative_etiqueta(uuid, boolean),
  public.formative_validar_destino(uuid, uuid, text), public.formative_elemento(uuid, uuid, text, text), public.formative_celda_banco(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
revoke execute on function
  public.formative_opciones(uuid), public.asignar_ejercicio_formative(uuid, uuid, date, uuid, text, text, uuid), public.calificar_entrega_rubrica(uuid, jsonb, text),
  public.guardar_spark_manual(uuid, jsonb), public.formative_propuesta(uuid), public.confirmar_formative(uuid, text, uuid[], text)
  from public, anon;
grant execute on function
  public.formative_opciones(uuid), public.asignar_ejercicio_formative(uuid, uuid, date, uuid, text, text, uuid), public.calificar_entrega_rubrica(uuid, jsonb, text),
  public.guardar_spark_manual(uuid, jsonb), public.formative_propuesta(uuid), public.confirmar_formative(uuid, text, uuid[], text)
  to authenticated;

-- ============================================================
-- 10. Verificación: nada existente cambió (notas, historial, módulos y sus versiones)
-- ============================================================
do $$
declare a record; v_n integer; v_s numeric; v_h integer; v_mv text;
begin
  select * into a from _formative_antes;
  select count(*), coalesce(sum(puntaje), 0) into v_n, v_s from public.eval_calificaciones;
  select count(*) into v_h from public.eval_historial;
  select coalesce(string_agg(id::text || ':' || coalesce(version_id::text, '-'), ',' order by id), '') into v_mv from public.eval_modulos;
  if v_n <> a.n_calif or v_s <> a.suma_calif then raise exception 'ABORTADO: cambiaron las calificaciones existentes (antes % / %, ahora % / %)', a.n_calif, a.suma_calif, v_n, v_s; end if;
  if v_h <> a.n_hist then raise exception 'ABORTADO: cambió el historial de correcciones'; end if;
  if v_mv <> a.mod_versiones then raise exception 'ABORTADO: cambió la versión de plantilla de algún módulo'; end if;
end $$;
drop table _formative_antes;

commit;

-- Para revertir esta migración (solo si aún no se usó): borrar la versión nueva del Grade Chart y reactivar la anterior, y eliminar las tablas
-- eval_formative_* y las funciones formative_* / ej_nota_entrega / guardar_spark_manual. Las notas ya publicadas con la rúbrica nueva se conservan.
