-- LIMPIEZA DE DATOS DE PRUEBA: deja una sola versión (la vigente) en cada plantilla de Evaluaciones.
-- No es una migración: ejecútala a mano en el SQL Editor, DESPUÉS de 20261119100000_grade_chart_unico.sql.
-- Solo borra versiones archivadas o en borrador que ningún módulo está usando; no toca notas.

begin;

delete from public.eval_versiones v
 where v.variante = 'normal'
   and v.estado <> 'vigente'
   and not exists (select 1 from public.eval_modulos m where m.version_id in (v.id, (select f.id from public.eval_versiones f where f.origen_id = v.id)));

-- Resumen: cada plantilla debe quedar con una versión (y su copia interna del módulo final)
select p.nombre, v.version, v.estado, v.variante
  from public.eval_plantillas p
  join public.eval_versiones v on v.plantilla_id = p.id
 order by p.nombre, v.version, v.variante;

commit;
