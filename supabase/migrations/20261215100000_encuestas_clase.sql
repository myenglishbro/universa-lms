-- UNIVERSA · Encuesta de experiencia de clase.
-- En cada clase, el estudiante responde 4 preguntas tipo Likert (1 a 5) y un comentario opcional. Está disponible desde que la clase
-- empieza (el docente puede pedirles que la completen durante la clase) y hasta 7 días después.
-- Solo administración ve las respuestas, con el nombre de cada estudiante: ni el docente ni otros estudiantes las ven.
-- Administración compara docentes por período y mes a mes.

create table if not exists public.clase_encuestas (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references public.salon_sesiones(id) on delete cascade,
  salon_id uuid not null references public.salones(id) on delete cascade,
  docente_id uuid references public.docentes(id) on delete set null, -- el docente del salón cuando se respondió
  alumno_id uuid not null references public.alumnos(id) on delete cascade,
  claridad smallint not null check (claridad between 1 and 5),
  participacion smallint not null check (participacion between 1 and 5),
  ritmo smallint not null check (ritmo between 1 and 5),
  general smallint not null check (general between 1 and 5),
  comentario text check (comentario is null or length(comentario) <= 1000),
  created_at timestamptz not null default now(),
  unique (sesion_id, alumno_id)
);
create index if not exists clase_encuestas_docente_idx on public.clase_encuestas (docente_id, created_at);

-- Sin acceso directo: todo pasa por las funciones de abajo.
alter table public.clase_encuestas enable row level security;
revoke all on public.clase_encuestas from anon, authenticated;

-- ¿Puede este estudiante calificar esta clase? Está matriculado, la clase no se canceló, ya empezó (o pasó) y fue en los últimos 7 días,
-- y no figura como ausente o justificado. No exige que el docente ya haya registrado la clase: se puede responder durante ella.
create or replace function public.encuesta_elegible(p_alumno uuid, p_sesion uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.salon_sesiones q
      join public.salones s on s.id = q.salon_id and s.docente_id is not null and s.archivado_at is null
     where q.id = p_sesion
       and q.estado <> 'cancelada'
       and q.fecha between public.hoy_lima() - 7 and public.hoy_lima()
       and (q.fecha < public.hoy_lima() or q.hora_inicio <= (now() at time zone 'America/Lima')::time)
       and exists (select 1 from public.asist_roster(p_sesion) r where r.alumno_id = p_alumno)
       and not exists (select 1 from public.asistencias a where a.sesion_id = q.id and a.alumno_id = p_alumno and a.estado in ('ausente', 'justificado')))
$$;
revoke execute on function public.encuesta_elegible(uuid, uuid) from public, anon, authenticated;

-- ============================================================
-- 1. Estudiante: la clase pendiente de encuesta más reciente (null = ninguna)
-- ============================================================
create or replace function public.portal_encuesta_pendiente() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_alumno uuid;
  v_q record;
begin
  select cr.alumno_id into v_alumno from public.cuenta_roles cr where cr.user_id = (select auth.uid()) and cr.rol = 'estudiante';
  if v_alumno is null then return null; end if;
  select q.id, q.fecha, s.nombre as salon, d.nombre as docente, r.tema
    into v_q
    from public.matriculas m
    join public.salon_sesiones q on q.salon_id = m.salon_id and q.fecha between public.hoy_lima() - 7 and public.hoy_lima()
    join public.salones s on s.id = q.salon_id
    left join public.docentes d on d.id = s.docente_id
    left join public.clase_registros r on r.sesion_id = q.id
   where m.alumno_id = v_alumno
     and not exists (select 1 from public.clase_encuestas e where e.sesion_id = q.id and e.alumno_id = v_alumno)
     and public.encuesta_elegible(v_alumno, q.id)
   order by q.fecha desc, q.hora_inicio desc
   limit 1;
  if v_q.id is null then return null; end if;
  return jsonb_build_object('sesion_id', v_q.id, 'fecha', v_q.fecha, 'salon', v_q.salon, 'docente', v_q.docente, 'tema', v_q.tema);
end $$;

-- ============================================================
-- 2. Estudiante: responder (una vez por clase)
-- ============================================================
create or replace function public.guardar_encuesta_clase(p_sesion uuid, p_claridad integer, p_participacion integer, p_ritmo integer, p_general integer, p_comentario text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_alumno uuid;
  v_q public.salon_sesiones;
  v_com text := nullif(btrim(coalesce(p_comentario, '')), '');
begin
  select cr.alumno_id into v_alumno from public.cuenta_roles cr where cr.user_id = (select auth.uid()) and cr.rol = 'estudiante';
  if v_alumno is null then raise exception 'Solo los estudiantes pueden responder la encuesta' using errcode = '42501'; end if;
  if p_claridad is null or p_participacion is null or p_ritmo is null or p_general is null
     or least(p_claridad, p_participacion, p_ritmo, p_general) < 1 or greatest(p_claridad, p_participacion, p_ritmo, p_general) > 5 then
    raise exception 'Responde las cuatro preguntas con un valor de 1 a 5';
  end if;
  if length(coalesce(v_com, '')) > 1000 then raise exception 'El comentario es demasiado largo (máximo 1000 caracteres)'; end if;

  select * into v_q from public.salon_sesiones where id = p_sesion;
  if not found or not public.encuesta_elegible(v_alumno, p_sesion) then
    raise exception 'Esa clase no está disponible para tu encuesta';
  end if;

  insert into public.clase_encuestas (sesion_id, salon_id, docente_id, alumno_id, claridad, participacion, ritmo, general, comentario)
  values (p_sesion, v_q.salon_id, (select docente_id from public.salones where id = v_q.salon_id), v_alumno, p_claridad, p_participacion, p_ritmo, p_general, v_com)
  on conflict (sesion_id, alumno_id) do nothing;
end $$;

-- ============================================================
-- 3. Administración: promedios por docente y del equipo en un período (p_dias nulo o 0 = todo el tiempo)
--    El período se cuenta por la FECHA DE LA CLASE. `asistentes` = asistencias (presente o tardanza) a clases realizadas del docente,
--    para calcular qué parte de quienes asistieron respondió.
-- ============================================================
create or replace function public.admin_encuestas_resumen(p_dias integer default 90) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_desde date := case when coalesce(p_dias, 0) > 0 then public.hoy_lima() - p_dias else date '1900-01-01' end;
begin
  if not (select public.es_admin()) then raise exception 'No tienes permisos para realizar esta acción' using errcode = '42501'; end if;
  return jsonb_build_object(
    'docentes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'docente_id', g.docente_id, 'docente', g.nombre, 'n', g.n, 'salones', g.salones,
               'claridad', g.claridad, 'participacion', g.participacion, 'ritmo', g.ritmo, 'general', g.general,
               'con_comentario', g.con_comentario, 'ultima', g.ultima,
               'asistentes', (select count(*) from public.asistencias a
                                join public.salon_sesiones q on q.id = a.sesion_id and q.estado = 'realizada' and q.fecha >= v_desde
                                join public.salones s on s.id = q.salon_id
                               where s.docente_id is not distinct from g.docente_id and a.estado in ('presente', 'tardanza'))) order by g.nombre)
        from (select e.docente_id, coalesce(d.nombre, '(teacher removed)') as nombre, count(*) as n, count(distinct e.salon_id) as salones,
                     round(avg(e.claridad), 2) as claridad, round(avg(e.participacion), 2) as participacion,
                     round(avg(e.ritmo), 2) as ritmo, round(avg(e.general), 2) as general,
                     count(*) filter (where nullif(btrim(e.comentario), '') is not null) as con_comentario, max(e.created_at) as ultima
                from public.clase_encuestas e
                join public.salon_sesiones q on q.id = e.sesion_id
                left join public.docentes d on d.id = e.docente_id
               where q.fecha >= v_desde
               group by e.docente_id, d.nombre) g), '[]'::jsonb),
    'equipo', (
      select jsonb_build_object('n', count(*), 'claridad', round(avg(e.claridad), 2), 'participacion', round(avg(e.participacion), 2),
                                'ritmo', round(avg(e.ritmo), 2), 'general', round(avg(e.general), 2))
        from public.clase_encuestas e join public.salon_sesiones q on q.id = e.sesion_id where q.fecha >= v_desde));
end $$;

-- ============================================================
-- 4. Administración: mes a mes (mes = mes de la clase, 'AAAA-MM'), por docente y para todo el equipo
-- ============================================================
create or replace function public.admin_encuestas_mensual(p_meses integer default 6) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_desde date := (date_trunc('month', public.hoy_lima()::timestamp) - make_interval(months => greatest(coalesce(p_meses, 6), 1) - 1))::date;
begin
  if not (select public.es_admin()) then raise exception 'No tienes permisos para realizar esta acción' using errcode = '42501'; end if;
  return jsonb_build_object(
    'docentes', coalesce((
      select jsonb_agg(jsonb_build_object('docente_id', g.docente_id, 'docente', g.nombre, 'mes', g.mes, 'n', g.n,
                                          'claridad', g.claridad, 'participacion', g.participacion, 'ritmo', g.ritmo, 'general', g.general)
                       order by g.nombre, g.mes)
        from (select e.docente_id, coalesce(d.nombre, '(teacher removed)') as nombre, to_char(q.fecha, 'YYYY-MM') as mes, count(*) as n,
                     round(avg(e.claridad), 2) as claridad, round(avg(e.participacion), 2) as participacion,
                     round(avg(e.ritmo), 2) as ritmo, round(avg(e.general), 2) as general
                from public.clase_encuestas e
                join public.salon_sesiones q on q.id = e.sesion_id
                left join public.docentes d on d.id = e.docente_id
               where q.fecha >= v_desde
               group by e.docente_id, d.nombre, to_char(q.fecha, 'YYYY-MM')) g), '[]'::jsonb),
    'equipo', coalesce((
      select jsonb_agg(jsonb_build_object('mes', t.mes, 'n', t.n, 'claridad', t.claridad, 'participacion', t.participacion, 'ritmo', t.ritmo, 'general', t.general) order by t.mes)
        from (select to_char(q.fecha, 'YYYY-MM') as mes, count(*) as n, round(avg(e.claridad), 2) as claridad, round(avg(e.participacion), 2) as participacion,
                     round(avg(e.ritmo), 2) as ritmo, round(avg(e.general), 2) as general
                from public.clase_encuestas e join public.salon_sesiones q on q.id = e.sesion_id
               where q.fecha >= v_desde group by to_char(q.fecha, 'YYYY-MM')) t), '[]'::jsonb));
end $$;

-- ============================================================
-- 5. Administración: respuestas de cada estudiante a un docente (con su nombre). p_mes opcional ('AAAA-MM').
-- ============================================================
create or replace function public.admin_encuestas_respuestas(p_docente uuid, p_dias integer default 90, p_mes text default null, p_limite integer default 200) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_desde date := case when coalesce(p_dias, 0) > 0 then public.hoy_lima() - p_dias else date '1900-01-01' end;
begin
  if not (select public.es_admin()) then raise exception 'No tienes permisos para realizar esta acción' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(c order by c.clase desc, c.alumno)
      from (select q.fecha as clase, s.nombre as salon, a.nombre as alumno, e.claridad, e.participacion, e.ritmo, e.general, nullif(btrim(e.comentario), '') as comentario
              from public.clase_encuestas e
              join public.salon_sesiones q on q.id = e.sesion_id
              join public.salones s on s.id = e.salon_id
              join public.alumnos a on a.id = e.alumno_id
             where e.docente_id is not distinct from p_docente
               and q.fecha >= v_desde
               and (p_mes is null or to_char(q.fecha, 'YYYY-MM') = p_mes)
             order by q.fecha desc, a.nombre
             limit least(greatest(coalesce(p_limite, 200), 1), 500)) c), '[]'::jsonb);
end $$;

revoke execute on function public.portal_encuesta_pendiente(), public.guardar_encuesta_clase(uuid, integer, integer, integer, integer, text),
  public.admin_encuestas_resumen(integer), public.admin_encuestas_mensual(integer), public.admin_encuestas_respuestas(uuid, integer, text, integer) from public, anon;
grant execute on function public.portal_encuesta_pendiente(), public.guardar_encuesta_clase(uuid, integer, integer, integer, integer, text),
  public.admin_encuestas_resumen(integer), public.admin_encuestas_mensual(integer), public.admin_encuestas_respuestas(uuid, integer, text, integer) to authenticated;
