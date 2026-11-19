-- Pruebas manuales del motor de rúbricas 2026 (NO se ejecutan solas). Solo funciones puras: no leen ni escriben datos.
-- Ejecutar DESPUÉS de las migraciones 20261208100000, 110000 y 120000, en el SQL Editor. Cada fila debe decir ok = true.

with casos(caso, obtenido, esperado) as (values
  -- Nota oficial: un solo redondeo, tramos 60/70/85
  ('59.49 → 59 desaprobó',          public.eval_clasificar(59.49)->>'resultado', 'desaprobo'),
  ('59.50 → 60 reforzamiento',      public.eval_clasificar(59.50)->>'resultado', 'reforzamiento'),
  ('69.49 → reforzamiento',         public.eval_clasificar(69.49)->>'resultado', 'reforzamiento'),
  ('69.50 → 70 aprobó',             public.eval_clasificar(69.50)->>'resultado', 'aprobo'),
  ('84.49 → aprobó',                public.eval_clasificar(84.49)->>'resultado', 'aprobo'),
  ('84.50 → 85 excelencia',         public.eval_clasificar(84.50)->>'resultado', 'excelencia'),
  ('nota oficial 69.5 = 70',        public.eval_clasificar(69.5)->>'nota_oficial', '70'),
  -- Nota exacta desde la copia de criterios (sin redondeo de 2 decimales)
  ('exacta: 8.4+4.2 de 14+7 = 60',  round(public.eval_nota_exacta(0, '[{"puntaje":8.4,"max":14},{"puntaje":4.2,"max":7}]'), 6)::text, '60.000000'),
  ('sin detalle usa la nota',       public.eval_nota_exacta(77.5, null)::text, '77.5'),
  -- Writing: Task 1 (35) + Task 2 (65): T1 completa (35/35) y T2 al nivel 3 (39/65) = 74/100, NO promedio 50/50 (que daría 80)
  ('Writing suma de puntos',        ((35 + 39) / 100.0 * 100)::text, '74.0000000000000000'),
  -- Grade Chart 28/24/28/20 con Test 80, Writing 74, Project 90, Formative 85 = 22.4+17.76+25.2+17 = 82.36
  ('Grade Chart',                   round(80*0.28 + 74*0.24 + 90*0.28 + 85*0.20, 2)::text, '82.36')
)
select caso, obtenido, esperado, obtenido = esperado as ok from casos;

-- Validación de niveles: debe LANZAR error el segundo (8 de 14 no es un nivel exacto).
-- select public.eval_validar_puntaje_criterio(row(null,null,'Task 1 · Content & Task Achievement',null,14,1,'[{"nivel":0}]'::jsonb,null)::public.eval_rubrica_criterios, 8.4); -- ok
-- select public.eval_validar_puntaje_criterio(row(null,null,'Task 1 · Content & Task Achievement',null,14,1,'[{"nivel":0}]'::jsonb,null)::public.eval_rubrica_criterios, 8);   -- error esperado

-- Comprobaciones de estructura de las rúbricas cargadas (todas deben dar ok = true)
select r.nombre, sum(c.max_puntaje) = 100 as suma_100, bool_and(jsonb_array_length(c.bandas) = 6) as seis_niveles
  from public.eval_rubricas r join public.eval_rubrica_criterios c on c.rubrica_id = r.id
 where r.nombre in ('Writing Assessment', 'Writing', 'Project', 'Speaking', 'Listening (manual)', 'Reading (manual)')
 group by r.nombre order by r.nombre;

-- Grade Chart vigente: 28 / 24 / 28 / 20 sin peso final
select c.nombre, c.tipo, c.peso, c.peso_final from public.eval_componentes c
  join public.eval_versiones v on v.id = c.version_id join public.eval_plantillas p on p.id = v.plantilla_id
 where p.nombre = 'Grade Chart Universa' and v.estado = 'vigente' and v.variante = 'normal' order by c.orden;

-- =====================================================================================================================================
-- VERIFICACIÓN DESPUÉS de aplicar 20261209100000_ajustes_writing_project_detalle.sql (solo lectura: SELECT). Cada fila debe decir ok = true.
-- =====================================================================================================================================
with casos(caso, obtenido, esperado) as (values
  -- Nota exacta: tolera el formato antiguo ({"nivel": n} como elemento aparte) y lee bien el nuevo
  ('exacta, formato antiguo',  round(public.eval_nota_exacta(0, '[{"criterio":"a","max":20,"puntaje":16},{"nivel":4},{"criterio":"b","max":5,"puntaje":4},{"nivel":4}]'), 6)::text, '80.000000'),
  ('exacta, formato nuevo',    round(public.eval_nota_exacta(0, '[{"criterio":"a","max":20,"puntaje":16,"nivel":4},{"criterio":"b","max":5,"puntaje":4,"nivel":4}]'), 6)::text, '80.000000'),
  ('exacta, sin detalle',      public.eval_nota_exacta(77.5, null)::text, '77.5'),
  -- Project: 7 criterios, 100 puntos, pesos nuevos
  ('Project: 7 criterios',     (select count(*) from eval_rubrica_criterios c join eval_rubricas r on r.id = c.rubrica_id where r.nombre = 'Project')::text, '7'),
  ('Project: suma 100',        (select sum(max_puntaje) from eval_rubrica_criterios c join eval_rubricas r on r.id = c.rubrica_id where r.nombre = 'Project')::text, '100.00'),
  ('Project: pesos en orden',  (select string_agg(max_puntaje::numeric::text, '/' order by orden) from eval_rubrica_criterios c join eval_rubricas r on r.id = c.rubrica_id where r.nombre = 'Project'), '25.00/12.50/12.50/15.00/20.00/10.00/5.00'),
  ('Project: G&V = 25',        (select sum(max_puntaje) from eval_rubrica_criterios c join eval_rubricas r on r.id = c.rubrica_id where r.nombre = 'Project' and c.nombre like 'Grammar & Vocabulary · %')::text, '25.00'),
  ('Project: 6 niveles c/u',   (select count(*) from eval_rubrica_criterios c join eval_rubricas r on r.id = c.rubrica_id where r.nombre = 'Project' and jsonb_array_length(c.bandas) = 6)::text, '7'),
  -- Writing Assessment: pesos sin cambio
  ('Writing T1 = 35',          (select sum(max_puntaje) from eval_rubrica_criterios c join eval_rubricas r on r.id = c.rubrica_id where r.nombre = 'Writing Assessment' and c.nombre like 'Task 1 · %')::text, '35.00'),
  ('Writing T2 = 65',          (select sum(max_puntaje) from eval_rubrica_criterios c join eval_rubricas r on r.id = c.rubrica_id where r.nombre = 'Writing Assessment' and c.nombre like 'Task 2 · %')::text, '65.00'),
  ('Writing pesos en orden',   (select string_agg(max_puntaje::numeric::text, '/' order by orden) from eval_rubrica_criterios c join eval_rubricas r on r.id = c.rubrica_id where r.nombre = 'Writing Assessment'), '14.00/7.00/11.00/3.00/23.00/13.00/23.00/6.00'),
  -- Las tres notas publicadas no cambiaron
  ('nota Writing Task 1',      (select k.puntaje::text from eval_calificaciones k join eval_evaluaciones e on e.id = k.evaluacion_id join eval_componentes c on c.id = e.componente_id where c.tipo = 'writing' and k.unidad = 'Task 1'), '68.00'),
  ('nota Writing Task 2',      (select k.puntaje::text from eval_calificaciones k join eval_evaluaciones e on e.id = k.evaluacion_id join eval_componentes c on c.id = e.componente_id where c.tipo = 'writing' and k.unidad = 'Task 2'), '63.08'),
  ('nota Project publicada',   (select k.puntaje::text from eval_calificaciones k join eval_evaluaciones e on e.id = k.evaluacion_id join eval_componentes c on c.id = e.componente_id where c.tipo = 'project'), '80.00'),
  -- Grade Chart intacto: una sola versión vigente de la plantilla, con 4 componentes y pesos 28/24/28/20
  ('Grade Chart vigente',      (select string_agg(c.peso::numeric::text, '/' order by c.orden) from eval_versiones v join eval_plantillas p on p.id = v.plantilla_id join eval_componentes c on c.version_id = v.id where p.nombre = 'Grade Chart Universa' and v.estado = 'vigente' and v.variante = 'normal'), '28.00/24.00/28.00/20.00'),
  ('versiones del Grade Chart', (select count(*) from eval_versiones)::text, '11')
)
select caso, obtenido, esperado, obtenido = esperado as ok from casos;

-- Nivel MCER objetivo por ciclo (misma expresión que eval_evaluacion_detalle). Esperado: 0→A1.1 · 1→A1.2 · 2→A2.1 · 3→A2.2 · 4→B1.1 · 5→B1.2 · 6→B1.3 ·
-- 7→B2.1 · 8→B2.2 · 9→C1.1 · 10→C1.2 · 11→C2.1 · 12→C2.2. Los módulos que existen hoy usan los ciclos 0 a 3.
select ci.numero as ciclo,
       nullif(btrim(case ci.posicion
         when 'impar' then (regexp_split_to_array(n.mcer, '\s*[–-]\s*'))[1]
         when 'par' then (regexp_split_to_array(n.mcer, '\s*[–-]\s*'))[array_length(regexp_split_to_array(n.mcer, '\s*[–-]\s*'), 1)]
         else n.mcer end), '') as mcer_objetivo,
       (select count(*) from eval_modulos m where m.ciclo = ci.numero) as modulos
  from ciclos ci join niveles n on n.id = ci.nivel_id order by ci.numero;

-- Módulos sin ciclo o cuyo ciclo no tiene nivel (deben ser 0: si hubiera, la pantalla usa el nivel del salón):
select count(*) as modulos_sin_mcer_objetivo
  from eval_modulos m
 where m.ciclo is null or not exists (select 1 from ciclos ci join niveles n on n.id = ci.nivel_id where ci.numero = m.ciclo and n.mcer is not null);

-- Pruebas que DEBEN FALLAR (ejecutar una por una dentro de una transacción de prueba, con ROLLBACK; ver aplicacion_ajustes_2026_12_09.md):
--  · guardar_calificaciones con {"puntaje": 90} y sin detalle en una evaluación Writing o Project → «This assessment is graded with a rubric…»
--  · guardar_rubrica de un tipo «project» que no sume 100, o «writing_task» con Task 2 ≠ 65 → error de suma
