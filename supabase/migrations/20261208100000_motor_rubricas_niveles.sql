-- UNIVERSA · Motor de rúbricas por niveles 0–5, Writing Assessment por tareas y nota oficial.
--
-- QUÉ HACE (todo sobre la arquitectura existente; sin versionado ni estados de rúbrica):
--  1. NIVELES 0–5: un criterio es «por niveles» cuando sus bandas llevan «nivel» (0 a 5) y un descriptor por nivel. El docente elige el nivel;
--     la pantalla envía los puntos (nivel ÷ 5 × peso del criterio) y el servidor RECHAZA cualquier valor que no sea un nivel exacto.
--     Los criterios antiguos (bandas con rango «desde–hasta») siguen funcionando igual.
--  2. TAREAS DE WRITING: una rúbrica de tipo writing cuyos criterios se llaman «Task 1 · …» / «Task 2 · …» define una unidad por tarea.
--     Cada tarea tiene sus criterios, su nota (puntos ÷ máximo de la tarea), su comentario y su estado (borrador / publicada) propios.
--     El peso de cada tarea es la suma de sus criterios (35 y 65): Writing = (puntos T1 + puntos T2) sobre 100. NO se promedian al 50 %.
--  3. UN SOLO CÁLCULO: eval_nota_componente() usa los puntos exactos de la rúbrica (sin el redondeo de 2 decimales de cada nota guardada) y la
--     usan eval_calc_modulo y eval_celda. El frontend solo muestra lo que devuelve el servidor.
--  4. NOTA OFICIAL: eval_clasificar() redondea UNA sola vez (0,5 o más sube) y clasifica: 0–59 desaprobó · 60–69 requiere reforzamiento ·
--     70–84 aprobó · 85–100 aprobó con excelencia. eval_calc_modulo y eval_calc_nivel la devuelven junto a la nota decimal original
--     (que se conserva) y una marca «definitiva» (solo con todo lo evaluado). No se desarrolla ningún proceso de reforzamiento.
--  5. Formative (participación, unidades, banco, SPARK) NO se toca; solo se amplía la validación de las rúbricas del banco para aceptar niveles.
--
-- Requiere 20261129100000_formative_automatico.sql. Repetible. Una sola transacción. No cambia ninguna nota guardada.

begin;

-- ============================================================
-- 1. Estructura
-- ============================================================
-- Expectativas por nivel MCER de cada criterio: {"A1": "...", "A2": "...", "B1": "...", "B2": "...", "C1": "..."}
alter table public.eval_rubrica_criterios add column if not exists niveles_mcer jsonb;
alter table public.eval_rubrica_criterios drop constraint if exists eval_rubrica_criterios_mcer_ck;
alter table public.eval_rubrica_criterios add constraint eval_rubrica_criterios_mcer_ck
  check (niveles_mcer is null or jsonb_typeof(niveles_mcer) = 'object');

-- Nuevo tipo de rúbrica: «writing_task» (Writing Assessment por tareas). Las rúbricas «writing» y «speaking» siguen siendo las del banco de actividades.
do $$
declare v_c text;
begin
  for v_c in select conname from pg_constraint
              where conrelid = 'public.eval_rubricas'::regclass and contype = 'c'
                and pg_get_constraintdef(oid) like '%tipo%' and pg_get_constraintdef(oid) like '%project%' loop
    execute format('alter table public.eval_rubricas drop constraint %I', v_c);
  end loop;
  alter table public.eval_rubricas add constraint eval_rubricas_tipo_check
    check (tipo in ('speaking', 'writing', 'writing_task', 'project', 'formative', 'otra'));
end $$;

-- ============================================================
-- 2. Ayudas internas
-- ============================================================
create or replace function public.eval_prefijo_unidad(p_nombre text) returns text
language sql immutable set search_path = '' as $$
  select case when position(' · ' in p_nombre) > 0 then split_part(p_nombre, ' · ', 1) end
$$;

-- Criterios de una rúbrica que corresponden a una unidad. Si la rúbrica no tiene criterios «Unidad · …» para esa unidad, son todos.
create or replace function public.eval_criterios_unidad(p_rubrica uuid, p_unidad text) returns setof public.eval_rubrica_criterios
language sql stable security definer set search_path = '' as $$
  select c.* from public.eval_rubrica_criterios c
   where c.rubrica_id = p_rubrica
     and (coalesce(p_unidad, '') = ''
          or not exists (select 1 from public.eval_rubrica_criterios x where x.rubrica_id = p_rubrica and left(x.nombre, length(p_unidad) + 3) = p_unidad || ' · ')
          or left(c.nombre, length(p_unidad) + 3) = p_unidad || ' · ')
$$;

create or replace function public.eval_criterio_por_niveles(p_bandas jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(p_bandas) = 'array' and exists (select 1 from jsonb_array_elements(p_bandas) b where jsonb_typeof(b) = 'object' and b ? 'nivel'), false)
$$;

-- Puntos de un criterio: de 0 a su peso y, si es por niveles, exactamente un nivel (0, 1/5, 2/5 … 5/5 del peso).
create or replace function public.eval_validar_puntaje_criterio(p_crit public.eval_rubrica_criterios, p_puntaje numeric) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_puntaje is null or p_puntaje < 0 or p_puntaje > p_crit.max_puntaje then
    raise exception 'El puntaje de «%» debe estar entre 0 y %', p_crit.nombre, p_crit.max_puntaje;
  end if;
  if public.eval_criterio_por_niveles(p_crit.bandas) and (p_puntaje * 5 / p_crit.max_puntaje) <> round(p_puntaje * 5 / p_crit.max_puntaje) then
    raise exception 'La puntuación de «%» debe ser un nivel de 0 a 5', p_crit.nombre;
  end if;
end $$;

-- Nota 0–100 con precisión completa: si la calificación guarda la copia de criterios, Σ puntos ÷ Σ máximos × 100; si no, la nota guardada.
create or replace function public.eval_nota_exacta(p_puntaje numeric, p_detalle jsonb) returns numeric
language sql immutable set search_path = '' as $$
  select coalesce(
    case when jsonb_typeof(p_detalle) = 'array' and jsonb_array_length(p_detalle) > 0
              and not exists (select 1 from jsonb_array_elements(p_detalle) x where jsonb_typeof(x->'puntaje') is distinct from 'number' or jsonb_typeof(x->'max') is distinct from 'number')
         then (select 100 * sum((x->>'puntaje')::numeric) / nullif(sum((x->>'max')::numeric), 0) from jsonb_array_elements(p_detalle) x) end,
    p_puntaje)
$$;

-- Tareas de una evaluación Writing: una fila por unidad con su peso (suma de sus criterios). Vacío si la evaluación no es «por tareas».
create or replace function public.eval_tareas_evaluacion(p_evaluacion uuid) returns table (unidad_t text, peso_t numeric, orden_t integer)
language sql stable security definer set search_path = '' as $$
  with e as (
    select ev.unidades, comp.rubrica_id from public.eval_evaluaciones ev join public.eval_componentes comp on comp.id = ev.componente_id
     where ev.id = p_evaluacion and comp.tipo = 'writing' and comp.rubrica_id is not null and cardinality(ev.unidades) > 0),
  t as (
    select u.nombre_u, u.n_u::integer n_u,
           (select sum(c.max_puntaje) from public.eval_rubrica_criterios c where c.rubrica_id = e.rubrica_id and left(c.nombre, length(u.nombre_u) + 3) = u.nombre_u || ' · ') peso_u
      from e cross join lateral unnest(e.unidades) with ordinality u(nombre_u, n_u))
  select t.nombre_u, t.peso_u, t.n_u from t where not exists (select 1 from t x where x.peso_u is null)
$$;

-- Nota 0–100 de un componente (no Formative) para un estudiante: promedio de sus unidades o, en Writing por tareas, ponderado por el peso de cada tarea.
-- Solo notas publicadas (o también borradores si p_con_borradores). Sin notas → null (nunca cero).
create or replace function public.eval_nota_componente(p_evaluacion uuid, p_alumno uuid, p_con_borradores boolean) returns numeric
language plpgsql stable security definer set search_path = '' as $$
declare v_uni text[]; v_n numeric;
begin
  select unidades into v_uni from public.eval_evaluaciones where id = p_evaluacion;
  if v_uni is null then return null; end if;
  if exists (select 1 from public.eval_tareas_evaluacion(p_evaluacion)) then
    select sum(t.peso_t * public.eval_nota_exacta(k.puntaje, k.detalle)) / nullif(sum(t.peso_t), 0) into v_n
      from public.eval_tareas_evaluacion(p_evaluacion) t
      join public.eval_calificaciones k on k.evaluacion_id = p_evaluacion and k.alumno_id = p_alumno and k.unidad = t.unidad_t and k.puntaje is not null
                                       and (k.estado = 'publicada' or p_con_borradores);
    return v_n;
  end if;
  select avg(public.eval_nota_exacta(k.puntaje, k.detalle)) into v_n
    from public.eval_calificaciones k
   where k.evaluacion_id = p_evaluacion and k.alumno_id = p_alumno and k.puntaje is not null and (k.estado = 'publicada' or p_con_borradores)
     and k.unidad = any (case when cardinality(v_uni) = 0 then array[''] else v_uni end);
  return v_n;
end $$;

-- Nota oficial (única regla de redondeo) y resultado. p_nota = nota 0–100 SIN redondear. null → null.
create or replace function public.eval_clasificar(p_nota numeric) returns jsonb
language sql immutable set search_path = '' as $$
  select case when p_nota is null then null
    else jsonb_build_object(
      'nota_oficial', least(100, greatest(0, floor(p_nota + 0.5)))::integer,
      'resultado', case when floor(p_nota + 0.5) >= 85 then 'excelencia' when floor(p_nota + 0.5) >= 70 then 'aprobo'
                        when floor(p_nota + 0.5) >= 60 then 'reforzamiento' else 'desaprobo' end) end
$$;

-- Una evaluación Writing por tareas nace con una unidad por tarea (Task 1, Task 2).
create or replace function public.eval_tareas_unidades() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_u text[];
begin
  if cardinality(new.unidades) = 0 then
    select array_agg(q.p order by q.o) into v_u
      from (select public.eval_prefijo_unidad(c.nombre) p, min(c.orden) o
              from public.eval_componentes comp join public.eval_rubrica_criterios c on c.rubrica_id = comp.rubrica_id
             where comp.id = new.componente_id and comp.tipo = 'writing' and public.eval_prefijo_unidad(c.nombre) is not null
             group by 1) q;
    if v_u is not null then new.unidades := v_u; end if;
  end if;
  return new;
end $$;
drop trigger if exists eval_evaluaciones_tareas on public.eval_evaluaciones;
create trigger eval_evaluaciones_tareas before insert on public.eval_evaluaciones
  for each row execute function public.eval_tareas_unidades();

-- ============================================================
-- 3. Rúbricas (administración): tipo writing_task, expectativas MCER y niveles 0–5 validados
-- ============================================================
create or replace function public.guardar_rubrica(p_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_nombre text := btrim(coalesce(p_datos->>'nombre', ''));
  v_tipo text := coalesce(nullif(p_datos->>'tipo', ''), 'otra');
  v_desc text := nullif(btrim(coalesce(p_datos->>'descripcion', '')), '');
  v_activa boolean := coalesce((p_datos->>'activa')::boolean, true);
  v_crit jsonb := coalesce(p_datos->'criterios', '[]'::jsonb);
  v_c jsonb; v_b jsonb;
  v_nom text; v_max numeric; v_desde numeric; v_hasta numeric; v_niv numeric; v_niveles numeric[];
  v_nombres text[] := '{}';
  v_id uuid; v_orden integer := 0;
begin
  perform public.cal_exigir_admin();
  if v_nombre = '' then raise exception 'El nombre de la rúbrica es obligatorio'; end if;
  if v_tipo not in ('speaking', 'writing', 'writing_task', 'project', 'formative', 'otra') then raise exception 'Tipo de rúbrica no válido'; end if;
  if jsonb_typeof(v_crit) <> 'array' or jsonb_array_length(v_crit) = 0 then raise exception 'La rúbrica necesita al menos un criterio'; end if;
  if jsonb_array_length(v_crit) > 30 then raise exception 'Una rúbrica admite hasta 30 criterios'; end if;
  if exists (select 1 from public.eval_rubricas where lower(btrim(nombre)) = lower(v_nombre) and id is distinct from p_id) then
    raise exception 'Ya existe una rúbrica con ese nombre';
  end if;

  for v_c in select * from jsonb_array_elements(v_crit) loop
    v_nom := btrim(coalesce(v_c->>'nombre', ''));
    if v_nom = '' then raise exception 'Todos los criterios necesitan nombre'; end if;
    if lower(v_nom) = any(v_nombres) then raise exception 'El criterio «%» está repetido', v_nom; end if;
    v_nombres := v_nombres || lower(v_nom);
    begin v_max := (v_c->>'max_puntaje')::numeric; exception when others then v_max := null; end;
    if v_max is null or v_max <= 0 or v_max > 1000 then raise exception 'El puntaje máximo de «%» debe ser mayor que 0 y hasta 1000', v_nom; end if;
    if jsonb_typeof(coalesce(v_c->'bandas', '[]'::jsonb)) <> 'array' then raise exception 'Las bandas de «%» no son válidas', v_nom; end if;
    if v_c->'niveles_mcer' is not null and jsonb_typeof(v_c->'niveles_mcer') not in ('object', 'null') then
      raise exception 'Las expectativas por nivel MCER de «%» no son válidas', v_nom;
    end if;
    v_niveles := '{}';
    for v_b in select * from jsonb_array_elements(coalesce(v_c->'bandas', '[]'::jsonb)) loop
      if btrim(coalesce(v_b->>'etiqueta', '')) = '' then raise exception 'Cada banda de «%» necesita una etiqueta', v_nom; end if;
      if (v_b->>'nivel') is not null then
        begin v_niv := (v_b->>'nivel')::numeric; exception when others then v_niv := null; end;
        if v_niv is null or v_niv not in (0, 1, 2, 3, 4, 5) or v_niv = any (v_niveles) then
          raise exception 'Los niveles de «%» deben ser 0, 1, 2, 3, 4 y 5 sin repetir', v_nom;
        end if;
        v_niveles := v_niveles || v_niv;
      elsif (v_b->>'desde') is not null or (v_b->>'hasta') is not null then
        begin v_desde := (v_b->>'desde')::numeric; v_hasta := (v_b->>'hasta')::numeric; exception when others then v_desde := null; v_hasta := null; end;
        if v_desde is null or v_hasta is null or v_desde < 0 or v_desde > v_hasta or v_hasta > v_max then
          raise exception 'Los rangos de «%» deben ir de 0 hasta su máximo (%)', v_nom, v_max;
        end if;
      end if;
    end loop;
    if cardinality(v_niveles) > 0 and cardinality(v_niveles) <> 6 then
      raise exception 'Un criterio por niveles («%») necesita los 6 niveles, de 0 a 5', v_nom;
    end if;
  end loop;

  if p_id is null then
    insert into public.eval_rubricas (nombre, tipo, descripcion, activa) values (v_nombre, v_tipo, v_desc, v_activa) returning id into v_id;
  else
    update public.eval_rubricas set nombre = v_nombre, tipo = v_tipo, descripcion = v_desc, activa = v_activa, updated_at = now()
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'La rúbrica no existe'; end if;
    delete from public.eval_rubrica_criterios where rubrica_id = v_id;
  end if;
  -- Los componentes que usan la rúbrica quedan apuntando a ella: se reemplazan solo los criterios (las notas ya guardan su copia).
  for v_c in select * from jsonb_array_elements(v_crit) loop
    v_orden := v_orden + 1;
    insert into public.eval_rubrica_criterios (rubrica_id, nombre, descripcion, max_puntaje, orden, bandas, niveles_mcer)
    values (v_id, btrim(v_c->>'nombre'), nullif(btrim(coalesce(v_c->>'descripcion', '')), ''), (v_c->>'max_puntaje')::numeric, v_orden,
            coalesce(v_c->'bandas', '[]'::jsonb), case when jsonb_typeof(v_c->'niveles_mcer') = 'object' then v_c->'niveles_mcer' end);
  end loop;
  return v_id;
end $$;

-- ============================================================
-- 4. Calificar con rúbrica: la nota sale de los criterios DE LA UNIDAD (Task 1 o Task 2 en Writing)
-- ============================================================
drop function if exists public.eval_resolver_nota(uuid, numeric, jsonb);
create or replace function public.eval_resolver_nota(p_componente uuid, p_puntaje numeric, p_detalle jsonb, p_unidad text default '') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_rub uuid; v_item jsonb; v_crit public.eval_rubrica_criterios; v_cid uuid; v_p numeric;
  v_sum numeric := 0; v_max numeric; v_det jsonb := '[]'::jsonb; v_vistos uuid[] := '{}'; v_n integer;
begin
  if p_detalle is null or jsonb_typeof(p_detalle) = 'null' or p_detalle = '[]'::jsonb then
    if p_puntaje is not null and (p_puntaje < 0 or p_puntaje > 100) then raise exception 'La nota debe estar entre 0 y 100'; end if;
    return jsonb_build_object('puntaje', round(p_puntaje, 2), 'detalle', null);
  end if;
  if jsonb_typeof(p_detalle) <> 'array' then raise exception 'El detalle de la rúbrica no es válido'; end if;
  select rubrica_id into v_rub from public.eval_componentes where id = p_componente;
  if v_rub is null then raise exception 'Este componente no usa rúbrica'; end if;
  for v_item in select * from jsonb_array_elements(p_detalle) loop
    begin v_cid := (v_item->>'criterio_id')::uuid; exception when others then raise exception 'Criterio no válido'; end;
    select * into v_crit from public.eval_criterios_unidad(v_rub, p_unidad) c where c.id = v_cid;
    if not found then raise exception 'Un criterio no pertenece a la rúbrica de esta evaluación o de esta tarea'; end if;
    if v_cid = any (v_vistos) then raise exception 'Un criterio está repetido'; end if;
    begin v_p := (v_item->>'puntaje')::numeric; exception when others then v_p := null; end;
    perform public.eval_validar_puntaje_criterio(v_crit, v_p);
    v_vistos := v_vistos || v_cid;
    v_sum := v_sum + v_p;
    v_det := v_det || jsonb_build_object('criterio', v_crit.nombre, 'max', v_crit.max_puntaje, 'puntaje', v_p)
                   || case when public.eval_criterio_por_niveles(v_crit.bandas) then jsonb_build_object('nivel', round(v_p * 5 / v_crit.max_puntaje)) else '{}'::jsonb end;
  end loop;
  select count(*), sum(max_puntaje) into v_n, v_max from public.eval_criterios_unidad(v_rub, p_unidad);
  if cardinality(v_vistos) <> v_n then raise exception 'Faltan criterios por calificar en la rúbrica'; end if;
  return jsonb_build_object('puntaje', round(v_sum / v_max * 100, 2), 'detalle', v_det);
end $$;

-- guardar_calificaciones y corregir_calificacion: igual que antes, pero pasan la unidad al resolver.
create or replace function public.guardar_calificaciones(p_evaluacion uuid, p_filas jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_e public.eval_evaluaciones; v_salon uuid; v_f jsonb; v_alumno uuid; v_unidad text; v_p numeric; v_com text; v_det jsonb; v_r jsonb;
  v_ex public.eval_calificaciones; v_n integer := 0;
begin
  select * into v_e from public.eval_evaluaciones where id = p_evaluacion;
  if not found then raise exception 'La evaluación no existe'; end if;
  v_salon := public.eval_salon_de(p_evaluacion);
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes permisos para registrar notas en este salón' using errcode = '42501'; end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then raise exception 'Las notas deben enviarse como lista'; end if;

  for v_f in select * from jsonb_array_elements(p_filas) loop
    begin v_alumno := (v_f->>'alumno_id')::uuid; exception when others then raise exception 'Identificador de estudiante no válido'; end;
    v_unidad := coalesce(v_f->>'unidad', '');
    if cardinality(v_e.unidades) = 0 then
      if v_unidad <> '' then raise exception 'Esta evaluación no tiene unidades'; end if;
    elsif not (v_unidad = any (v_e.unidades)) then
      raise exception 'La unidad «%» no existe en esta evaluación', v_unidad;
    end if;
    select * into v_ex from public.eval_calificaciones where evaluacion_id = p_evaluacion and alumno_id = v_alumno and unidad = v_unidad;
    if not found and not exists (select 1 from public.matriculas m where m.alumno_id = v_alumno and m.salon_id = v_salon and m.estado = 'activa') then
      raise exception 'Un estudiante de la lista no está matriculado en este salón';
    end if;
    if found and v_ex.estado = 'publicada' then
      raise exception 'La nota ya está publicada: usa «Corregir» e indica el motivo';
    end if;
    begin v_p := nullif(v_f->>'puntaje', '')::numeric; exception when others then raise exception 'La nota no es un número válido'; end;
    v_com := nullif(btrim(coalesce(v_f->>'comentario', '')), '');
    v_det := v_f->'detalle';
    v_r := public.eval_resolver_nota(v_e.componente_id, v_p, v_det, v_unidad);
    v_p := (v_r->>'puntaje')::numeric;
    if v_p is null and v_com is null then
      delete from public.eval_calificaciones where evaluacion_id = p_evaluacion and alumno_id = v_alumno and unidad = v_unidad;
      continue;
    end if;
    insert into public.eval_calificaciones (evaluacion_id, alumno_id, unidad, puntaje, comentario, detalle, estado, updated_by)
    values (p_evaluacion, v_alumno, v_unidad, v_p, v_com, case when jsonb_typeof(v_r->'detalle') = 'null' then null else v_r->'detalle' end, 'borrador', (select auth.uid()))
    on conflict (evaluacion_id, alumno_id, unidad) do update
      set puntaje = excluded.puntaje, comentario = excluded.comentario, detalle = excluded.detalle, updated_at = now(), updated_by = excluded.updated_by;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function public.corregir_calificacion(
  p_evaluacion uuid, p_alumno uuid, p_unidad text, p_puntaje numeric, p_comentario text, p_motivo text, p_detalle jsonb default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_e public.eval_evaluaciones; v_salon uuid := public.eval_salon_de(p_evaluacion); v_k public.eval_calificaciones; v_r jsonb;
  v_motivo text := btrim(coalesce(p_motivo, '')); v_com text := nullif(btrim(coalesce(p_comentario, '')), ''); v_p numeric;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes permisos para corregir notas de este salón' using errcode = '42501'; end if;
  if length(v_motivo) < 3 then raise exception 'Indica el motivo de la corrección'; end if;
  select * into v_e from public.eval_evaluaciones where id = p_evaluacion;
  select * into v_k from public.eval_calificaciones where evaluacion_id = p_evaluacion and alumno_id = p_alumno and unidad = coalesce(p_unidad, '') for update;
  if not found then raise exception 'No existe esa nota'; end if;
  if v_k.estado <> 'publicada' then raise exception 'La nota aún es un borrador: edítala y publícala'; end if;
  v_r := public.eval_resolver_nota(v_e.componente_id, p_puntaje, p_detalle, coalesce(p_unidad, ''));
  v_p := (v_r->>'puntaje')::numeric;
  if v_p is null then raise exception 'Indica la nueva nota'; end if;
  if v_p = v_k.puntaje and v_com is not distinct from v_k.comentario then raise exception 'No hay cambios que guardar'; end if;
  insert into public.eval_historial (calificacion_id, puntaje_anterior, puntaje_nuevo, comentario_anterior, comentario_nuevo, motivo, por)
  values (v_k.id, v_k.puntaje, v_p, v_k.comentario, v_com, v_motivo, (select auth.uid()));
  update public.eval_calificaciones
     set puntaje = v_p, comentario = v_com, detalle = case when jsonb_typeof(v_r->'detalle') = 'null' then detalle else v_r->'detalle' end,
         updated_at = now(), updated_by = (select auth.uid())
   where id = v_k.id;
end $$;

-- Writing / Speaking del banco: misma validación (niveles exactos) y el nivel queda en la copia de criterios.
create or replace function public.calificar_entrega_rubrica(p_entrega uuid, p_detalle jsonb, p_feedback text) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_e public.ejercicio_entregas; v_a public.ejercicio_asignaciones; v_v public.eval_formative_vinculos; v_r public.eval_rubricas;
  v_item jsonb; v_crit public.eval_rubrica_criterios; v_cid uuid; v_p numeric; v_vistos uuid[] := '{}';
  v_sum numeric := 0; v_max numeric; v_n integer; v_det jsonb := '[]'::jsonb; v_nota numeric;
begin
  select * into v_e from public.ejercicio_entregas where id = p_entrega for update;
  if not found then raise exception 'La entrega ya no existe'; end if;
  select * into v_a from public.ejercicio_asignaciones where id = v_e.asignacion_id;
  if not public.puede_gestionar_curso(v_a.salon_id) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_v from public.eval_formative_vinculos where asignacion_id = v_a.id;
  if not found or v_v.rubrica_id is null or v_a.tipo not in ('writing', 'speaking') then raise exception 'Esta actividad no se califica con rúbrica'; end if;
  select * into v_r from public.eval_rubricas where id = v_v.rubrica_id;
  if p_detalle is null or jsonb_typeof(p_detalle) <> 'array' then raise exception 'Califica todos los criterios de la rúbrica'; end if;

  for v_item in select * from jsonb_array_elements(p_detalle) loop
    begin v_cid := (v_item->>'criterio_id')::uuid; exception when others then raise exception 'Criterio no válido'; end;
    select * into v_crit from public.eval_rubrica_criterios where id = v_cid and rubrica_id = v_v.rubrica_id;
    if not found then raise exception 'Un criterio no pertenece a la rúbrica de esta actividad'; end if;
    if v_cid = any (v_vistos) then raise exception 'Un criterio está repetido'; end if;
    begin v_p := (v_item->>'puntaje')::numeric; exception when others then v_p := null; end;
    perform public.eval_validar_puntaje_criterio(v_crit, v_p);
    v_vistos := v_vistos || v_cid;
    v_sum := v_sum + v_p;
    v_det := v_det || jsonb_build_object('criterio', v_crit.nombre, 'max', v_crit.max_puntaje, 'puntaje', v_p)
                   || case when public.eval_criterio_por_niveles(v_crit.bandas) then jsonb_build_object('nivel', round(v_p * 5 / v_crit.max_puntaje)) else '{}'::jsonb end;
  end loop;
  select count(*), sum(max_puntaje) into v_n, v_max from public.eval_rubrica_criterios where rubrica_id = v_v.rubrica_id;
  if cardinality(v_vistos) <> v_n then raise exception 'Faltan criterios por calificar en la rúbrica'; end if;

  v_nota := 100 * v_sum / v_max;
  update public.ejercicio_entregas
     set puntaje = round(v_nota, 2), estado = 'revisada', feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
         detalle = jsonb_build_object('rubrica', v_r.nombre, 'rubrica_id', v_r.id, 'criterios', v_det),
         calificado_por = (select auth.uid()), calificado_at = now()
   where id = p_entrega;
  return v_nota;
end $$;

-- Writing / Speaking tomado EN VIVO (sin que el estudiante envíe nada en la plataforma): el docente califica con la misma rúbrica del vínculo.
-- Crea (si no existe) una entrega marcada {"en_vivo": true} y usa calificar_entrega_rubrica: misma validación de niveles, misma copia de criterios,
-- mismo feedback y la misma sincronización automática del Formative. Si el estudiante ya había enviado algo, califica esa entrega.
create or replace function public.calificar_en_vivo(p_asignacion uuid, p_alumno uuid, p_detalle jsonb, p_feedback text) returns numeric
language plpgsql security definer set search_path = '' as $$
declare v_a public.ejercicio_asignaciones; v_e uuid;
begin
  select * into v_a from public.ejercicio_asignaciones where id = p_asignacion;
  if not found then raise exception 'La actividad no existe'; end if;
  if not public.puede_gestionar_curso(v_a.salon_id) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  if v_a.tipo not in ('writing', 'speaking') then raise exception 'Solo Writing y Speaking se califican con rúbrica'; end if;
  if not exists (select 1 from public.eval_formative_vinculos v where v.asignacion_id = p_asignacion and v.rubrica_id is not null) then
    raise exception 'Esta actividad no está vinculada al Formative con una rúbrica';
  end if;
  if not exists (select 1 from public.matriculas m where m.alumno_id = p_alumno and m.salon_id = v_a.salon_id and m.estado = 'activa') then
    raise exception 'El estudiante no está matriculado en este salón';
  end if;
  insert into public.ejercicio_entregas (asignacion_id, alumno_id, respuestas, estado)
  values (p_asignacion, p_alumno, '{"en_vivo": true}'::jsonb, 'pendiente')
  on conflict (asignacion_id, alumno_id) do nothing;
  select id into v_e from public.ejercicio_entregas where asignacion_id = p_asignacion and alumno_id = p_alumno;
  return public.calificar_entrega_rubrica(v_e, p_detalle, p_feedback);
end $$;
revoke execute on function public.calificar_en_vivo(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.calificar_en_vivo(uuid, uuid, jsonb, text) to authenticated;

-- Rúbrica de una actividad del banco (Formative) con niveles y expectativas MCER, para la revisión del docente.
create or replace function public.formative_etiqueta(p_asignacion uuid, p_con_rubrica boolean default false) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('evaluacion_id', v.evaluacion_id, 'modulo', m.nombre, 'unidad', v.unidad, 'habilidad', v.habilidad)
         || case when p_con_rubrica and r.id is not null then jsonb_build_object('rubrica', jsonb_build_object(
              'id', r.id, 'nombre', r.nombre,
              'criterios', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'descripcion', c.descripcion, 'max_puntaje', c.max_puntaje,
                                                                       'bandas', c.bandas, 'niveles_mcer', c.niveles_mcer) order by c.orden), '[]'::jsonb)
                              from public.eval_rubrica_criterios c where c.rubrica_id = r.id)))
            else '{}'::jsonb end
    from public.eval_formative_vinculos v
    join public.eval_evaluaciones ev on ev.id = v.evaluacion_id
    join public.eval_modulos m on m.id = ev.modulo_id
    left join public.eval_rubricas r on r.id = v.rubrica_id
   where v.asignacion_id = p_asignacion
$$;

-- ============================================================
-- 5. Detalle de una evaluación: rúbrica con niveles y expectativas MCER
-- ============================================================
create or replace function public.eval_evaluacion_detalle(p_evaluacion uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_e public.eval_evaluaciones; v_salon uuid := public.eval_salon_de(p_evaluacion); v_c public.eval_componentes; v_m public.eval_modulos; v_rub jsonb := null;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_e from public.eval_evaluaciones where id = p_evaluacion;
  select * into v_c from public.eval_componentes where id = v_e.componente_id;
  select * into v_m from public.eval_modulos where id = v_e.modulo_id;
  if v_c.rubrica_id is not null then
    select jsonb_build_object('id', r.id, 'nombre', r.nombre, 'tipo', r.tipo,
             'criterios', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'nombre', k.nombre, 'descripcion', k.descripcion, 'max_puntaje', k.max_puntaje,
                                                                      'bandas', k.bandas, 'niveles_mcer', k.niveles_mcer) order by k.orden)
                                      from public.eval_rubrica_criterios k where k.rubrica_id = r.id), '[]'::jsonb))
      into v_rub from public.eval_rubricas r where r.id = v_c.rubrica_id;
  end if;
  return jsonb_build_object(
    'evaluacion', jsonb_build_object('id', v_e.id, 'nombre', v_e.nombre, 'unidades', to_jsonb(v_e.unidades), 'salon_id', v_salon,
                                     'modulo_id', v_m.id, 'modulo', v_m.nombre, 'componente', v_c.nombre, 'tipo', v_c.tipo, 'peso', v_c.peso,
                                     'por_tareas', exists (select 1 from public.eval_tareas_evaluacion(p_evaluacion))),
    'rubrica', v_rub,
    'alumnos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'alumno_id', a.id, 'nombre', a.nombre,
        'filas', coalesce((select jsonb_agg(jsonb_build_object(
                    'unidad', k.unidad, 'puntaje', k.puntaje, 'comentario', k.comentario, 'detalle', k.detalle, 'estado', k.estado,
                    'corregida', exists (select 1 from public.eval_historial h where h.calificacion_id = k.id)) order by k.unidad)
                  from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = a.id), '[]'::jsonb)) order by a.nombre)
      from public.alumnos a
     where a.id in (select m2.alumno_id from public.matriculas m2 where m2.salon_id = v_salon and m2.estado = 'activa'
                    union select k2.alumno_id from public.eval_calificaciones k2 where k2.evaluacion_id = p_evaluacion)), '[]'::jsonb));
end $$;

-- ============================================================
-- 6. Cálculo del módulo: un solo motor (nota exacta, Writing ponderado por tarea) y nota oficial
-- ============================================================
create or replace function public.eval_calc_modulo(p_modulo uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_m public.eval_modulos; v_v public.eval_versiones; v_nombre text;
  v_comp jsonb; v_total numeric; v_eval numeric; v_puntos numeric; v_faltan jsonb; v_exacta numeric;
begin
  select * into v_m from public.eval_modulos where id = p_modulo;
  if not found then return null; end if;
  if v_m.version_id is null then
    return jsonb_build_object('modulo_id', v_m.id, 'nombre', v_m.nombre, 'ciclo', v_m.ciclo, 'sin_plantilla', true, 'parcial', true,
                              'nota', null, 'puntos', 0, 'escala', null, 'peso_total', 0, 'peso_evaluado', 0, 'componentes', '[]'::jsonb, 'faltan', '[]'::jsonb);
  end if;
  select * into v_v from public.eval_versiones where id = v_m.version_id;
  select p.nombre into v_nombre from public.eval_plantillas p where p.id = v_v.plantilla_id;

  with c as (
    select c.id, c.nombre, c.tipo, c.peso, c.orden,
           (c.tipo = 'formative' and e.id is not null and cardinality(e.unidades) > 0) as es_form,
           case when c.tipo = 'formative' then coalesce(c.peso_participacion, 0) / 100 else 0 end as p_part,
           coalesce(cardinality(e.unidades), 0) as n_uni,
           u.n as u_pub, u.nota as u_nota, pa.nota as part_nota,
           case when e.id is null or cardinality(e.unidades) = 0 then 1 else cardinality(e.unidades) end as n_simple,
           coalesce(k.n, 0) as k_pub, k.nota as k_nota
      from public.eval_componentes c
      left join public.eval_evaluaciones e on e.componente_id = c.id and e.modulo_id = p_modulo
      left join lateral (
        select count(*)::integer n,
               case when c.tipo = 'formative' then null else public.eval_nota_componente(e.id, p_alumno, false) end nota
          from public.eval_calificaciones x
         where x.evaluacion_id = e.id and x.alumno_id = p_alumno and x.estado = 'publicada'
           and x.unidad = any (case when cardinality(e.unidades) = 0 then array[''] else e.unidades end)) k on true
      left join lateral (
        select count(*)::integer n, avg(x.puntaje) nota
          from public.eval_calificaciones x
         where x.evaluacion_id = e.id and x.alumno_id = p_alumno and x.estado = 'publicada' and x.unidad = any (e.unidades)) u on true
      left join lateral (
        select x.puntaje nota from public.eval_calificaciones x
         where x.evaluacion_id = e.id and x.alumno_id = p_alumno and x.estado = 'publicada' and x.unidad = '' limit 1) pa on true
     where c.version_id = v_m.version_id
  ), d as (
    select *,
           case when es_form then n_uni + (case when p_part > 0 then 1 else 0 end) else n_simple end as n_total,
           case when es_form then coalesce(u_pub, 0) + (case when p_part > 0 and part_nota is not null then 1 else 0 end) else k_pub end as n_pub,
           case when es_form then (1 - p_part) * u_nota + p_part * coalesce(part_nota, 0) else k_nota end as nota
      from c
  ), t as (
    select *, case when n_pub >= n_total then 'completo' when n_pub = 0 then 'falta' else 'incompleto' end as estado from d
  )
  select jsonb_agg(jsonb_build_object('componente_id', id, 'nombre', nombre, 'tipo', tipo, 'peso', peso, 'estado', estado,
                                      'unidades_publicadas', n_pub, 'unidades_total', n_total,
                                      'nota', case when estado = 'completo' then round(nota, 2) end) order by orden),
         coalesce(sum(peso), 0),
         coalesce(sum(peso) filter (where estado = 'completo'), 0),
         coalesce(sum(peso * nota / 100) filter (where estado = 'completo'), 0),
         coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'estado', estado, 'unidades_publicadas', n_pub, 'unidades_total', n_total) order by orden)
                  filter (where estado <> 'completo'), '[]'::jsonb)
    into v_comp, v_total, v_eval, v_puntos, v_faltan from t;

  v_exacta := case when v_eval > 0 then v_puntos / v_eval * 100 end;
  return jsonb_build_object(
    'modulo_id', v_m.id, 'nombre', v_m.nombre, 'ciclo', v_m.ciclo, 'plantilla', v_nombre, 'version', v_v.version,
    'escala', v_v.escala_puntos, 'peso_total', v_total, 'peso_evaluado', v_eval,
    'puntos', round(v_puntos, 2), 'puntos_exactos', v_puntos,
    -- nota 0-100 sobre lo evaluado (decimal original, 2 decimales para mostrar); la nota_exacta no tiene redondeo y alimenta la nota oficial
    'nota', round(v_exacta, 2), 'nota_exacta', v_exacta,
    'parcial', v_eval < v_total, 'sin_plantilla', false, 'definitiva', (v_total > 0 and v_eval >= v_total),
    'componentes', coalesce(v_comp, '[]'::jsonb), 'faltan', v_faltan)
    || coalesce(public.eval_clasificar(v_exacta), '{}'::jsonb);
end $$;

-- Resultado efectivo (con remedial aplicado): conserva los campos exactos y oficiales coherentes con la nota que rige.
create or replace function public.eval_modulo_efectivo(p_modulo uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_r jsonb := public.eval_calc_modulo(p_modulo, p_alumno); v_m public.eval_modulos; v_rem public.eval_remediales; v_escala numeric;
begin
  if v_r is null then return null; end if;
  if coalesce((v_r->>'sin_plantilla')::boolean, false) then return v_r || jsonb_build_object('remedial', false); end if;
  select * into v_m from public.eval_modulos where id = p_modulo;
  select * into v_rem from public.eval_remediales r
   where r.alumno_id = p_alumno and r.estado = 'aplicado'
     and ((r.ambito = 'modulo' and r.modulo_id = p_modulo) or (r.ambito = 'ciclo' and r.salon_id = v_m.salon_id and v_m.ciclo is not null and r.ciclo = v_m.ciclo))
   order by (r.ambito = 'modulo') desc limit 1;
  if not found then return v_r || jsonb_build_object('remedial', false); end if;
  v_escala := (v_r->>'peso_total')::numeric;
  return v_r || jsonb_build_object('remedial', true, 'remedial_id', v_rem.id, 'remedial_ambito', v_rem.ambito, 'remedial_nota', v_rem.nota,
    'puntos_original', v_r->'puntos', 'nota_original', v_r->'nota', 'parcial_original', v_r->'parcial',
    'puntos', round(v_rem.nota / 100 * v_escala, 2), 'puntos_exactos', v_rem.nota / 100 * v_escala, 'nota', v_rem.nota, 'nota_exacta', v_rem.nota,
    'parcial', false, 'definitiva', true, 'peso_evaluado', v_escala, 'faltan', '[]'::jsonb) || public.eval_clasificar(v_rem.nota);
end $$;

-- Nota del nivel: usa los valores exactos de cada módulo (sin redondeos intermedios) y devuelve la nota oficial una sola vez.
create or replace function public.eval_calc_nivel(p_salon uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_c public.eval_consolidacion; v_m record; v_r jsonb; v_mods jsonb := '[]'::jsonb;
  v_puntos numeric := 0; v_escala_total numeric := 0; v_escala_eval numeric := 0;
  v_suma_nota numeric := 0; v_suma_aporte numeric := 0; v_parcial boolean := false; v_sin integer := 0; v_exacta numeric;
begin
  select * into v_c from public.eval_consolidacion where salon_id = p_salon;
  if not found or v_c.metodo = 'sin_definir' then
    return jsonb_build_object('definido', false, 'metodo', 'sin_definir', 'confirmada', false);
  end if;
  for v_m in select id, aporte_nivel from public.eval_modulos where salon_id = p_salon order by orden loop
    v_r := public.eval_modulo_efectivo(v_m.id, p_alumno);
    if (v_r->>'sin_plantilla')::boolean then v_sin := v_sin + 1; v_parcial := true; continue; end if;
    v_mods := v_mods || jsonb_build_object('modulo_id', v_m.id, 'nombre', v_r->>'nombre', 'nota', v_r->'nota', 'parcial', v_r->'parcial');
    v_puntos := v_puntos + coalesce((v_r->>'puntos_exactos')::numeric, (v_r->>'puntos')::numeric);
    v_escala_total := v_escala_total + (v_r->>'peso_total')::numeric;
    v_escala_eval := v_escala_eval + (v_r->>'peso_evaluado')::numeric;
    if (v_r->>'parcial')::boolean then v_parcial := true; end if;
    if (v_r->>'peso_evaluado')::numeric > 0 then
      v_suma_nota := v_suma_nota + v_m.aporte_nivel * coalesce((v_r->>'nota_exacta')::numeric, (v_r->>'nota')::numeric);
      v_suma_aporte := v_suma_aporte + v_m.aporte_nivel;
    end if;
  end loop;
  if v_c.metodo = 'suma_puntos' then
    v_exacta := case when v_escala_eval > 0 then v_puntos / v_escala_eval * 100 end;
  else
    v_exacta := case when v_suma_aporte > 0 then v_suma_nota / v_suma_aporte end;
  end if;
  return jsonb_build_object('definido', true, 'metodo', v_c.metodo, 'confirmada', v_c.confirmada, 'nota', round(v_exacta, 2), 'nota_exacta', v_exacta,
                            'parcial', v_parcial or jsonb_array_length(v_mods) = 0, 'modulos_sin_plantilla', v_sin, 'modulos', v_mods,
                            'definitiva', v_c.confirmada and not (v_parcial or jsonb_array_length(v_mods) = 0))
         || coalesce(public.eval_clasificar(v_exacta), '{}'::jsonb);
end $$;

-- Celda de la matriz: igual que antes; la nota de las evaluaciones sin Formative sale del mismo cálculo (Writing ponderado por tarea).
create or replace function public.eval_celda(p_evaluacion uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_e public.eval_evaluaciones; v_c public.eval_componentes; v_n integer; v_pub integer; v_bor integer; v_prom numeric; v_pt numeric; v_r jsonb; v_estado text;
  v_pp numeric; v_uni jsonb; v_nu integer; v_nu_reg integer; v_nu_pub integer; v_prom_u numeric; v_part_pub numeric; v_part_prov numeric;
  v_hay_part boolean; v_completa boolean; v_prov numeric; v_wu numeric; v_wp numeric;
begin
  select * into v_e from public.eval_evaluaciones where id = p_evaluacion;
  select * into v_c from public.eval_componentes where id = v_e.componente_id;
  if v_c.tipo = 'participacion' then
    v_r := public.eval_part_resumen(p_evaluacion, p_alumno);
    select k.puntaje into v_pt from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = p_alumno and k.unidad = '' and k.estado = 'publicada';
    if v_pt is not null then v_estado := 'publicada';
    elsif (v_r->>'total')::integer = 0 then v_estado := 'sin_clases';
    elsif (v_r->>'registradas')::integer = 0 then v_estado := 'sin_nota';
    elsif (v_r->>'registradas')::integer < (v_r->>'total')::integer then v_estado := 'en_curso';
    else v_estado := 'listo'; v_pt := round((v_r->>'cumplidas')::numeric / (v_r->>'total')::numeric * 100, 2);
    end if;
    return v_r || jsonb_build_object('tipo', 'participacion', 'estado', v_estado, 'puntaje', v_pt, 'aporte', case when v_pt is not null then round(v_c.peso * v_pt / 100, 2) end);
  end if;

  if v_c.tipo = 'formative' and cardinality(v_e.unidades) > 0 then
    v_pp := coalesce(v_c.peso_participacion, 0) / 100;
    v_hay_part := v_pp > 0;
    v_nu := cardinality(v_e.unidades);
    select count(*) filter (where k.estado = 'publicada'), count(*), avg(k.puntaje), avg(k.puntaje) filter (where k.estado = 'publicada')
      into v_nu_pub, v_nu_reg, v_prom_u, v_pt
      from public.eval_calificaciones k
     where k.evaluacion_id = p_evaluacion and k.alumno_id = p_alumno and k.puntaje is not null and k.unidad = any (v_e.unidades);
    select coalesce(jsonb_agg(jsonb_build_object('unidad', u.nombre, 'puntaje', k.puntaje, 'estado', coalesce(k.estado, 'sin_nota')) order by u.n), '[]'::jsonb)
      into v_uni
      from unnest(v_e.unidades) with ordinality u(nombre, n)
      left join public.eval_calificaciones k on k.evaluacion_id = p_evaluacion and k.alumno_id = p_alumno and k.unidad = u.nombre;
    v_r := case when v_hay_part then public.eval_part_resumen(p_evaluacion, p_alumno) else jsonb_build_object('total', 0, 'hechas', 0, 'registradas', 0, 'cumplidas', 0) end;
    select k.puntaje into v_part_pub from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = p_alumno and k.unidad = '' and k.estado = 'publicada';
    v_part_prov := case when v_part_pub is not null then v_part_pub
                        when (v_r->>'registradas')::integer > 0 then round((v_r->>'cumplidas')::numeric / (v_r->>'registradas')::numeric * 100, 2) end;
    v_completa := v_nu_pub >= v_nu and (not v_hay_part or v_part_pub is not null);
    v_wu := case when v_nu_reg > 0 then 1 - v_pp end;
    v_wp := case when v_hay_part and v_part_prov is not null then v_pp end;
    v_prov := case when coalesce(v_wu, 0) + coalesce(v_wp, 0) > 0
                   then round((coalesce(v_wu * v_prom_u, 0) + coalesce(v_wp * v_part_prov, 0)) / (coalesce(v_wu, 0) + coalesce(v_wp, 0)), 2) end;
    v_estado := case when v_completa then 'publicada'
                     when v_nu_reg >= v_nu and (not v_hay_part or ((v_r->>'total')::integer > 0 and (v_r->>'registradas')::integer >= (v_r->>'total')::integer)) then 'listo'
                     when v_prov is not null then 'en_curso'
                     else 'sin_nota' end;
    return jsonb_build_object('tipo', 'formative', 'estado', v_estado,
      'puntaje', case when v_completa then round((1 - v_pp) * v_pt + v_pp * coalesce(v_part_pub, 0), 2) else v_prov end,
      'aporte', case when v_completa then round(v_c.peso * ((1 - v_pp) * v_pt + v_pp * coalesce(v_part_pub, 0)) / 100, 2) end,
      'provisional', not v_completa,
      'peso_participacion', v_c.peso_participacion,
      'unidades', v_uni, 'unidades_total', v_nu, 'unidades_registradas', v_nu_reg, 'unidades_publicadas', v_nu_pub,
      'promedio_unidades', round(v_prom_u, 2),
      'participacion', v_r || jsonb_build_object('puntaje', v_part_prov, 'publicada', v_part_pub is not null, 'aplica', v_hay_part));
  end if;

  v_n := greatest(1, cardinality(v_e.unidades));
  select count(*) filter (where k.estado = 'publicada'), count(*) filter (where k.estado = 'borrador')
    into v_pub, v_bor
    from public.eval_calificaciones k
   where k.evaluacion_id = p_evaluacion and k.alumno_id = p_alumno and k.puntaje is not null
     and k.unidad = any (case when cardinality(v_e.unidades) = 0 then array[''] else v_e.unidades end);
  v_prom := public.eval_nota_componente(p_evaluacion, p_alumno, true);
  v_estado := case when v_pub >= v_n then 'publicada' when v_pub + v_bor >= v_n then 'borrador' when v_pub + v_bor > 0 then 'parcial' else 'sin_nota' end;
  v_pt := case when v_pub + v_bor >= v_n then round(v_prom, 2) end;
  return jsonb_build_object('tipo', v_c.tipo, 'estado', v_estado, 'puntaje', v_pt, 'aporte', case when v_pt is not null then round(v_c.peso * v_pt / 100, 2) end,
                            'unidades_total', v_n, 'unidades_registradas', v_pub + v_bor, 'unidades_publicadas', v_pub);
end $$;

-- ============================================================
-- 7. Permisos: las ayudas son internas; las funciones que ya se llamaban desde la aplicación conservan los suyos
-- ============================================================
revoke execute on function
  public.eval_prefijo_unidad(text), public.eval_criterios_unidad(uuid, text), public.eval_criterio_por_niveles(jsonb),
  public.eval_validar_puntaje_criterio(public.eval_rubrica_criterios, numeric), public.eval_nota_exacta(numeric, jsonb),
  public.eval_tareas_evaluacion(uuid), public.eval_nota_componente(uuid, uuid, boolean), public.eval_clasificar(numeric),
  public.eval_tareas_unidades(), public.eval_resolver_nota(uuid, numeric, jsonb, text),
  public.eval_calc_modulo(uuid, uuid), public.eval_modulo_efectivo(uuid, uuid), public.eval_calc_nivel(uuid, uuid), public.eval_celda(uuid, uuid)
  from public, anon, authenticated;

commit;
