-- UNIVERSA · Writing Assessment como examen del banco de ejercicios.
--
--  * Un ejercicio Writing del banco puede ser un EXAMEN de dos tareas (contenido.modo = 'assessment': Task 1 y Task 2, con tiempo límite).
--  * Se asigna a un salón vinculado al Writing de un módulo (eval_writing_vinculos). Un solo intento: el estudiante lo inicia una vez, el reloj
--    corre en el servidor y solo se puede enviar una vez. Las consignas no llegan al navegador hasta que inicia.
--  * Cada vez que el estudiante sale de la página queda registrado (ejercicio_examenes.salidas) y el docente lo ve al revisar.
--  * La revisión es MANUAL: el docente califica cada tarea con los criterios de la rúbrica «Writing Assessment». La nota queda como BORRADOR en
--    eval_calificaciones (unidad «Task 1» / «Task 2»); se publica desde la Grade matrix o Quick entry como cualquier nota. Nada se publica solo.
--
-- Repetible. Requiere el banco de ejercicios, el motor de rúbricas (20261208100000) y el Formative (20261128100000).

begin;

create table if not exists public.eval_writing_vinculos (
  asignacion_id uuid primary key references public.ejercicio_asignaciones(id) on delete cascade,
  evaluacion_id uuid not null references public.eval_evaluaciones(id) on delete cascade,
  minutos integer not null check (minutos between 5 and 240),
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists eval_writing_vinculos_eval_idx on public.eval_writing_vinculos (evaluacion_id);

create table if not exists public.ejercicio_examenes (
  asignacion_id uuid not null references public.ejercicio_asignaciones(id) on delete cascade,
  alumno_id uuid not null references public.alumnos(id),
  iniciado_at timestamptz not null default now(),
  limite_at timestamptz not null,
  salidas integer not null default 0,
  primary key (asignacion_id, alumno_id)
);

alter table public.eval_writing_vinculos enable row level security;
alter table public.ejercicio_examenes enable row level security;
revoke all on public.eval_writing_vinculos, public.ejercicio_examenes from anon, authenticated;

-- ============================================================
-- Docente: módulos con Writing por tareas y asignación del examen
-- ============================================================
create or replace function public.writing_opciones(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'evaluacion_id', e.id, 'modulo', m.nombre, 'nombre', e.nombre, 'unidades', to_jsonb(e.unidades),
      'asignado', exists (select 1 from public.eval_writing_vinculos v join public.ejercicio_asignaciones a on a.id = v.asignacion_id and a.activa where v.evaluacion_id = e.id))
      order by m.orden, m.nombre)
    from public.eval_evaluaciones e
    join public.eval_modulos m on m.id = e.modulo_id
    join public.eval_componentes c on c.id = e.componente_id
   where m.salon_id = p_salon and c.tipo = 'writing' and e.unidades @> array['Task 1', 'Task 2']), '[]'::jsonb);
end $$;

create or replace function public.asignar_writing_assessment(p_ejercicio uuid, p_salon uuid, p_evaluacion uuid, p_minutos integer, p_limite date default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_e public.ejercicios; v_ev public.eval_evaluaciones; v_id uuid;
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_e from public.ejercicios where id = p_ejercicio and activo and (publico or autor_user_id = (select auth.uid()));
  if not found then raise exception 'El ejercicio no está disponible'; end if;
  if v_e.tipo <> 'writing' or coalesce(v_e.contenido->>'modo', '') <> 'assessment' then raise exception 'Este ejercicio no es un Writing Assessment'; end if;
  if p_minutos is null or p_minutos < 5 or p_minutos > 240 then raise exception 'El tiempo límite debe estar entre 5 y 240 minutos'; end if;
  if public.eval_salon_de(p_evaluacion) is distinct from p_salon then raise exception 'El módulo elegido no pertenece a este salón'; end if;
  select * into v_ev from public.eval_evaluaciones where id = p_evaluacion;
  if not exists (select 1 from public.eval_componentes c where c.id = v_ev.componente_id and c.tipo = 'writing') or not (v_ev.unidades @> array['Task 1', 'Task 2']) then
    raise exception 'Ese módulo no tiene un Writing por tareas (Task 1 y Task 2)';
  end if;
  if exists (select 1 from public.eval_writing_vinculos v join public.ejercicio_asignaciones a on a.id = v.asignacion_id and a.activa where v.evaluacion_id = p_evaluacion) then
    raise exception 'Este Writing ya tiene un examen asignado: quítalo antes de asignar otro';
  end if;
  insert into public.ejercicio_asignaciones (ejercicio_id, salon_id, titulo, tipo, contenido, clave, fecha_limite, asignado_por)
  values (v_e.id, p_salon, v_e.titulo, v_e.tipo, v_e.contenido, null, p_limite, (select auth.uid()))
  returning id into v_id;
  insert into public.eval_writing_vinculos (asignacion_id, evaluacion_id, minutos, creado_por) values (v_id, p_evaluacion, p_minutos, (select auth.uid()));
  return v_id;
end $$;

-- ============================================================
-- Estudiante: iniciar (una vez), registrar salidas y enviar
-- ============================================================
-- Devuelve las consignas y el reloj. Volver a llamarla (p. ej. al recargar la página) devuelve el mismo límite: el tiempo no se reinicia.
create or replace function public.examen_iniciar(p_asignacion uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_a public.ejercicio_asignaciones; v_v public.eval_writing_vinculos; v_alumno uuid := public.alumno_actual(); v_x public.ejercicio_examenes;
begin
  select * into v_a from public.ejercicio_asignaciones where id = p_asignacion and activa;
  if not found then raise exception 'Este examen ya no está disponible'; end if;
  if v_alumno is null or not public.es_estudiante_de(v_a.salon_id) then raise exception 'No tienes acceso a este examen' using errcode = '42501'; end if;
  select * into v_v from public.eval_writing_vinculos where asignacion_id = p_asignacion;
  if not found then raise exception 'Este ejercicio no es un examen'; end if;
  if exists (select 1 from public.ejercicio_entregas where asignacion_id = p_asignacion and alumno_id = v_alumno) then raise exception 'Ya enviaste este examen'; end if;
  insert into public.ejercicio_examenes (asignacion_id, alumno_id, limite_at) values (p_asignacion, v_alumno, now() + make_interval(mins => v_v.minutos))
  on conflict (asignacion_id, alumno_id) do nothing;
  select * into v_x from public.ejercicio_examenes where asignacion_id = p_asignacion and alumno_id = v_alumno;
  return jsonb_build_object('iniciado_at', v_x.iniciado_at, 'limite_at', v_x.limite_at, 'ahora', now(), 'minutos', v_v.minutos, 'salidas', v_x.salidas,
                            'tareas', v_a.contenido->'tareas', 'instrucciones', v_a.contenido->'instrucciones');
end $$;

create or replace function public.examen_registrar_salida(p_asignacion uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_alumno uuid := public.alumno_actual(); v_n integer;
begin
  if v_alumno is null then return null; end if;
  update public.ejercicio_examenes x set salidas = x.salidas + 1
   where x.asignacion_id = p_asignacion and x.alumno_id = v_alumno
     and not exists (select 1 from public.ejercicio_entregas e where e.asignacion_id = p_asignacion and e.alumno_id = v_alumno)
  returning x.salidas into v_n;
  return v_n;
end $$;

-- Igual que la versión del banco, con una rama para el examen: exige haberlo iniciado, guarda las dos tareas y marca si se envió fuera de tiempo.
create or replace function public.entregar_ejercicio(p_asignacion uuid, p_respuestas jsonb, p_audio text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_a public.ejercicio_asignaciones;
  v_alumno uuid := public.alumno_actual();
  v_n integer; i integer; v_ok integer := 0; v_good boolean; v_resp text; v_acc text;
  v_det jsonb := '[]'::jsonb; v_puntaje numeric;
  v_v public.eval_writing_vinculos; v_x public.ejercicio_examenes; v_t1 text; v_t2 text;
begin
  select * into v_a from public.ejercicio_asignaciones where id = p_asignacion and activa;
  if not found then raise exception 'Este ejercicio ya no está disponible'; end if;
  if v_alumno is null or not public.es_estudiante_de(v_a.salon_id) then raise exception 'No tienes acceso a este ejercicio' using errcode = '42501'; end if;
  if exists (select 1 from public.ejercicio_entregas where asignacion_id = p_asignacion and alumno_id = v_alumno) then
    raise exception 'Ya enviaste este ejercicio';
  end if;

  if v_a.tipo = 'writing' then
    select * into v_v from public.eval_writing_vinculos where asignacion_id = p_asignacion;
    if found then
      select * into v_x from public.ejercicio_examenes where asignacion_id = p_asignacion and alumno_id = v_alumno;
      if not found then raise exception 'Inicia el examen antes de enviarlo'; end if;
      v_t1 := btrim(coalesce(p_respuestas->'tareas'->0->>'texto', ''));
      v_t2 := btrim(coalesce(p_respuestas->'tareas'->1->>'texto', ''));
      if v_t1 = '' and v_t2 = '' then raise exception 'Escribe tu respuesta antes de enviar'; end if;
      insert into public.ejercicio_entregas (asignacion_id, alumno_id, respuestas, estado)
      values (p_asignacion, v_alumno,
              jsonb_build_object('tareas', jsonb_build_array(jsonb_build_object('texto', v_t1), jsonb_build_object('texto', v_t2)),
                                 'salidas', v_x.salidas,
                                 'fuera_de_tiempo', now() > v_x.limite_at + interval '90 seconds',
                                 'segundos', extract(epoch from (now() - v_x.iniciado_at))::integer),
              'pendiente');
      return jsonb_build_object('estado', 'pendiente');
    end if;
    if btrim(coalesce(p_respuestas->>'texto', '')) = '' then raise exception 'Escribe tu respuesta antes de enviar'; end if;
    insert into public.ejercicio_entregas (asignacion_id, alumno_id, respuestas, estado) values (p_asignacion, v_alumno, jsonb_build_object('texto', p_respuestas->>'texto'), 'pendiente');
    return jsonb_build_object('estado', 'pendiente');
  elsif v_a.tipo = 'speaking' then
    if p_audio is null or split_part(p_audio, '/', 1) <> p_asignacion::text or split_part(p_audio, '/', 2) <> (select auth.uid())::text then
      raise exception 'Graba tu respuesta antes de enviar';
    end if;
    insert into public.ejercicio_entregas (asignacion_id, alumno_id, respuestas, audio_path, estado) values (p_asignacion, v_alumno, '{}'::jsonb, p_audio, 'pendiente');
    return jsonb_build_object('estado', 'pendiente');
  end if;

  if v_a.clave is null or jsonb_typeof(p_respuestas) <> 'array' then raise exception 'Respuestas no válidas'; end if;
  v_n := jsonb_array_length(v_a.clave->'items');
  for i in 0 .. v_n - 1 loop
    v_resp := p_respuestas->>i;
    v_good := false;
    if public.ej_norm(v_resp) <> '' then
      for v_acc in select t.value from jsonb_array_elements_text(v_a.clave->'items'->i) as t(value) loop
        if public.ej_norm(v_acc) = public.ej_norm(v_resp) then v_good := true; end if;
      end loop;
    end if;
    if v_good then v_ok := v_ok + 1; end if;
    v_det := v_det || jsonb_build_array(jsonb_build_object('ok', v_good, 'correcta', v_a.clave->'items'->i->>0, 'respuesta', v_resp));
  end loop;
  v_puntaje := case when v_n = 0 then 0 else round(100.0 * v_ok / v_n, 2) end;
  insert into public.ejercicio_entregas (asignacion_id, alumno_id, respuestas, estado, puntaje, correctas, total, detalle)
  values (p_asignacion, v_alumno, p_respuestas, 'autocalificada', v_puntaje, v_ok, v_n, v_det);
  return jsonb_build_object('estado', 'autocalificada', 'puntaje', v_puntaje, 'correctas', v_ok, 'total', v_n, 'detalle', v_det);
end $$;

-- Lista del estudiante: en un examen NO se envían las consignas (llegan al iniciar) y se agrega el estado del reloj.
create or replace function public.portal_ejercicios(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_alumno uuid := public.alumno_actual();
begin
  if not public.es_estudiante_de(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'titulo', a.titulo, 'tipo', a.tipo,
      'contenido', case when w.asignacion_id is not null then a.contenido - 'tareas' else a.contenido end,
      'fecha_limite', a.fecha_limite, 'creada', a.created_at,
      'formative', public.formative_etiqueta(a.id),
      'examen', case when w.asignacion_id is not null then jsonb_build_object('minutos', w.minutos, 'iniciado_at', x.iniciado_at, 'limite_at', x.limite_at, 'ahora', now(), 'salidas', coalesce(x.salidas, 0)) end,
      'entrega', case when e.id is null then null else jsonb_build_object(
        'estado', e.estado, 'puntaje', case when w.asignacion_id is null then e.puntaje end, 'correctas', e.correctas, 'total', e.total, 'detalle', case when w.asignacion_id is null then e.detalle end,
        'respuestas', e.respuestas, 'audio_path', e.audio_path, 'feedback', case when w.asignacion_id is null then e.feedback end, 'entregado_at', e.entregado_at) end)
      order by a.created_at desc)
    from public.ejercicio_asignaciones a
    left join public.eval_writing_vinculos w on w.asignacion_id = a.id
    left join public.ejercicio_examenes x on x.asignacion_id = a.id and x.alumno_id = v_alumno
    left join public.ejercicio_entregas e on e.asignacion_id = a.id and e.alumno_id = v_alumno
    where a.salon_id = p_salon and a.activa), '[]'::jsonb);
end $$;

-- Lista del salón: agrega los minutos del examen (null si no es un examen).
create or replace function public.ejercicios_salon(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'titulo', a.titulo, 'tipo', a.tipo, 'fecha_limite', a.fecha_limite, 'creada', a.created_at,
      'entregas', (select count(*) from public.ejercicio_entregas e where e.asignacion_id = a.id),
      'pendientes', (select count(*) from public.ejercicio_entregas e where e.asignacion_id = a.id and e.estado = 'pendiente'),
      'promedio', (select round(avg(e.puntaje), 1) from public.ejercicio_entregas e where e.asignacion_id = a.id and e.puntaje is not null),
      'total', (select count(*) from public.matriculas m where m.salon_id = a.salon_id and m.estado = 'activa'),
      'formative', public.formative_etiqueta(a.id),
      'examen_minutos', (select w.minutos from public.eval_writing_vinculos w where w.asignacion_id = a.id))
      order by a.created_at desc)
    from public.ejercicio_asignaciones a where a.salon_id = p_salon and a.activa), '[]'::jsonb);
end $$;

-- ============================================================
-- Docente: revisión por tarea
-- ============================================================
create or replace function public.writing_assessment_revision(p_asignacion uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_a public.ejercicio_asignaciones; v_v public.eval_writing_vinculos; v_ev public.eval_evaluaciones; v_rub uuid; v_mod text;
begin
  select * into v_a from public.ejercicio_asignaciones where id = p_asignacion and activa;
  if not found then raise exception 'La asignación ya no existe'; end if;
  if not public.puede_gestionar_curso(v_a.salon_id) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_v from public.eval_writing_vinculos where asignacion_id = p_asignacion;
  if not found then raise exception 'Esta actividad no es un Writing Assessment'; end if;
  select * into v_ev from public.eval_evaluaciones where id = v_v.evaluacion_id;
  select c.rubrica_id into v_rub from public.eval_componentes c where c.id = v_ev.componente_id;
  select nombre into v_mod from public.eval_modulos where id = v_ev.modulo_id;
  return jsonb_build_object(
    'asignacion', jsonb_build_object('id', v_a.id, 'titulo', v_a.titulo, 'contenido', v_a.contenido, 'fecha_limite', v_a.fecha_limite),
    'minutos', v_v.minutos, 'evaluacion_id', v_ev.id, 'modulo', v_mod, 'unidades', to_jsonb(v_ev.unidades),
    'rubrica', (select jsonb_build_object('id', r.id, 'nombre', r.nombre,
                  'criterios', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'descripcion', c.descripcion, 'max_puntaje', c.max_puntaje,
                                                                           'bandas', c.bandas, 'niveles_mcer', c.niveles_mcer) order by c.orden), '[]'::jsonb)
                                  from public.eval_rubrica_criterios c where c.rubrica_id = r.id))
                  from public.eval_rubricas r where r.id = v_rub),
    'filas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'alumno_id', al.id, 'nombre', al.nombre,
        'examen', case when x.alumno_id is null then null else jsonb_build_object('iniciado_at', x.iniciado_at, 'limite_at', x.limite_at, 'salidas', x.salidas) end,
        'entrega', case when e.id is null then null else jsonb_build_object('id', e.id, 'estado', e.estado, 'respuestas', e.respuestas, 'entregado_at', e.entregado_at) end,
        'notas', coalesce((select jsonb_object_agg(k.unidad, jsonb_build_object('puntaje', k.puntaje, 'estado', k.estado, 'detalle', k.detalle, 'comentario', k.comentario))
                             from public.eval_calificaciones k where k.evaluacion_id = v_ev.id and k.alumno_id = al.id and k.unidad in ('Task 1', 'Task 2')), '{}'::jsonb))
        order by al.nombre)
      from public.matriculas m join public.alumnos al on al.id = m.alumno_id
      left join public.ejercicio_examenes x on x.asignacion_id = p_asignacion and x.alumno_id = al.id
      left join public.ejercicio_entregas e on e.asignacion_id = p_asignacion and e.alumno_id = al.id
      where m.salon_id = v_a.salon_id and m.estado = 'activa'), '[]'::jsonb));
end $$;

-- Califica UNA tarea con los criterios de la rúbrica. La nota queda como borrador en la matriz; publicar es un paso aparte del docente.
create or replace function public.calificar_writing_task(p_entrega uuid, p_tarea text, p_detalle jsonb, p_feedback text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_e public.ejercicio_entregas; v_a public.ejercicio_asignaciones; v_v public.eval_writing_vinculos; v_ev public.eval_evaluaciones;
  v_k public.eval_calificaciones; v_r jsonb; v_p numeric; v_com text := nullif(btrim(coalesce(p_feedback, '')), ''); v_hechas integer;
begin
  select * into v_e from public.ejercicio_entregas where id = p_entrega for update;
  if not found then raise exception 'La entrega ya no existe'; end if;
  select * into v_a from public.ejercicio_asignaciones where id = v_e.asignacion_id;
  if not public.puede_gestionar_curso(v_a.salon_id) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_v from public.eval_writing_vinculos where asignacion_id = v_a.id;
  if not found then raise exception 'Esta entrega no es de un Writing Assessment'; end if;
  select * into v_ev from public.eval_evaluaciones where id = v_v.evaluacion_id;
  if p_tarea is null or p_tarea not in ('Task 1', 'Task 2') or not (p_tarea = any (v_ev.unidades)) then raise exception 'Tarea no válida'; end if;
  select * into v_k from public.eval_calificaciones where evaluacion_id = v_ev.id and alumno_id = v_e.alumno_id and unidad = p_tarea for update;
  if found and v_k.estado = 'publicada' then raise exception 'La nota de % ya está publicada: corrígela desde la Grade matrix indicando el motivo', p_tarea; end if;

  v_r := public.eval_resolver_nota(v_ev.componente_id, null, p_detalle, p_tarea);
  v_p := (v_r->>'puntaje')::numeric;
  if v_p is null then raise exception 'Califica todos los criterios de la tarea'; end if;

  insert into public.eval_calificaciones (evaluacion_id, alumno_id, unidad, puntaje, comentario, detalle, estado, updated_by)
  values (v_ev.id, v_e.alumno_id, p_tarea, v_p, v_com, case when jsonb_typeof(v_r->'detalle') = 'null' then null else v_r->'detalle' end, 'borrador', (select auth.uid()))
  on conflict (evaluacion_id, alumno_id, unidad) do update
    set puntaje = excluded.puntaje, comentario = excluded.comentario, detalle = excluded.detalle, updated_at = now(), updated_by = excluded.updated_by;

  select count(*) into v_hechas from public.eval_calificaciones where evaluacion_id = v_ev.id and alumno_id = v_e.alumno_id and unidad in ('Task 1', 'Task 2');
  update public.ejercicio_entregas
     set detalle = coalesce(detalle, '{}'::jsonb) || jsonb_build_object('tareas', coalesce(detalle->'tareas', '{}'::jsonb) || jsonb_build_object(p_tarea, jsonb_build_object('puntaje', v_p, 'revisada_at', now()))),
         estado = case when v_hechas >= 2 then 'revisada' else estado end,
         calificado_por = (select auth.uid()), calificado_at = now()
   where id = p_entrega;
  return jsonb_build_object('puntaje', v_p, 'completa', v_hechas >= 2);
end $$;

revoke execute on function public.writing_opciones(uuid), public.asignar_writing_assessment(uuid, uuid, uuid, integer, date),
  public.examen_iniciar(uuid), public.examen_registrar_salida(uuid), public.writing_assessment_revision(uuid),
  public.calificar_writing_task(uuid, text, jsonb, text) from public, anon;
grant execute on function public.writing_opciones(uuid), public.asignar_writing_assessment(uuid, uuid, uuid, integer, date),
  public.examen_iniciar(uuid), public.examen_registrar_salida(uuid), public.writing_assessment_revision(uuid),
  public.calificar_writing_task(uuid, text, jsonb, text) to authenticated;
-- Las funciones reemplazadas conservan sus permisos, pero se reafirman por si la base los reinició.
revoke execute on function public.entregar_ejercicio(uuid, jsonb, text), public.portal_ejercicios(uuid), public.ejercicios_salon(uuid) from public, anon;
grant execute on function public.entregar_ejercicio(uuid, jsonb, text), public.portal_ejercicios(uuid), public.ejercicios_salon(uuid) to authenticated;

commit;
