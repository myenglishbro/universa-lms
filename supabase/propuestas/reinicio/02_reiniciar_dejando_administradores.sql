-- UNIVERSA · REINICIO · PASO 2. ¡BORRA DATOS DE FORMA IRREVERSIBLE!
--
-- Antes de ejecutar:
--   1. Haz una copia: Supabase → Database → Backups (o descarga un respaldo). Sin copia no hay vuelta atrás.
--   2. Ejecuta y revisa 01_vista_previa.sql.
--
-- QUÉ HACE (una sola transacción: si algo falla o no cuadra, no se borra nada)
--   · Conserva SOLO las cuentas con rol 'admin' (y su perfil). Borra las demás cuentas (estudiantes, docentes, comercial, RR. HH.).
--   · Vacía todos los datos: alumnos, docentes, salones, matrículas, paquetes, asistencia, notas, ejercicios, entregas, registros de profesores…
--   · Conserva la CONFIGURACIÓN: programas, niveles, ciclos, modalidades, horarios, planes, frecuencias, feriados,
--     rúbricas, plantillas/versiones de evaluación (Grade Chart Universa) y documentos de las zonas.
--   · Verifica al final que la configuración no perdió filas y que quedó al menos un administrador; si no, revierte todo.
-- NO borra los archivos de Storage (audios de speaking, fotos): vacía esos buckets desde Supabase → Storage.

begin;

do $$
declare
  v_conserva text[] := array['perfiles','programas','niveles','ciclos','modalidades','horario_patrones','planes_academicos','plan_ciclos',
    'reglas_pendientes','plan_pendientes','frecuencias','frecuencia_modalidades','feriados',
    'eval_rubricas','eval_rubrica_criterios','eval_plantillas','eval_versiones','eval_componentes','zona_documentos','_entorno_prueba'];
  v_t text; v_antes jsonb := '{}'::jsonb; v_n bigint; v_admins integer; v_lista text;
begin
  select count(*) into v_admins from public.perfiles where rol = 'admin';
  if v_admins = 0 then raise exception 'No hay ningún administrador: se cancela para no dejar el sistema sin acceso'; end if;

  -- Filas de configuración antes del borrado
  foreach v_t in array v_conserva loop
    if to_regclass('public.' || quote_ident(v_t)) is not null then
      execute format('select count(*) from public.%I', v_t) into v_n;
      v_antes := v_antes || jsonb_build_object(v_t, v_n);
    end if;
  end loop;

  -- Vaciar los datos (todas las tablas de public que no son configuración)
  select string_agg(format('public.%I', c.relname), ', ') into v_lista
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname <> all (v_conserva);
  if v_lista is not null then execute 'truncate table ' || v_lista || ' restart identity cascade'; end if;

  -- Cuentas: solo quedan los administradores (cascada a perfiles, identidades y sesiones)
  delete from auth.users where id not in (select user_id from public.perfiles where rol = 'admin');

  -- Verificaciones
  foreach v_t in array v_conserva loop
    if v_antes ? v_t then
      execute format('select count(*) from public.%I', v_t) into v_n;
      if v_t = 'perfiles' then
        if v_n <> v_admins then raise exception 'perfiles: se esperaban % administradores y hay %', v_admins, v_n; end if;
      elsif v_n <> (v_antes ->> v_t)::bigint then
        raise exception 'La configuración "%" perdió filas (% → %): se revierte todo', v_t, v_antes ->> v_t, v_n;
      end if;
    end if;
  end loop;
  if (select count(*) from auth.users) <> v_admins then raise exception 'Las cuentas restantes no coinciden con los administradores'; end if;
  raise notice 'Reinicio listo: % administrador(es) conservado(s).', v_admins;
end $$;

commit;
