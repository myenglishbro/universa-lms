-- UNIVERSA · Fase 1 · VERIFICACIÓN POSTERIOR (solo lectura).
-- Ejecutar DESPUÉS de aplicar 20261105100000_catalogo_academico.sql. No crea, modifica ni borra nada.
-- Resultado esperado: TODAS las filas con resultado 'OK' (la última fila resume: FALLAS = 0).
-- Los valores esperados de "lo existente" son los del preflight de producción (21/42/11/7/0/16/1).
-- Si has creado salones o sesiones entre el preflight y ahora, esas filas mostrarán 'REVISAR' (no es un fallo de la migración).
begin read only;

with
conteos as (
  select '1. niveles = 7' as comprobacion, '7' as esperado, (select count(*) from public.niveles)::text as obtenido
  union all select '1. ciclos = 13 (0 a 12)', '13', (select count(*) from public.ciclos)::text
  union all select '1. modalidades = 2', '2', (select count(*) from public.modalidades)::text
  union all select '1. patrones de horario = 6', '6', (select count(*) from public.horario_patrones)::text
  union all select '1. PLANES = 58', '58', (select count(*) from public.planes_academicos)::text
  union all select '1. plan_ciclos = 112', '112', (select count(*) from public.plan_ciclos)::text
  union all select '1. reglas pendientes = 11', '11', (select count(*) from public.reglas_pendientes)::text
  union all select '1. vínculos plan-pendiente = 265', '265', (select count(*) from public.plan_pendientes)::text
  union all select '1. vista catalogo_planes = 58', '58', (select count(*) from public.catalogo_planes)::text
  union all select '1. COMBINACIONES = 103', '103', (select count(*) from public.catalogo_combinaciones)::text
),
huella as (
  select '2. huella de las 103 combinaciones = CSV original' as comprobacion,
         '053ae610212db2c2fa8dcfa40299662a' as esperado,
         (select md5(string_agg(linea, E'\n' order by linea collate "C")) from (
            select modalidad_codigo || '|' || nivel_codigo || '|' || patron_codigo || '|' || coalesce(tipo_alumno, '-') || '|' ||
                   minutos_clase || '|' || sesiones_semana || '|' || array_to_string(dias, ',') || '|' ||
                   total_sesiones || '|' || to_char(horas_totales, 'FM9990.0') || '|' || semanas || '|' || receso_semanas || '|' ||
                   ciclo_impar || '|' || sesiones_ciclo_impar || '|' || to_char(horas_ciclo_impar, 'FM9990.0') || '|' ||
                   coalesce(ciclo_par::text, '') || '|' || coalesce(sesiones_ciclo_par::text, '') || '|' ||
                   coalesce(to_char(horas_ciclo_par, 'FM9990.0'), '') as linea
            from public.catalogo_combinaciones) x) as obtenido
),
validaciones as (
  select '3. validación interna: ' || prueba as comprobacion, 'true' as esperado, ok::text as obtenido
  from public.catalogo_verificar()
  union all select '3. número de validaciones internas = 9', '9', (select count(*) from public.catalogo_verificar())::text
),
estado as (
  select '4. planes en estado inferido = 58 (ninguno aprobado)' as comprobacion, '58' as esperado,
         (select count(*) from public.planes_academicos where estado_dato = 'inferido' and aprobado_por is null)::text as obtenido
),
seguridad as (
  select '5. RLS activada en las 8 tablas nuevas' as comprobacion, '8' as esperado,
         (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
             and c.relname in ('niveles','ciclos','modalidades','horario_patrones','planes_academicos','plan_ciclos','reglas_pendientes','plan_pendientes'))::text as obtenido
  union all select '5. políticas (todas de lectura) = 8', '8',
         (select count(*) from pg_policies where schemaname = 'public' and cmd = 'SELECT'
            and tablename in ('niveles','ciclos','modalidades','horario_patrones','planes_academicos','plan_ciclos','reglas_pendientes','plan_pendientes'))::text
  union all select '5. políticas de escritura en tablas nuevas = 0', '0',
         (select count(*) from pg_policies where schemaname = 'public' and cmd <> 'SELECT'
            and tablename in ('niveles','ciclos','modalidades','horario_patrones','planes_academicos','plan_ciclos','reglas_pendientes','plan_pendientes'))::text
  union all select '5. permisos de escritura para anon/authenticated en tablas y vistas nuevas = 0', '0',
         (select count(*) from information_schema.role_table_grants
           where table_schema = 'public' and grantee in ('anon','authenticated')
             and table_name in ('niveles','ciclos','modalidades','horario_patrones','planes_academicos','plan_ciclos','reglas_pendientes','plan_pendientes','catalogo_planes','catalogo_combinaciones')
             and privilege_type <> 'SELECT')::text
  union all select '5. permisos de lectura para anon en lo nuevo = 0', '0',
         (select count(*) from information_schema.role_table_grants
           where table_schema = 'public' and grantee = 'anon'
             and table_name in ('niveles','ciclos','modalidades','horario_patrones','planes_academicos','plan_ciclos','reglas_pendientes','plan_pendientes','catalogo_planes','catalogo_combinaciones'))::text
),
existente as (
  select '6. salones = 21 (conservados)' as comprobacion, '21' as esperado, (select count(*) from public.salones)::text as obtenido
  union all select '6. salon_horarios = 42', '42', (select count(*) from public.salon_horarios)::text
  union all select '6. salon_sesiones = 11', '11', (select count(*) from public.salon_sesiones)::text
  union all select '6. programas = 7', '7', (select count(*) from public.programas)::text
  union all select '6. docentes = 0', '0', (select count(*) from public.docentes)::text
  union all select '6. feriados = 16', '16', (select count(*) from public.feriados)::text
  union all select '6. perfiles = 1', '1', (select count(*) from public.perfiles)::text
  union all select '6. columnas de salones sin cambios (sin plan_id/ciclo)', '0',
         (select count(*) from information_schema.columns where table_schema = 'public'
            and table_name in ('salones','salon_sesiones') and column_name in ('plan_id','ciclo','ciclo_desde','ciclo_hasta'))::text
),
todo as (
  select * from conteos union all select * from huella union all select * from validaciones
  union all select * from estado union all select * from seguridad union all select * from existente
),
resultado as (
  select comprobacion, esperado, obtenido,
         case when obtenido = esperado then 'OK' else 'REVISAR' end as resultado, 1 as orden
  from todo
)
select comprobacion, esperado, obtenido, resultado from resultado
union all
select '>>> RESUMEN: filas con REVISAR = ' || count(*) filter (where resultado <> 'OK'),
       '0', count(*) filter (where resultado <> 'OK')::text,
       case when count(*) filter (where resultado <> 'OK') = 0 then 'OK' else 'REVISAR' end
from resultado
order by 1;

rollback;
