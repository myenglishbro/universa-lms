-- UNIVERSA · Asistencia y seguimiento académico.
--
--  * Se apoya en lo que ya existe: salon_sesiones (calendario), matriculas (quién cursa), curso_lecciones (grabaciones y
--    materiales del portal) y planes/ciclos. NO crea otro calendario ni otro sistema de recursos.
--  * asistencias(sesion, alumno) → presente / ausente / tardanza / justificado. La clave primaria impide duplicados.
--  * clase_registros(sesion) → tema desarrollado y observaciones. «Registrada» = hay registro y la sesión está realizada.
--    Los materiales de la clase son las lecciones que ya tienen sesion_id = esa sesión (misma relación del portal).
--  * Guardar la clase (registrar_clase) guarda asistencia + registro + materiales de una vez y marca la sesión como realizada
--    si estaba programada y ya ocurrió. Nunca se registra una clase futura.
--  * PERMISOS: escribir = administrador o docente asignado al salón (puede_gestionar_curso). Comercial solo consulta.
--    El estudiante solo lee SU asistencia, el tema y los materiales visibles; no ve observaciones ni a otros estudiantes.
--  * PROGRESO: avance por sesiones realizadas (sobre total_sesiones y, si hay plan, por ciclo). NO calcula aprobación, notas,
--    evaluaciones ni recesos: esas reglas no están confirmadas por Coordinación.
--
-- Repetible. Requiere las migraciones anteriores, incluida 20261113100000_portales.sql.

-- ============================================================
-- 1. Tablas (lectura directa solo para el personal; todo lo demás por funciones)
-- ============================================================
create table if not exists public.clase_registros (
  sesion_id uuid primary key references public.salon_sesiones(id) on delete cascade,
  tema text check (length(tema) <= 300),
  observaciones text check (length(observaciones) <= 3000),
  registrado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asistencias (
  sesion_id uuid not null references public.salon_sesiones(id) on delete cascade,
  alumno_id uuid not null references public.alumnos(id),
  estado text not null check (estado in ('presente', 'ausente', 'tardanza', 'justificado')),
  updated_at timestamptz not null default now(),
  primary key (sesion_id, alumno_id)
);
create index if not exists asistencias_alumno_idx on public.asistencias (alumno_id);

alter table public.clase_registros enable row level security;
alter table public.asistencias enable row level security;
revoke all on public.clase_registros, public.asistencias from anon, authenticated;
grant select on public.clase_registros, public.asistencias to authenticated;
drop policy if exists "personal consulta registros" on public.clase_registros;
create policy "personal consulta registros" on public.clase_registros for select to authenticated using ((select public.tiene_perfil()));
drop policy if exists "personal consulta asistencias" on public.asistencias;
create policy "personal consulta asistencias" on public.asistencias for select to authenticated using ((select public.tiene_perfil()));

-- ============================================================
-- 2. Quiénes deben figurar en una sesión (uso interno)
-- ============================================================
-- Estudiantes con matrícula vigente en la fecha de la sesión, más los que ya tienen asistencia guardada en ella.
create or replace function public.asist_roster(p_sesion uuid) returns table (alumno_id uuid, nombre text)
language sql stable security definer set search_path = '' as $$
  select a.id, a.nombre
    from public.salon_sesiones s
    join public.alumnos a on a.id in (
      select m.alumno_id from public.matriculas m
       where m.salon_id = s.salon_id and m.fecha_inicio <= s.fecha and (m.fecha_fin is null or m.fecha_fin >= s.fecha)
      union
      select x.alumno_id from public.asistencias x where x.sesion_id = s.id)
   where s.id = p_sesion
   order by a.nombre
$$;

-- ============================================================
-- 3. Registrar la clase (asistencia + tema + materiales). Administrador o docente del salón.
-- ============================================================
-- p_asistencia: [{"alumno_id": "...", "estado": "presente|ausente|tardanza|justificado"}, ...] — debe incluir a todos los de la lista.
-- p_materiales: lecciones del propio salón que pertenecen a esta clase; null = no tocar los vínculos actuales.
-- Sirve igual para la primera vez que para corregir.
create or replace function public.registrar_clase(
  p_sesion uuid, p_asistencia jsonb, p_tema text default null, p_observaciones text default null, p_materiales uuid[] default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_s public.salon_sesiones;
  v_tema text := nullif(btrim(coalesce(p_tema, '')), '');
  v_obs text := nullif(btrim(coalesce(p_observaciones, '')), '');
  v_item jsonb;
  v_vistos uuid[] := '{}';
  v_alumno uuid;
  v_estado text;
begin
  select * into v_s from public.salon_sesiones where id = p_sesion;
  if not found then raise exception 'La sesión no existe'; end if;
  if not public.puede_gestionar_curso(v_s.salon_id) then raise exception 'No tienes permisos para registrar esta clase' using errcode = '42501'; end if;
  perform 1 from public.salones where id = v_s.salon_id for update;
  select * into v_s from public.salon_sesiones where id = p_sesion;

  if v_s.estado = 'cancelada' then raise exception 'Una sesión cancelada no tiene asistencia'; end if;
  if v_s.fecha > public.hoy_lima() then raise exception 'No se puede registrar una clase que aún no ocurre'; end if;
  if length(coalesce(v_tema, '')) > 300 then raise exception 'El tema es demasiado largo (máximo 300 caracteres)'; end if;
  if length(coalesce(v_obs, '')) > 3000 then raise exception 'Las observaciones son demasiado largas (máximo 3000 caracteres)'; end if;
  if p_asistencia is null or jsonb_typeof(p_asistencia) <> 'array' then raise exception 'La asistencia debe ser una lista'; end if;

  for v_item in select * from jsonb_array_elements(p_asistencia) loop
    begin
      v_alumno := (v_item->>'alumno_id')::uuid;
    exception when others then
      raise exception 'Identificador de estudiante no válido';
    end;
    v_estado := v_item->>'estado';
    if v_estado is null or v_estado not in ('presente', 'ausente', 'tardanza', 'justificado') then
      raise exception 'Estado de asistencia no válido (usa presente, ausente, tardanza o justificado)';
    end if;
    if v_alumno = any(v_vistos) then raise exception 'Un estudiante está repetido en la asistencia'; end if;
    if not exists (select 1 from public.asist_roster(p_sesion) r where r.alumno_id = v_alumno) then
      raise exception 'Un estudiante de la lista no está matriculado en este salón en la fecha de la clase';
    end if;
    v_vistos := v_vistos || v_alumno;
  end loop;
  if exists (select 1 from public.asist_roster(p_sesion) r where r.alumno_id <> all (v_vistos)) then
    raise exception 'Falta marcar la asistencia de uno o más estudiantes';
  end if;

  if p_materiales is not null and exists (
       select 1 from unnest(p_materiales) m(id)
        where not exists (select 1 from public.curso_lecciones l where l.id = m.id and l.salon_id = v_s.salon_id)) then
    raise exception 'Un material elegido no pertenece a este salón';
  end if;

  insert into public.asistencias (sesion_id, alumno_id, estado)
  select p_sesion, (e->>'alumno_id')::uuid, e->>'estado' from jsonb_array_elements(p_asistencia) e
  on conflict (sesion_id, alumno_id) do update set estado = excluded.estado, updated_at = now();

  insert into public.clase_registros (sesion_id, tema, observaciones, registrado_por)
  values (p_sesion, v_tema, v_obs, (select auth.uid()))
  on conflict (sesion_id) do update set tema = excluded.tema, observaciones = excluded.observaciones, updated_at = now();

  if p_materiales is not null then
    update public.curso_lecciones set sesion_id = null where sesion_id = p_sesion and id <> all (p_materiales);
    update public.curso_lecciones set sesion_id = p_sesion where salon_id = v_s.salon_id and id = any (p_materiales);
  end if;

  if v_s.estado = 'programada' then
    update public.salon_sesiones set estado = 'realizada' where id = p_sesion;
    perform public.cal_actualizar_fin(v_s.salon_id);
  end if;
end $$;

-- ============================================================
-- 4. Lecturas para docente y administración
-- ============================================================
-- Sesiones del salón con su estado de registro: registrada / pendiente (ya ocurrió y falta registrar) / proxima.
create or replace function public.portal_clases_salon(p_salon uuid) returns table (
  sesion_id uuid, numero integer, fecha date, hora_inicio time, hora_fin time, tipo text, estado text, estado_registro text,
  tema text, presentes integer, ausentes integer, tardanzas integer, justificados integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return query
    select s.id, (row_number() over (order by s.fecha, s.hora_inicio))::integer, s.fecha, s.hora_inicio, s.hora_fin, s.tipo, s.estado,
           case when s.estado = 'realizada' and r.sesion_id is not null then 'registrada'
                when s.fecha <= public.hoy_lima() then 'pendiente'
                else 'proxima' end,
           r.tema,
           (select count(*)::integer from public.asistencias a where a.sesion_id = s.id and a.estado = 'presente'),
           (select count(*)::integer from public.asistencias a where a.sesion_id = s.id and a.estado = 'ausente'),
           (select count(*)::integer from public.asistencias a where a.sesion_id = s.id and a.estado = 'tardanza'),
           (select count(*)::integer from public.asistencias a where a.sesion_id = s.id and a.estado = 'justificado')
      from public.salon_sesiones s
      left join public.clase_registros r on r.sesion_id = s.id
     where s.salon_id = p_salon and s.estado <> 'cancelada'
     order by s.fecha, s.hora_inicio;
end $$;

-- Detalle de una sesión para registrar o corregir: lista de estudiantes con su estado actual, tema, observaciones y materiales.
create or replace function public.sesion_registro(p_sesion uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_s public.salon_sesiones;
  v_r public.clase_registros;
begin
  select * into v_s from public.salon_sesiones where id = p_sesion;
  if not found then raise exception 'La sesión no existe'; end if;
  if not public.puede_gestionar_curso(v_s.salon_id) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_r from public.clase_registros where sesion_id = p_sesion;
  return jsonb_build_object(
    'sesion', jsonb_build_object('id', v_s.id, 'salon_id', v_s.salon_id, 'fecha', v_s.fecha, 'hora_inicio', v_s.hora_inicio,
                                 'hora_fin', v_s.hora_fin, 'estado', v_s.estado, 'registrada', (v_s.estado = 'realizada' and v_r.sesion_id is not null),
                                 'futura', v_s.fecha > public.hoy_lima()),
    'tema', v_r.tema,
    'observaciones', v_r.observaciones,
    'alumnos', coalesce((select jsonb_agg(jsonb_build_object('alumno_id', r.alumno_id, 'nombre', r.nombre, 'estado', a.estado) order by r.nombre)
                           from public.asist_roster(p_sesion) r
                           left join public.asistencias a on a.sesion_id = p_sesion and a.alumno_id = r.alumno_id), '[]'::jsonb),
    'materiales', coalesce((select jsonb_agg(l.id order by l.created_at) from public.curso_lecciones l where l.sesion_id = p_sesion), '[]'::jsonb));
end $$;

-- Resumen por estudiante del salón (conteos; no se interpreta ni se califica).
create or replace function public.asistencia_resumen_salon(p_salon uuid) returns table (
  alumno_id uuid, nombre text, matriculado boolean, presentes integer, ausentes integer, tardanzas integer, justificados integer, registradas integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return query
    select a.id, a.nombre,
           exists (select 1 from public.matriculas m where m.alumno_id = a.id and m.salon_id = p_salon and m.estado = 'activa'),
           (select count(*)::integer from public.asistencias x join public.salon_sesiones s on s.id = x.sesion_id where s.salon_id = p_salon and x.alumno_id = a.id and x.estado = 'presente'),
           (select count(*)::integer from public.asistencias x join public.salon_sesiones s on s.id = x.sesion_id where s.salon_id = p_salon and x.alumno_id = a.id and x.estado = 'ausente'),
           (select count(*)::integer from public.asistencias x join public.salon_sesiones s on s.id = x.sesion_id where s.salon_id = p_salon and x.alumno_id = a.id and x.estado = 'tardanza'),
           (select count(*)::integer from public.asistencias x join public.salon_sesiones s on s.id = x.sesion_id where s.salon_id = p_salon and x.alumno_id = a.id and x.estado = 'justificado'),
           (select count(*)::integer from public.asistencias x join public.salon_sesiones s on s.id = x.sesion_id where s.salon_id = p_salon and x.alumno_id = a.id)
      from public.alumnos a
     where a.id in (select m.alumno_id from public.matriculas m where m.salon_id = p_salon
                    union select x.alumno_id from public.asistencias x join public.salon_sesiones s on s.id = x.sesion_id where s.salon_id = p_salon)
     order by 3 desc, a.nombre;
end $$;

-- Asistencia de un estudiante por salón (administración y comercial: ficha del estudiante).
create or replace function public.asistencia_resumen_alumno(p_alumno uuid) returns table (
  salon_id uuid, codigo text, nombre text, matricula text, presentes integer, ausentes integer, tardanzas integer, justificados integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.tiene_perfil() then raise exception 'No tienes permisos para consultar la asistencia' using errcode = '42501'; end if;
  return query
    select s.id, s.codigo, s.nombre,
           case when exists (select 1 from public.matriculas m where m.alumno_id = p_alumno and m.salon_id = s.id and m.estado = 'activa') then 'activa' else 'retirada' end,
           (select count(*)::integer from public.asistencias x join public.salon_sesiones q on q.id = x.sesion_id where q.salon_id = s.id and x.alumno_id = p_alumno and x.estado = 'presente'),
           (select count(*)::integer from public.asistencias x join public.salon_sesiones q on q.id = x.sesion_id where q.salon_id = s.id and x.alumno_id = p_alumno and x.estado = 'ausente'),
           (select count(*)::integer from public.asistencias x join public.salon_sesiones q on q.id = x.sesion_id where q.salon_id = s.id and x.alumno_id = p_alumno and x.estado = 'tardanza'),
           (select count(*)::integer from public.asistencias x join public.salon_sesiones q on q.id = x.sesion_id where q.salon_id = s.id and x.alumno_id = p_alumno and x.estado = 'justificado')
      from public.salones s
     where s.id in (select m.salon_id from public.matriculas m where m.alumno_id = p_alumno)
     order by s.nombre;
end $$;

-- ============================================================
-- 5. Progreso por sesiones (administración, docente del salón y estudiantes matriculados)
-- ============================================================
-- «Realizadas» = sesiones del calendario marcadas como realizadas. Es avance de CALENDARIO, no aprobación académica.
-- Con plan definido se reparte por ciclo según las cuotas de plan_ciclos; sin plan, solo el total del salón (si lo tiene).
create or replace function public.progreso_salon(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_s public.salones;
  v_real integer;
  v_prog integer;
  v_canc integer;
  v_pend integer;
  v_registradas integer;
  v_prox date;
  v_ciclos jsonb := '[]'::jsonb;
begin
  select * into v_s from public.salones where id = p_salon;
  if not found then raise exception 'El salón no existe'; end if;
  if not (public.puede_gestionar_curso(p_salon) or public.es_estudiante_de(p_salon)) then
    raise exception 'No tienes acceso a este salón' using errcode = '42501';
  end if;
  select count(*) filter (where q.estado = 'realizada'),
         count(*) filter (where q.estado = 'programada'),
         count(*) filter (where q.estado = 'cancelada'),
         count(*) filter (where q.estado <> 'cancelada' and q.fecha <= public.hoy_lima() and not (q.estado = 'realizada' and r.sesion_id is not null)),
         count(*) filter (where q.estado = 'realizada' and r.sesion_id is not null),
         min(q.fecha) filter (where q.estado = 'programada' and q.fecha >= public.hoy_lima())
    into v_real, v_prog, v_canc, v_pend, v_registradas, v_prox
    from public.salon_sesiones q left join public.clase_registros r on r.sesion_id = q.id
   where q.salon_id = p_salon;

  if v_s.plan_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('ciclo', c.ciclo, 'sesiones', c.sesiones, 'realizadas', greatest(0, least(c.sesiones, v_real - c.antes))) order by c.ciclo), '[]'::jsonb)
      into v_ciclos
      from (select pc.ciclo, pc.sesiones, (sum(pc.sesiones) over (order by pc.ciclo) - pc.sesiones)::integer as antes
              from public.plan_ciclos pc
             where pc.plan_id = v_s.plan_id and pc.ciclo between v_s.ciclo_desde and v_s.ciclo_hasta) c;
  end if;

  return jsonb_build_object(
    'total', v_s.total_sesiones, 'realizadas', v_real, 'programadas', v_prog, 'canceladas', v_canc,
    'por_registrar', v_pend, 'registradas', v_registradas, 'proxima_fecha', v_prox,
    'con_plan', v_s.plan_id is not null, 'ciclos', v_ciclos);
end $$;

-- ============================================================
-- 6. Lecturas del estudiante: SU asistencia, el tema y los materiales visibles
-- ============================================================
create or replace function public.portal_mi_asistencia(p_salon uuid) returns table (
  sesion_id uuid, numero integer, fecha date, hora_inicio time, hora_fin time, estado_registro text, asistencia text, tema text, materiales jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare v_alumno uuid;
begin
  select cr.alumno_id into v_alumno from public.cuenta_roles cr where cr.user_id = (select auth.uid()) and cr.rol = 'estudiante';
  if v_alumno is null or not public.es_estudiante_de(p_salon) then raise exception 'No tienes acceso a este curso' using errcode = '42501'; end if;
  return query
    select t.id, t.numero, t.fecha, t.hora_inicio, t.hora_fin,
           case when t.estado = 'realizada' and t.registrada then 'registrada' else 'pendiente' end,
           a.estado,
           case when t.estado = 'realizada' then r.tema end,
           case when t.estado = 'realizada' then coalesce((
             select jsonb_agg(jsonb_build_object('id', l.id, 'titulo', l.titulo, 'tipo', l.tipo) order by l.created_at)
               from public.curso_lecciones l join public.curso_secciones c on c.id = l.seccion_id
              where l.sesion_id = t.id and not l.oculta and not c.oculta), '[]'::jsonb) else '[]'::jsonb end
      from (select s.id, s.fecha, s.hora_inicio, s.hora_fin, s.estado,
                   (row_number() over (order by s.fecha, s.hora_inicio))::integer as numero,
                   exists (select 1 from public.clase_registros z where z.sesion_id = s.id) as registrada
              from public.salon_sesiones s where s.salon_id = p_salon and s.estado <> 'cancelada') t
      left join public.clase_registros r on r.sesion_id = t.id
      left join public.asistencias a on a.sesion_id = t.id and a.alumno_id = v_alumno
     where t.fecha <= public.hoy_lima()
       and exists (select 1 from public.matriculas m where m.alumno_id = v_alumno and m.salon_id = p_salon
                    and m.fecha_inicio <= t.fecha and (m.fecha_fin is null or m.fecha_fin >= t.fecha))
     order by t.fecha desc, t.hora_inicio desc;
end $$;

-- ============================================================
-- 7. Permisos de ejecución
-- ============================================================
revoke execute on function
  public.asist_roster(uuid),
  public.registrar_clase(uuid, jsonb, text, text, uuid[]),
  public.portal_clases_salon(uuid), public.sesion_registro(uuid),
  public.asistencia_resumen_salon(uuid), public.asistencia_resumen_alumno(uuid),
  public.progreso_salon(uuid), public.portal_mi_asistencia(uuid)
  from public, anon, authenticated;
grant execute on function
  public.registrar_clase(uuid, jsonb, text, text, uuid[]),
  public.portal_clases_salon(uuid), public.sesion_registro(uuid),
  public.asistencia_resumen_salon(uuid), public.asistencia_resumen_alumno(uuid),
  public.progreso_salon(uuid), public.portal_mi_asistencia(uuid)
  to authenticated;
