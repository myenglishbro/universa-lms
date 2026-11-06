-- UNIVERSA · Banco de ejercicios.
--
--  * Administración crea ejercicios que van al BANCO (visible para todos los docentes). Cada docente puede además crear los suyos (privados).
--  * El docente asigna un ejercicio (del banco o propio) a un salón. La asignación guarda una copia fija: si luego se edita el ejercicio, lo ya asignado no cambia.
--  * Tipos: multiple_choice, fill_gap, matching, order_sentences, reading, listening (autocalificables) y writing, speaking (revisión del docente con feedback).
--  * La clave de respuestas NUNCA llega al estudiante antes de enviar: solo lee funciones que devuelven el contenido sin ella.
--  * Los audios de speaking van a un bucket privado de Storage; solo los lee su autor y quien gestiona el salón.
--
-- Repetible (idempotente). Requiere las migraciones de portales y matrículas.

-- ============================================================
-- 1. Helpers
-- ============================================================
create or replace function public.docente_actual() returns uuid
language sql stable security definer set search_path = '' as $$
  select docente_id from public.cuenta_roles where user_id = (select auth.uid()) and rol = 'docente'
$$;

create or replace function public.alumno_actual() returns uuid
language sql stable security definer set search_path = '' as $$
  select alumno_id from public.cuenta_roles where user_id = (select auth.uid()) and rol = 'estudiante'
$$;

-- Normaliza una respuesta para compararla: sin tildes, mayúsculas, signos ni espacios repetidos.
create or replace function public.ej_norm(t text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(regexp_replace(
           lower(translate(coalesce(t, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')),
           '[[:punct:]¡¿“”‘’]+', '', 'g'), '\s+', ' ', 'g'))
$$;

-- ============================================================
-- 2. Tablas
-- ============================================================
create table if not exists public.ejercicios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (btrim(titulo) <> '' and length(titulo) <= 200),
  tipo text not null check (tipo in ('multiple_choice', 'fill_gap', 'matching', 'order_sentences', 'reading', 'listening', 'writing', 'speaking')),
  nivel text,
  tema text,
  datos jsonb not null,      -- formato de autoría (con respuestas): lo que se edita
  contenido jsonb not null,  -- lo que ve el estudiante (sin respuestas)
  clave jsonb,               -- {items: [[respuestas aceptadas], ...]}; null en writing y speaking
  publico boolean not null,  -- true = banco de administración
  autor_user_id uuid references auth.users(id) on delete set null,
  autor_docente_id uuid references public.docentes(id),
  autor_nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ejercicios_tipo_idx on public.ejercicios (tipo) where activo;

create table if not exists public.ejercicio_asignaciones (
  id uuid primary key default gen_random_uuid(),
  ejercicio_id uuid references public.ejercicios(id),
  salon_id uuid not null references public.salones(id),
  titulo text not null,
  tipo text not null,
  contenido jsonb not null,
  clave jsonb,
  fecha_limite date,
  activa boolean not null default true,
  asignado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ejercicio_asignaciones_salon_idx on public.ejercicio_asignaciones (salon_id) where activa;

create table if not exists public.ejercicio_entregas (
  id uuid primary key default gen_random_uuid(),
  asignacion_id uuid not null references public.ejercicio_asignaciones(id) on delete cascade,
  alumno_id uuid not null references public.alumnos(id),
  respuestas jsonb not null,
  audio_path text,
  estado text not null check (estado in ('autocalificada', 'pendiente', 'revisada')),
  puntaje numeric(5, 2) check (puntaje is null or (puntaje >= 0 and puntaje <= 100)),
  correctas integer,
  total integer,
  detalle jsonb,
  feedback text,
  calificado_por uuid references auth.users(id) on delete set null,
  calificado_at timestamptz,
  entregado_at timestamptz not null default now(),
  unique (asignacion_id, alumno_id)
);

alter table public.ejercicios enable row level security;
alter table public.ejercicio_asignaciones enable row level security;
alter table public.ejercicio_entregas enable row level security;
revoke all on public.ejercicios, public.ejercicio_asignaciones, public.ejercicio_entregas from anon, authenticated;
grant select on public.ejercicios to authenticated;

-- Solo administración y docentes leen ejercicios: el banco público y los propios. Asignaciones y entregas: únicamente por funciones.
drop policy if exists "ver ejercicios" on public.ejercicios;
create policy "ver ejercicios" on public.ejercicios for select to authenticated
  using (activo and ((select public.es_admin()) or (select public.docente_actual()) is not null)
         and (publico or autor_user_id = (select auth.uid())));

-- ============================================================
-- 3. Banco: crear, editar y archivar
-- ============================================================
create or replace function public.guardar_ejercicio(p_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_admin boolean := public.es_admin();
  v_doc uuid := public.docente_actual();
  v_uid uuid := (select auth.uid());
  v_tipo text := p_datos->>'tipo';
  v_e public.ejercicios;
  v_id uuid;
  v_nombre text;
begin
  if not v_admin and v_doc is null then raise exception 'No tienes permisos para crear ejercicios' using errcode = '42501'; end if;
  if btrim(coalesce(p_datos->>'titulo', '')) = '' then raise exception 'Ponle un título al ejercicio'; end if;
  if v_tipo is null or v_tipo not in ('multiple_choice', 'fill_gap', 'matching', 'order_sentences', 'reading', 'listening', 'writing', 'speaking') then
    raise exception 'Tipo de ejercicio no válido';
  end if;
  if p_datos->'contenido' is null or p_datos->'datos' is null then raise exception 'El ejercicio no tiene contenido'; end if;
  if v_tipo not in ('writing', 'speaking') and (p_datos->'clave' is null or jsonb_array_length(p_datos->'clave'->'items') = 0) then
    raise exception 'El ejercicio necesita al menos una pregunta con su respuesta';
  end if;
  if v_tipo = 'listening' and coalesce(p_datos->'datos'->>'audio_url', '') !~ '^https://(drive|docs)\.google\.com/' then
    raise exception 'El audio debe ser un enlace de Google Drive';
  end if;

  if p_id is null then
    select case when v_admin then 'Administración' else (select nombre from public.docentes where id = v_doc) end into v_nombre;
    insert into public.ejercicios (titulo, tipo, nivel, tema, datos, contenido, clave, publico, autor_user_id, autor_docente_id, autor_nombre)
    values (btrim(p_datos->>'titulo'), v_tipo, nullif(btrim(p_datos->>'nivel'), ''), nullif(btrim(p_datos->>'tema'), ''),
            p_datos->'datos', p_datos->'contenido', nullif(p_datos->'clave', 'null'::jsonb), v_admin, v_uid,
            case when v_admin then null else v_doc end, coalesce(v_nombre, 'Docente'))
    returning id into v_id;
    return v_id;
  end if;

  select * into v_e from public.ejercicios where id = p_id and activo for update;
  if not found then raise exception 'El ejercicio ya no existe'; end if;
  -- Administración edita el banco; cada docente, solo lo suyo.
  if not ((v_admin and v_e.publico) or (v_e.autor_user_id = v_uid)) then raise exception 'No puedes editar este ejercicio' using errcode = '42501'; end if;
  if v_e.tipo <> v_tipo then raise exception 'No se puede cambiar el tipo de un ejercicio ya creado'; end if;
  update public.ejercicios
     set titulo = btrim(p_datos->>'titulo'), nivel = nullif(btrim(p_datos->>'nivel'), ''), tema = nullif(btrim(p_datos->>'tema'), ''),
         datos = p_datos->'datos', contenido = p_datos->'contenido', clave = nullif(p_datos->'clave', 'null'::jsonb), updated_at = now()
   where id = p_id;
  return p_id;
end $$;

create or replace function public.archivar_ejercicio(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_e public.ejercicios;
begin
  select * into v_e from public.ejercicios where id = p_id and activo;
  if not found then raise exception 'El ejercicio ya no existe'; end if;
  if not ((public.es_admin() and v_e.publico) or v_e.autor_user_id = (select auth.uid())) then raise exception 'No puedes quitar este ejercicio' using errcode = '42501'; end if;
  update public.ejercicios set activo = false, updated_at = now() where id = p_id;
end $$;

-- ============================================================
-- 4. Asignar a un salón (copia fija) y retirar
-- ============================================================
create or replace function public.asignar_ejercicio(p_ejercicio uuid, p_salon uuid, p_limite date default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_e public.ejercicios; v_id uuid;
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_e from public.ejercicios where id = p_ejercicio and activo and (publico or autor_user_id = (select auth.uid()));
  if not found then raise exception 'El ejercicio no está disponible'; end if;
  insert into public.ejercicio_asignaciones (ejercicio_id, salon_id, titulo, tipo, contenido, clave, fecha_limite, asignado_por)
  values (v_e.id, p_salon, v_e.titulo, v_e.tipo, v_e.contenido, v_e.clave, p_limite, (select auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.quitar_asignacion(p_asignacion uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_s uuid;
begin
  select salon_id into v_s from public.ejercicio_asignaciones where id = p_asignacion and activa;
  if v_s is null then raise exception 'La asignación ya no existe'; end if;
  if not public.puede_gestionar_curso(v_s) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  update public.ejercicio_asignaciones set activa = false where id = p_asignacion;
end $$;

-- ============================================================
-- 5. Docente / administración: lista del salón, entregas y revisión
-- ============================================================
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
      'total', (select count(*) from public.matriculas m where m.salon_id = a.salon_id and m.estado = 'activa'))
      order by a.created_at desc)
    from public.ejercicio_asignaciones a where a.salon_id = p_salon and a.activa), '[]'::jsonb);
end $$;

create or replace function public.entregas_ejercicio(p_asignacion uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_a public.ejercicio_asignaciones;
begin
  select * into v_a from public.ejercicio_asignaciones where id = p_asignacion and activa;
  if not found then raise exception 'La asignación ya no existe'; end if;
  if not public.puede_gestionar_curso(v_a.salon_id) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return jsonb_build_object(
    'asignacion', jsonb_build_object('id', v_a.id, 'titulo', v_a.titulo, 'tipo', v_a.tipo, 'contenido', v_a.contenido, 'fecha_limite', v_a.fecha_limite),
    'filas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'alumno_id', al.id, 'nombre', al.nombre,
        'entrega', case when e.id is null then null else jsonb_build_object(
          'id', e.id, 'estado', e.estado, 'puntaje', e.puntaje, 'correctas', e.correctas, 'total', e.total, 'respuestas', e.respuestas,
          'audio_path', e.audio_path, 'feedback', e.feedback, 'entregado_at', e.entregado_at, 'calificado_at', e.calificado_at) end)
        order by al.nombre)
      from public.matriculas m join public.alumnos al on al.id = m.alumno_id
      left join public.ejercicio_entregas e on e.asignacion_id = v_a.id and e.alumno_id = al.id
      where m.salon_id = v_a.salon_id and m.estado = 'activa'), '[]'::jsonb));
end $$;

create or replace function public.calificar_entrega(p_entrega uuid, p_puntaje numeric, p_feedback text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_e public.ejercicio_entregas; v_a public.ejercicio_asignaciones;
begin
  select * into v_e from public.ejercicio_entregas where id = p_entrega for update;
  if not found then raise exception 'La entrega ya no existe'; end if;
  select * into v_a from public.ejercicio_asignaciones where id = v_e.asignacion_id;
  if not public.puede_gestionar_curso(v_a.salon_id) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  if v_a.tipo not in ('writing', 'speaking') then raise exception 'Este ejercicio se califica solo'; end if;
  if p_puntaje is null or p_puntaje < 0 or p_puntaje > 100 then raise exception 'La nota debe estar entre 0 y 100'; end if;
  update public.ejercicio_entregas
     set puntaje = p_puntaje, feedback = nullif(btrim(coalesce(p_feedback, '')), ''), estado = 'revisada',
         calificado_por = (select auth.uid()), calificado_at = now()
   where id = p_entrega;
end $$;

-- ============================================================
-- 6. Estudiante: ver (sin respuestas) y enviar
-- ============================================================
create or replace function public.portal_ejercicios(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_alumno uuid := public.alumno_actual();
begin
  if not public.es_estudiante_de(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'titulo', a.titulo, 'tipo', a.tipo, 'contenido', a.contenido, 'fecha_limite', a.fecha_limite, 'creada', a.created_at,
      'entrega', case when e.id is null then null else jsonb_build_object(
        'estado', e.estado, 'puntaje', e.puntaje, 'correctas', e.correctas, 'total', e.total, 'detalle', e.detalle,
        'respuestas', e.respuestas, 'audio_path', e.audio_path, 'feedback', e.feedback, 'entregado_at', e.entregado_at) end)
      order by a.created_at desc)
    from public.ejercicio_asignaciones a
    left join public.ejercicio_entregas e on e.asignacion_id = a.id and e.alumno_id = v_alumno
    where a.salon_id = p_salon and a.activa), '[]'::jsonb);
end $$;

create or replace function public.entregar_ejercicio(p_asignacion uuid, p_respuestas jsonb, p_audio text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_a public.ejercicio_asignaciones;
  v_alumno uuid := public.alumno_actual();
  v_n integer; i integer; v_ok integer := 0; v_good boolean; v_resp text; v_acc text;
  v_det jsonb := '[]'::jsonb; v_puntaje numeric;
begin
  select * into v_a from public.ejercicio_asignaciones where id = p_asignacion and activa;
  if not found then raise exception 'Este ejercicio ya no está disponible'; end if;
  if v_alumno is null or not public.es_estudiante_de(v_a.salon_id) then raise exception 'No tienes acceso a este ejercicio' using errcode = '42501'; end if;
  if exists (select 1 from public.ejercicio_entregas where asignacion_id = p_asignacion and alumno_id = v_alumno) then
    raise exception 'Ya enviaste este ejercicio';
  end if;

  if v_a.tipo = 'writing' then
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

-- ============================================================
-- 7. Audios de speaking (bucket privado)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('ejercicios-audio', 'ejercicios-audio', false, 10485760)
on conflict (id) do nothing;

-- Ruta: <asignacion>/<usuario>/<archivo>. modo 'subir': el estudiante del salón a su propia carpeta. modo 'ver': el autor o quien gestiona el salón.
create or replace function public.ej_audio_permitido(p_ruta text, p_modo text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_asig uuid; v_uid text := (select auth.uid())::text;
begin
  begin v_asig := split_part(p_ruta, '/', 1)::uuid; exception when others then return false; end;
  if p_modo = 'subir' then
    return split_part(p_ruta, '/', 2) = v_uid
       and exists (select 1 from public.ejercicio_asignaciones a where a.id = v_asig and a.activa and a.tipo = 'speaking' and public.es_estudiante_de(a.salon_id));
  end if;
  return split_part(p_ruta, '/', 2) = v_uid
      or exists (select 1 from public.ejercicio_asignaciones a where a.id = v_asig and public.puede_gestionar_curso(a.salon_id));
end $$;

drop policy if exists "subir audio de ejercicio" on storage.objects;
create policy "subir audio de ejercicio" on storage.objects for insert to authenticated
  with check (bucket_id = 'ejercicios-audio' and public.ej_audio_permitido(name, 'subir'));
drop policy if exists "ver audio de ejercicio" on storage.objects;
create policy "ver audio de ejercicio" on storage.objects for select to authenticated
  using (bucket_id = 'ejercicios-audio' and public.ej_audio_permitido(name, 'ver'));

-- ============================================================
-- 8. Permisos
-- ============================================================
revoke execute on function public.docente_actual(), public.alumno_actual(), public.ej_norm(text), public.ej_audio_permitido(text, text) from public, anon;
grant execute on function public.docente_actual(), public.alumno_actual(), public.ej_audio_permitido(text, text) to authenticated;
revoke execute on function
  public.guardar_ejercicio(uuid, jsonb), public.archivar_ejercicio(uuid), public.asignar_ejercicio(uuid, uuid, date), public.quitar_asignacion(uuid),
  public.ejercicios_salon(uuid), public.entregas_ejercicio(uuid), public.calificar_entrega(uuid, numeric, text),
  public.portal_ejercicios(uuid), public.entregar_ejercicio(uuid, jsonb, text)
  from public, anon;
grant execute on function
  public.guardar_ejercicio(uuid, jsonb), public.archivar_ejercicio(uuid), public.asignar_ejercicio(uuid, uuid, date), public.quitar_asignacion(uuid),
  public.ejercicios_salon(uuid), public.entregas_ejercicio(uuid), public.calificar_entrega(uuid, numeric, text),
  public.portal_ejercicios(uuid), public.entregar_ejercicio(uuid, jsonb, text)
  to authenticated;
