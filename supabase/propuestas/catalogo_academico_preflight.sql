-- UNIVERSA · Comprobación previa (SOLO LECTURA). Ejecútala en el SQL Editor de Supabase ANTES de aplicar la migración.
-- Todas las filas deben decir 'OK'. No modifica nada: solo contiene SELECT y se ejecuta dentro de una transacción
-- de SOLO LECTURA (begin read only), que Postgres rechaza si se intenta escribir cualquier cosa.
begin read only;

-- 1. Requisitos que la migración necesita
select 'requisito: ' || r.nombre as comprobacion,
       case when r.existe then 'OK' else 'FALTA' end as resultado
from (values
  ('función public.tiene_perfil()', to_regprocedure('public.tiene_perfil()') is not null),
  ('función public.set_updated_at()', to_regprocedure('public.set_updated_at()') is not null),
  ('tabla auth.users', to_regclass('auth.users') is not null),
  ('tabla public.perfiles', to_regclass('public.perfiles') is not null),
  ('tabla public.salones', to_regclass('public.salones') is not null),
  ('vista public.salon_progreso', to_regclass('public.salon_progreso') is not null)
) as r(nombre, existe)
union all
-- 2. Nombres que la migración va a crear: no deben existir todavía
select 'libre: public.' || n.nombre,
       case when to_regclass('public.' || n.nombre) is null then 'OK' else 'YA EXISTE' end
from (values
  ('niveles'), ('ciclos'), ('modalidades'), ('horario_patrones'), ('planes_academicos'),
  ('plan_ciclos'), ('reglas_pendientes'), ('plan_pendientes'), ('catalogo_planes'), ('catalogo_combinaciones')
) as n(nombre)
union all
select 'libre: función public.' || f.nombre,
       case when not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                             where s.nspname = 'public' and p.proname = f.nombre) then 'OK' else 'YA EXISTE' end
from (values
  ('catalogo_verificar'), ('catalogo_validar_plan'), ('catalogo_plan_inmutable'), ('catalogo_plan_ciclos_inmutable')
) as f(nombre)
union all
-- 3. Fotografía de los datos actuales (anótala: después de la migración deben ser idénticos)
select 'filas: ' || t.tabla, t.filas::text
from (
  select 'salones' as tabla, count(*) as filas from public.salones
  union all select 'salon_horarios', count(*) from public.salon_horarios
  union all select 'salon_sesiones', count(*) from public.salon_sesiones
  union all select 'programas', count(*) from public.programas
  union all select 'docentes', count(*) from public.docentes
  union all select 'feriados', count(*) from public.feriados
  union all select 'perfiles', count(*) from public.perfiles
) t;

rollback;
