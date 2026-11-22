-- UNIVERSA · Las unidades del Formative continúan entre módulos.
-- Cada módulo tiene 3 unidades: el módulo 1 va de la Unit 1 a la 3, el módulo 2 de la 4 a la 6, el 3 de la 7 a la 9, etc.
-- (la posición del módulo es su «orden» dentro del salón). Antes, todos los módulos nacían con Unit 1, 2 y 3.

-- 1. Una evaluación Formative nueva nace con las 3 unidades que le corresponden a su módulo.
create or replace function public.eval_formative_unidades() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_base integer;
begin
  if cardinality(new.unidades) = 0
     and exists (select 1 from public.eval_componentes c where c.id = new.componente_id and c.tipo = 'formative') then
    select (count(*))::integer * 3 into v_base
      from public.eval_modulos m
     where m.salon_id = (select m2.salon_id from public.eval_modulos m2 where m2.id = new.modulo_id)
       and (m.orden, m.id) < ((select m2.orden from public.eval_modulos m2 where m2.id = new.modulo_id), new.modulo_id);
    v_base := coalesce(v_base, 0);
    new.unidades := array['Unit ' || (v_base + 1), 'Unit ' || (v_base + 2), 'Unit ' || (v_base + 3)];
  end if;
  return new;
end $$;

-- 2. Corrección de lo ya creado: los módulos que quedaron con Unit 1, 2 y 3 pasan a su numeración.
--    Se renombra también todo lo que guarda la unidad (notas, vínculos de actividades, SPARK, confirmaciones y notas manuales).
do $$
declare r record; v_base integer;
begin
  for r in
    select e.id as evaluacion_id,
           (select count(*)::integer from public.eval_modulos m2
             where m2.salon_id = m.salon_id and (m2.orden, m2.id) < (m.orden, m.id)) * 3 as base
      from public.eval_evaluaciones e
      join public.eval_modulos m on m.id = e.modulo_id
      join public.eval_componentes c on c.id = e.componente_id
     where c.tipo = 'formative' and e.unidades = array['Unit 1', 'Unit 2', 'Unit 3']
  loop
    v_base := r.base;
    continue when v_base = 0;
    update public.eval_calificaciones set unidad = 'Unit ' || (v_base + substring(unidad from '\d+$')::integer)
      where evaluacion_id = r.evaluacion_id and unidad in ('Unit 1', 'Unit 2', 'Unit 3');
    update public.eval_formative_vinculos set unidad = 'Unit ' || (v_base + substring(unidad from '\d+$')::integer)
      where evaluacion_id = r.evaluacion_id and unidad in ('Unit 1', 'Unit 2', 'Unit 3');
    update public.eval_formative_spark set unidad = 'Unit ' || (v_base + substring(unidad from '\d+$')::integer)
      where evaluacion_id = r.evaluacion_id and unidad in ('Unit 1', 'Unit 2', 'Unit 3');
    update public.eval_formative_confirmaciones set unidad = 'Unit ' || (v_base + substring(unidad from '\d+$')::integer)
      where evaluacion_id = r.evaluacion_id and unidad in ('Unit 1', 'Unit 2', 'Unit 3');
    update public.eval_formative_manual set unidad = 'Unit ' || (v_base + substring(unidad from '\d+$')::integer)
      where evaluacion_id = r.evaluacion_id and unidad in ('Unit 1', 'Unit 2', 'Unit 3');
    update public.eval_evaluaciones
       set unidades = array['Unit ' || (v_base + 1), 'Unit ' || (v_base + 2), 'Unit ' || (v_base + 3)]
     where id = r.evaluacion_id;
  end loop;
end $$;
