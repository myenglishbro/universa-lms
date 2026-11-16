-- UNIVERSA · BORRAR TODOS LOS PAQUETES DE HORAS. ¡IRREVERSIBLE!
--
-- Pensado para ejecutarse en Supabase → SQL Editor (no pasa por la app, así que no usa las funciones que exigen sesión de admin).
--
-- QUÉ BORRA (una sola transacción: si algo falla, no se borra nada)
--   · Todos los paquetes de horas con su historial: movimientos, pagos y clases.
--   · Los salones individuales creados por los paquetes (con sus matrículas y su calendario). Esto libera el horario de los docentes.
-- QUÉ CONSERVA
--   · Estudiantes (alumnos), docentes, salones grupales y todo lo demás.
-- Si algún salón de paquete tiene ejercicios asignados o historial archivado, se cancela todo y dice cuál (bórralo a mano o
-- quítale ese contenido primero).
--
-- Requiere antes: migración 20261206150000_borrado_controlado_movimientos.sql (permite borrar el historial solo con la marca de abajo).
-- Antes: haz una copia (Supabase → Database → Backups). PASO 1: ejecuta solo el bloque «VISTA PREVIA». PASO 2: el resto.

-- ===== VISTA PREVIA (no borra nada) =====
select (select count(*) from public.paquetes_horas) as paquetes,
       (select count(*) from public.paquete_clases) as clases,
       (select count(*) from public.paquete_movimientos) as movimientos,
       (select count(*) from public.paquete_pagos) as pagos,
       (select count(*) from public.salones where id in (select salon_id from public.paquetes_horas where salon_id is not null)) as salones_de_paquetes;

-- ===== BORRADO =====
begin;

-- El historial de movimientos es inmutable; esta marca (solo dura esta transacción) permite borrarlo aquí.
select set_config('universa.borrado_paquetes', 'on', true);

-- Requiere la migración 20261206150000_borrado_controlado_movimientos.sql (cambia el trigger que bloquea el borrado).
do $$
declare
  v_salones uuid[] := array(select distinct salon_id from public.paquetes_horas where salon_id is not null);
  v_mal text;
  v_n integer;
begin
  select string_agg(s.codigo || ' ' || s.nombre, ', ') into v_mal from public.salones s
   where s.id = any(v_salones)
     and (exists (select 1 from public.ejercicio_asignaciones x where x.salon_id = s.id)
          or exists (select 1 from public.archivo_alumnos x where x.salon_id = s.id));
  if v_mal is not null then
    raise exception 'Estos salones tienen ejercicios asignados o historial archivado y no se pueden borrar: %. No se borró nada.', v_mal;
  end if;

  update public.paquetes_horas set paquete_origen_id = null;
  delete from public.paquete_movimientos;
  delete from public.paquete_pagos;
  delete from public.paquete_clases;
  delete from public.paquetes_horas;

  update public.matriculas set matricula_origen_id = null
   where matricula_origen_id in (select id from public.matriculas where salon_id = any(v_salones));
  delete from public.matriculas where salon_id = any(v_salones);
  delete from public.salones where id = any(v_salones);
  get diagnostics v_n = row_count;
  raise notice 'Paquetes borrados. Salones de paquete borrados: %', v_n;

  if exists (select 1 from public.paquetes_horas) then raise exception 'Quedaron paquetes: se revierte todo'; end if;
end $$;

commit;
