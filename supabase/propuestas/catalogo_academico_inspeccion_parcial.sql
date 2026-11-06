-- UNIVERSA · Fase 1 · INSPECCIÓN de una instalación parcial del catálogo. SOLO LECTURA.
-- Muestra qué quedó creado (tablas con sus filas, vistas, funciones, triggers, políticas) y si algo AJENO al
-- catálogo depende de ello. Para poder limpiar con seguridad, las dos filas de la sección "5 ajeno" deben dar 0
-- y la sección "6 firma" debe dar "2 de 2" (si la tabla existe).
begin read only;

with cat as (
  select unnest(array['niveles','ciclos','modalidades','horario_patrones','planes_academicos','plan_ciclos',
                      'reglas_pendientes','plan_pendientes']) as t
),
tablas as (
  select c.oid, c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','v')
    and (c.relname in (select t from cat) or c.relname in ('catalogo_planes','catalogo_combinaciones'))
)
select '1 relaciones' as seccion, relname::text as objeto,
       case relkind when 'r' then 'tabla' else 'vista' end
         || coalesce(' · filas: ' || (xpath('/row/c/text()', query_to_xml(format('select count(*) c from public.%I', relname), false, true, '')))[1]::text, '') as detalle
from tablas
union all
select '2 funciones', p.proname::text, 'public.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'catalogo\_%'
union all
select '3 triggers', tgname::text, tgrelid::regclass::text
from pg_trigger where not tgisinternal and tgrelid in (select oid from tablas)
union all
select '4 políticas', policyname::text, tablename::text || ' · ' || cmd
from pg_policies where schemaname = 'public' and tablename in (select t from cat)
union all
select '5 ajeno', 'claves foráneas de otras tablas hacia el catálogo (esperado 0)',
       (select count(*) from pg_constraint k
         where k.contype = 'f' and k.confrelid in (select oid from tablas) and k.conrelid not in (select oid from tablas))::text
union all
select '5 ajeno', 'vistas ajenas que dependen del catálogo (esperado 0)',
       (select count(distinct v.oid) from pg_depend d
          join pg_rewrite r on r.oid = d.objid and d.classid = 'pg_rewrite'::regclass
          join pg_class v on v.oid = r.ev_class
         where d.refobjid in (select oid from tablas) and v.oid not in (select oid from tablas))::text
union all
select '6 firma', 'planes_academicos tiene estado_dato y fuente (es nuestra)',
       (select count(*) from information_schema.columns where table_schema = 'public'
         and table_name = 'planes_academicos' and column_name in ('estado_dato','fuente'))::text || ' de 2'
order by 1, 2;

rollback;
