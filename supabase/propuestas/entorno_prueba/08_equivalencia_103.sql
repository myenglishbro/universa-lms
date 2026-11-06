-- UNIVERSA · Paso 8. SOLO LECTURA. Compara las 103 combinaciones generadas con el CSV original mediante una huella.
-- Cada línea contiene: modalidad|nivel|horario|tipo|min|ses/sem|días|sesiones|horas|semanas|receso|
--                      ciclo A|sesiones A|horas A|ciclo B|sesiones B|horas B   (los campos que se compararon con el CSV).
begin read only;

select count(*) as combinaciones,
       md5(string_agg(linea, E'\n' order by linea collate "C")) as huella
from (
  select modalidad_codigo || '|' || nivel_codigo || '|' || patron_codigo || '|' || coalesce(tipo_alumno, '-') || '|' ||
         minutos_clase || '|' || sesiones_semana || '|' || array_to_string(dias, ',') || '|' ||
         total_sesiones || '|' || to_char(horas_totales, 'FM9990.0') || '|' || semanas || '|' || receso_semanas || '|' ||
         ciclo_impar || '|' || sesiones_ciclo_impar || '|' || to_char(horas_ciclo_impar, 'FM9990.0') || '|' ||
         coalesce(ciclo_par::text, '') || '|' || coalesce(sesiones_ciclo_par::text, '') || '|' ||
         coalesce(to_char(horas_ciclo_par, 'FM9990.0'), '') as linea
  from public.catalogo_combinaciones
) x;

rollback;
