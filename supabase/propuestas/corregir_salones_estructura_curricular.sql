-- UNIVERSA · Corrige los dos salones que no cumplían la estructura curricular (ver migración 20261223120000_estructura_curricular_cursos.sql).
--
--   A. SAL-0022 (Basic C2): el módulo «MODULE 3» estaba numerado como módulo 1. Pasa a ser el módulo 3, y sus unidades de Formative
--      pasan de Unit 1-3 a Unit 7-9 (también las notas, vínculos de actividades, SPARK, confirmaciones y notas manuales que usan esa unidad).
--   B. Salones del nivel Funcional (ciclo 0) con menos de 4 módulos (hoy SAL-0031, que tiene el 1 y el 2): se crean los módulos que faltan
--      (con su versión del Grade Chart y sus evaluaciones, igual que al crear el salón) y las sesiones se reparten en 4 partes iguales
--      (con 122 sesiones: 1-31, 32-62, 63-93 y 94-122). El módulo 1 (que ya tiene notas) conserva su rango; solo se reajustan los módulos sin notas.
--
-- Todo ocurre en una transacción: si la comprobación final no da lo esperado, no se guarda nada.
-- Repetible: si ya está corregido, no hace nada.
-- Puede ejecutarse antes o después de la migración 20261223120000.
-- Ejecutar con: npx supabase db query --remote --yes --file supabase/propuestas/corregir_salones_estructura_curricular.sql

begin;

-- ============================================================
-- A. SAL-0022: «MODULE 3» pasa de número 1 a número 3
-- ============================================================
do $$
declare v_m public.eval_modulos; r record; v_delta integer;
begin
  select m.* into v_m
    from public.eval_modulos m join public.salones s on s.id = m.salon_id
   where s.codigo = 'SAL-0022' and m.ciclo = 2 and m.orden = 1 and upper(btrim(m.nombre)) = 'MODULE 3';
  if not found then
    raise notice 'A. SAL-0022: no hay nada que corregir';
    return;
  end if;
  v_delta := (3 - v_m.orden) * 3;   -- de Unit 1-3 a Unit 7-9: +6

  for r in
    select e.id as evaluacion_id
      from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id
     where e.modulo_id = v_m.id and c.tipo = 'formative' and e.unidades = array['Unit 1', 'Unit 2', 'Unit 3']
  loop
    update public.eval_calificaciones set unidad = 'Unit ' || (substring(unidad from '\d+$')::integer + v_delta)
      where evaluacion_id = r.evaluacion_id and unidad in ('Unit 1', 'Unit 2', 'Unit 3');
    update public.eval_formative_vinculos set unidad = 'Unit ' || (substring(unidad from '\d+$')::integer + v_delta)
      where evaluacion_id = r.evaluacion_id and unidad in ('Unit 1', 'Unit 2', 'Unit 3');
    update public.eval_formative_spark set unidad = 'Unit ' || (substring(unidad from '\d+$')::integer + v_delta)
      where evaluacion_id = r.evaluacion_id and unidad in ('Unit 1', 'Unit 2', 'Unit 3');
    update public.eval_formative_confirmaciones set unidad = 'Unit ' || (substring(unidad from '\d+$')::integer + v_delta)
      where evaluacion_id = r.evaluacion_id and unidad in ('Unit 1', 'Unit 2', 'Unit 3');
    update public.eval_formative_manual set unidad = 'Unit ' || (substring(unidad from '\d+$')::integer + v_delta)
      where evaluacion_id = r.evaluacion_id and unidad in ('Unit 1', 'Unit 2', 'Unit 3');
    update public.eval_evaluaciones set unidades = array['Unit 7', 'Unit 8', 'Unit 9'] where id = r.evaluacion_id;
  end loop;

  update public.eval_modulos set orden = 3 where id = v_m.id;
  raise notice 'A. SAL-0022: «%» ahora es el módulo 3 (Unit 7-9)', v_m.nombre;
end $$;

-- ============================================================
-- B. Salones del Funcional (ciclo 0) con menos de 4 módulos: se completan hasta 4
-- ============================================================
do $$
declare
  v_s public.salones; v_m1 public.eval_modulos; v_q integer; v_tam integer; v_k integer; v_id uuid;
  v_desde integer; v_hasta integer; v_creados integer;
begin
  for v_s in
    select s.* from public.salones s
     where s.ciclo_desde = 0 and s.ciclo_hasta = 0 and s.plan_id is not null
       and (select count(*) from public.eval_modulos m where m.salon_id = s.id) between 1 and 3
  loop
    select * into v_m1 from public.eval_modulos where salon_id = v_s.id and orden = 1;
    if not found or v_m1.version_id is null then
      raise notice 'B. %: sin módulo 1 con versión del Grade Chart; se omite (créalo a mano)', v_s.codigo;
      continue;
    end if;
    select sesiones into v_q from public.plan_ciclos where plan_id = v_s.plan_id and ciclo = 0;
    v_tam := case when v_q >= 4 then ceil(v_q / 4.0)::integer end;
    v_creados := 0;

    for v_k in 1..4 loop
      if v_tam is null then v_desde := null; v_hasta := null;
      else v_desde := 1 + (v_k - 1) * v_tam; v_hasta := least(v_k * v_tam, v_q); end if;

      if not exists (select 1 from public.eval_modulos where salon_id = v_s.id and orden = v_k) then
        insert into public.eval_modulos (salon_id, nombre, orden, ciclo, sesion_desde, sesion_hasta, version_id, es_final)
        values (v_s.id, 'Módulo ' || v_k, v_k, 0, v_desde, v_hasta, v_m1.version_id, false) returning id into v_id;
        insert into public.eval_evaluaciones (modulo_id, componente_id, nombre)
        select v_id, c.id, c.nombre from public.eval_componentes c where c.version_id = v_m1.version_id order by c.orden;
        v_creados := v_creados + 1;
      elsif not exists (
        select 1 from public.eval_calificaciones k join public.eval_evaluaciones e on e.id = k.evaluacion_id
         join public.eval_modulos m on m.id = e.modulo_id where m.salon_id = v_s.id and m.orden = v_k
      ) then
        -- Módulo existente sin notas: su rango de sesiones se ajusta a la cuarta parte que le toca.
        update public.eval_modulos set sesion_desde = v_desde, sesion_hasta = v_hasta where salon_id = v_s.id and orden = v_k;
      end if;
    end loop;
    raise notice 'B. %: se crearon % módulos (ahora tiene 4)', v_s.codigo, v_creados;
  end loop;
end $$;

-- ============================================================
-- Comprobación: si algo no quedó como se espera, se cancela todo (rollback automático)
-- ============================================================
do $$
declare v_n integer;
begin
  select count(*) into v_n from public.salones s
   where s.ciclo_desde = 0 and s.ciclo_hasta = 0 and s.plan_id is not null
     and (select count(*) from public.eval_modulos m where m.salon_id = s.id) between 1 and 3;
  if v_n > 0 then raise exception 'Quedan % salones del Funcional con menos de 4 módulos', v_n; end if;

  select count(*) into v_n from public.eval_modulos m
   where m.ciclo is not null
     and not (m.orden = any (case when m.ciclo = 0 then array[1, 2, 3, 4] when m.ciclo % 2 = 1 then array[1, 2] else array[3, 4] end));
  if v_n > 0 then raise exception 'Quedan % módulos con número que no corresponde a su ciclo', v_n; end if;

  select count(*) into v_n
    from public.eval_evaluaciones e
    join public.eval_modulos m on m.id = e.modulo_id join public.eval_componentes c on c.id = e.componente_id
   where c.tipo = 'formative' and cardinality(e.unidades) > 0 and m.orden between 1 and 4
     and exists (select 1 from unnest(e.unidades) u
                  where u !~ '^Unit \d+$' or substring(u from '\d+$')::integer not between (m.orden - 1) * 3 + 1 and m.orden * 3);
  if v_n > 0 then raise exception 'Quedan % evaluaciones Formative con unidades que no son las de su módulo', v_n; end if;
end $$;

-- Resultado: cómo quedaron los salones corregidos.
select s.codigo, m.nombre, m.orden, m.ciclo, m.sesion_desde, m.sesion_hasta,
       (select string_agg(e.unidades::text, ' ' order by e.nombre) from public.eval_evaluaciones e where e.modulo_id = m.id and cardinality(e.unidades) > 0) as unidades,
       (select count(*) from public.eval_calificaciones k join public.eval_evaluaciones e on e.id = k.evaluacion_id where e.modulo_id = m.id) as notas
  from public.salones s join public.eval_modulos m on m.salon_id = s.id
 where s.codigo in ('SAL-0022', 'SAL-0031')
 order by s.codigo, m.orden;

commit;
