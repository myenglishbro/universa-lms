-- UNIVERSA · Paso 3. Datos de ejemplo con las mismas proporciones que producción:
-- 21 salones, 42 horarios, 11 sesiones, 7 programas, 0 docentes, 16 feriados.
-- Se crean con las funciones reales de la aplicación (guardar_salon, generar_calendario) como el usuario admin.
do $$
declare
  v_admin uuid;
  v_prog uuid;
  v_hoy date := public.hoy_lima();
  v_salon uuid;
  i integer;
begin
  if to_regclass('public._entorno_prueba') is null then
    raise exception 'ABORTADO: este proyecto no está marcado como entorno de pruebas.';
  end if;
  select id into v_admin from auth.users where email = 'admin-prueba@universa.test';
  if v_admin is null or not exists (select 1 from public.perfiles where user_id = v_admin and rol = 'admin') then
    raise exception 'Ejecuta primero el paso 2 (perfiles de prueba).';
  end if;
  if exists (select 1 from public.salones) then
    raise exception 'Ya hay salones en este proyecto de pruebas; este script solo se ejecuta una vez.';
  end if;
  select id into v_prog from public.programas where nombre = 'Básico';

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;

  for i in 1..21 loop
    v_salon := public.guardar_salon(
      null,
      jsonb_build_object(
        'codigo', 'PRUEBA-' || lpad(i::text, 3, '0'),
        'nombre', 'Salón de prueba ' || i,
        'programa_id', v_prog,
        'fecha_inicio', (v_hoy + (i * 3 - 30))::text,
        'fecha_fin_estimada', case when i = 1 then null else (v_hoy + i * 3)::text end,
        'capacidad', 8,
        'estado', case when i % 3 = 0 then 'pendiente' else 'en_curso' end,
        'total_sesiones', case when i = 1 then 11 else null end),
      '[{"dia":1,"hora_inicio":"18:00","hora_fin":"19:30"},{"dia":3,"hora_inicio":"18:00","hora_fin":"19:30"}]'::jsonb);
    if i = 1 then
      perform public.generar_calendario(v_salon);   -- 11 sesiones, como en producción
    end if;
  end loop;
  reset role;
end $$;

-- Esperado: salones 21, salon_horarios 42, salon_sesiones 11, programas 7, docentes 0, feriados 16, perfiles 2
select 'salones' as tabla, count(*) from public.salones
union all select 'salon_horarios', count(*) from public.salon_horarios
union all select 'salon_sesiones', count(*) from public.salon_sesiones
union all select 'programas', count(*) from public.programas
union all select 'docentes', count(*) from public.docentes
union all select 'feriados', count(*) from public.feriados
union all select 'perfiles', count(*) from public.perfiles;
