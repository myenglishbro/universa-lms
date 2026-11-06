-- UNIVERSA · Fase 1 · LIMPIEZA de una instalación parcial o completa del catálogo.
-- Elimina EXCLUSIVAMENTE los 10 objetos de relación y las 4 funciones creados por 20261105100000_catalogo_academico.sql.
-- No toca salones, salon_horarios, salon_sesiones, programas, docentes, feriados, perfiles ni ninguna función/vista anterior.
--
-- Es UNA SOLA SENTENCIA (un bloque DO): es atómica aunque el SQL Editor confirme cada sentencia por separado.
-- Se detiene sin borrar nada si:
--   · alguna tabla de otro módulo (p. ej. salones.plan_id, Fase 2) apunta al catálogo por clave foránea;
--   · alguna vista ajena depende del catálogo;
--   · una tabla con el mismo nombre no tiene la firma del catálogo (no es nuestra).
-- Es repetible: si no queda nada, termina sin error.
do $limpieza$
declare
  v_tablas text[] := array['niveles','ciclos','modalidades','horario_patrones','planes_academicos','plan_ciclos',
                           'reglas_pendientes','plan_pendientes'];
  v_oids oid[];
  v_txt text;
begin
  select coalesce(array_agg(c.oid), '{}') into v_oids
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','v')
    and (c.relname = any (v_tablas) or c.relname in ('catalogo_planes','catalogo_combinaciones'));

  -- Guardia 1: nada ajeno referencia al catálogo
  select string_agg(k.conrelid::regclass::text || ' -> ' || k.confrelid::regclass::text, ', ') into v_txt
  from pg_constraint k
  where k.contype = 'f' and k.confrelid = any (v_oids) and not (k.conrelid = any (v_oids));
  if v_txt is not null then
    raise exception 'ABORTADO: hay claves foráneas ajenas hacia el catálogo (%). No se borró nada.', v_txt;
  end if;

  -- Guardia 2: ninguna vista ajena depende del catálogo
  select string_agg(distinct v.relname::text, ', ') into v_txt
  from pg_depend d
  join pg_rewrite r on r.oid = d.objid and d.classid = 'pg_rewrite'::regclass
  join pg_class v on v.oid = r.ev_class
  where d.refobjid = any (v_oids) and not (v.oid = any (v_oids));
  if v_txt is not null then
    raise exception 'ABORTADO: hay vistas ajenas que dependen del catálogo (%). No se borró nada.', v_txt;
  end if;

  -- Guardia 3: lo que se va a borrar tiene la firma del catálogo (no es una tabla homónima de otro módulo)
  if to_regclass('public.planes_academicos') is not null and (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'planes_academicos' and column_name in ('estado_dato','fuente','minutos_clase')) <> 3 then
    raise exception 'ABORTADO: public.planes_academicos no tiene la firma del catálogo. No se borró nada.';
  end if;
  if to_regclass('public.ciclos') is not null and (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'ciclos' and column_name in ('numero','posicion','nivel_id')) <> 3 then
    raise exception 'ABORTADO: public.ciclos no tiene la firma del catálogo. No se borró nada.';
  end if;
  if to_regclass('public.niveles') is not null and not exists (
       select 1 from information_schema.columns where table_schema = 'public' and table_name = 'niveles' and column_name = 'codigo') then
    raise exception 'ABORTADO: public.niveles no tiene la firma del catálogo. No se borró nada.';
  end if;

  -- Borrado en orden de dependencias (sin CASCADE: si algo inesperado depende, falla y se revierte todo)
  drop view if exists public.catalogo_combinaciones;
  drop view if exists public.catalogo_planes;
  drop function if exists public.catalogo_verificar();

  drop table if exists public.plan_pendientes;
  drop table if exists public.reglas_pendientes;
  drop table if exists public.plan_ciclos;
  drop table if exists public.planes_academicos;
  drop table if exists public.horario_patrones;
  drop table if exists public.modalidades;
  drop table if exists public.ciclos;
  drop table if exists public.niveles;

  drop function if exists public.catalogo_validar_plan();
  drop function if exists public.catalogo_plan_inmutable();
  drop function if exists public.catalogo_plan_ciclos_inmutable();
end
$limpieza$;
