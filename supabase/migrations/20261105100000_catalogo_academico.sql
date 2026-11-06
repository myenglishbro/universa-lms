-- UNIVERSA · Catálogo académico (Fase 1)  ·  PROPUESTA: no se ha ejecutado en ninguna base.
--
-- Alcance: crea tablas, vistas y funciones NUEVAS de catálogo. No modifica salones, salon_sesiones,
-- salon_horarios, programas, perfiles, el calendario, salon_progreso ni ninguna política existente.
--
-- Origen de los datos: documento técnico-funcional del 03-nov-2026. Los totales de sesiones y horas son
-- los resultados del generador original (Course Advance, función build()). Entran como 'inferido':
-- NO están aprobados por Coordinación (aprobado_en / aprobado_por vacíos) y cada plan queda enlazado a las
-- reglas pendientes (P01-P11) de las que depende.
--
-- Versionado: un plan es INMUTABLE en sus datos de negocio. Para corregirlo se inserta una versión nueva
-- (version + 1, reemplaza_a = plan anterior) y la anterior pasa a vigente = false con vigente_hasta.
-- Los salones (Fase 2) guardarán el plan_id exacto con que se crearon, así que una versión nueva
-- nunca cambia retroactivamente un salón existente.
--
-- Escritura: ninguna política de escritura. Los cambios se hacen por migración o por funciones de admin futuras.
-- Requiere las migraciones anteriores (public.tiene_perfil(), public.set_updated_at(), auth.users).
-- Se ejecuta como una sola transacción: si cualquier verificación falla, no queda nada.
begin;

-- ============================================================
-- 1. Tablas
-- ============================================================
create table public.niveles (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null unique,
  nombre_en text,
  orden smallint not null unique,
  libro text,
  mcer text,
  estado_dato text not null default 'confirmado' check (estado_dato in ('confirmado', 'inferido', 'pendiente')),
  fuente text not null,
  notas text,
  created_at timestamptz not null default now()
);

-- Ciclos 0-12. 0 = ciclo único del nivel Funcional; impares = primer ciclo del nivel; pares = segundo.
create table public.ciclos (
  numero smallint primary key check (numero between 0 and 12),
  nivel_id uuid not null references public.niveles(id),
  posicion text not null check (posicion in ('unico', 'impar', 'par')),
  estado_dato text not null default 'confirmado' check (estado_dato in ('confirmado', 'inferido', 'pendiente')),
  fuente text not null,
  notas text,
  unique (numero, nivel_id),
  unique (nivel_id, posicion),
  check ((numero = 0 and posicion = 'unico')
      or (numero > 0 and posicion = case when numero % 2 = 1 then 'impar' else 'par' end))
);

create table public.modalidades (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null unique,
  alumnos_min smallint not null check (alumnos_min > 0),
  alumnos_max smallint not null,
  horas_referencia_nivel integer not null check (horas_referencia_nivel > 0), -- por NIVEL completo, no por ciclo
  admite_funcional boolean not null,
  estado_dato text not null default 'confirmado' check (estado_dato in ('confirmado', 'inferido', 'pendiente')),
  fuente text not null,
  notas text,
  created_at timestamptz not null default now(),
  check (alumnos_max >= alumnos_min)
);

-- Horarios definidos (S1 SCHEDS / S3 SCHEDS). Los días concretos de cada salón siguen en salon_horarios.
create table public.horario_patrones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  dias smallint[] not null check (cardinality(dias) > 0 and dias <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]), -- 1 = lunes ... 7 = domingo
  minutos_clase smallint not null check (minutos_clase > 0),
  sesiones_semana smallint generated always as (cardinality(dias)::smallint) stored,
  estado_dato text not null default 'confirmado' check (estado_dato in ('confirmado', 'inferido', 'pendiente')),
  fuente text not null
);

-- Un plan = nivel x modalidad x duración de clase x sesiones por semana x tipo de alumno (x versión).
-- tipo_alumno:
--   'unico'    el catálogo original tiene una sola fila, sin distinción de alumno.
--   'ambos'    el catálogo original lista alumno nuevo y continuo con el MISMO resultado (2 filas, 1 plan).
--   'nuevo' / 'continuo'  resultados distintos (Estándar 90 min, ciclos 1-12).
-- Las 120 h / 80 h son por NIVEL; aquí se guardan las sesiones y horas REALES del generador.
create table public.planes_academicos (
  id uuid primary key default gen_random_uuid(),
  nivel_id uuid not null references public.niveles(id),
  modalidad_id uuid not null references public.modalidades(id),
  minutos_clase smallint not null check (minutos_clase > 0),
  sesiones_semana smallint not null check (sesiones_semana > 0),
  tipo_alumno text not null default 'unico' check (tipo_alumno in ('unico', 'ambos', 'nuevo', 'continuo')),
  total_sesiones integer not null check (total_sesiones > 0),
  horas_totales numeric(5,1) not null check (horas_totales > 0),
  semanas smallint not null check (semanas > 0),                       -- sin contar el receso
  receso_semanas smallint not null default 0 check (receso_semanas >= 0),
  ultima_sesion_minutos smallint,                                      -- solo si la última sesión del plan dura menos (Acelerado 3 h = 90)
  version integer not null default 1 check (version >= 1),
  reemplaza_a uuid references public.planes_academicos(id),
  vigente boolean not null default true,
  vigente_desde date not null default ((now() at time zone 'America/Lima')::date),
  vigente_hasta date,
  estado_dato text not null default 'inferido' check (estado_dato in ('confirmado', 'inferido', 'pendiente')),
  fuente text not null,
  notas text,
  aprobado_en timestamptz,
  aprobado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planes_version_unica unique (nivel_id, modalidad_id, minutos_clase, sesiones_semana, tipo_alumno, version),
  unique (id, nivel_id),
  check (ultima_sesion_minutos is null or (ultima_sesion_minutos > 0 and ultima_sesion_minutos < minutos_clase)),
  -- horas = suma de minutos de todas las sesiones / 60 (regla 5 del documento)
  check (horas_totales = round(((total_sesiones * minutos_clase) - coalesce(minutos_clase - ultima_sesion_minutos, 0)) / 60.0, 1)),
  check ((version = 1) = (reemplaza_a is null) and (reemplaza_a is null or reemplaza_a <> id)),
  check (vigente or vigente_hasta is not null),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde),
  check ((aprobado_en is null) = (aprobado_por is null)),
  -- Un dato inferido nunca figura como aprobado: al aprobarlo, Coordinación lo pasa a 'confirmado'.
  check (estado_dato <> 'inferido' or aprobado_en is null)
);
create unique index planes_vigente_unico on public.planes_academicos
  (nivel_id, modalidad_id, minutos_clase, sesiones_semana, tipo_alumno) where vigente;
create index planes_nivel_modalidad_idx on public.planes_academicos (nivel_id, modalidad_id);

create trigger planes_updated_at before update on public.planes_academicos
  for each row execute function public.set_updated_at();

-- Sesiones y horas por ciclo dentro de cada plan (cuotas de cada ciclo).
create table public.plan_ciclos (
  plan_id uuid not null,
  nivel_id uuid not null,
  ciclo smallint not null,
  sesiones integer not null check (sesiones > 0),
  horas numeric(5,1) not null check (horas > 0),
  primary key (plan_id, ciclo),
  foreign key (plan_id, nivel_id) references public.planes_academicos (id, nivel_id) on delete cascade,
  foreign key (ciclo, nivel_id) references public.ciclos (numero, nivel_id)
);

-- Reglas o datos por aprobar por Coordinación, y los planes que dependen de ellas.
create table public.reglas_pendientes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  tema text not null,
  descripcion text not null,
  impacto text not null check (impacto in ('sesiones', 'horas', 'calendario', 'academico', 'comercial')),
  estado text not null default 'abierta' check (estado in ('abierta', 'resuelta')),
  resolucion text,
  resuelta_en timestamptz,
  fuente text not null,
  created_at timestamptz not null default now(),
  check ((estado = 'resuelta') = (resuelta_en is not null))
);

create table public.plan_pendientes (
  plan_id uuid not null references public.planes_academicos(id) on delete cascade,
  regla_id uuid not null references public.reglas_pendientes(id) on delete cascade,
  primary key (plan_id, regla_id)
);

-- ============================================================
-- 2. Triggers (reglas entre filas o tablas que un CHECK no puede expresar)
-- ============================================================
create function public.catalogo_validar_plan() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.ciclos c where c.nivel_id = new.nivel_id and c.posicion = 'unico')
     and not (select m.admite_funcional from public.modalidades m where m.id = new.modalidad_id) then
    raise exception 'La modalidad seleccionada no admite el nivel Funcional';
  end if;

  if not exists (
    select 1 from public.horario_patrones h
    where h.minutos_clase = new.minutos_clase and h.sesiones_semana = new.sesiones_semana
  ) then
    raise exception 'No existe un horario definido de % min con % sesiones por semana', new.minutos_clase, new.sesiones_semana;
  end if;

  -- Dos planes vigentes no pueden cubrir la misma combinación ('unico' y 'ambos' cubren a cualquier alumno).
  if new.vigente and exists (
    select 1 from public.planes_academicos o
    where o.id <> new.id and o.vigente
      and o.nivel_id = new.nivel_id and o.modalidad_id = new.modalidad_id
      and o.minutos_clase = new.minutos_clase and o.sesiones_semana = new.sesiones_semana
      and (o.tipo_alumno in ('unico', 'ambos') or new.tipo_alumno in ('unico', 'ambos') or o.tipo_alumno = new.tipo_alumno)
  ) then
    raise exception 'Ya existe un plan vigente que cubre esta combinación; crea una versión nueva y retira la anterior';
  end if;
  return new;
end $$;

create function public.catalogo_plan_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (old.nivel_id, old.modalidad_id, old.minutos_clase, old.sesiones_semana, old.tipo_alumno, old.total_sesiones,
      old.horas_totales, old.semanas, old.receso_semanas, old.ultima_sesion_minutos, old.version, old.reemplaza_a,
      old.vigente_desde)
     is distinct from
     (new.nivel_id, new.modalidad_id, new.minutos_clase, new.sesiones_semana, new.tipo_alumno, new.total_sesiones,
      new.horas_totales, new.semanas, new.receso_semanas, new.ultima_sesion_minutos, new.version, new.reemplaza_a,
      new.vigente_desde) then
    raise exception 'Un plan académico no se modifica: crea una versión nueva (version + 1) y retira la anterior';
  end if;
  return new;
end $$;

create function public.catalogo_plan_ciclos_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Las cuotas por ciclo de un plan no se modifican: crea una versión nueva del plan';
end $$;

revoke execute on function public.catalogo_validar_plan(), public.catalogo_plan_inmutable(),
  public.catalogo_plan_ciclos_inmutable() from public, anon, authenticated;

create trigger planes_validar before insert or update on public.planes_academicos
  for each row execute function public.catalogo_validar_plan();
create trigger planes_inmutable before update on public.planes_academicos
  for each row execute function public.catalogo_plan_inmutable();
create trigger plan_ciclos_inmutable before update on public.plan_ciclos
  for each row execute function public.catalogo_plan_ciclos_inmutable();

-- ============================================================
-- 3. Vistas (respetan RLS de quien consulta)
-- ============================================================
create view public.catalogo_planes with (security_invoker = true) as
select p.id as plan_id,
       n.codigo as nivel_codigo, n.nombre as nivel, n.orden as nivel_orden,
       m.codigo as modalidad_codigo, m.nombre as modalidad,
       p.minutos_clase, p.sesiones_semana, p.tipo_alumno,
       p.total_sesiones, p.horas_totales, p.semanas, p.receso_semanas, p.ultima_sesion_minutos,
       p.version, p.reemplaza_a, p.vigente, p.vigente_desde, p.vigente_hasta,
       p.estado_dato, p.fuente, p.notas,
       p.aprobado_en, (p.aprobado_en is not null) as aprobado,
       (select count(*) from public.plan_pendientes pp
          join public.reglas_pendientes r on r.id = pp.regla_id
         where pp.plan_id = p.id and r.estado = 'abierta')::integer as pendientes_abiertas
from public.planes_academicos p
join public.niveles n on n.id = p.nivel_id
join public.modalidades m on m.id = p.modalidad_id;

-- Expande cada plan vigente a las filas del catálogo original: una por nivel x modalidad x horario x tipo de alumno.
-- tipo_alumno nulo = el catálogo original no distingue alumno. El ciclo 0 (Funcional) cuenta como "primer ciclo".
create view public.catalogo_combinaciones with (security_invoker = true) as
select n.codigo as nivel_codigo, n.nombre as nivel,
       m.codigo as modalidad_codigo,
       h.codigo as patron_codigo, h.minutos_clase, h.sesiones_semana,
       a.tipo_alumno,
       p.id as plan_id, p.version, p.total_sesiones, p.horas_totales, p.semanas, p.receso_semanas,
       (select pc.sesiones from public.plan_ciclos pc join public.ciclos c on c.numero = pc.ciclo
         where pc.plan_id = p.id and c.posicion in ('impar', 'unico')) as sesiones_ciclo_impar,
       (select pc.horas from public.plan_ciclos pc join public.ciclos c on c.numero = pc.ciclo
         where pc.plan_id = p.id and c.posicion in ('impar', 'unico')) as horas_ciclo_impar,
       (select pc.sesiones from public.plan_ciclos pc join public.ciclos c on c.numero = pc.ciclo
         where pc.plan_id = p.id and c.posicion = 'par') as sesiones_ciclo_par,
       (select pc.horas from public.plan_ciclos pc join public.ciclos c on c.numero = pc.ciclo
         where pc.plan_id = p.id and c.posicion = 'par') as horas_ciclo_par,
       p.estado_dato, p.aprobado_en,
       h.dias,
       (select pc.ciclo from public.plan_ciclos pc join public.ciclos c on c.numero = pc.ciclo
         where pc.plan_id = p.id and c.posicion in ('impar', 'unico')) as ciclo_impar,
       (select pc.ciclo from public.plan_ciclos pc join public.ciclos c on c.numero = pc.ciclo
         where pc.plan_id = p.id and c.posicion = 'par') as ciclo_par
from public.planes_academicos p
join public.niveles n on n.id = p.nivel_id
join public.modalidades m on m.id = p.modalidad_id
join public.horario_patrones h on h.minutos_clase = p.minutos_clase and h.sesiones_semana = p.sesiones_semana
cross join lateral unnest(
  case p.tipo_alumno
    when 'ambos' then array['nuevo', 'continuo']
    when 'unico' then array[null]::text[]
    else array[p.tipo_alumno]
  end
) as a(tipo_alumno)
where p.vigente;

-- ============================================================
-- 4. Verificación de integridad (solo lectura; reutilizable después de cualquier cambio del catálogo)
-- ============================================================
-- Devuelve una fila por prueba; ok = false indica incumplimiento y el detalle nombra los planes afectados.
create function public.catalogo_verificar() returns table (prueba text, ok boolean, detalle text)
language sql stable set search_path = '' as $$
  with pe as (
    select p.id, p.nivel_id, p.modalidad_id, p.minutos_clase, p.sesiones_semana, p.tipo_alumno,
           p.total_sesiones, p.horas_totales, p.ultima_sesion_minutos, p.vigente,
           n.codigo || '/' || m.codigo || '/' || p.minutos_clase || 'min/' || p.tipo_alumno || '/v' || p.version as et,
           (select sum(pc.sesiones) from public.plan_ciclos pc where pc.plan_id = p.id) as ses_ciclos,
           (select sum(pc.horas) from public.plan_ciclos pc where pc.plan_id = p.id) as hrs_ciclos,
           (select count(*) from public.plan_ciclos pc where pc.plan_id = p.id) as n_ciclos,
           (select count(*) from public.ciclos c where c.nivel_id = p.nivel_id) as n_ciclos_nivel
    from public.planes_academicos p
    join public.niveles n on n.id = p.nivel_id
    join public.modalidades m on m.id = p.modalidad_id
  )
  -- 1. La suma de sesiones de los ciclos es el total del plan
  select 'sesiones_suman_total'::text, count(*) = 0,
         coalesce(string_agg(et || ' (plan ' || total_sesiones || ' vs ciclos ' || coalesce(ses_ciclos, 0) || ')', '; '), 'correcto')
  from pe where total_sesiones is distinct from ses_ciclos
  union all
  -- 2. La suma de horas de los ciclos es el total del plan
  select 'horas_suman_total', count(*) = 0,
         coalesce(string_agg(et || ' (plan ' || horas_totales || ' vs ciclos ' || coalesce(hrs_ciclos, 0) || ')', '; '), 'correcto')
  from pe where horas_totales is distinct from hrs_ciclos
  union all
  -- 3. Cantidad de ciclos del plan = cantidad de ciclos de su nivel
  select 'cantidad_ciclos', count(*) = 0,
         coalesce(string_agg(et || ' (plan ' || n_ciclos || ' vs nivel ' || n_ciclos_nivel || ')', '; '), 'correcto')
  from pe where n_ciclos <> n_ciclos_nivel
  union all
  -- 4. Los ciclos del plan son exactamente los del nivel (ni faltan ni sobran)
  select 'ciclos_exactos', count(*) = 0, coalesce(string_agg(et, '; '), 'correcto')
  from pe
  where exists (select c.numero from public.ciclos c where c.nivel_id = pe.nivel_id
                except select pc.ciclo from public.plan_ciclos pc where pc.plan_id = pe.id)
     or exists (select pc.ciclo from public.plan_ciclos pc where pc.plan_id = pe.id
                except select c.numero from public.ciclos c where c.nivel_id = pe.nivel_id)
  union all
  -- 5. Horas de cada ciclo = sesiones x minutos / 60 (la última sesión del nivel puede durar menos)
  select 'horas_por_ciclo_correctas', count(*) = 0,
         coalesce(string_agg(pe.et || ' ciclo ' || pc.ciclo || ' (' || pc.horas || ' h)', '; '), 'correcto')
  from public.plan_ciclos pc
  join pe on pe.id = pc.plan_id
  join public.ciclos c on c.numero = pc.ciclo
  where pc.horas is distinct from round(
          ((pc.sesiones * pe.minutos_clase)
           - case when c.posicion in ('par', 'unico') then coalesce(pe.minutos_clase - pe.ultima_sesion_minutos, 0) else 0 end) / 60.0, 1)
  union all
  -- 6. Horas totales del plan = sesiones x minutos / 60
  select 'horas_totales_correctas', count(*) = 0, coalesce(string_agg(et, '; '), 'correcto')
  from pe
  where horas_totales is distinct from round(
          ((total_sesiones * minutos_clase) - coalesce(minutos_clase - ultima_sesion_minutos, 0)) / 60.0, 1)
  union all
  -- 7. Sin planes vigentes duplicados ni solapados
  select 'sin_planes_duplicados', count(*) = 0, coalesce(string_agg(a.et || ' ~ ' || b.et, '; '), 'correcto')
  from pe a
  join pe b on a.id < b.id and a.vigente and b.vigente
           and a.nivel_id = b.nivel_id and a.modalidad_id = b.modalidad_id
           and a.minutos_clase = b.minutos_clase and a.sesiones_semana = b.sesiones_semana
           and (a.tipo_alumno in ('unico', 'ambos') or b.tipo_alumno in ('unico', 'ambos') or a.tipo_alumno = b.tipo_alumno)
  union all
  -- 8. Referencias coherentes
  select 'referencias_consistentes', count(*) = 0, coalesce(string_agg(r.detalle, '; '), 'correcto')
  from (
    select pc.plan_id::text || ' ciclo ' || pc.ciclo || ': nivel inconsistente' as detalle
    from public.plan_ciclos pc
    join public.planes_academicos p on p.id = pc.plan_id
    join public.ciclos c on c.numero = pc.ciclo
    where pc.nivel_id <> p.nivel_id or c.nivel_id <> pc.nivel_id
    union all
    select pe.et || ': la modalidad no admite Funcional'
    from pe join public.modalidades m on m.id = pe.modalidad_id
    where not m.admite_funcional
      and exists (select 1 from public.ciclos c where c.nivel_id = pe.nivel_id and c.posicion = 'unico')
    union all
    select pe.et || ': sin horario definido'
    from pe
    where not exists (select 1 from public.horario_patrones h
                      where h.minutos_clase = pe.minutos_clase and h.sesiones_semana = pe.sesiones_semana)
    union all
    select pe.et || ': la versión anterior apunta a otro nivel o modalidad'
    from public.planes_academicos p
    join pe on pe.id = p.id
    join public.planes_academicos o on o.id = p.reemplaza_a
    where o.nivel_id <> p.nivel_id or o.modalidad_id <> p.modalidad_id
  ) r
  union all
  -- 9. Ciclos 0-12 completos y bien repartidos por nivel (Funcional: ciclo único; el resto: impar + par)
  select 'ciclos_0_a_12',
         (select count(*) from public.ciclos) = 13
           and (select min(numero) from public.ciclos) = 0
           and (select max(numero) from public.ciclos) = 12
           and not exists (
             select 1 from public.niveles n
             where not (
               (select count(*) from public.ciclos c where c.nivel_id = n.id) = 1
                 and exists (select 1 from public.ciclos c where c.nivel_id = n.id and c.posicion = 'unico')
               or (select count(*) from public.ciclos c where c.nivel_id = n.id) = 2
                 and exists (select 1 from public.ciclos c where c.nivel_id = n.id and c.posicion = 'impar')
                 and exists (select 1 from public.ciclos c where c.nivel_id = n.id and c.posicion = 'par'))),
         'ciclos: ' || (select count(*) from public.ciclos)
$$;
revoke execute on function public.catalogo_verificar() from public, anon;
grant execute on function public.catalogo_verificar() to authenticated;

-- ============================================================
-- 5. Seguridad: solo lectura para usuarios con perfil (admin o comercial)
-- ============================================================
revoke all on public.niveles, public.ciclos, public.modalidades, public.horario_patrones,
              public.planes_academicos, public.plan_ciclos, public.reglas_pendientes,
              public.plan_pendientes, public.catalogo_planes, public.catalogo_combinaciones
  from anon, authenticated;
grant select on public.niveles, public.ciclos, public.modalidades, public.horario_patrones,
                public.planes_academicos, public.plan_ciclos, public.reglas_pendientes,
                public.plan_pendientes, public.catalogo_planes, public.catalogo_combinaciones
  to authenticated;

alter table public.niveles           enable row level security;
alter table public.ciclos            enable row level security;
alter table public.modalidades       enable row level security;
alter table public.horario_patrones  enable row level security;
alter table public.planes_academicos enable row level security;
alter table public.plan_ciclos       enable row level security;
alter table public.reglas_pendientes enable row level security;
alter table public.plan_pendientes   enable row level security;

create policy "consultar niveles" on public.niveles for select to authenticated
  using ((select public.tiene_perfil()));
create policy "consultar ciclos" on public.ciclos for select to authenticated
  using ((select public.tiene_perfil()));
create policy "consultar modalidades" on public.modalidades for select to authenticated
  using ((select public.tiene_perfil()));
create policy "consultar patrones de horario" on public.horario_patrones for select to authenticated
  using ((select public.tiene_perfil()));
create policy "consultar planes" on public.planes_academicos for select to authenticated
  using ((select public.tiene_perfil()));
create policy "consultar ciclos de planes" on public.plan_ciclos for select to authenticated
  using ((select public.tiene_perfil()));
create policy "consultar reglas pendientes" on public.reglas_pendientes for select to authenticated
  using ((select public.tiene_perfil()));
create policy "consultar pendientes de planes" on public.plan_pendientes for select to authenticated
  using ((select public.tiene_perfil()));
-- Sin políticas INSERT/UPDATE/DELETE y sin GRANT de escritura: nadie escribe el catálogo desde la aplicación.

-- ============================================================
-- 6. Datos iniciales
-- ============================================================
insert into public.niveles (codigo, nombre, nombre_en, orden, libro, mcer, fuente, notas) values
  ('funcional', 'Funcional', 'Functional', 1, 'World English Intro 3e', 'A1.1',
   'S1 LEVELS; S3 LEVELS; S4 CEFR; S6; S11', 'Un solo ciclo (ciclo 0).'),
  ('basico', 'Básico', 'Basic', 2, 'World English 1 3e', 'A1.2 – A2.1',
   'S1 LEVELS; S3 LEVELS; S4 CEFR; S6; S11', 'Los Syllabus originales (S9) indican un MCER más amplio (A1–A2).'),
  ('intermedio', 'Intermedio', 'Intermediate', 3, 'World English 2 3e', 'A2.2 – B1.1',
   'S1 LEVELS; S3 LEVELS; S4 CEFR; S6; S11', null),
  ('intermedio_alto', 'Intermedio Alto', 'Upper Intermediate', 4, 'World English 3 3e', 'B1.2 – B1.3',
   'S1 LEVELS; S3 LEVELS; S4 CEFR; S6; S11',
   'Los archivos usan dos nombres en inglés: Upper Intermediate (S1) y High-Intermediate (S3, S6).'),
  ('avanzado', 'Avanzado', 'Advanced', 5, 'Keynote 4', 'B2.1 – B2.2',
   'S1 LEVELS; S3 LEVELS; S4 CEFR; S6; S11', null),
  ('proficiency', 'Proficiente', 'Proficient', 6, 'Keynote Advanced 5', 'C1.1 – C1.2',
   'S1 LEVELS; S3 LEVELS; S4 CEFR; S6; S11', 'Se conserva el nombre original del generador (Proficiente). El código interno "proficiency" no cambia.'),
  ('master', 'Master', 'Master', 7, 'Keynote Proficient 6', 'C2.1 – C2.2',
   'S1 LEVELS; S3 LEVELS; S4 CEFR; S6; S11', 'Se conserva el nombre original del generador (Master, sin tilde).');

-- Asignación de ciclos a niveles verificada contra LEVELS de course-advance-logic.js (cycles: [5,6] = Intermedio alto,
-- [7,8] = Avanzado, etc.) y contra la columna 'ciclos' de universa_catalogo_horarios.csv.
insert into public.ciclos (numero, nivel_id, posicion, estado_dato, fuente)
select v.numero, n.id, v.posicion, 'confirmado',
       'Documento técnico-funcional 03-nov-2026, §2; verificado contra LEVELS de course-advance-logic.js y la columna ciclos del CSV'
from (values
  (0, 'funcional', 'unico'),
  (1, 'basico', 'impar'), (2, 'basico', 'par'),
  (3, 'intermedio', 'impar'), (4, 'intermedio', 'par'),
  (5, 'intermedio_alto', 'impar'), (6, 'intermedio_alto', 'par'),
  (7, 'avanzado', 'impar'), (8, 'avanzado', 'par'),
  (9, 'proficiency', 'impar'), (10, 'proficiency', 'par'),
  (11, 'master', 'impar'), (12, 'master', 'par')
) as v(numero, nivel, posicion)
join public.niveles n on n.codigo = v.nivel;

insert into public.modalidades
  (codigo, nombre, alumnos_min, alumnos_max, horas_referencia_nivel, admite_funcional, fuente, notas) values
  ('estandar', 'Estándar Grupal', 2, 8, 120, true, 'S1 modOpts (M.H=120); S9; S11',
   'Horas reales por nivel: 120 – 121,5 – 122 – 124 h.'),
  ('acelerado', 'Acelerado Privado 1 a 1', 1, 1, 80, false, 'S1 modOpts (M.H=80); S3',
   'No existe para Funcional. Ninguna combinación vigente da 80 h (ver P02).');

insert into public.horario_patrones (codigo, nombre, dias, minutos_clase, fuente) values
  ('LV-60', 'Lunes a viernes · 60 min', '{1,2,3,4,5}', 60, 'S1 SCHEDS; S3 SCHEDS'),
  ('LMV-90', 'Lun · Mié · Vie · 90 min', '{1,3,5}', 90, 'S1 SCHEDS; S3 SCHEDS'),
  ('MaJS-90', 'Mar · Jue · Sáb · 90 min', '{2,4,6}', 90, 'S1 SCHEDS; S3 SCHEDS'),
  ('LMV-120', 'Lun · Mié · Vie · 120 min', '{1,3,5}', 120, 'S1 SCHEDS; S3 SCHEDS'),
  ('MaJS-120', 'Mar · Jue · Sáb · 120 min', '{2,4,6}', 120, 'S1 SCHEDS; S3 SCHEDS'),
  ('MiJ-180', 'Mié · Jue · 180 min', '{3,4}', 180, 'S1 SCHEDS; S3 SCHEDS');

insert into public.reglas_pendientes (codigo, tema, descripcion, impacto, fuente) values
  ('P01', 'Hora académica',
   'Si una hora académica equivale a 60 min o a otra duración (p. ej. 45 min).', 'horas', 'Documento §8.1'),
  ('P02', 'Horas de Acelerado',
   'Si las 80 h de Acelerado son un objetivo a cumplir; hoy ninguna combinación da 80 h (resultados: 81, 82,5, 86 y 90 h).',
   'sesiones', 'Documento §8.2'),
  ('P03', 'Estándar 1h30, alumno nuevo',
   'Si debe quedar en 81 sesiones (121,5 h) o ajustarse a 80.', 'sesiones', 'Documento §8.3'),
  ('P04', 'Horas por unidad',
   'Unidad de 8 h (generador vigente) o 9 h (documentos originales y plantilla Assessment). Puede cambiar los totales de sesiones.',
   'sesiones', 'Documento §8.4'),
  ('P05', 'Límite de faltas',
   '20 % (Syllabus originales) o 25 % (vigente y plantilla).', 'academico', 'Documento §8.5'),
  ('P06', 'Horario de 3 h (mié/jue)',
   'Si está vigente para Funcional y para Acelerado.', 'sesiones', 'Documento §8.6'),
  ('P07', 'Fin de ciclo a mitad de semana',
   'Si el receso empieza ese día o la semana siguiente.', 'calendario', 'Documento §8.7'),
  ('P08', 'Feriados y recuperaciones',
   'Calendario de feriados y regla de recuperación de clases suspendidas.', 'calendario', 'Documento §8.8'),
  ('P09', 'Advisor',
   'Quién es el advisor y si representa a Comercial.', 'comercial', 'Documento §8.9'),
  ('P10', 'Productos comerciales',
   'Dynamic, Flex Signature, Sessions On Demand, Conversation Clubs y Professional Mastery Lab: qué se vende, cantidades, duración, precios, vigencia, consumo, cancelación, renovación y fecha estimada de fin.',
   'comercial', 'Documento §8.10'),
  ('P11', 'Venta por nivel o ciclo',
   'Si Acelerado se vende por nivel completo o por ciclo, y si los niveles de dos ciclos pueden comprarse por ciclo.',
   'comercial', 'Documento §8.11');

-- Plantillas del generador (documento §3). 'funcional' aplica al nivel Funcional; 'ciclos' a los otros seis niveles.
-- s_imp/h_imp = primer ciclo (en Funcional, el ciclo único); s_par/h_par = segundo ciclo.
-- Datos del generador, repetidos como CTE en cada sentencia que los usa: no dependen de tablas temporales
-- ni del estado de la sesión (el SQL Editor de Supabase no lo garantiza). Un cambio debe hacerse en AMBAS copias;
-- el bloque DO final comprueba 58 planes, 112 cuotas y 103 combinaciones.
with _plantillas (ambito, modalidad, minutos, spw, tipo, ses, horas, sem, rec, ult, s_imp, h_imp, s_par, h_par, nota) as (
  values
  -- Funcional (ciclo 0, un solo ciclo): receso de 1 semana al cerrar el nivel
  ('funcional', 'estandar',  60, 5, 'unico', 122, 122.0, 25, 1, null, 122, 122.0, null, null,
   'Coincide con el ejemplo de Coordinación (§3.1); eso no equivale a aprobación.'),
  ('funcional', 'estandar',  90, 3, 'unico',  80, 120.0, 27, 1, null,  80, 120.0, null, null,
   'Coincide con el ejemplo de Coordinación (§3.1). En Funcional no hay variante de alumno continuo.'),
  ('funcional', 'estandar', 120, 3, 'unico',  62, 124.0, 21, 1, null,  62, 124.0, null, null,
   'Coincide con el ejemplo de Coordinación (§3.1).'),
  ('funcional', 'estandar', 180, 2, 'ambos',  40, 120.0, 20, 1, null,  40, 120.0, null, null,
   'El documento lista alumno nuevo y continuo con el mismo resultado (40 sesiones).'),
  -- Básico a Máster (ciclos 1-12): receso de 1 semana entre ciclos y 1 al cerrar el nivel
  ('ciclos', 'estandar',  60, 5, 'unico',   122, 122.0, 25, 2, null,  59, 59.0, 63, 63.0, null),
  ('ciclos', 'estandar',  90, 3, 'nuevo',    81, 121.5, 27, 2, null,  40, 60.0, 41, 61.5,
   'Alumno nuevo: 81 sesiones y 121,5 h (ver P03). El Course Advance original de Básico 1h30 (S7) indica 80 clases y 120 h.'),
  ('ciclos', 'estandar',  90, 3, 'continuo', 80, 120.0, 27, 2, null,  39, 58.5, 41, 61.5,
   'Alumno continuo (Level Kick-off): solo cambia la introducción.'),
  ('ciclos', 'estandar', 120, 3, 'unico',    62, 124.0, 21, 2, null,  30, 60.0, 32, 64.0, null),
  ('ciclos', 'estandar', 180, 2, 'ambos',    40, 120.0, 20, 2, null,  19, 57.0, 21, 63.0,
   'El documento lista alumno nuevo y continuo con el mismo resultado (40 sesiones).'),
  ('ciclos', 'acelerado',  60, 5, 'unico',   86,  86.0, 18, 2, null,  41, 41.0, 45, 45.0,
   'Ninguna combinación Acelerada da 80 h (P02).'),
  ('ciclos', 'acelerado',  90, 3, 'unico',   54,  81.0, 18, 2, null,  26, 39.0, 28, 42.0,
   'Ninguna combinación Acelerada da 80 h (P02).'),
  ('ciclos', 'acelerado', 120, 3, 'unico',   45,  90.0, 15, 2, null,  21, 42.0, 24, 48.0,
   'Ninguna combinación Acelerada da 80 h (P02).'),
  ('ciclos', 'acelerado', 180, 2, 'ambos',   28,  82.5, 14, 2,   90,  13, 39.0, 15, 43.5,
   'La última sesión del nivel dura 90 min; el descanso de 10 min cuenta dentro de las 3 h (P02, P06).')
)
insert into public.planes_academicos
  (nivel_id, modalidad_id, minutos_clase, sesiones_semana, tipo_alumno, total_sesiones, horas_totales,
   semanas, receso_semanas, ultima_sesion_minutos, estado_dato, fuente, notas)
select n.id, m.id, t.minutos, t.spw, t.tipo, t.ses, t.horas, t.sem, t.rec, t.ult, 'inferido',
       'Documento técnico-funcional 03-nov-2026, §3 y §5.1; salida de build() (universa_catalogo_horarios.csv, 103 filas)', t.nota
from _plantillas t
join public.modalidades m on m.codigo = t.modalidad
join public.niveles n on (t.ambito = 'funcional') = (n.codigo = 'funcional');

with _plantillas (ambito, modalidad, minutos, spw, tipo, ses, horas, sem, rec, ult, s_imp, h_imp, s_par, h_par, nota) as (
  values
  -- Funcional (ciclo 0, un solo ciclo): receso de 1 semana al cerrar el nivel
  ('funcional', 'estandar',  60, 5, 'unico', 122, 122.0, 25, 1, null, 122, 122.0, null, null,
   'Coincide con el ejemplo de Coordinación (§3.1); eso no equivale a aprobación.'),
  ('funcional', 'estandar',  90, 3, 'unico',  80, 120.0, 27, 1, null,  80, 120.0, null, null,
   'Coincide con el ejemplo de Coordinación (§3.1). En Funcional no hay variante de alumno continuo.'),
  ('funcional', 'estandar', 120, 3, 'unico',  62, 124.0, 21, 1, null,  62, 124.0, null, null,
   'Coincide con el ejemplo de Coordinación (§3.1).'),
  ('funcional', 'estandar', 180, 2, 'ambos',  40, 120.0, 20, 1, null,  40, 120.0, null, null,
   'El documento lista alumno nuevo y continuo con el mismo resultado (40 sesiones).'),
  -- Básico a Máster (ciclos 1-12): receso de 1 semana entre ciclos y 1 al cerrar el nivel
  ('ciclos', 'estandar',  60, 5, 'unico',   122, 122.0, 25, 2, null,  59, 59.0, 63, 63.0, null),
  ('ciclos', 'estandar',  90, 3, 'nuevo',    81, 121.5, 27, 2, null,  40, 60.0, 41, 61.5,
   'Alumno nuevo: 81 sesiones y 121,5 h (ver P03). El Course Advance original de Básico 1h30 (S7) indica 80 clases y 120 h.'),
  ('ciclos', 'estandar',  90, 3, 'continuo', 80, 120.0, 27, 2, null,  39, 58.5, 41, 61.5,
   'Alumno continuo (Level Kick-off): solo cambia la introducción.'),
  ('ciclos', 'estandar', 120, 3, 'unico',    62, 124.0, 21, 2, null,  30, 60.0, 32, 64.0, null),
  ('ciclos', 'estandar', 180, 2, 'ambos',    40, 120.0, 20, 2, null,  19, 57.0, 21, 63.0,
   'El documento lista alumno nuevo y continuo con el mismo resultado (40 sesiones).'),
  ('ciclos', 'acelerado',  60, 5, 'unico',   86,  86.0, 18, 2, null,  41, 41.0, 45, 45.0,
   'Ninguna combinación Acelerada da 80 h (P02).'),
  ('ciclos', 'acelerado',  90, 3, 'unico',   54,  81.0, 18, 2, null,  26, 39.0, 28, 42.0,
   'Ninguna combinación Acelerada da 80 h (P02).'),
  ('ciclos', 'acelerado', 120, 3, 'unico',   45,  90.0, 15, 2, null,  21, 42.0, 24, 48.0,
   'Ninguna combinación Acelerada da 80 h (P02).'),
  ('ciclos', 'acelerado', 180, 2, 'ambos',   28,  82.5, 14, 2,   90,  13, 39.0, 15, 43.5,
   'La última sesión del nivel dura 90 min; el descanso de 10 min cuenta dentro de las 3 h (P02, P06).')
)
insert into public.plan_ciclos (plan_id, nivel_id, ciclo, sesiones, horas)
select p.id, p.nivel_id, c.numero,
       case c.posicion when 'par' then t.s_par else t.s_imp end,
       case c.posicion when 'par' then t.h_par else t.h_imp end
from public.planes_academicos p
join public.modalidades m on m.id = p.modalidad_id
join public.ciclos c on c.nivel_id = p.nivel_id
join _plantillas t on t.modalidad = m.codigo and t.minutos = p.minutos_clase
                  and t.spw = p.sesiones_semana and t.tipo = p.tipo_alumno
                  and (t.ambito = 'funcional') = (c.posicion = 'unico');

-- Qué planes dependen de cada regla abierta (P05, P08, P09 y P10 no afectan a ningún plan).
insert into public.plan_pendientes (plan_id, regla_id)
select p.id, r.id
from public.planes_academicos p
join public.modalidades m on m.id = p.modalidad_id
join public.niveles n on n.id = p.nivel_id
cross join public.reglas_pendientes r
where r.codigo in ('P01', 'P04', 'P07')
   or (r.codigo = 'P02' and m.codigo = 'acelerado')
   or (r.codigo = 'P03' and m.codigo = 'estandar' and p.minutos_clase = 90 and p.tipo_alumno = 'nuevo')
   or (r.codigo = 'P06' and p.minutos_clase = 180 and (n.codigo = 'funcional' or m.codigo = 'acelerado'))
   or (r.codigo = 'P11' and (m.codigo = 'acelerado' or n.codigo <> 'funcional'));

-- ============================================================
-- 7. Verificación final: si algo no cuadra, la migración completa se revierte
-- ============================================================
do $$
declare
  v_fallas text;
  v_n integer;
begin
  -- Integridad: cada prueba (sesiones, horas, cantidad de ciclos, ciclos exactos, duplicados, referencias...) por separado.
  select string_agg(prueba || ': ' || detalle, E'\n') into v_fallas from public.catalogo_verificar() where not ok;
  if v_fallas is not null then
    raise exception E'Catálogo inconsistente:\n%', v_fallas;
  end if;

  -- Conteos esperados según el documento.
  select count(*) into v_n from public.niveles;
  if v_n <> 7 then raise exception 'Se esperaban 7 niveles y hay %', v_n; end if;
  select count(*) into v_n from public.modalidades;
  if v_n <> 2 then raise exception 'Se esperaban 2 modalidades y hay %', v_n; end if;
  select count(*) into v_n from public.horario_patrones;
  if v_n <> 6 then raise exception 'Se esperaban 6 horarios y hay %', v_n; end if;
  select count(*) into v_n from public.reglas_pendientes;
  if v_n <> 11 then raise exception 'Se esperaban 11 reglas pendientes y hay %', v_n; end if;
  select count(*) into v_n from public.planes_academicos;
  if v_n <> 58 then raise exception 'Se esperaban 58 planes y hay %', v_n; end if;
  select count(*) into v_n from public.plan_ciclos;
  if v_n <> 112 then raise exception 'Se esperaban 112 cuotas por ciclo (4 x 1 + 54 x 2) y hay %', v_n; end if;
  select count(*) into v_n from public.catalogo_combinaciones;
  if v_n <> 103 then raise exception 'Los 58 planes deben expandirse a 103 combinaciones y dan %', v_n; end if;
  select count(*) into v_n from public.planes_academicos where aprobado_en is not null or estado_dato <> 'inferido';
  if v_n <> 0 then raise exception 'Ningún plan inicial debe figurar aprobado ni confirmado (hay %)', v_n; end if;
end $$;

commit;
