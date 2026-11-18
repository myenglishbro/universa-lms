-- UNIVERSA · Grade Chart 2026: Test 28 · Writing Assessment 24 · Project Assessment 28 · Formative Assessment 20 = 100, para TODOS los módulos.
--
--   Nota del módulo = Test × 0,28 + Writing × 0,24 + Project × 0,28 + Formative × 0,20   (cada nota de 0 a 100)
--
-- Crea una versión NUEVA y vigente de «Grade Chart Universa» sin columna de módulo final. Las versiones anteriores quedan archivadas.
--  · Writing apunta a la rúbrica «Writing Assessment» (Task 1 y Task 2). Project, a la rúbrica «Project». Test sigue sin rúbrica.
--  · Formative conserva su estructura (5 elementos de 16 % + participación 20 %, rúbrica «Formative Assessment · elementos»): no se toca.
-- Los módulos que NO tienen ningún dato (notas, participación, SPARK, actividades vinculadas, notas manuales…) pasan a la versión nueva.
-- Los que ya tienen datos conservan su versión: cambiarla borraría sus evaluaciones. Se listan con un aviso para que administración decida.
-- Sustituye en la práctica a 20261207100000_pesos_unicos_modulos.sql (que no debe ejecutarse: re-aplica módulos sin revisar todas las tablas).
-- Requiere 20261208110000_rubricas_2026_contenido.sql y 20261128100000_formative_banco.sql. Repetible. Una sola transacción.

begin;

do $$
declare
  v_p uuid; v_old public.eval_versiones; v_new uuid; v_ver integer; v_wri uuid; v_pro uuid; v_for uuid;
  v_mod record; v_ref record; v_dep boolean; v_hay boolean; v_conservados text := ''; v_movidos integer := 0;
begin
  select id into v_p from public.eval_plantillas where nombre = 'Grade Chart Universa';
  if v_p is null then raise exception 'Falta la plantilla «Grade Chart Universa»'; end if;
  select id into v_wri from public.eval_rubricas where lower(btrim(nombre)) = 'writing assessment' and activa;
  select id into v_pro from public.eval_rubricas where lower(btrim(nombre)) = 'project' and activa;
  select id into v_for from public.eval_rubricas where lower(btrim(nombre)) = lower('Formative Assessment · elementos') and activa;
  if v_wri is null or v_pro is null then raise exception 'Faltan las rúbricas «Writing Assessment» y «Project»: ejecuta antes 20261208110000_rubricas_2026_contenido.sql'; end if;
  if v_for is null then raise exception 'Falta la rúbrica «Formative Assessment · elementos»: ejecuta antes 20261128100000_formative_banco.sql'; end if;

  select * into v_old from public.eval_versiones where plantilla_id = v_p and estado = 'vigente' and variante = 'normal';
  if v_old.id is null then raise exception 'La plantilla «Grade Chart Universa» no tiene una versión vigente'; end if;

  -- Ya aplicado: la versión vigente es exactamente esta (4 componentes, sin columna final).
  if not exists (select 1 from public.eval_componentes where version_id = v_old.id and peso_final is not null)
     and (select count(*) from public.eval_componentes where version_id = v_old.id) = 4
     and exists (select 1 from public.eval_componentes where version_id = v_old.id and tipo = 'writing' and peso = 24 and rubrica_id = v_wri)
     and exists (select 1 from public.eval_componentes where version_id = v_old.id and tipo = 'project' and peso = 28 and rubrica_id = v_pro)
     and exists (select 1 from public.eval_componentes where version_id = v_old.id and tipo = 'test' and peso = 28)
     and exists (select 1 from public.eval_componentes where version_id = v_old.id and tipo = 'formative' and peso = 20) then
    raise notice 'El Grade Chart 2026 ya es la versión vigente: no se hace nada.';
    return;
  end if;

  select coalesce(max(version), 0) + 1 into v_ver from public.eval_versiones where plantilla_id = v_p;
  update public.eval_versiones set estado = 'archivada' where plantilla_id = v_p and estado = 'vigente' and variante = 'normal';
  insert into public.eval_versiones (plantilla_id, version, estado, escala_puntos, notas, activada_at)
  values (v_p, v_ver, 'vigente', 100,
          'Grade Chart 2026: Test 28, Writing Assessment 24 (Task 1 = 35 y Task 2 = 65 puntos de 100), Project Assessment 28, Formative Assessment 20. Mismos pesos en todos los módulos.', now())
  returning id into v_new;

  insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id, peso_participacion) values
    (v_new, 'Test', 'test', 28, 1, null, null),
    (v_new, 'Writing', 'writing', 24, 2, v_wri, null),
    (v_new, 'Project', 'project', 28, 3, v_pro, null),
    (v_new, 'Formative Assessment', 'formative', 20, 4, v_for, 20);

  if (select sum(peso) from public.eval_componentes where version_id = v_new) <> 100 then raise exception 'Los pesos del Grade Chart deben sumar 100'; end if;

  update public.eval_plantillas
     set descripcion = 'Cada módulo vale 100 y todos usan los mismos pesos: Test 28, Writing 24, Project 28, Formative 20. Writing = Task 1 (35) + Task 2 (65). Formative = 5 elementos de 16 % (Listening / Lessons, Writing, Reading, Speaking, SPARK Homework) + 20 % de participación por clase.'
   where id = v_p;

  -- Módulos de esta plantilla: los que no tienen NINGÚN dato dependiente de sus evaluaciones pasan a la versión nueva.
  for v_mod in
    select m.id, m.nombre from public.eval_modulos m
     where m.version_id in (select id from public.eval_versiones where plantilla_id = v_p and id <> v_new)
  loop
    v_hay := false;
    -- Cualquier tabla que apunte a eval_evaluaciones (notas, participaciones, SPARK, notas manuales, vínculos, confirmaciones…).
    for v_ref in
      select c.conrelid::regclass::text as tabla, a.attname as col
        from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
       where c.contype = 'f' and c.confrelid = 'public.eval_evaluaciones'::regclass and c.conrelid <> 'public.eval_evaluaciones'::regclass
    loop
      execute format('select exists (select 1 from %s t join public.eval_evaluaciones e on e.id = t.%I where e.modulo_id = $1)', v_ref.tabla, v_ref.col) into v_dep using v_mod.id;
      if v_dep then v_hay := true; exit; end if;
    end loop;
    if v_hay then
      v_conservados := v_conservados || v_mod.nombre || ', ';
    else
      update public.eval_modulos set es_final = false where id = v_mod.id;
      perform public.eval_aplicar_version(v_mod.id, v_new);
      v_movidos := v_movidos + 1;
    end if;
  end loop;
  raise notice 'Módulos pasados al Grade Chart 2026: %', v_movidos;
  if v_conservados <> '' then raise notice 'Conservan su versión anterior (ya tienen datos): %', v_conservados; end if;
end $$;

commit;
