-- UNIVERSA · Fase 1 · ¿Qué dejó creado un intento fallido de la migración? SOLO LECTURA.
-- Esperado tras un fallo limpio (transacción revertida): las 3 filas con 0 y "LIMPIO".
-- Si hay objetos o filas, NO reintentes la migración: envíame el resultado.
begin read only;

select 'tablas del catálogo presentes' as comprobacion,
       count(*)::text as cantidad,
       coalesce(string_agg(table_name, ', ' order by table_name), '-') as detalle
from information_schema.tables
where table_schema = 'public'
  and table_name in ('niveles','ciclos','modalidades','horario_patrones','planes_academicos','plan_ciclos',
                     'reglas_pendientes','plan_pendientes','catalogo_planes','catalogo_combinaciones')
union all
select 'funciones del catálogo presentes', count(*)::text, coalesce(string_agg(p.proname, ', ' order by p.proname), '-')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'catalogo\_%'
union all
select 'tablas temporales visibles (_plantillas)', count(*)::text, coalesce(string_agg(c.relname, ', '), '-')
from pg_class c where c.relname = '_plantillas'
union all
select 'ESTADO',
       case when (select count(*) from information_schema.tables where table_schema = 'public'
                   and table_name in ('niveles','ciclos','modalidades','horario_patrones','planes_academicos','plan_ciclos',
                                      'reglas_pendientes','plan_pendientes','catalogo_planes','catalogo_combinaciones')) = 0
             and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname like 'catalogo\_%') = 0
            then 'LIMPIO' else 'PARCIAL' end, '-';

rollback;
