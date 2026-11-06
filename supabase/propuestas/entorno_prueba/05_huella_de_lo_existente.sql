-- UNIVERSA · Paso 5 (y de nuevo tras la migración y tras el rollback). No modifica nada del proyecto:
-- solo crea una función TEMPORAL de esta sesión (desaparece sola) y lee.
-- Calcula una huella de TODO lo existente (contenido de tablas y vistas, columnas, vistas, funciones, políticas,
-- permisos, triggers y RLS), sin incluir los objetos del catálogo nuevo. Si la migración no altera nada,
-- la fila TOTAL es idéntica antes y después (y tras el rollback).
begin;

create function pg_temp.huella_existente() returns table (objeto text, huella text)
language plpgsql as $$
declare
  t record;
  v text;
  nuevos text[] := array['niveles', 'ciclos', 'modalidades', 'horario_patrones', 'planes_academicos', 'plan_ciclos',
                         'reglas_pendientes', 'plan_pendientes', 'catalogo_planes', 'catalogo_combinaciones'];
begin
  for t in
    select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v') and c.relname !~ '^(_|zz_)' and c.relname <> all (nuevos)
    order by c.relname
  loop
    execute format($f$select count(*) || ':' || md5(coalesce(string_agg(x::text, E'\n' order by x::text), '')) from public.%I x$f$, t.relname) into v;
    objeto := 'datos: ' || t.relname; huella := v; return next;
    select md5(string_agg(column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default, ''), ',' order by ordinal_position))
      into v from information_schema.columns where table_schema = 'public' and table_name = t.relname;
    objeto := 'columnas: ' || t.relname; huella := v; return next;
    if t.relkind = 'v' then
      objeto := 'vista: ' || t.relname; huella := md5(pg_get_viewdef(('public.' || t.relname)::regclass)); return next;
    end if;
  end loop;

  select md5(coalesce(string_agg(pg_get_functiondef(p.oid), E'\n' order by p.proname, p.oid::regprocedure::text), ''))
    into v from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.proname not like 'catalogo\_%';
  objeto := 'funciones'; huella := v; return next;

  select md5(coalesce(string_agg(tablename || policyname || cmd || roles::text || coalesce(qual, '') || coalesce(with_check, ''), '|' order by tablename, policyname), ''))
    into v from pg_policies where schemaname = 'public' and tablename <> all (nuevos);
  objeto := 'politicas'; huella := v; return next;

  select md5(coalesce(string_agg(table_name || grantee || privilege_type, '|' order by table_name, grantee, privilege_type), ''))
    into v from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated') and table_name <> all (nuevos) and table_name !~ '^(_|zz_)';
  objeto := 'permisos'; huella := v; return next;

  select md5(coalesce(string_agg(tgname || ':' || tgrelid::regclass::text, '|' order by tgname, tgrelid::regclass::text), ''))
    into v from pg_trigger
    where not tgisinternal and tgrelid::regclass::text !~ '^(public\.)?(_|zz_)'
      and regexp_replace(tgrelid::regclass::text, '^public\.', '') <> all (nuevos)
      and tgrelid::regclass::text !~ '^(auth|storage|realtime|extensions|vault|graphql|pgsodium|supabase)';
  objeto := 'triggers'; huella := v; return next;

  select md5(coalesce(string_agg(relname || ':' || relrowsecurity::text, '|' order by relname), ''))
    into v from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and relkind = 'r' and relname !~ '^(_|zz_)' and relname <> all (nuevos);
  objeto := 'rls'; huella := v; return next;
end $$;

-- Esperado: la fila TOTAL es la misma en los tres momentos (antes, después de migrar, después del rollback).
select objeto, huella from (
  select objeto, huella, 1 as o from pg_temp.huella_existente()
  union all
  select 'TOTAL', md5(string_agg(objeto || huella, '|' order by objeto)), 2 from pg_temp.huella_existente()
) x order by o, objeto;

rollback;
