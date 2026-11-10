-- UNIVERSA · REINICIO · PASO 1 (solo lectura, no cambia nada).
-- Muestra qué se conservaría y qué se borraría. Revísalo antes de ejecutar el paso 2.

-- A) Cuentas: se conservan solo los administradores.
select u.email, coalesce(p.rol, '(sin perfil)') as rol,
       case when p.rol = 'admin' then 'SE CONSERVA' else 'SE BORRA' end as accion
  from auth.users u left join public.perfiles p on p.user_id = u.id
 order by accion desc, u.email;

-- B) Tablas de public: configuración (se conserva) o datos (se vacían), con cantidad de filas.
with conserva(t) as (values
  ('perfiles'),('programas'),('niveles'),('ciclos'),('modalidades'),('horario_patrones'),('planes_academicos'),('plan_ciclos'),
  ('reglas_pendientes'),('plan_pendientes'),('frecuencias'),('frecuencia_modalidades'),('feriados'),
  ('eval_rubricas'),('eval_rubrica_criterios'),('eval_plantillas'),('eval_versiones'),('eval_componentes'),
  ('zona_documentos'),('_entorno_prueba'))
select c.relname as tabla,
       case when c.relname in (select t from conserva) then 'SE CONSERVA (configuración)' else 'SE VACÍA (datos)' end as accion,
       (xpath('/row/n/text()', query_to_xml(format('select count(*) n from public.%I', c.relname), false, true, '')))[1]::text::int as filas
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r', 'p')
 order by accion desc, c.relname;
