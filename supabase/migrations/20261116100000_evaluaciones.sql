-- UNIVERSA · Evaluaciones y calificaciones.
--
-- Referencia: «ASSESSMENT FILE 2026 - BASIC GROUP» de Coordinación Académica. Este módulo NO copia las once hojas: guarda la
-- estructura (plantillas, rúbricas, módulos, evaluaciones, notas) y calcula los resultados con funciones.
--
--  * PLANTILLAS con componentes y pesos, VERSIONADAS: borrador → vigente → archivada. Una versión vigente no se edita; para
--    cambiar pesos se crea una versión nueva. Cada módulo guarda la versión que usa, así los resultados publicados no cambian.
--    Nada se aplica por defecto: se siembran tres referencias EDITABLES en borrador (Notas por módulo y las dos de Grades Chart).
--    Cada versión tiene su escala de puntos (100 para «Notas por módulo»; 25 por módulo para «Grades Chart»).
--  * MÓDULOS configurables por salón (opcionalmente ligados a un ciclo del plan del salón). No se impone un número de módulos.
--  * RÚBRICAS editables (Speaking, Writing, Project, Formative). La nota de una rúbrica = suma de criterios / suma de máximos
--    × 100: el total se DERIVA de los criterios, por lo que no puede repetirse el error del Excel (Project sumaba 9 de 10).
--  * NOTAS por estudiante, evaluación y unidad (Formative/SPARK tienen unidades): borrador → publicada. Corregir una nota
--    publicada exige motivo y deja historial.
--  * RESULTADOS: nota del módulo (con la escala de su plantilla) y nota final del nivel (consolidación configurable). Los
--    componentes sin notas publicadas NO cuentan como cero: el resultado se marca parcial y lista lo que falta.
--    La consolidación del nivel nace «sin definir» y no se muestra a estudiantes hasta que Coordinación la confirme.
--  * La asistencia queda aparte: no entra en ninguna nota ni regla. No se define nota mínima, recuperación ni aprobación.
--  * PERMISOS: administración configura; docente asignado (o administración) registra, publica y corrige en sus salones;
--    el estudiante lee solo lo suyo y publicado; comercial no accede. Escrituras y lecturas del portal, por funciones.
--
-- Repetible. Requiere las migraciones anteriores, incluida 20261115100000_asistencia.sql.

-- ============================================================
-- 1. Rúbricas
-- ============================================================
create table if not exists public.eval_rubricas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> '' and length(nombre) <= 120),
  tipo text not null check (tipo in ('speaking', 'writing', 'project', 'formative', 'otra')),
  descripcion text check (length(descripcion) <= 1000),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists eval_rubricas_nombre_unico on public.eval_rubricas (lower(btrim(nombre)));

create table if not exists public.eval_rubrica_criterios (
  id uuid primary key default gen_random_uuid(),
  rubrica_id uuid not null references public.eval_rubricas(id) on delete cascade,
  nombre text not null check (btrim(nombre) <> '' and length(nombre) <= 120),
  descripcion text check (length(descripcion) <= 1000),
  max_puntaje numeric(6,2) not null check (max_puntaje > 0 and max_puntaje <= 1000),
  orden integer not null default 1,
  bandas jsonb not null default '[]'::jsonb -- [{etiqueta, desde?, hasta?, descripcion?}] solo orientativas para quien califica
);
create index if not exists eval_rubrica_criterios_idx on public.eval_rubrica_criterios (rubrica_id, orden);

-- ============================================================
-- 2. Plantillas versionadas
-- ============================================================
create table if not exists public.eval_plantillas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> '' and length(nombre) <= 120),
  descripcion text check (length(descripcion) <= 1000),
  nivel_id uuid references public.niveles(id), -- solo referencia de identificación; no se aplica sola
  created_at timestamptz not null default now()
);
create unique index if not exists eval_plantillas_nombre_unico on public.eval_plantillas (lower(btrim(nombre)));

create table if not exists public.eval_versiones (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.eval_plantillas(id) on delete cascade,
  version integer not null check (version >= 1),
  estado text not null default 'borrador' check (estado in ('borrador', 'vigente', 'archivada')),
  escala_puntos numeric(6,2) not null default 100 check (escala_puntos > 0 and escala_puntos <= 1000), -- los pesos deben sumar esto
  notas text check (length(notas) <= 1000),
  created_at timestamptz not null default now(),
  activada_at timestamptz,
  unique (plantilla_id, version)
);
create unique index if not exists eval_versiones_una_vigente on public.eval_versiones (plantilla_id) where estado = 'vigente';
create unique index if not exists eval_versiones_un_borrador on public.eval_versiones (plantilla_id) where estado = 'borrador';

create table if not exists public.eval_componentes (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.eval_versiones(id) on delete cascade,
  nombre text not null check (btrim(nombre) <> '' and length(nombre) <= 80),
  tipo text not null default 'otro' check (tipo in ('test', 'writing', 'project', 'formative', 'spark', 'speaking', 'otro')),
  peso numeric(6,2) not null check (peso > 0 and peso <= 1000),
  orden integer not null default 1,
  rubrica_id uuid references public.eval_rubricas(id)
);
create unique index if not exists eval_componentes_nombre_unico on public.eval_componentes (version_id, lower(btrim(nombre)));

-- ============================================================
-- 3. Módulos, evaluaciones y notas
-- ============================================================
create table if not exists public.eval_modulos (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salones(id) on delete cascade,
  nombre text not null check (btrim(nombre) <> '' and length(nombre) <= 80),
  orden integer not null default 1,
  ciclo smallint, -- opcional: ciclo del plan del salón
  version_id uuid references public.eval_versiones(id),
  aporte_nivel numeric(6,2) not null default 1 check (aporte_nivel > 0), -- peso del módulo en «promedio_modulos»
  created_at timestamptz not null default now()
);
create unique index if not exists eval_modulos_nombre_unico on public.eval_modulos (salon_id, lower(btrim(nombre)));

create table if not exists public.eval_evaluaciones (
  id uuid primary key default gen_random_uuid(),
  modulo_id uuid not null references public.eval_modulos(id) on delete cascade,
  componente_id uuid not null references public.eval_componentes(id),
  nombre text not null,
  unidades text[] not null default '{}', -- p. ej. {Unit 1,Unit 2,Unit 3}; vacío = una sola nota
  unique (modulo_id, componente_id)
);

create table if not exists public.eval_calificaciones (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references public.eval_evaluaciones(id) on delete cascade,
  alumno_id uuid not null references public.alumnos(id),
  unidad text not null default '',
  puntaje numeric(5,2) check (puntaje >= 0 and puntaje <= 100),
  comentario text check (length(comentario) <= 2000),
  detalle jsonb, -- copia de los criterios de rúbrica al calificar: editar la rúbrica después no altera notas ya puestas
  estado text not null default 'borrador' check (estado in ('borrador', 'publicada')),
  publicada_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  unique (evaluacion_id, alumno_id, unidad),
  check (estado = 'borrador' or puntaje is not null)
);
create index if not exists eval_calificaciones_alumno_idx on public.eval_calificaciones (alumno_id);

create table if not exists public.eval_historial (
  id uuid primary key default gen_random_uuid(),
  calificacion_id uuid not null references public.eval_calificaciones(id) on delete cascade,
  puntaje_anterior numeric(5,2),
  puntaje_nuevo numeric(5,2),
  comentario_anterior text,
  comentario_nuevo text,
  motivo text not null check (btrim(motivo) <> ''),
  por uuid references auth.users(id) on delete set null,
  cuando timestamptz not null default now()
);
create index if not exists eval_historial_idx on public.eval_historial (calificacion_id, cuando);

-- Consolidación del nivel: estructura lista, SIN fórmula activa hasta que Coordinación la confirme.
create table if not exists public.eval_consolidacion (
  salon_id uuid primary key references public.salones(id) on delete cascade,
  metodo text not null default 'sin_definir' check (metodo in ('sin_definir', 'suma_puntos', 'promedio_modulos')),
  confirmada boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not confirmada or metodo <> 'sin_definir')
);

-- ============================================================
-- 4. RLS: lectura directa solo para administración (comercial queda fuera); todo lo demás, por funciones
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['eval_rubricas', 'eval_rubrica_criterios', 'eval_plantillas', 'eval_versiones', 'eval_componentes',
                           'eval_modulos', 'eval_evaluaciones', 'eval_calificaciones', 'eval_historial', 'eval_consolidacion'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists "admin consulta" on public.%I', t);
    execute format('create policy "admin consulta" on public.%I for select to authenticated using ((select public.es_admin()))', t);
  end loop;
end $$;

-- ============================================================
-- 5. Administración: rúbricas
-- ============================================================
-- p_datos: {nombre, tipo, descripcion, activa, criterios: [{nombre, descripcion, max_puntaje, bandas: [{etiqueta, desde, hasta, descripcion}]}]}
create or replace function public.guardar_rubrica(p_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_nombre text := btrim(coalesce(p_datos->>'nombre', ''));
  v_tipo text := coalesce(nullif(p_datos->>'tipo', ''), 'otra');
  v_desc text := nullif(btrim(coalesce(p_datos->>'descripcion', '')), '');
  v_activa boolean := coalesce((p_datos->>'activa')::boolean, true);
  v_crit jsonb := coalesce(p_datos->'criterios', '[]'::jsonb);
  v_c jsonb; v_b jsonb;
  v_nom text; v_max numeric; v_desde numeric; v_hasta numeric;
  v_nombres text[] := '{}';
  v_id uuid; v_orden integer := 0;
begin
  perform public.cal_exigir_admin();
  if v_nombre = '' then raise exception 'El nombre de la rúbrica es obligatorio'; end if;
  if v_tipo not in ('speaking', 'writing', 'project', 'formative', 'otra') then raise exception 'Tipo de rúbrica no válido'; end if;
  if jsonb_typeof(v_crit) <> 'array' or jsonb_array_length(v_crit) = 0 then raise exception 'La rúbrica necesita al menos un criterio'; end if;
  if jsonb_array_length(v_crit) > 30 then raise exception 'Una rúbrica admite hasta 30 criterios'; end if;
  if exists (select 1 from public.eval_rubricas where lower(btrim(nombre)) = lower(v_nombre) and id is distinct from p_id) then
    raise exception 'Ya existe una rúbrica con ese nombre';
  end if;

  -- Validación completa antes de escribir nada
  for v_c in select * from jsonb_array_elements(v_crit) loop
    v_nom := btrim(coalesce(v_c->>'nombre', ''));
    if v_nom = '' then raise exception 'Todos los criterios necesitan nombre'; end if;
    if lower(v_nom) = any(v_nombres) then raise exception 'El criterio «%» está repetido', v_nom; end if;
    v_nombres := v_nombres || lower(v_nom);
    begin v_max := (v_c->>'max_puntaje')::numeric; exception when others then v_max := null; end;
    if v_max is null or v_max <= 0 or v_max > 1000 then raise exception 'El puntaje máximo de «%» debe ser mayor que 0 y hasta 1000', v_nom; end if;
    if jsonb_typeof(coalesce(v_c->'bandas', '[]'::jsonb)) <> 'array' then raise exception 'Las bandas de «%» no son válidas', v_nom; end if;
    for v_b in select * from jsonb_array_elements(coalesce(v_c->'bandas', '[]'::jsonb)) loop
      if btrim(coalesce(v_b->>'etiqueta', '')) = '' then raise exception 'Cada banda de «%» necesita una etiqueta', v_nom; end if;
      if (v_b->>'desde') is not null or (v_b->>'hasta') is not null then
        begin v_desde := (v_b->>'desde')::numeric; v_hasta := (v_b->>'hasta')::numeric; exception when others then v_desde := null; v_hasta := null; end;
        if v_desde is null or v_hasta is null or v_desde < 0 or v_desde > v_hasta or v_hasta > v_max then
          raise exception 'Los rangos de «%» deben ir de 0 hasta su máximo (%)', v_nom, v_max;
        end if;
      end if;
    end loop;
  end loop;

  if p_id is null then
    insert into public.eval_rubricas (nombre, tipo, descripcion, activa) values (v_nombre, v_tipo, v_desc, v_activa) returning id into v_id;
  else
    update public.eval_rubricas set nombre = v_nombre, tipo = v_tipo, descripcion = v_desc, activa = v_activa, updated_at = now()
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'La rúbrica no existe'; end if;
    delete from public.eval_rubrica_criterios where rubrica_id = v_id;
  end if;
  -- Los componentes que usan la rúbrica quedan apuntando a ella: se reemplazan solo los criterios (las notas ya guardan su copia).
  for v_c in select * from jsonb_array_elements(v_crit) loop
    v_orden := v_orden + 1;
    insert into public.eval_rubrica_criterios (rubrica_id, nombre, descripcion, max_puntaje, orden, bandas)
    values (v_id, btrim(v_c->>'nombre'), nullif(btrim(coalesce(v_c->>'descripcion', '')), ''), (v_c->>'max_puntaje')::numeric, v_orden,
            coalesce(v_c->'bandas', '[]'::jsonb));
  end loop;
  return v_id;
end $$;

-- ============================================================
-- 6. Administración: plantillas versionadas
-- ============================================================
create or replace function public.guardar_plantilla(p_id uuid, p_nombre text, p_descripcion text default null, p_nivel uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_nombre text := btrim(coalesce(p_nombre, '')); v_id uuid;
begin
  perform public.cal_exigir_admin();
  if v_nombre = '' then raise exception 'El nombre de la plantilla es obligatorio'; end if;
  if exists (select 1 from public.eval_plantillas where lower(btrim(nombre)) = lower(v_nombre) and id is distinct from p_id) then
    raise exception 'Ya existe una plantilla con ese nombre';
  end if;
  if p_id is null then
    insert into public.eval_plantillas (nombre, descripcion, nivel_id) values (v_nombre, nullif(btrim(coalesce(p_descripcion, '')), ''), p_nivel) returning id into v_id;
    insert into public.eval_versiones (plantilla_id, version) values (v_id, 1);
  else
    update public.eval_plantillas set nombre = v_nombre, descripcion = nullif(btrim(coalesce(p_descripcion, '')), ''), nivel_id = p_nivel
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'La plantilla no existe'; end if;
  end if;
  return v_id;
end $$;

-- Edita una versión en BORRADOR. p_datos: {escala_puntos, notas, componentes: [{nombre, tipo, peso, rubrica_id}]}
-- Se puede guardar incompleta; la suma de pesos se exige al activar.
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
    if v_tipo not in ('test', 'writing', 'project', 'formative', 'spark', 'speaking', 'otro') then raise exception 'Tipo de componente no válido'; end if;
    v_rub := nullif(v_c->>'rubrica_id', '')::uuid;
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

-- Activa una versión: los pesos deben sumar exactamente su escala. La vigente anterior pasa a archivada (los módulos que la usan
-- conservan su versión, así sus resultados no cambian).
create or replace function public.activar_version(p_version uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_v public.eval_versiones; v_suma numeric; v_n integer;
begin
  perform public.cal_exigir_admin();
  select * into v_v from public.eval_versiones where id = p_version for update;
  if not found then raise exception 'La versión no existe'; end if;
  if v_v.estado <> 'borrador' then raise exception 'Solo se puede activar una versión en borrador'; end if;
  select coalesce(sum(peso), 0), count(*) into v_suma, v_n from public.eval_componentes where version_id = p_version;
  if v_n = 0 then raise exception 'La versión no tiene componentes'; end if;
  if v_suma <> v_v.escala_puntos then
    raise exception 'Los pesos suman % y deben sumar % (la escala de la plantilla)', v_suma, v_v.escala_puntos;
  end if;
  update public.eval_versiones set estado = 'archivada' where plantilla_id = v_v.plantilla_id and estado = 'vigente';
  update public.eval_versiones set estado = 'vigente', activada_at = now() where id = p_version;
end $$;

-- Crea un borrador copiando la última versión (para cambiar pesos sin tocar lo ya publicado).
create or replace function public.nueva_version(p_plantilla uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_ult public.eval_versiones; v_id uuid;
begin
  perform public.cal_exigir_admin();
  perform 1 from public.eval_plantillas where id = p_plantilla for update;
  if not found then raise exception 'La plantilla no existe'; end if;
  if exists (select 1 from public.eval_versiones where plantilla_id = p_plantilla and estado = 'borrador') then
    raise exception 'Ya hay una versión en borrador: edítala o actívala';
  end if;
  select * into v_ult from public.eval_versiones where plantilla_id = p_plantilla order by version desc limit 1;
  insert into public.eval_versiones (plantilla_id, version, escala_puntos, notas)
  values (p_plantilla, v_ult.version + 1, v_ult.escala_puntos, v_ult.notas) returning id into v_id;
  insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id)
  select v_id, nombre, tipo, peso, orden, rubrica_id from public.eval_componentes where version_id = v_ult.id;
  return v_id;
end $$;

-- ============================================================
-- 7. Administración: módulos del salón y consolidación del nivel
-- ============================================================
create or replace function public.guardar_modulo(p_id uuid, p_salon uuid, p_nombre text, p_ciclo smallint default null, p_aporte numeric default 1) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_nombre text := btrim(coalesce(p_nombre, '')); v_s public.salones; v_id uuid;
begin
  perform public.cal_exigir_admin();
  select * into v_s from public.salones where id = p_salon;
  if not found then raise exception 'El salón no existe'; end if;
  if v_nombre = '' then raise exception 'El nombre del módulo es obligatorio'; end if;
  if p_aporte is null or p_aporte <= 0 then raise exception 'El aporte del módulo debe ser mayor que 0'; end if;
  if p_ciclo is not null and (v_s.plan_id is null or p_ciclo < v_s.ciclo_desde or p_ciclo > v_s.ciclo_hasta) then
    raise exception 'El ciclo % no pertenece al plan de este salón', p_ciclo;
  end if;
  if exists (select 1 from public.eval_modulos where salon_id = p_salon and lower(btrim(nombre)) = lower(v_nombre) and id is distinct from p_id) then
    raise exception 'Ya existe un módulo con ese nombre en este salón';
  end if;
  if p_id is null then
    insert into public.eval_modulos (salon_id, nombre, orden, ciclo, aporte_nivel)
    values (p_salon, v_nombre, coalesce((select max(orden) from public.eval_modulos where salon_id = p_salon), 0) + 1, p_ciclo, p_aporte) returning id into v_id;
  else
    update public.eval_modulos set nombre = v_nombre, ciclo = p_ciclo, aporte_nivel = p_aporte where id = p_id and salon_id = p_salon returning id into v_id;
    if v_id is null then raise exception 'El módulo no existe en este salón'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.eliminar_modulo(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  if exists (select 1 from public.eval_calificaciones k join public.eval_evaluaciones e on e.id = k.evaluacion_id where e.modulo_id = p_id) then
    raise exception 'El módulo ya tiene notas registradas; no se puede eliminar';
  end if;
  delete from public.eval_modulos where id = p_id;
end $$;

-- Asigna la versión de plantilla que usará el módulo y crea sus evaluaciones (una por componente).
-- Si ya hay notas (borrador o publicadas) no se puede cambiar: así los resultados históricos no se alteran.
create or replace function public.asignar_plantilla(p_modulo uuid, p_version uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_v public.eval_versiones; v_n integer;
begin
  perform public.cal_exigir_admin();
  perform 1 from public.eval_modulos where id = p_modulo for update;
  if not found then raise exception 'El módulo no existe'; end if;
  select * into v_v from public.eval_versiones where id = p_version;
  if not found then raise exception 'La versión no existe'; end if;
  if v_v.estado <> 'vigente' then raise exception 'Solo se puede asignar una versión vigente (activa la versión primero)'; end if;
  if exists (select 1 from public.eval_calificaciones k join public.eval_evaluaciones e on e.id = k.evaluacion_id where e.modulo_id = p_modulo) then
    raise exception 'El módulo ya tiene notas registradas; no se puede cambiar su plantilla';
  end if;
  delete from public.eval_evaluaciones where modulo_id = p_modulo;
  update public.eval_modulos set version_id = p_version where id = p_modulo;
  insert into public.eval_evaluaciones (modulo_id, componente_id, nombre)
  select p_modulo, c.id, c.nombre from public.eval_componentes c where c.version_id = p_version order by c.orden;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.guardar_consolidacion(p_salon uuid, p_metodo text, p_confirmada boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  if not exists (select 1 from public.salones where id = p_salon) then raise exception 'El salón no existe'; end if;
  if p_metodo not in ('sin_definir', 'suma_puntos', 'promedio_modulos') then raise exception 'Método de consolidación no válido'; end if;
  if coalesce(p_confirmada, false) and p_metodo = 'sin_definir' then raise exception 'No se puede confirmar una consolidación sin definir'; end if;
  insert into public.eval_consolidacion (salon_id, metodo, confirmada) values (p_salon, p_metodo, coalesce(p_confirmada, false))
  on conflict (salon_id) do update set metodo = excluded.metodo, confirmada = excluded.confirmada, updated_at = now();
end $$;

-- ============================================================
-- 8. Docente asignado o administración: unidades, notas, publicación y correcciones
-- ============================================================
create or replace function public.eval_salon_de(p_evaluacion uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.salon_id from public.eval_evaluaciones e join public.eval_modulos m on m.id = e.modulo_id where e.id = p_evaluacion
$$;

-- Unidades de una evaluación (Formative, SPARK…). No se puede quitar una unidad que ya tiene notas.
create or replace function public.configurar_unidades(p_evaluacion uuid, p_unidades text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_salon uuid := public.eval_salon_de(p_evaluacion); v_u text[]; v_x text;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes permisos para esta evaluación' using errcode = '42501'; end if;
  select coalesce(array_agg(u order by n), '{}') into v_u
    from (select btrim(x) u, min(n) n from unnest(coalesce(p_unidades, '{}')) with ordinality t(x, n) where btrim(x) <> '' group by btrim(x)) q;
  if cardinality(v_u) > 12 then raise exception 'Una evaluación admite hasta 12 unidades'; end if;
  foreach v_x in array v_u loop
    if length(v_x) > 60 then raise exception 'El nombre de una unidad es demasiado largo'; end if;
  end loop;
  if exists (select 1 from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion
              and not (k.unidad = any (case when cardinality(v_u) = 0 then array[''] else v_u end))) then
    raise exception 'Hay notas registradas en una unidad que quieres quitar';
  end if;
  update public.eval_evaluaciones set unidades = v_u where id = p_evaluacion;
end $$;

-- Calcula la nota (0-100) y la copia de criterios. Con rúbrica: suma de criterios / suma de máximos × 100. Uso interno.
create or replace function public.eval_resolver_nota(p_componente uuid, p_puntaje numeric, p_detalle jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_rub uuid; v_item jsonb; v_crit public.eval_rubrica_criterios; v_cid uuid; v_p numeric;
  v_sum numeric := 0; v_max numeric; v_det jsonb := '[]'::jsonb; v_vistos uuid[] := '{}'; v_n integer;
begin
  if p_detalle is null or jsonb_typeof(p_detalle) = 'null' or p_detalle = '[]'::jsonb then
    if p_puntaje is not null and (p_puntaje < 0 or p_puntaje > 100) then raise exception 'La nota debe estar entre 0 y 100'; end if;
    return jsonb_build_object('puntaje', round(p_puntaje, 2), 'detalle', null);
  end if;
  if jsonb_typeof(p_detalle) <> 'array' then raise exception 'El detalle de la rúbrica no es válido'; end if;
  select rubrica_id into v_rub from public.eval_componentes where id = p_componente;
  if v_rub is null then raise exception 'Este componente no usa rúbrica'; end if;
  for v_item in select * from jsonb_array_elements(p_detalle) loop
    begin v_cid := (v_item->>'criterio_id')::uuid; exception when others then raise exception 'Criterio no válido'; end;
    select * into v_crit from public.eval_rubrica_criterios where id = v_cid and rubrica_id = v_rub;
    if not found then raise exception 'Un criterio no pertenece a la rúbrica de este componente'; end if;
    if v_cid = any (v_vistos) then raise exception 'Un criterio está repetido'; end if;
    begin v_p := (v_item->>'puntaje')::numeric; exception when others then v_p := null; end;
    if v_p is null or v_p < 0 or v_p > v_crit.max_puntaje then
      raise exception 'El puntaje de «%» debe estar entre 0 y %', v_crit.nombre, v_crit.max_puntaje;
    end if;
    v_vistos := v_vistos || v_cid;
    v_sum := v_sum + v_p;
    v_det := v_det || jsonb_build_object('criterio', v_crit.nombre, 'max', v_crit.max_puntaje, 'puntaje', v_p);
  end loop;
  select count(*), sum(max_puntaje) into v_n, v_max from public.eval_rubrica_criterios where rubrica_id = v_rub;
  if cardinality(v_vistos) <> v_n then raise exception 'Faltan criterios por calificar en la rúbrica'; end if;
  return jsonb_build_object('puntaje', round(v_sum / v_max * 100, 2), 'detalle', v_det);
end $$;

-- Guarda borradores. p_filas: [{alumno_id, unidad, puntaje, comentario, detalle: [{criterio_id, puntaje}]}]
-- Una fila sin nota, sin comentario y sin detalle borra el borrador. Una nota ya publicada no se toca aquí (usa corregir_calificacion).
create or replace function public.guardar_calificaciones(p_evaluacion uuid, p_filas jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_e public.eval_evaluaciones; v_salon uuid; v_f jsonb; v_alumno uuid; v_unidad text; v_p numeric; v_com text; v_det jsonb; v_r jsonb;
  v_ex public.eval_calificaciones; v_n integer := 0;
begin
  select * into v_e from public.eval_evaluaciones where id = p_evaluacion;
  if not found then raise exception 'La evaluación no existe'; end if;
  v_salon := public.eval_salon_de(p_evaluacion);
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes permisos para registrar notas en este salón' using errcode = '42501'; end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then raise exception 'Las notas deben enviarse como lista'; end if;

  for v_f in select * from jsonb_array_elements(p_filas) loop
    begin v_alumno := (v_f->>'alumno_id')::uuid; exception when others then raise exception 'Identificador de estudiante no válido'; end;
    v_unidad := coalesce(v_f->>'unidad', '');
    if cardinality(v_e.unidades) = 0 then
      if v_unidad <> '' then raise exception 'Esta evaluación no tiene unidades'; end if;
    elsif not (v_unidad = any (v_e.unidades)) then
      raise exception 'La unidad «%» no existe en esta evaluación', v_unidad;
    end if;
    select * into v_ex from public.eval_calificaciones where evaluacion_id = p_evaluacion and alumno_id = v_alumno and unidad = v_unidad;
    if not found and not exists (select 1 from public.matriculas m where m.alumno_id = v_alumno and m.salon_id = v_salon and m.estado = 'activa') then
      raise exception 'Un estudiante de la lista no está matriculado en este salón';
    end if;
    if found and v_ex.estado = 'publicada' then
      raise exception 'La nota ya está publicada: usa «Corregir» e indica el motivo';
    end if;
    begin v_p := nullif(v_f->>'puntaje', '')::numeric; exception when others then raise exception 'La nota no es un número válido'; end;
    v_com := nullif(btrim(coalesce(v_f->>'comentario', '')), '');
    v_det := v_f->'detalle';
    v_r := public.eval_resolver_nota(v_e.componente_id, v_p, v_det);
    v_p := (v_r->>'puntaje')::numeric;
    if v_p is null and v_com is null then -- con rúbrica la nota siempre existe, así que esto solo ocurre en una fila vacía
      delete from public.eval_calificaciones where evaluacion_id = p_evaluacion and alumno_id = v_alumno and unidad = v_unidad;
      continue;
    end if;
    insert into public.eval_calificaciones (evaluacion_id, alumno_id, unidad, puntaje, comentario, detalle, estado, updated_by)
    values (p_evaluacion, v_alumno, v_unidad, v_p, v_com, case when jsonb_typeof(v_r->'detalle') = 'null' then null else v_r->'detalle' end, 'borrador', (select auth.uid()))
    on conflict (evaluacion_id, alumno_id, unidad) do update
      set puntaje = excluded.puntaje, comentario = excluded.comentario, detalle = excluded.detalle, updated_at = now(), updated_by = excluded.updated_by;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Publica los borradores con nota (de todos o de los estudiantes indicados). Los que solo tienen comentario siguen en borrador.
create or replace function public.publicar_evaluacion(p_evaluacion uuid, p_alumnos uuid[] default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_salon uuid := public.eval_salon_de(p_evaluacion); v_n integer;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes permisos para publicar en este salón' using errcode = '42501'; end if;
  update public.eval_calificaciones set estado = 'publicada', publicada_at = now(), updated_at = now(), updated_by = (select auth.uid())
   where evaluacion_id = p_evaluacion and estado = 'borrador' and puntaje is not null and (p_alumnos is null or alumno_id = any (p_alumnos));
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'No hay notas en borrador para publicar'; end if;
  return v_n;
end $$;

-- Corrige una nota publicada. Exige motivo y conserva el historial (valor anterior y nuevo).
create or replace function public.corregir_calificacion(
  p_evaluacion uuid, p_alumno uuid, p_unidad text, p_puntaje numeric, p_comentario text, p_motivo text, p_detalle jsonb default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_e public.eval_evaluaciones; v_salon uuid := public.eval_salon_de(p_evaluacion); v_k public.eval_calificaciones; v_r jsonb;
  v_motivo text := btrim(coalesce(p_motivo, '')); v_com text := nullif(btrim(coalesce(p_comentario, '')), ''); v_p numeric;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes permisos para corregir notas de este salón' using errcode = '42501'; end if;
  if length(v_motivo) < 3 then raise exception 'Indica el motivo de la corrección'; end if;
  select * into v_e from public.eval_evaluaciones where id = p_evaluacion;
  select * into v_k from public.eval_calificaciones where evaluacion_id = p_evaluacion and alumno_id = p_alumno and unidad = coalesce(p_unidad, '') for update;
  if not found then raise exception 'No existe esa nota'; end if;
  if v_k.estado <> 'publicada' then raise exception 'La nota aún es un borrador: edítala y publícala'; end if;
  v_r := public.eval_resolver_nota(v_e.componente_id, p_puntaje, p_detalle);
  v_p := (v_r->>'puntaje')::numeric;
  if v_p is null then raise exception 'Indica la nueva nota'; end if;
  if v_p = v_k.puntaje and v_com is not distinct from v_k.comentario then raise exception 'No hay cambios que guardar'; end if;
  insert into public.eval_historial (calificacion_id, puntaje_anterior, puntaje_nuevo, comentario_anterior, comentario_nuevo, motivo, por)
  values (v_k.id, v_k.puntaje, v_p, v_k.comentario, v_com, v_motivo, (select auth.uid()));
  update public.eval_calificaciones
     set puntaje = v_p, comentario = v_com, detalle = case when jsonb_typeof(v_r->'detalle') = 'null' then detalle else v_r->'detalle' end,
         updated_at = now(), updated_by = (select auth.uid())
   where id = v_k.id;
end $$;

-- ============================================================
-- 9. Cálculo de resultados (uso interno; solo notas PUBLICADAS)
-- ============================================================
-- Un componente cuenta cuando TODAS sus unidades están publicadas; si no, figura como faltante o incompleto y no suma (nunca como cero).
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
    select c.id, c.nombre, c.tipo, c.peso, c.orden, e.id as eid,
           case when e.id is null or cardinality(e.unidades) = 0 then 1 else cardinality(e.unidades) end as n_total,
           coalesce(k.n, 0) as n_pub, k.nota
      from public.eval_componentes c
      left join public.eval_evaluaciones e on e.componente_id = c.id and e.modulo_id = p_modulo
      left join lateral (
        select count(*)::integer n, avg(x.puntaje) nota
          from public.eval_calificaciones x
         where x.evaluacion_id = e.id and x.alumno_id = p_alumno and x.estado = 'publicada'
           and x.unidad = any (case when cardinality(e.unidades) = 0 then array[''] else e.unidades end)) k on true
     where c.version_id = v_m.version_id
  ), t as (
    select *, case when n_pub >= n_total then 'completo' when n_pub = 0 then 'falta' else 'incompleto' end as estado from c
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
    -- nota 0-100 sobre lo evaluado; cuando está completo equivale a puntos / escala × 100
    'nota', case when v_eval > 0 then round(v_puntos / v_eval * 100, 2) end,
    'parcial', v_eval < v_total, 'sin_plantilla', false,
    'componentes', coalesce(v_comp, '[]'::jsonb), 'faltan', v_faltan);
end $$;

-- Nota final del nivel según la consolidación configurada del salón. Con «sin_definir» no calcula nada.
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
    v_r := public.eval_calc_modulo(v_m.id, p_alumno);
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

-- ============================================================
-- 10. Lecturas para docente y administración
-- ============================================================
-- Estructura del salón: módulos, plantilla asignada, evaluaciones con su avance de registro y la consolidación.
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

-- Una evaluación para registrar notas: componente, rúbrica (si tiene), unidades y estudiantes con sus notas.
create or replace function public.eval_evaluacion_detalle(p_evaluacion uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_e public.eval_evaluaciones; v_salon uuid := public.eval_salon_de(p_evaluacion); v_c public.eval_componentes; v_m public.eval_modulos; v_rub jsonb := null;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_e from public.eval_evaluaciones where id = p_evaluacion;
  select * into v_c from public.eval_componentes where id = v_e.componente_id;
  select * into v_m from public.eval_modulos where id = v_e.modulo_id;
  if v_c.rubrica_id is not null then
    select jsonb_build_object('id', r.id, 'nombre', r.nombre, 'tipo', r.tipo,
             'criterios', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'nombre', k.nombre, 'descripcion', k.descripcion, 'max_puntaje', k.max_puntaje, 'bandas', k.bandas) order by k.orden)
                                      from public.eval_rubrica_criterios k where k.rubrica_id = r.id), '[]'::jsonb))
      into v_rub from public.eval_rubricas r where r.id = v_c.rubrica_id;
  end if;
  return jsonb_build_object(
    'evaluacion', jsonb_build_object('id', v_e.id, 'nombre', v_e.nombre, 'unidades', to_jsonb(v_e.unidades), 'salon_id', v_salon,
                                     'modulo_id', v_m.id, 'modulo', v_m.nombre, 'componente', v_c.nombre, 'tipo', v_c.tipo, 'peso', v_c.peso),
    'rubrica', v_rub,
    'alumnos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'alumno_id', a.id, 'nombre', a.nombre,
        'filas', coalesce((select jsonb_agg(jsonb_build_object(
                    'unidad', k.unidad, 'puntaje', k.puntaje, 'comentario', k.comentario, 'detalle', k.detalle, 'estado', k.estado,
                    'corregida', exists (select 1 from public.eval_historial h where h.calificacion_id = k.id)) order by k.unidad)
                  from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = a.id), '[]'::jsonb)) order by a.nombre)
      from public.alumnos a
     where a.id in (select m2.alumno_id from public.matriculas m2 where m2.salon_id = v_salon and m2.estado = 'activa'
                    union select k2.alumno_id from public.eval_calificaciones k2 where k2.evaluacion_id = p_evaluacion)), '[]'::jsonb));
end $$;

-- Historial de correcciones de una evaluación.
create or replace function public.eval_historial_evaluacion(p_evaluacion uuid) returns table (
  alumno text, unidad text, puntaje_anterior numeric, puntaje_nuevo numeric, comentario_anterior text, comentario_nuevo text, motivo text, cuando timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_gestionar_curso(public.eval_salon_de(p_evaluacion)) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return query
    select a.nombre, k.unidad, h.puntaje_anterior, h.puntaje_nuevo, h.comentario_anterior, h.comentario_nuevo, h.motivo, h.cuando
      from public.eval_historial h join public.eval_calificaciones k on k.id = h.calificacion_id join public.alumnos a on a.id = k.alumno_id
     where k.evaluacion_id = p_evaluacion order by h.cuando desc;
end $$;

-- Resultados de todos los estudiantes del salón (nota por módulo y, si está definida, del nivel). Solo notas publicadas.
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
        'modulos', coalesce((select jsonb_agg(public.eval_calc_modulo(m.id, a.id) order by m.orden) from public.eval_modulos m where m.salon_id = p_salon), '[]'::jsonb),
        'nivel', public.eval_calc_nivel(p_salon, a.id)) order by a.nombre)
      from public.alumnos a
     where a.id in (select m2.alumno_id from public.matriculas m2 where m2.salon_id = p_salon and m2.estado = 'activa'
                    union select k.alumno_id from public.eval_calificaciones k join public.eval_evaluaciones e on e.id = k.evaluacion_id
                                                 join public.eval_modulos mm on mm.id = e.modulo_id where mm.salon_id = p_salon)), '[]'::jsonb));
end $$;

-- ============================================================
-- 11. Lectura del estudiante: SUS notas publicadas, con comentarios
-- ============================================================
create or replace function public.portal_mis_calificaciones(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_alumno uuid; v_c public.eval_consolidacion; v_nivel jsonb;
begin
  select cr.alumno_id into v_alumno from public.cuenta_roles cr where cr.user_id = (select auth.uid()) and cr.rol = 'estudiante';
  if v_alumno is null or not public.es_estudiante_de(p_salon) then raise exception 'No tienes acceso a este curso' using errcode = '42501'; end if;
  select * into v_c from public.eval_consolidacion where salon_id = p_salon;
  -- La nota del nivel solo se muestra cuando Coordinación confirmó la consolidación.
  v_nivel := case when coalesce(v_c.confirmada, false) then public.eval_calc_nivel(p_salon, v_alumno) else jsonb_build_object('definido', false, 'confirmada', false) end;
  return jsonb_build_object(
    'nivel', v_nivel,
    'modulos', coalesce((
      select jsonb_agg(public.eval_calc_modulo(m.id, v_alumno) || jsonb_build_object(
        'evaluaciones', coalesce((
          select jsonb_agg(jsonb_build_object(
            'nombre', e.nombre, 'peso', c.peso,
            'notas', coalesce((select jsonb_agg(jsonb_build_object('unidad', k.unidad, 'puntaje', k.puntaje, 'comentario', k.comentario,
                                                                  'corregida', exists (select 1 from public.eval_historial h where h.calificacion_id = k.id),
                                                                  'fecha', k.publicada_at) order by k.unidad)
                                 from public.eval_calificaciones k where k.evaluacion_id = e.id and k.alumno_id = v_alumno and k.estado = 'publicada'), '[]'::jsonb))
            order by c.orden)
          from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id where e.modulo_id = m.id), '[]'::jsonb))
        order by m.orden)
      from public.eval_modulos m where m.salon_id = p_salon), '[]'::jsonb));
end $$;

-- ============================================================
-- 12. Referencias del Excel de Coordinación (EDITABLES, en borrador: no se aplican a ningún salón)
-- ============================================================
do $$
declare
  v_spk uuid; v_wri uuid; v_pro uuid; v_for uuid; v_p uuid; v_v uuid;
begin
  if not exists (select 1 from public.eval_rubricas where lower(nombre) = 'speaking') then
    insert into public.eval_rubricas (nombre, tipo, descripcion) values ('Speaking', 'speaking', 'Referencia del Excel de Coordinación: 5 criterios de 10 puntos.') returning id into v_spk;
    insert into public.eval_rubrica_criterios (rubrica_id, nombre, descripcion, max_puntaje, orden, bandas)
    select v_spk, n, d, 10, o, '[{"etiqueta":"Excelente","desde":8,"hasta":10},{"etiqueta":"Bueno","desde":6,"hasta":7},{"etiqueta":"Regular","desde":4,"hasta":5},{"etiqueta":"Bajo","desde":0,"hasta":3}]'::jsonb
      from (values (1, 'Communicative ability', 'Duración de las expresiones y flexibilidad para comunicarse'), (2, 'Accuracy/grammar', 'Precisión y adecuación de la gramática'),
                   (3, 'Vocabulary', 'Variedad y elección de palabras y frases'), (4, 'Pronunciation', 'Entonación, acento y sonidos'),
                   (5, 'Content', 'Desarrollo del tema, organización, coherencia y cohesión')) t(o, n, d);
  end if;
  if not exists (select 1 from public.eval_rubricas where lower(nombre) = 'writing') then
    insert into public.eval_rubricas (nombre, tipo, descripcion) values ('Writing', 'writing', 'Referencia del Excel de Coordinación: 5 criterios de 20 puntos.') returning id into v_wri;
    insert into public.eval_rubrica_criterios (rubrica_id, nombre, max_puntaje, orden, bandas)
    select v_wri, n, 20, o, '[{"etiqueta":"Bajo"},{"etiqueta":"Regular"},{"etiqueta":"Excelente"}]'::jsonb
      from (values (1, 'Content / Ideas'), (2, 'Coherence and cohesion'), (3, 'Grammar'), (4, 'Spelling and punctuation'), (5, 'Vocabulary')) t(o, n);
  end if;
  if not exists (select 1 from public.eval_rubricas where lower(nombre) = 'project') then
    insert into public.eval_rubricas (nombre, tipo, descripcion) values ('Project', 'project', 'Referencia del Excel de Coordinación: 10 criterios de 10 puntos (el Excel sumaba solo 9 en tres módulos).') returning id into v_pro;
    insert into public.eval_rubrica_criterios (rubrica_id, nombre, descripcion, max_puntaje, orden, bandas)
    select v_pro, n, d, 10, o, '[{"etiqueta":"Bajo","desde":0,"hasta":5},{"etiqueta":"Regular","desde":6,"hasta":8},{"etiqueta":"Excelente","desde":9,"hasta":10}]'::jsonb
      from (values (1, 'Presentation · Visual', 'Herramientas de presentación'), (2, 'Non-verbal · Eye contact while reading', null), (3, 'Non-verbal · Attitude and posture', null),
                   (4, 'Oral · Elocution', null), (5, 'Oral · Pronunciation', null), (6, 'Oral · Vocabulary', null), (7, 'Oral · Accuracy/grammar', null),
                   (8, 'Contents · Organization', null), (9, 'Contents · Subject knowledge', null), (10, 'Questions · Question and answer session', null)) t(o, n, d);
  end if;
  if not exists (select 1 from public.eval_rubricas where lower(nombre) = 'formative assessment') then
    insert into public.eval_rubricas (nombre, tipo, descripcion) values ('Formative Assessment', 'formative', 'Referencia del Excel de Coordinación: 5 criterios de 20 puntos por unidad.') returning id into v_for;
    insert into public.eval_rubrica_criterios (rubrica_id, nombre, descripcion, max_puntaje, orden, bandas)
    select v_for, n, d, 20, o, '[{"etiqueta":"Needs improvement","desde":1,"hasta":5},{"etiqueta":"Developing","desde":6,"hasta":10},{"etiqueta":"Competent","desde":11,"hasta":15},{"etiqueta":"Excellent","desde":16,"hasta":20}]'::jsonb
      from (values (1, 'Use of English', 'Uso de gramática y vocabulario vistos en clase'), (2, 'Listening', 'Comprensión de audios e instrucciones'),
                   (3, 'Writing', 'Producción escrita'), (4, 'Speaking', 'Expresión oral'), (5, 'Reading', 'Comprensión de textos adaptados')) t(o, n, d);
  end if;

  select id into v_wri from public.eval_rubricas where lower(nombre) = 'writing';
  select id into v_pro from public.eval_rubricas where lower(nombre) = 'project';
  select id into v_for from public.eval_rubricas where lower(nombre) = 'formative assessment';

  if not exists (select 1 from public.eval_plantillas where lower(nombre) = lower('Referencia · Notas por módulo')) then
    insert into public.eval_plantillas (nombre, descripcion) values ('Referencia · Notas por módulo', 'Hoja «Notas por módulo» del Excel de Coordinación (base 100 por módulo). Referencia editable, no confirmada.') returning id into v_p;
    insert into public.eval_versiones (plantilla_id, version, escala_puntos, notas) values (v_p, 1, 100, 'Del Excel: Test 25, Writing 25, Project 25, Formative 18, SPARK 7. Pendiente de confirmación.') returning id into v_v;
    insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id) values
      (v_v, 'Test', 'test', 25, 1, null), (v_v, 'Writing', 'writing', 25, 2, v_wri), (v_v, 'Project', 'project', 25, 3, v_pro),
      (v_v, 'Formative Assessment', 'formative', 18, 4, v_for), (v_v, 'SPARK Homework', 'spark', 7, 5, null);
  end if;
  if not exists (select 1 from public.eval_plantillas where lower(nombre) = lower('Referencia · Grades Chart (módulos de práctica)')) then
    insert into public.eval_plantillas (nombre, descripcion) values ('Referencia · Grades Chart (módulos de práctica)', 'Hoja «Grades Chart»: 25 puntos por módulo (módulos 1 a 3). Distribución propia, no equivalente a «Notas por módulo». Referencia editable, no confirmada.') returning id into v_p;
    insert into public.eval_versiones (plantilla_id, version, escala_puntos, notas) values (v_p, 1, 25, 'Del Excel: Test 7, Writing 6, Project 7, Formative 3, SPARK 2 (suma 25). Pendiente de confirmación.') returning id into v_v;
    insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id) values
      (v_v, 'Test', 'test', 7, 1, null), (v_v, 'Writing', 'writing', 6, 2, v_wri), (v_v, 'Project', 'project', 7, 3, v_pro),
      (v_v, 'Formative Assessment', 'formative', 3, 4, v_for), (v_v, 'SPARK Homework', 'spark', 2, 5, null);
  end if;
  if not exists (select 1 from public.eval_plantillas where lower(nombre) = lower('Referencia · Grades Chart (módulo final)')) then
    insert into public.eval_plantillas (nombre, descripcion) values ('Referencia · Grades Chart (módulo final)', 'Hoja «Grades Chart»: 25 puntos para el módulo final (Final Test / Final Project). Referencia editable, no confirmada.') returning id into v_p;
    insert into public.eval_versiones (plantilla_id, version, escala_puntos, notas) values (v_p, 1, 25, 'Del Excel: Final Test 8, Writing 6, Final Project 8, Formative 2, SPARK 1 (suma 25). Pendiente de confirmación.') returning id into v_v;
    insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id) values
      (v_v, 'Final Test', 'test', 8, 1, null), (v_v, 'Writing', 'writing', 6, 2, v_wri), (v_v, 'Final Project', 'project', 8, 3, v_pro),
      (v_v, 'Formative Assessment', 'formative', 2, 4, v_for), (v_v, 'SPARK Homework', 'spark', 1, 5, null);
  end if;
end $$;

-- ============================================================
-- 13. Permisos de ejecución
-- ============================================================
revoke execute on function
  public.guardar_rubrica(uuid, jsonb), public.guardar_plantilla(uuid, text, text, uuid), public.guardar_version(uuid, jsonb),
  public.activar_version(uuid), public.nueva_version(uuid), public.guardar_modulo(uuid, uuid, text, smallint, numeric),
  public.eliminar_modulo(uuid), public.asignar_plantilla(uuid, uuid), public.guardar_consolidacion(uuid, text, boolean),
  public.eval_salon_de(uuid), public.configurar_unidades(uuid, text[]), public.eval_resolver_nota(uuid, numeric, jsonb),
  public.guardar_calificaciones(uuid, jsonb), public.publicar_evaluacion(uuid, uuid[]),
  public.corregir_calificacion(uuid, uuid, text, numeric, text, text, jsonb),
  public.eval_calc_modulo(uuid, uuid), public.eval_calc_nivel(uuid, uuid),
  public.eval_estructura_salon(uuid), public.eval_evaluacion_detalle(uuid), public.eval_historial_evaluacion(uuid),
  public.eval_resultados_salon(uuid), public.portal_mis_calificaciones(uuid)
  from public, anon, authenticated;
grant execute on function
  public.guardar_rubrica(uuid, jsonb), public.guardar_plantilla(uuid, text, text, uuid), public.guardar_version(uuid, jsonb),
  public.activar_version(uuid), public.nueva_version(uuid), public.guardar_modulo(uuid, uuid, text, smallint, numeric),
  public.eliminar_modulo(uuid), public.asignar_plantilla(uuid, uuid), public.guardar_consolidacion(uuid, text, boolean),
  public.configurar_unidades(uuid, text[]),
  public.guardar_calificaciones(uuid, jsonb), public.publicar_evaluacion(uuid, uuid[]),
  public.corregir_calificacion(uuid, uuid, text, numeric, text, text, jsonb),
  public.eval_estructura_salon(uuid), public.eval_evaluacion_detalle(uuid), public.eval_historial_evaluacion(uuid),
  public.eval_resultados_salon(uuid), public.portal_mis_calificaciones(uuid)
  to authenticated;
