-- UNIVERSA · Feriados 2027 (PROVISIONAL, NO ejecutar sin confirmar).
--
-- Al 3/11/2026 no existe un calendario oficial 2027 publicado en gob.pe ni en El Peruano.
-- Estas fechas son las que establece hoy la ley (Decreto Legislativo 713, art. 6, y las leyes 31381, 31530,
-- 31788 y 31822); Jueves y Viernes Santo 2027 siguen del Domingo de Pascua (28/03/2027).
-- RIESGO: el MEF propuso (Andina, 8/8/2026) trasladar al lunes más cercano los feriados que caen de martes
-- a viernes desde 2027. Es solo una propuesta; si se aprueba, estas fechas cambiarían.
--
-- Revísalo contra la norma oficial antes de ejecutarlo. También puedes cargarlos desde la pantalla Feriados.
-- Se ejecuta en el SQL Editor (como propietario de la base de datos).
begin;

insert into public.feriados (fecha, nombre) values
  ('2027-01-01', 'Año Nuevo'),
  ('2027-03-25', 'Jueves Santo'),
  ('2027-03-26', 'Viernes Santo'),
  ('2027-05-01', 'Día del Trabajo'),
  ('2027-06-07', 'Batalla de Arica y Día de la Bandera'),
  ('2027-06-29', 'San Pedro y San Pablo'),
  ('2027-07-23', 'Día de la Fuerza Aérea del Perú'),
  ('2027-07-28', 'Fiestas Patrias'),
  ('2027-07-29', 'Fiestas Patrias'),
  ('2027-08-06', 'Batalla de Junín'),
  ('2027-08-30', 'Santa Rosa de Lima'),
  ('2027-10-08', 'Combate de Angamos'),
  ('2027-11-01', 'Todos los Santos'),
  ('2027-12-08', 'Inmaculada Concepción'),
  ('2027-12-09', 'Batalla de Ayacucho'),
  ('2027-12-25', 'Navidad')
on conflict (fecha) do nothing;

-- Regenera las sesiones futuras (regulares, no manuales) de los calendarios existentes.
select public.cal_recalcular_todos();

commit;
