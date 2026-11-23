-- UNIVERSA · Las unidades del Formative siguen el NÚMERO del módulo, no cuántos módulos tiene el salón.
-- Un grupo del ciclo 2 tiene los módulos 3 y 4 (orden 3 y 4) aunque sea su primer módulo; sus unidades son 7-8-9 y 10-11-12.
-- Antes se contaban los módulos del salón y el módulo 3 quedaba con Unit 1-3. Ahora: unidades = (orden - 1) × 3 + 1, 2 y 3.
-- Reemplaza el cálculo de 20261211100000_unidades_continuas_por_modulo.sql y corrige lo ya creado. Repetible.

create or replace function public.eval_formative_unidades() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_base integer;
begin
  if cardinality(new.unidades) = 0
     and exists (select 1 from public.eval_componentes c where c.id = new.componente_id and c.tipo = 'formative') then
    select (greatest(m.orden, 1) - 1) * 3 into v_base from public.eval_modulos m where m.id = new.modulo_id;
    v_base := coalesce(v_base, 0);
    new.unidades := array['Unit ' || (v_base + 1), 'Unit ' || (v_base + 2), 'Unit ' || (v_base + 3)];
  end if;
  return new;
end $$;

-- Corrección: los Formative cuyas 3 unidades correlativas no corresponden al número de su módulo se renumeran.
-- Se renombra también todo lo que guarda la unidad. El desplazamiento es múltiplo de 3, así que no hay choques entre nombres.
do $$
declare r record; v_actual integer; v_delta integer;
begin
  for r in
    select e.id as evaluacion_id, e.unidades, (greatest(m.orden, 1) - 1) * 3 as base
      from public.eval_evaluaciones e
      join public.eval_modulos m on m.id = e.modulo_id
      join public.eval_componentes c on c.id = e.componente_id
     where c.tipo = 'formative' and cardinality(e.unidades) = 3
       and e.unidades[1] ~ '^Unit \d+$' and e.unidades[2] ~ '^Unit \d+$' and e.unidades[3] ~ '^Unit \d+$'
  loop
    v_actual := substring(r.unidades[1] from '\d+$')::integer - 1;
    continue when substring(r.unidades[2] from '\d+$')::integer <> v_actual + 2
               or substring(r.unidades[3] from '\d+$')::integer <> v_actual + 3;
    v_delta := r.base - v_actual;
    continue when v_delta = 0;
    update public.eval_calificaciones set unidad = 'Unit ' || (substring(unidad from '\d+$')::integer + v_delta)
      where evaluacion_id = r.evaluacion_id and unidad = any (r.unidades);
    update public.eval_formative_vinculos set unidad = 'Unit ' || (substring(unidad from '\d+$')::integer + v_delta)
      where evaluacion_id = r.evaluacion_id and unidad = any (r.unidades);
    update public.eval_formative_spark set unidad = 'Unit ' || (substring(unidad from '\d+$')::integer + v_delta)
      where evaluacion_id = r.evaluacion_id and unidad = any (r.unidades);
    update public.eval_formative_confirmaciones set unidad = 'Unit ' || (substring(unidad from '\d+$')::integer + v_delta)
      where evaluacion_id = r.evaluacion_id and unidad = any (r.unidades);
    update public.eval_formative_manual set unidad = 'Unit ' || (substring(unidad from '\d+$')::integer + v_delta)
      where evaluacion_id = r.evaluacion_id and unidad = any (r.unidades);
    update public.eval_evaluaciones
       set unidades = array['Unit ' || (r.base + 1), 'Unit ' || (r.base + 2), 'Unit ' || (r.base + 3)]
     where id = r.evaluacion_id;
  end loop;
end $$;
