-- UNIVERSA · Grade Chart con un solo juego de pesos para todos los módulos (decisión de Carlos Apolaya).
-- Antes: módulos normales Test 28 / Writing 24 / Project 28 / Formative 20, y módulo final 32 / 24 / 32 / 12.
-- Ahora: todos los módulos, incluido el último del nivel, usan 28 / 24 / 28 / 20 (el Final Test y el Final Project vuelven a llamarse Test y Project).
-- Crea una versión NUEVA y vigente de «Grade Chart Universa» sin pesos de módulo final. La versión anterior queda archivada.
-- Los módulos que ya tienen notas, participaciones, SPARK o actividades vinculadas conservan su versión (no se les cambia la plantilla).
-- Repetible: si la versión vigente ya no tiene pesos de módulo final, no hace nada. Va después de 20261128100000_formative_banco.sql.

do $$
declare
  v_p uuid; v_old public.eval_versiones; v_new uuid; v_ver integer; v_suma numeric; v_mod record; v_tiene boolean;
begin
  select id into v_p from public.eval_plantillas where nombre = 'Grade Chart Universa';
  if v_p is null then return; end if;
  select * into v_old from public.eval_versiones where plantilla_id = v_p and estado = 'vigente' and variante = 'normal';
  if v_old.id is null then return; end if;
  -- Ya unificado: ninguna columna de módulo final.
  if not exists (select 1 from public.eval_componentes where version_id = v_old.id and peso_final is not null) then return; end if;

  select coalesce(sum(peso), 0) into v_suma from public.eval_componentes where version_id = v_old.id;
  if v_suma <> v_old.escala_puntos then raise exception 'Los pesos de la versión vigente suman % y deben sumar %', v_suma, v_old.escala_puntos; end if;

  select coalesce(max(version), 0) + 1 into v_ver from public.eval_versiones where plantilla_id = v_p;
  update public.eval_versiones set estado = 'archivada' where plantilla_id = v_p and estado = 'vigente';
  insert into public.eval_versiones (plantilla_id, version, estado, escala_puntos, notas, activada_at)
  values (v_p, v_ver, 'vigente', v_old.escala_puntos,
          'Pesos únicos para todos los módulos (incluido el último del nivel): Test 28, Writing 24, Project 28, Formative 20. Se elimina la columna del módulo final.', now())
  returning id into v_new;

  insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id, peso_participacion)
  select v_new, nombre, tipo, peso, orden, rubrica_id, peso_participacion from public.eval_componentes where version_id = v_old.id;

  update public.eval_plantillas
     set descripcion = 'Cada módulo vale 100 y todos los módulos usan los mismos pesos: Test 28, Writing 24, Project 28, Formative 20. Formative = 5 elementos de 16 % (Listening / Lessons, Writing, Reading, Speaking, SPARK Homework) + 20 % de participación por clase.'
   where id = v_p;

  -- Módulos sin ningún dato pasan a la versión nueva (los finales también); los que ya tienen datos conservan la suya.
  for v_mod in
    select m.id from public.eval_modulos m
     where m.version_id in (select id from public.eval_versiones where plantilla_id = v_p and id <> v_new)
  loop
    v_tiene := exists (select 1 from public.eval_calificaciones k join public.eval_evaluaciones e on e.id = k.evaluacion_id where e.modulo_id = v_mod.id)
            or exists (select 1 from public.eval_participaciones x join public.eval_evaluaciones e on e.id = x.evaluacion_id where e.modulo_id = v_mod.id);
    if not v_tiene and to_regclass('public.eval_formative_spark') is not null then
      v_tiene := exists (select 1 from public.eval_formative_spark s join public.eval_evaluaciones e on e.id = s.evaluacion_id where e.modulo_id = v_mod.id);
    end if;
    if not v_tiene and to_regclass('public.eval_formative_vinculos') is not null then
      v_tiene := exists (select 1 from public.eval_formative_vinculos x join public.eval_evaluaciones e on e.id = x.evaluacion_id where e.modulo_id = v_mod.id);
    end if;
    if not v_tiene then perform public.eval_aplicar_version(v_mod.id, v_new); end if;
  end loop;
end $$;
