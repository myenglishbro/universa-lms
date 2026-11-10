-- UNIVERSA · Formative automático: la nota de la unidad se calcula y se publica sola; el docente puede corregir cada elemento a mano.
--
-- QUÉ CAMBIA respecto de 20261128100000_formative_banco.sql (que no se modifica):
--  1. SIN PLANTILLA ANTERIOR: cualquier módulo con Formative recibe actividades oficiales. Ya no se exige la rúbrica de 5 elementos ni una versión
--     «nueva» del Grade Chart; el máximo de cada elemento es 5. (formative_validar_destino y formative_opciones se redefinen.)
--  2. AUTOMÁTICO: al entregar un ejercicio oficial (autocalificado) o al calificarlo el docente, se recalcula la unidad del estudiante.
--     Cuando los 5 elementos están completos, la nota se escribe y se PUBLICA sola en la matriz (si ya estaba publicada y cambia, se corrige con
--     historial «Actualización automática»). Con algún elemento pendiente la unidad queda parcial: no se escribe nada y nunca se cuenta como cero.
--     El estudiante ve su avance en vivo (portal_formative) aunque la unidad aún esté parcial.
--  3. MANUAL: el docente puede anotar a mano Listening / Lessons, Writing, Reading, Speaking o SPARK (0 a 5) de un estudiante en una unidad
--     (por ejemplo, una actividad que se tomó de forma oral o que olvidó asignar). La nota manual PREVALECE sobre el promedio del banco.
--     Dejarla vacía la quita y vuelve el cálculo automático.
--  4. Un ejercicio ya asignado como práctica puede convertirse después en actividad oficial (formative_vincular) o volver a práctica
--     (formative_desvincular). Las entregas que los estudiantes ya hicieron cuentan de inmediato.
--  5. confirmar_formative deja de existir: ya no hay paso de confirmación.
--
-- Requiere 20261128100000_formative_banco.sql. Repetible. Una sola transacción. No cambia notas existentes por sí misma.

begin;

do $$
begin
  if to_regclass('public.eval_formative_vinculos') is null then
    raise exception 'Falta aplicar 20261128100000_formative_banco.sql antes de esta migración.';
  end if;
end $$;

-- ============================================================
-- 1. Nota manual por elemento
-- ============================================================
create table if not exists public.eval_formative_manual (
  evaluacion_id uuid not null references public.eval_evaluaciones(id) on delete cascade,
  alumno_id uuid not null references public.alumnos(id),
  unidad text not null check (btrim(unidad) <> ''),
  habilidad text not null check (habilidad in ('listening', 'writing', 'reading', 'speaking')),
  puntaje numeric(6, 2) not null check (puntaje >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (evaluacion_id, alumno_id, unidad, habilidad)
);
alter table public.eval_formative_manual enable row level security;
revoke all on public.eval_formative_manual from anon, authenticated;

-- ============================================================
-- 2. Destino válido en cualquier módulo con Formative
-- ============================================================
create or replace function public.formative_validar_destino(p_salon uuid, p_evaluacion uuid, p_unidad text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_e public.eval_evaluaciones; v_u text := coalesce(btrim(p_unidad), '');
begin
  select * into v_e from public.eval_evaluaciones where id = p_evaluacion;
  if v_e.id is null or public.eval_salon_de(p_evaluacion) is distinct from p_salon
     or not exists (select 1 from public.eval_componentes c where c.id = v_e.componente_id and c.tipo = 'formative') then
    raise exception 'Elige el Formative de un módulo de este salón';
  end if;
  if not (v_u = any (v_e.unidades)) then raise exception 'Elige la unidad del Formative'; end if;
  return v_u;
end $$;

create or replace function public.formative_opciones(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return jsonb_build_object(
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('evaluacion_id', e.id, 'modulo_id', m.id, 'modulo', m.nombre, 'unidades', to_jsonb(e.unidades), 'max', 5) order by m.orden, m.nombre)
        from public.eval_evaluaciones e join public.eval_modulos m on m.id = e.modulo_id join public.eval_componentes c on c.id = e.componente_id
       where m.salon_id = p_salon and c.tipo = 'formative'), '[]'::jsonb),
    'anteriores', '[]'::jsonb,
    'rubricas', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'nombre', r.nombre, 'tipo', r.tipo, 'por_defecto', lower(btrim(r.nombre)) = r.tipo) order by r.tipo, r.nombre)
        from public.eval_rubricas r
       where r.activa and r.tipo in ('writing', 'speaking') and exists (select 1 from public.eval_rubrica_criterios c where c.rubrica_id = r.id)), '[]'::jsonb));
end $$;

-- ============================================================
-- 3. Cálculo: la nota manual prevalece sobre el promedio del banco
-- ============================================================
create or replace function public.formative_elemento(p_evaluacion uuid, p_alumno uuid, p_unidad text, p_habilidad text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('n_asignadas', count(t.asignacion_id), 'n_calificadas', count(t.nota), 'promedio', avg(t.nota),
           'manual', (select m.puntaje from public.eval_formative_manual m
                       where m.evaluacion_id = p_evaluacion and m.alumno_id = p_alumno and m.unidad = p_unidad and m.habilidad = p_habilidad),
           'actividades', coalesce(jsonb_agg(jsonb_build_object('asignacion_id', t.asignacion_id, 'titulo', t.titulo, 'tipo', t.tipo, 'estado', t.est, 'nota', t.nota) order by t.titulo)
                                   filter (where t.asignacion_id is not null), '[]'::jsonb))
    from (select v.asignacion_id, a.titulo, a.tipo, public.ej_nota_entrega(a.tipo, e) nota,
                 case when e.id is null then 'sin_entrega' when public.ej_nota_entrega(a.tipo, e) is null then 'por_revisar' else 'calificada' end est
            from public.eval_formative_vinculos v
            join public.ejercicio_asignaciones a on a.id = v.asignacion_id and a.activa
            left join public.ejercicio_entregas e on e.asignacion_id = v.asignacion_id and e.alumno_id = p_alumno
           where v.evaluacion_id = p_evaluacion and v.unidad = p_unidad and v.habilidad = p_habilidad) t
$$;

-- Los 5 elementos de una unidad, cada uno de 0 a max (5). habilidad = manual si existe; si no, promedio × max ÷ 100. SPARK = nota manual.
-- p_crit se ignora salvo por su «max» (compatibilidad): ya no depende de ninguna plantilla.
drop function if exists public.formative_celda_banco(uuid, uuid, text, jsonb);
create or replace function public.formative_celda_banco(p_evaluacion uuid, p_alumno uuid, p_unidad text, p_crit jsonb default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_max numeric := coalesce((p_crit->>'max')::numeric, 5); v_h text; v_el jsonb; v_val numeric; v_sp numeric;
  v_elementos jsonb := '{}'::jsonb; v_valores jsonb := '{}'::jsonb; v_n integer := 0; v_sum numeric := 0;
begin
  foreach v_h in array array['listening', 'writing', 'reading', 'speaking'] loop
    v_el := public.formative_elemento(p_evaluacion, p_alumno, p_unidad, v_h);
    v_val := coalesce((v_el->>'manual')::numeric, (v_el->>'promedio')::numeric * v_max / 100);
    v_elementos := v_elementos || jsonb_build_object(v_h, v_el || jsonb_build_object('valor', v_val, 'es_manual', (v_el->>'manual') is not null));
    if v_val is not null then v_n := v_n + 1; v_sum := v_sum + v_val; v_valores := v_valores || jsonb_build_object(v_h, v_val); end if;
  end loop;
  select puntaje into v_sp from public.eval_formative_spark where evaluacion_id = p_evaluacion and alumno_id = p_alumno and unidad = p_unidad;
  v_elementos := v_elementos || jsonb_build_object('spark', jsonb_build_object('valor', v_sp, 'es_manual', true));
  if v_sp is not null then v_n := v_n + 1; v_sum := v_sum + v_sp; v_valores := v_valores || jsonb_build_object('spark', v_sp); end if;
  return jsonb_build_object('elementos', v_elementos, 'valores', v_valores, 'completos', v_n,
    'valor', case when v_n = 5 then 100 * v_sum / (5 * v_max) end,
    'provisional', case when v_n > 0 then 100 * v_sum / (v_n * v_max) end);
end $$;

-- ============================================================
-- 4. Sincronización automática de la nota de la unidad
-- ============================================================
-- Con los 5 elementos completos escribe y publica la nota de la unidad; si ya estaba publicada y cambió, la corrige con historial.
-- Con algún elemento pendiente no toca nada. Nunca lanza error hacia quien la dispara (un estudiante que entrega no debe fallar por esto).
create or replace function public.formative_sincronizar(p_evaluacion uuid, p_alumno uuid, p_unidad text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c jsonb; v_nota numeric; v_det jsonb; v_k public.eval_calificaciones; v_hay boolean; v_h text;
  v_nombres constant jsonb := '{"listening":"Listening / Lessons","writing":"Writing","reading":"Reading","speaking":"Speaking","spark":"SPARK Homework"}';
begin
  begin
    if not exists (select 1 from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id
                    where e.id = p_evaluacion and c.tipo = 'formative' and p_unidad = any (e.unidades)) then
      return;
    end if;
    if not exists (select 1 from public.matriculas m where m.alumno_id = p_alumno and m.salon_id = public.eval_salon_de(p_evaluacion) and m.estado = 'activa') then
      return;
    end if;
    v_c := public.formative_celda_banco(p_evaluacion, p_alumno, p_unidad, null);
    if (v_c->>'completos')::integer < 5 then return; end if;

    v_nota := round((v_c->>'valor')::numeric, 2);
    v_det := '[]'::jsonb;
    foreach v_h in array array['listening', 'writing', 'reading', 'speaking', 'spark'] loop
      v_det := v_det || jsonb_build_object('criterio', v_nombres->>v_h, 'max', 5, 'puntaje', (v_c->'valores'->>v_h)::numeric);
    end loop;

    select * into v_k from public.eval_calificaciones where evaluacion_id = p_evaluacion and alumno_id = p_alumno and unidad = p_unidad for update;
    v_hay := found;
    if not v_hay then
      insert into public.eval_calificaciones (evaluacion_id, alumno_id, unidad, puntaje, detalle, estado, publicada_at, updated_by)
      values (p_evaluacion, p_alumno, p_unidad, v_nota, v_det, 'publicada', now(), (select auth.uid()));
      insert into public.eval_formative_confirmaciones (evaluacion_id, alumno_id, unidad, nota, elementos, accion, motivo, por)
      values (p_evaluacion, p_alumno, p_unidad, v_nota, v_c->'elementos', 'publicada', 'Automática', (select auth.uid()));
    elsif v_k.estado = 'borrador' then
      update public.eval_calificaciones
         set puntaje = v_nota, detalle = v_det, estado = 'publicada', publicada_at = now(), updated_at = now(), updated_by = (select auth.uid())
       where id = v_k.id;
      insert into public.eval_formative_confirmaciones (evaluacion_id, alumno_id, unidad, nota, elementos, accion, motivo, por)
      values (p_evaluacion, p_alumno, p_unidad, v_nota, v_c->'elementos', 'publicada', 'Automática', (select auth.uid()));
    elsif v_k.puntaje is distinct from v_nota then
      insert into public.eval_historial (calificacion_id, puntaje_anterior, puntaje_nuevo, comentario_anterior, comentario_nuevo, motivo, por)
      values (v_k.id, v_k.puntaje, v_nota, v_k.comentario, v_k.comentario, 'Actualización automática del Formative (cambió una actividad o una nota manual)', (select auth.uid()));
      update public.eval_calificaciones set puntaje = v_nota, detalle = v_det, updated_at = now(), updated_by = (select auth.uid()) where id = v_k.id;
      insert into public.eval_formative_confirmaciones (evaluacion_id, alumno_id, unidad, nota, elementos, accion, motivo, por)
      values (p_evaluacion, p_alumno, p_unidad, v_nota, v_c->'elementos', 'corregida', 'Actualización automática', (select auth.uid()));
    end if;
  exception when others then
    raise warning 'formative_sincronizar: %', sqlerrm;
  end;
end $$;

-- Todos los estudiantes y unidades de un Formative (o solo una unidad).
create or replace function public.formative_sincronizar_todo(p_evaluacion uuid, p_unidad text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_salon uuid := public.eval_salon_de(p_evaluacion); v_u text; v_a uuid; v_unidades text[];
begin
  if v_salon is null then return; end if;
  select unidades into v_unidades from public.eval_evaluaciones where id = p_evaluacion;
  for v_a in select m.alumno_id from public.matriculas m where m.salon_id = v_salon and m.estado = 'activa' loop
    foreach v_u in array v_unidades loop
      if p_unidad is null or p_unidad = v_u then perform public.formative_sincronizar(p_evaluacion, v_a, v_u); end if;
    end loop;
  end loop;
end $$;

-- Al entregar o calificar un ejercicio oficial se recalcula la unidad de ese estudiante.
create or replace function public.formative_trg_entrega() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v public.eval_formative_vinculos;
begin
  select * into v from public.eval_formative_vinculos where asignacion_id = new.asignacion_id;
  if found then perform public.formative_sincronizar(v.evaluacion_id, new.alumno_id, v.unidad); end if;
  return null;
end $$;
drop trigger if exists ejercicio_entregas_formative on public.ejercicio_entregas;
create trigger ejercicio_entregas_formative after insert or update on public.ejercicio_entregas
  for each row execute function public.formative_trg_entrega();

-- ============================================================
-- 5. Docente: hacer oficial / volver a práctica, notas manuales, recalcular
-- ============================================================
-- Convierte una asignación ya existente (práctica u oficial en otro destino) en actividad oficial de una unidad y habilidad.
create or replace function public.formative_vincular(p_asignacion uuid, p_evaluacion uuid, p_unidad text, p_habilidad text, p_rubrica uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_a public.ejercicio_asignaciones; v_unidad text; v_rub uuid := null; v_ant public.eval_formative_vinculos;
begin
  select * into v_a from public.ejercicio_asignaciones where id = p_asignacion and activa;
  if not found then raise exception 'La asignación ya no existe'; end if;
  if not public.puede_gestionar_curso(v_a.salon_id) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  if p_habilidad is null or p_habilidad not in ('listening', 'writing', 'reading', 'speaking') then
    raise exception 'Elige la habilidad: Listening / Lessons, Writing, Reading o Speaking';
  end if;
  v_unidad := public.formative_validar_destino(v_a.salon_id, p_evaluacion, p_unidad);

  if v_a.tipo in ('writing', 'speaking') then
    if p_rubrica is not null then
      select r.id into v_rub from public.eval_rubricas r where r.id = p_rubrica and r.activa and r.tipo = v_a.tipo;
      if v_rub is null then raise exception 'La rúbrica elegida no es una rúbrica activa de %', v_a.tipo; end if;
    else
      select r.id into v_rub from public.eval_rubricas r where r.activa and r.tipo = v_a.tipo and lower(btrim(r.nombre)) = v_a.tipo;
      if v_rub is null then raise exception 'No hay una rúbrica activa «%»: créala en Rúbricas o elige otra de tipo %', v_a.tipo, v_a.tipo; end if;
    end if;
    if not exists (select 1 from public.eval_rubrica_criterios where rubrica_id = v_rub) then raise exception 'La rúbrica elegida no tiene criterios'; end if;
  end if;

  select * into v_ant from public.eval_formative_vinculos where asignacion_id = p_asignacion;
  insert into public.eval_formative_vinculos (asignacion_id, evaluacion_id, unidad, habilidad, rubrica_id, creado_por)
  values (p_asignacion, p_evaluacion, v_unidad, p_habilidad, v_rub, (select auth.uid()))
  on conflict (asignacion_id) do update
    set evaluacion_id = excluded.evaluacion_id, unidad = excluded.unidad, habilidad = excluded.habilidad,
        rubrica_id = coalesce(excluded.rubrica_id, public.eval_formative_vinculos.rubrica_id);
  perform public.formative_sincronizar_todo(p_evaluacion, v_unidad);
  if v_ant.asignacion_id is not null then perform public.formative_sincronizar_todo(v_ant.evaluacion_id, v_ant.unidad); end if;
end $$;

create or replace function public.formative_desvincular(p_asignacion uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_a public.ejercicio_asignaciones; v_v public.eval_formative_vinculos;
begin
  select * into v_a from public.ejercicio_asignaciones where id = p_asignacion;
  if not found then raise exception 'La asignación ya no existe'; end if;
  if not public.puede_gestionar_curso(v_a.salon_id) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_v from public.eval_formative_vinculos where asignacion_id = p_asignacion;
  if not found then return; end if;
  delete from public.eval_formative_vinculos where asignacion_id = p_asignacion;
  perform public.formative_sincronizar_todo(v_v.evaluacion_id, v_v.unidad);
end $$;

-- Notas manuales: p_filas = [{alumno_id, unidad, elemento, puntaje}] con elemento listening | writing | reading | speaking | spark y puntaje de 0 a 5.
-- Puntaje vacío = quitar la nota manual (vuelve el cálculo automático; SPARK vuelve a pendiente, nunca cero).
create or replace function public.guardar_formative_manual(p_evaluacion uuid, p_filas jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_salon uuid := public.eval_salon_de(p_evaluacion); v_e public.eval_evaluaciones; v_f jsonb; v_alumno uuid; v_u text; v_el text; v_p numeric; v_n integer := 0;
  v_pares text[] := '{}'; v_par text;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes permisos para registrar notas en este salón' using errcode = '42501'; end if;
  select * into v_e from public.eval_evaluaciones where id = p_evaluacion;
  if not exists (select 1 from public.eval_componentes c where c.id = v_e.componente_id and c.tipo = 'formative') then raise exception 'Esta evaluación no es un Formative'; end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then raise exception 'Las notas deben enviarse como lista'; end if;

  for v_f in select * from jsonb_array_elements(p_filas) loop
    begin v_alumno := (v_f->>'alumno_id')::uuid; exception when others then raise exception 'Identificador de estudiante no válido'; end;
    v_u := coalesce(btrim(v_f->>'unidad'), '');
    v_el := coalesce(v_f->>'elemento', '');
    if not (v_u = any (v_e.unidades)) then raise exception 'La unidad «%» no existe en este Formative', v_u; end if;
    if v_el not in ('listening', 'writing', 'reading', 'speaking', 'spark') then raise exception 'Elemento del Formative no válido'; end if;
    if not exists (select 1 from public.matriculas m where m.alumno_id = v_alumno and m.salon_id = v_salon and m.estado = 'activa') then
      raise exception 'Un estudiante de la lista no está matriculado en este salón';
    end if;
    begin v_p := nullif(btrim(coalesce(v_f->>'puntaje', '')), '')::numeric; exception when others then raise exception 'La nota no es un número válido'; end;
    if v_p is not null and (v_p < 0 or v_p > 5) then raise exception 'La nota debe estar entre 0 y 5'; end if;

    if v_el = 'spark' then
      if v_p is null then
        delete from public.eval_formative_spark where evaluacion_id = p_evaluacion and alumno_id = v_alumno and unidad = v_u;
      else
        insert into public.eval_formative_spark (evaluacion_id, alumno_id, unidad, puntaje, updated_by) values (p_evaluacion, v_alumno, v_u, v_p, (select auth.uid()))
        on conflict (evaluacion_id, alumno_id, unidad) do update set puntaje = excluded.puntaje, updated_by = excluded.updated_by, updated_at = now();
      end if;
    elsif v_p is null then
      delete from public.eval_formative_manual where evaluacion_id = p_evaluacion and alumno_id = v_alumno and unidad = v_u and habilidad = v_el;
    else
      insert into public.eval_formative_manual (evaluacion_id, alumno_id, unidad, habilidad, puntaje, updated_by) values (p_evaluacion, v_alumno, v_u, v_el, v_p, (select auth.uid()))
      on conflict (evaluacion_id, alumno_id, unidad, habilidad) do update set puntaje = excluded.puntaje, updated_by = excluded.updated_by, updated_at = now();
    end if;
    v_n := v_n + 1;
    v_par := v_alumno::text || '|' || v_u;
    if not (v_par = any (v_pares)) then v_pares := v_pares || v_par; end if;
  end loop;

  foreach v_par in array v_pares loop
    perform public.formative_sincronizar(p_evaluacion, split_part(v_par, '|', 1)::uuid, split_part(v_par, '|', 2));
  end loop;
  return v_n;
end $$;

-- SPARK manual (se conserva el nombre anterior): ahora también recalcula la unidad.
create or replace function public.guardar_spark_manual(p_evaluacion uuid, p_filas jsonb) returns integer
language sql security definer set search_path = '' as $$
  select public.guardar_formative_manual(p_evaluacion,
    coalesce((select jsonb_agg(f || '{"elemento":"spark"}'::jsonb) from jsonb_array_elements(p_filas) f), '[]'::jsonb))
$$;

create or replace function public.formative_recalcular(p_evaluacion uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_salon uuid := public.eval_salon_de(p_evaluacion);
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  perform public.formative_sincronizar_todo(p_evaluacion);
end $$;

-- ============================================================
-- 6. Propuesta del docente (sin exigir plantilla) y vista del estudiante
-- ============================================================
create or replace function public.formative_propuesta(p_evaluacion uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_salon uuid := public.eval_salon_de(p_evaluacion); v_e public.eval_evaluaciones;
  v_mod text; v_filas jsonb := '[]'::jsonb; v_acts jsonb; v_a record; v_u text; v_c jsonb; v_k record; v_cf jsonb;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_e from public.eval_evaluaciones where id = p_evaluacion;
  if not exists (select 1 from public.eval_componentes c where c.id = v_e.componente_id and c.tipo = 'formative') then raise exception 'Esta evaluación no es un Formative'; end if;
  select nombre into v_mod from public.eval_modulos where id = v_e.modulo_id;

  select coalesce(jsonb_agg(jsonb_build_object('asignacion_id', v.asignacion_id, 'titulo', a.titulo, 'tipo', a.tipo, 'unidad', v.unidad, 'habilidad', v.habilidad) order by v.unidad, v.habilidad, a.titulo), '[]'::jsonb)
    into v_acts
    from public.eval_formative_vinculos v join public.ejercicio_asignaciones a on a.id = v.asignacion_id and a.activa
   where v.evaluacion_id = p_evaluacion;

  for v_a in
    select al.id, al.nombre from public.matriculas m join public.alumnos al on al.id = m.alumno_id where m.salon_id = v_salon and m.estado = 'activa' order by al.nombre
  loop
    foreach v_u in array v_e.unidades loop
      v_c := public.formative_celda_banco(p_evaluacion, v_a.id, v_u, null);
      select k.puntaje, k.estado into v_k from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = v_a.id and k.unidad = v_u;
      select jsonb_build_object('cuando', f.cuando, 'nota', f.nota, 'accion', f.accion) into v_cf
        from public.eval_formative_confirmaciones f where f.evaluacion_id = p_evaluacion and f.alumno_id = v_a.id and f.unidad = v_u order by f.cuando desc limit 1;
      v_filas := v_filas || (jsonb_build_object('alumno_id', v_a.id, 'nombre', v_a.nombre, 'unidad', v_u,
        'registrada', case when v_k.estado is null then null else jsonb_build_object('puntaje', v_k.puntaje, 'estado', v_k.estado) end,
        'confirmacion', v_cf) || (v_c - 'valores'));
    end loop;
  end loop;

  return jsonb_build_object('evaluacion_id', p_evaluacion, 'modulo', v_mod, 'unidades', to_jsonb(v_e.unidades), 'max', 5,
    'actividades', v_acts, 'filas', v_filas);
end $$;

-- Lo que ve el estudiante: por módulo y unidad, sus 5 elementos (de 0 a 5), el avance en vivo y la nota oficial de la unidad cuando ya está publicada.
create or replace function public.portal_formative(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_alumno uuid := public.alumno_actual(); v_res jsonb := '[]'::jsonb; v_e record; v_u text; v_unis jsonb; v_c jsonb; v_k record; v_h text; v_els jsonb;
begin
  if not public.es_estudiante_de(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  for v_e in
    select e.id, e.unidades, m.nombre modulo from public.eval_evaluaciones e
      join public.eval_modulos m on m.id = e.modulo_id join public.eval_componentes c on c.id = e.componente_id
     where m.salon_id = p_salon and c.tipo = 'formative' order by m.orden, m.nombre
  loop
    v_unis := '[]'::jsonb;
    foreach v_u in array v_e.unidades loop
      v_c := public.formative_celda_banco(v_e.id, v_alumno, v_u, null);
      v_els := '{}'::jsonb;
      foreach v_h in array array['listening', 'writing', 'reading', 'speaking', 'spark'] loop
        v_els := v_els || jsonb_build_object(v_h, jsonb_build_object(
          'valor', v_c->'elementos'->v_h->'valor', 'es_manual', v_c->'elementos'->v_h->'es_manual',
          'n_asignadas', v_c->'elementos'->v_h->'n_asignadas', 'n_calificadas', v_c->'elementos'->v_h->'n_calificadas'));
      end loop;
      select k.puntaje, k.estado into v_k from public.eval_calificaciones k where k.evaluacion_id = v_e.id and k.alumno_id = v_alumno and k.unidad = v_u;
      v_unis := v_unis || jsonb_build_object('unidad', v_u, 'elementos', v_els, 'completos', v_c->'completos', 'provisional', v_c->'provisional',
        'valor', v_c->'valor', 'oficial', case when v_k.estado = 'publicada' then v_k.puntaje end);
    end loop;
    v_res := v_res || jsonb_build_object('evaluacion_id', v_e.id, 'modulo', v_e.modulo, 'unidades', v_unis);
  end loop;
  return v_res;
end $$;

-- ============================================================
-- 7. Fuera el paso de confirmación
-- ============================================================
drop function if exists public.confirmar_formative(uuid, text, uuid[], text);

-- ============================================================
-- 8. Permisos de ejecución
-- ============================================================
revoke execute on function
  public.formative_sincronizar(uuid, uuid, text), public.formative_sincronizar_todo(uuid, text), public.formative_trg_entrega(),
  public.formative_validar_destino(uuid, uuid, text), public.formative_elemento(uuid, uuid, text, text), public.formative_celda_banco(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
revoke execute on function
  public.formative_opciones(uuid), public.formative_vincular(uuid, uuid, text, text, uuid), public.formative_desvincular(uuid),
  public.guardar_formative_manual(uuid, jsonb), public.guardar_spark_manual(uuid, jsonb), public.formative_recalcular(uuid),
  public.formative_propuesta(uuid), public.portal_formative(uuid)
  from public, anon;
grant execute on function
  public.formative_opciones(uuid), public.formative_vincular(uuid, uuid, text, text, uuid), public.formative_desvincular(uuid),
  public.guardar_formative_manual(uuid, jsonb), public.guardar_spark_manual(uuid, jsonb), public.formative_recalcular(uuid),
  public.formative_propuesta(uuid), public.portal_formative(uuid)
  to authenticated;

commit;
