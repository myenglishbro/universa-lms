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
