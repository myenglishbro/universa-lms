-- LIMPIEZA DE DATOS DE PRUEBA: borra TODOS los salones y TODAS las matrículas.
-- No es una migración: ejecútala a mano en el SQL Editor de Supabase solo cuando quieras empezar de cero.
-- No se puede deshacer.
--
-- SE BORRA:
--   matrículas; salones y, en cascada, sus horarios, sesiones del calendario, asistencia, recursos y tareas,
--   módulos de evaluación, evaluaciones, notas, historial de correcciones, participación y remediales.
-- SE CONSERVA:
--   estudiantes, docentes, cuentas y accesos, planes y catálogo académico, Grade Chart Universa, rúbricas,
--   paquetes de horas y clases particulares.

begin;

-- 1. Matrículas primero (no se borran solas con el salón)
delete from public.matriculas;

-- 2. Salones (arrastra todo lo que depende de ellos)
delete from public.salones;

-- 3. Los códigos automáticos de salón vuelven a empezar en SAL-0001
alter sequence public.salon_codigo_seq restart with 1;

-- 4. Resumen: todo debe quedar en 0, salvo estudiantes/docentes/plantillas
select
  (select count(*) from public.salones)           as salones,
  (select count(*) from public.matriculas)        as matriculas,
  (select count(*) from public.salon_sesiones)    as sesiones,
  (select count(*) from public.eval_modulos)      as modulos,
  (select count(*) from public.eval_calificaciones) as notas,
  (select count(*) from public.alumnos)           as estudiantes_conservados,
  (select count(*) from public.docentes)          as docentes_conservados,
  (select count(*) from public.eval_plantillas)   as plantillas_conservadas;

commit;
