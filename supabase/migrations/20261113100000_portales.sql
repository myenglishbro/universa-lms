-- UNIVERSA · Portales del estudiante y del docente.
--
--  * SEGURIDAD: public.tiene_perfil() pasaba por «cualquier fila en perfiles». Ahora solo es verdadera para el personal
--    (admin y comercial). Las ~26 políticas que la usan quedan protegidas sin reescribirlas: ninguna cuenta de portal
--    hereda lectura administrativa. perfiles sigue guardando solo admin/comercial (compatibilidad).
--  * ROLES MÚLTIPLES: cuenta_roles(user_id, rol, alumno_id | docente_id). Una cuenta puede ser estudiante, docente y además
--    admin/comercial (perfiles) a la vez, sin duplicar cuentas. Una persona (alumno/docente) solo se vincula a una cuenta.
--  * VINCULACIÓN: vincular_cuenta(correo, rol, persona). Si el usuario de Supabase Auth ya existe se vincula; si no, queda una
--    invitación pendiente que reclamar_invitaciones() convierte en vínculo cuando esa persona inicia sesión con un correo
--    confirmado. Más adelante un Edge Function (service_role SOLO en el servidor) puede enviar la invitación por correo.
--  * CONTENIDO: curso_secciones y curso_lecciones (enlaces de YouTube / Google Drive; no se guardan archivos). Ocultar no borra.
--  * Todas las escrituras pasan por funciones SECURITY DEFINER; las lecturas del portal, por funciones que solo devuelven
--    lo que corresponde a quien consulta (nada de abrir salones, alumnos, pagos o paquetes completos).
--
-- Repetible. Requiere las migraciones anteriores, incluida 20261112100000_matriculas.sql.

-- ============================================================
-- 1. tiene_perfil() = personal (admin o comercial)
-- ============================================================
create or replace function public.tiene_perfil() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where user_id = (select auth.uid()) and rol in ('admin', 'comercial'))
$$;

-- ============================================================
-- 2. Roles de portal por cuenta (varios por cuenta) e invitaciones
-- ============================================================
create table if not exists public.cuenta_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rol text not null check (rol in ('estudiante', 'docente')),
  alumno_id uuid references public.alumnos(id),
  docente_id uuid references public.docentes(id),
  created_at timestamptz not null default now(),
  constraint cuenta_roles_persona_ck check (
    (rol = 'estudiante' and alumno_id is not null and docente_id is null)
    or (rol = 'docente' and docente_id is not null and alumno_id is null)),
  constraint cuenta_roles_user_rol_unico unique (user_id, rol)
);
create unique index if not exists cuenta_roles_alumno_unico on public.cuenta_roles (alumno_id) where alumno_id is not null;
create unique index if not exists cuenta_roles_docente_unico on public.cuenta_roles (docente_id) where docente_id is not null;

create table if not exists public.cuenta_invitaciones (
  id uuid primary key default gen_random_uuid(),
  correo text not null check (correo = lower(btrim(correo))),
  rol text not null check (rol in ('estudiante', 'docente')),
  alumno_id uuid references public.alumnos(id),
  docente_id uuid references public.docentes(id),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'cancelada')),
  creado_por uuid references auth.users(id) on delete set null,
  aceptada_por uuid references auth.users(id) on delete set null,
  aceptada_at timestamptz,
  created_at timestamptz not null default now(),
  constraint cuenta_invitaciones_persona_ck check (
    (rol = 'estudiante' and alumno_id is not null and docente_id is null)
    or (rol = 'docente' and docente_id is not null and alumno_id is null))
);
create unique index if not exists cuenta_invitaciones_pendiente_unica
  on public.cuenta_invitaciones (correo, rol, coalesce(alumno_id, docente_id)) where estado = 'pendiente';

alter table public.cuenta_roles enable row level security;
alter table public.cuenta_invitaciones enable row level security;
revoke all on public.cuenta_roles, public.cuenta_invitaciones from anon, authenticated;
grant select on public.cuenta_roles to authenticated;
drop policy if exists "ver mis roles" on public.cuenta_roles;
create policy "ver mis roles" on public.cuenta_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.es_admin()));
-- cuenta_invitaciones: sin acceso directo (solo mediante funciones de administración).

-- ============================================================
-- 3. Helpers de pertenencia (no exponen datos, solo responden sí/no)
-- ============================================================
create or replace function public.es_docente_de(p_salon uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cuenta_roles cr join public.salones s on s.docente_id = cr.docente_id
     where cr.user_id = (select auth.uid()) and cr.rol = 'docente' and s.id = p_salon)
$$;

create or replace function public.es_estudiante_de(p_salon uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cuenta_roles cr join public.matriculas m on m.alumno_id = cr.alumno_id
     where cr.user_id = (select auth.uid()) and cr.rol = 'estudiante' and m.salon_id = p_salon and m.estado = 'activa')
$$;

create or replace function public.puede_gestionar_curso(p_salon uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select public.es_admin()) or public.es_docente_de(p_salon)
$$;

-- ============================================================
-- 4. Contenido: secciones y lecciones
-- ============================================================
create table if not exists public.curso_secciones (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salones(id) on delete cascade,
  titulo text not null check (btrim(titulo) <> '' and length(titulo) <= 200),
  orden integer not null default 1,
  oculta boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists curso_secciones_salon_idx on public.curso_secciones (salon_id, orden);

create table if not exists public.curso_lecciones (
  id uuid primary key default gen_random_uuid(),
  seccion_id uuid not null references public.curso_secciones(id) on delete cascade,
  salon_id uuid not null references public.salones(id) on delete cascade,
  titulo text not null check (btrim(titulo) <> '' and length(titulo) <= 200),
  descripcion text check (length(descripcion) <= 2000),
  tipo text not null check (tipo in ('grabacion', 'video', 'documento', 'enlace')),
  proveedor text not null check (proveedor in ('youtube', 'drive', 'externo')),
  url text not null check (url ~ '^https://' and length(url) <= 2000),
  orden integer not null default 1,
  oculta boolean not null default false,
  sesion_id uuid references public.salon_sesiones(id) on delete set null,
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists curso_lecciones_seccion_idx on public.curso_lecciones (seccion_id, orden);
create index if not exists curso_lecciones_salon_idx on public.curso_lecciones (salon_id);
drop trigger if exists curso_lecciones_updated on public.curso_lecciones;
create trigger curso_lecciones_updated before update on public.curso_lecciones for each row execute function public.set_updated_at();

alter table public.curso_secciones enable row level security;
alter table public.curso_lecciones enable row level security;
revoke all on public.curso_secciones, public.curso_lecciones from anon, authenticated;
grant select on public.curso_secciones, public.curso_lecciones to authenticated;

drop policy if exists "personal consulta secciones" on public.curso_secciones;
drop policy if exists "docente consulta secciones" on public.curso_secciones;
drop policy if exists "estudiante consulta secciones" on public.curso_secciones;
create policy "personal consulta secciones" on public.curso_secciones for select to authenticated using ((select public.tiene_perfil()));
create policy "docente consulta secciones" on public.curso_secciones for select to authenticated using ((select public.es_docente_de(salon_id)));
create policy "estudiante consulta secciones" on public.curso_secciones for select to authenticated
  using (not oculta and (select public.es_estudiante_de(salon_id)));

drop policy if exists "personal consulta lecciones" on public.curso_lecciones;
drop policy if exists "docente consulta lecciones" on public.curso_lecciones;
drop policy if exists "estudiante consulta lecciones" on public.curso_lecciones;
create policy "personal consulta lecciones" on public.curso_lecciones for select to authenticated using ((select public.tiene_perfil()));
create policy "docente consulta lecciones" on public.curso_lecciones for select to authenticated using ((select public.es_docente_de(salon_id)));
create policy "estudiante consulta lecciones" on public.curso_lecciones for select to authenticated
  using (not oculta and (select public.es_estudiante_de(salon_id))
         and exists (select 1 from public.curso_secciones s where s.id = seccion_id and not s.oculta));

-- ============================================================
-- 5. Validación de enlaces
-- ============================================================
-- Devuelve 'youtube', 'drive' o 'externo'. Videos y grabaciones: YouTube o Drive. Documentos: Drive/Docs. Enlaces: cualquier https.
create or replace function public.curso_proveedor(p_url text, p_tipo text) returns text
language plpgsql immutable set search_path = '' as $$
declare v_host text; v_prov text;
begin
  if p_tipo is null or p_tipo not in ('grabacion', 'video', 'documento', 'enlace') then
    raise exception 'Tipo de recurso no válido';
  end if;
  if p_url is null or length(p_url) > 2000 or p_url !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?([/?#][^[:space:]]*)?$' then
    raise exception 'El enlace debe comenzar con https:// y no puede tener espacios';
  end if;
  v_host := lower(substring(p_url from '^https://([A-Za-z0-9.-]+)'));
  v_prov := case
    when v_host in ('youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com') then 'youtube'
    when v_host in ('drive.google.com', 'docs.google.com') then 'drive'
    else 'externo' end;
  if p_tipo in ('grabacion', 'video') and v_prov = 'externo' then
    raise exception 'Los videos y grabaciones deben ser enlaces de YouTube o Google Drive';
  end if;
  if p_tipo = 'documento' and v_prov <> 'drive' then
    raise exception 'Los documentos deben ser enlaces de Google Drive (Drive, Docs o Slides)';
  end if;
  return v_prov;
end $$;

-- ============================================================
-- 6. Gestión del contenido (admin o docente asignado al salón)
-- ============================================================
create or replace function public.guardar_seccion(p_id uuid, p_salon uuid, p_titulo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_salon uuid := p_salon; v_titulo text := btrim(coalesce(p_titulo, ''));
begin
  if p_id is not null then
    select salon_id into v_salon from public.curso_secciones where id = p_id;
    if not found then raise exception 'La sección no existe'; end if;
  end if;
  if v_salon is null or not exists (select 1 from public.salones where id = v_salon) then raise exception 'El salón no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes permisos para administrar este curso' using errcode = '42501'; end if;
  if v_titulo = '' then raise exception 'El título de la sección es obligatorio'; end if;
  if length(v_titulo) > 200 then raise exception 'El título es demasiado largo (máximo 200 caracteres)'; end if;
  if p_id is null then
    perform 1 from public.salones where id = v_salon for update;
    insert into public.curso_secciones (salon_id, titulo, orden)
    values (v_salon, v_titulo, coalesce((select max(orden) from public.curso_secciones where salon_id = v_salon), 0) + 1)
    returning id into v_id;
  else
    update public.curso_secciones set titulo = v_titulo where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.guardar_leccion(p_id uuid, p_seccion uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_l public.curso_lecciones;
  v_sec public.curso_secciones;
  v_titulo text := btrim(coalesce(p_datos->>'titulo', ''));
  v_desc text := nullif(btrim(coalesce(p_datos->>'descripcion', '')), '');
  v_tipo text := coalesce(nullif(p_datos->>'tipo', ''), 'video');
  v_url text := btrim(coalesce(p_datos->>'url', ''));
  v_sesion uuid := nullif(p_datos->>'sesion_id', '')::uuid;
  v_prov text;
  v_id uuid;
begin
  if p_id is not null then
    select * into v_l from public.curso_lecciones where id = p_id;
    if not found then raise exception 'La lección no existe'; end if;
    p_seccion := coalesce(p_seccion, v_l.seccion_id);
    if not (p_datos ? 'sesion_id') then v_sesion := v_l.sesion_id; end if; -- si no se envía, se conserva la sesión vinculada
  end if;
  select * into v_sec from public.curso_secciones where id = p_seccion for update;
  if not found then raise exception 'La sección no existe'; end if;
  if not public.puede_gestionar_curso(v_sec.salon_id) then raise exception 'No tienes permisos para administrar este curso' using errcode = '42501'; end if;
  if p_id is not null and v_l.salon_id <> v_sec.salon_id then raise exception 'No se puede mover una lección a otro salón'; end if;
  if v_titulo = '' then raise exception 'El título es obligatorio'; end if;
  if length(v_titulo) > 200 then raise exception 'El título es demasiado largo (máximo 200 caracteres)'; end if;
  if length(coalesce(v_desc, '')) > 2000 then raise exception 'La descripción es demasiado larga (máximo 2000 caracteres)'; end if;
  v_prov := public.curso_proveedor(v_url, v_tipo);
  if v_sesion is not null and not exists (select 1 from public.salon_sesiones where id = v_sesion and salon_id = v_sec.salon_id) then
    raise exception 'La sesión elegida no pertenece a este salón';
  end if;

  if p_id is null then
    insert into public.curso_lecciones (seccion_id, salon_id, titulo, descripcion, tipo, proveedor, url, orden, sesion_id, creado_por)
    values (p_seccion, v_sec.salon_id, v_titulo, v_desc, v_tipo, v_prov, v_url,
            coalesce((select max(orden) from public.curso_lecciones where seccion_id = p_seccion), 0) + 1, v_sesion, (select auth.uid()))
    returning id into v_id;
  else
    update public.curso_lecciones set seccion_id = p_seccion, titulo = v_titulo, descripcion = v_desc, tipo = v_tipo, proveedor = v_prov, url = v_url,
           sesion_id = v_sesion,
           orden = case when seccion_id = p_seccion then orden
                        else coalesce((select max(orden) from public.curso_lecciones where seccion_id = p_seccion), 0) + 1 end
     where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

-- Ocultar o mostrar (no se elimina nada).
create or replace function public.ocultar_leccion(p_id uuid, p_oculta boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_salon uuid;
begin
  select salon_id into v_salon from public.curso_lecciones where id = p_id;
  if not found then raise exception 'La lección no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes permisos para administrar este curso' using errcode = '42501'; end if;
  update public.curso_lecciones set oculta = coalesce(p_oculta, true) where id = p_id;
end $$;

create or replace function public.ocultar_seccion(p_id uuid, p_oculta boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_salon uuid;
begin
  select salon_id into v_salon from public.curso_secciones where id = p_id;
  if not found then raise exception 'La sección no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes permisos para administrar este curso' using errcode = '42501'; end if;
  update public.curso_secciones set oculta = coalesce(p_oculta, true) where id = p_id;
end $$;

-- Reordenar: la lista debe contener exactamente los elementos actuales, sin repetir.
create or replace function public.reordenar_lecciones(p_seccion uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_salon uuid; v_n integer := coalesce(array_length(p_ids, 1), 0);
begin
  select salon_id into v_salon from public.curso_secciones where id = p_seccion for update;
  if not found then raise exception 'La sección no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes permisos para administrar este curso' using errcode = '42501'; end if;
  if (select count(*) from public.curso_lecciones where seccion_id = p_seccion) <> v_n
     or (select count(distinct x) from unnest(p_ids) x) <> v_n
     or exists (select 1 from unnest(p_ids) x where not exists (select 1 from public.curso_lecciones where id = x and seccion_id = p_seccion)) then
    raise exception 'La lista de lecciones no coincide con las de la sección; recarga e inténtalo de nuevo';
  end if;
  update public.curso_lecciones l set orden = t.n from unnest(p_ids) with ordinality as t(id, n) where l.id = t.id;
end $$;

create or replace function public.reordenar_secciones(p_salon uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_n integer := coalesce(array_length(p_ids, 1), 0);
begin
  perform 1 from public.salones where id = p_salon for update;
  if not found then raise exception 'El salón no existe'; end if;
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes permisos para administrar este curso' using errcode = '42501'; end if;
  if (select count(*) from public.curso_secciones where salon_id = p_salon) <> v_n
     or (select count(distinct x) from unnest(p_ids) x) <> v_n
     or exists (select 1 from unnest(p_ids) x where not exists (select 1 from public.curso_secciones where id = x and salon_id = p_salon)) then
    raise exception 'La lista de secciones no coincide con las del curso; recarga e inténtalo de nuevo';
  end if;
  update public.curso_secciones s set orden = t.n from unnest(p_ids) with ordinality as t(id, n) where s.id = t.id;
end $$;

-- ============================================================
-- 7. Lecturas del portal (devuelven solo lo que corresponde a quien consulta)
-- ============================================================
create or replace function public.portal_mis_cursos() returns table (
  salon_id uuid, codigo text, nombre text, nivel text, docente text, estado text, fecha_inicio date,
  horarios jsonb, lecciones integer, matriculado_desde date)
language sql stable security definer set search_path = '' as $$
  select s.id, s.codigo, s.nombre, n.nombre, d.nombre, s.estado, s.fecha_inicio,
         coalesce((select jsonb_agg(jsonb_build_object('dia', h.dia, 'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin) order by h.dia, h.hora_inicio)
                     from public.salon_horarios h where h.salon_id = s.id), '[]'::jsonb),
         (select count(*)::integer from public.curso_lecciones l join public.curso_secciones c on c.id = l.seccion_id
           where l.salon_id = s.id and not l.oculta and not c.oculta),
         m.fecha_inicio
    from public.cuenta_roles cr
    join public.matriculas m on m.alumno_id = cr.alumno_id and m.estado = 'activa'
    join public.salones s on s.id = m.salon_id
    left join public.niveles n on n.id = s.nivel_id
    left join public.docentes d on d.id = s.docente_id
   where cr.user_id = (select auth.uid()) and cr.rol = 'estudiante'
   order by s.estado = 'finalizado', s.nombre
$$;

create or replace function public.portal_mis_salones() returns table (
  salon_id uuid, codigo text, nombre text, nivel text, estado text, fecha_inicio date, capacidad integer,
  estudiantes integer, horarios jsonb, lecciones integer)
language sql stable security definer set search_path = '' as $$
  select s.id, s.codigo, s.nombre, n.nombre, s.estado, s.fecha_inicio, s.capacidad,
         (select count(*)::integer from public.matriculas m where m.salon_id = s.id and m.estado = 'activa'),
         coalesce((select jsonb_agg(jsonb_build_object('dia', h.dia, 'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin) order by h.dia, h.hora_inicio)
                     from public.salon_horarios h where h.salon_id = s.id), '[]'::jsonb),
         (select count(*)::integer from public.curso_lecciones l where l.salon_id = s.id and not l.oculta)
    from public.cuenta_roles cr
    join public.salones s on s.docente_id = cr.docente_id
    left join public.niveles n on n.id = s.nivel_id
   where cr.user_id = (select auth.uid()) and cr.rol = 'docente'
   order by s.estado = 'finalizado', s.nombre
$$;

-- Estudiantes matriculados: solo nombre y fecha (sin contacto, notas ni pagos). Admin o docente del salón.
create or replace function public.portal_estudiantes_salon(p_salon uuid) returns table (alumno_id uuid, nombre text, desde date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return query
    select a.id, a.nombre, m.fecha_inicio from public.matriculas m join public.alumnos a on a.id = m.alumno_id
     where m.salon_id = p_salon and m.estado = 'activa' order by a.nombre;
end $$;

-- Sesiones del calendario de un salón (para vincular una grabación). Solo admin o docente del salón.
create or replace function public.portal_sesiones_salon(p_salon uuid) returns table (id uuid, fecha date, hora_inicio time, hora_fin time, estado text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return query select s.id, s.fecha, s.hora_inicio, s.hora_fin, s.estado from public.salon_sesiones s
   where s.salon_id = p_salon and s.estado <> 'cancelada' order by s.fecha desc, s.hora_inicio;
end $$;

-- Contenido de un curso. Estudiante: solo lo visible. Admin/docente del salón: también lo oculto.
create or replace function public.portal_contenido(p_salon uuid) returns table (
  seccion_id uuid, seccion_titulo text, seccion_orden integer, seccion_oculta boolean,
  leccion_id uuid, leccion_titulo text, descripcion text, tipo text, proveedor text, url text,
  leccion_orden integer, leccion_oculta boolean, sesion_id uuid, sesion_fecha date)
language plpgsql stable security definer set search_path = '' as $$
declare v_gestion boolean := public.puede_gestionar_curso(p_salon);
begin
  if not v_gestion and not public.es_estudiante_de(p_salon) then
    raise exception 'No tienes acceso a este curso' using errcode = '42501';
  end if;
  return query
    select s.id, s.titulo, s.orden, s.oculta, l.id, l.titulo, l.descripcion, l.tipo, l.proveedor, l.url, l.orden, coalesce(l.oculta, false), l.sesion_id, ss.fecha
      from public.curso_secciones s
      left join public.curso_lecciones l on l.seccion_id = s.id and (v_gestion or not l.oculta)
      left join public.salon_sesiones ss on ss.id = l.sesion_id
     where s.salon_id = p_salon and (v_gestion or not s.oculta)
     order by s.orden, s.created_at, l.orden, l.created_at;
end $$;

-- Próximas clases (grupales y particulares) de la cuenta, según sus roles de portal.
create or replace function public.portal_proximas_clases() returns table (
  rol text, origen text, id uuid, salon_id uuid, titulo text, fecha date, hora_inicio time, hora_fin time, docente text)
language sql stable security definer set search_path = '' as $$
  select t.* from (
    select 'estudiante'::text as rol, 'grupal'::text as origen, s.id, s.salon_id, sa.nombre as titulo, s.fecha, s.hora_inicio, s.hora_fin, d.nombre as docente
      from public.cuenta_roles cr
      join public.matriculas m on m.alumno_id = cr.alumno_id and m.estado = 'activa'
      join public.salon_sesiones s on s.salon_id = m.salon_id and s.estado = 'programada' and s.fecha >= public.hoy_lima()
      join public.salones sa on sa.id = s.salon_id
      left join public.docentes d on d.id = sa.docente_id
     where cr.user_id = (select auth.uid()) and cr.rol = 'estudiante'
    union all
    select 'estudiante', 'particular', c.id, null::uuid, 'Clase particular', c.fecha, c.hora_inicio, c.hora_fin, d.nombre
      from public.cuenta_roles cr
      join public.paquetes_horas p on p.alumno_id = cr.alumno_id and not p.anulado
      join public.paquete_clases c on c.paquete_id = p.id and c.estado = 'programada' and c.fecha >= public.hoy_lima()
      left join public.docentes d on d.id = coalesce(c.docente_id, p.docente_id)
     where cr.user_id = (select auth.uid()) and cr.rol = 'estudiante'
    union all
    select 'docente', 'grupal', s.id, s.salon_id, sa.nombre, s.fecha, s.hora_inicio, s.hora_fin, null::text
      from public.cuenta_roles cr
      join public.salones sa on sa.docente_id = cr.docente_id
      join public.salon_sesiones s on s.salon_id = sa.id and s.estado = 'programada' and s.fecha >= public.hoy_lima()
     where cr.user_id = (select auth.uid()) and cr.rol = 'docente'
    union all
    select 'docente', 'particular', c.id, null::uuid, a.nombre, c.fecha, c.hora_inicio, c.hora_fin, null::text
      from public.cuenta_roles cr
      join public.paquetes_horas p on not p.anulado
      join public.paquete_clases c on c.paquete_id = p.id and c.estado = 'programada' and c.fecha >= public.hoy_lima()
                                  and coalesce(c.docente_id, p.docente_id) = cr.docente_id
      join public.alumnos a on a.id = p.alumno_id
     where cr.user_id = (select auth.uid()) and cr.rol = 'docente'
  ) t
  order by t.fecha, t.hora_inicio
  limit 40
$$;

-- ============================================================
-- 8. Vinculación de cuentas (administración) e invitaciones
-- ============================================================
-- Vincula una cuenta de Supabase Auth (por correo) con un alumno o docente existente. No crea personas ni cuentas.
-- Devuelve 'vinculada' (la cuenta ya existía) o 'invitada' (queda pendiente hasta que esa persona inicie sesión).
create or replace function public.vincular_cuenta(p_correo text, p_rol text, p_persona uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_correo text := lower(btrim(coalesce(p_correo, '')));
  v_user uuid;
  v_nombre text;
begin
  perform public.cal_exigir_admin();
  if v_correo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Escribe un correo válido'; end if;
  if p_rol = 'estudiante' then select nombre into v_nombre from public.alumnos where id = p_persona;
  elsif p_rol = 'docente' then select nombre into v_nombre from public.docentes where id = p_persona;
  else raise exception 'Rol no válido'; end if;
  if v_nombre is null then raise exception 'La persona a vincular no existe'; end if;

  select id into v_user from auth.users where lower(email) = v_correo;
  if exists (select 1 from public.cuenta_roles where rol = p_rol and coalesce(alumno_id, docente_id) = p_persona and user_id is distinct from v_user) then
    raise exception '% ya tiene otra cuenta vinculada. Desvincúlala primero', v_nombre;
  end if;

  if v_user is not null then
    if exists (select 1 from public.cuenta_roles where user_id = v_user and rol = p_rol and coalesce(alumno_id, docente_id) <> p_persona) then
      raise exception 'Esa cuenta ya está vinculada a otro %', case when p_rol = 'estudiante' then 'estudiante' else 'docente' end;
    end if;
    insert into public.cuenta_roles (user_id, rol, alumno_id, docente_id)
    values (v_user, p_rol, case when p_rol = 'estudiante' then p_persona end, case when p_rol = 'docente' then p_persona end)
    on conflict do nothing;
    update public.cuenta_invitaciones set estado = 'cancelada'
     where estado = 'pendiente' and correo = v_correo and rol = p_rol and coalesce(alumno_id, docente_id) = p_persona;
    return 'vinculada';
  end if;

  insert into public.cuenta_invitaciones (correo, rol, alumno_id, docente_id, creado_por)
  values (v_correo, p_rol, case when p_rol = 'estudiante' then p_persona end, case when p_rol = 'docente' then p_persona end, (select auth.uid()))
  on conflict do nothing;
  return 'invitada';
end $$;

create or replace function public.desvincular_cuenta(p_rol text, p_persona uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  delete from public.cuenta_roles where rol = p_rol and coalesce(alumno_id, docente_id) = p_persona;
  update public.cuenta_invitaciones set estado = 'cancelada'
   where estado = 'pendiente' and rol = p_rol and coalesce(alumno_id, docente_id) = p_persona;
end $$;

-- Cuentas e invitaciones de una persona (admin): permite mostrar el correo vinculado sin exponer auth.users.
create or replace function public.cuentas_de_persona(p_rol text, p_persona uuid) returns table (estado text, correo text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  return query
    select 'vinculada'::text, u.email::text from public.cuenta_roles cr join auth.users u on u.id = cr.user_id
     where cr.rol = p_rol and coalesce(cr.alumno_id, cr.docente_id) = p_persona
    union all
    select 'invitada'::text, i.correo from public.cuenta_invitaciones i
     where i.estado = 'pendiente' and i.rol = p_rol and coalesce(i.alumno_id, i.docente_id) = p_persona;
end $$;

-- Se llama al iniciar sesión: convierte en vínculos las invitaciones pendientes del correo CONFIRMADO de quien consulta.
create or replace function public.reclamar_invitaciones() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_email text; v_n integer := 0; r public.cuenta_invitaciones;
begin
  if v_uid is null then return 0; end if;
  select lower(email) into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  for r in select * from public.cuenta_invitaciones where estado = 'pendiente' and correo = v_email for update loop
    insert into public.cuenta_roles (user_id, rol, alumno_id, docente_id) values (v_uid, r.rol, r.alumno_id, r.docente_id) on conflict do nothing;
    if exists (select 1 from public.cuenta_roles where user_id = v_uid and rol = r.rol and coalesce(alumno_id, docente_id) = coalesce(r.alumno_id, r.docente_id)) then
      update public.cuenta_invitaciones set estado = 'aceptada', aceptada_por = v_uid, aceptada_at = now() where id = r.id;
      v_n := v_n + 1;
    else
      update public.cuenta_invitaciones set estado = 'cancelada' where id = r.id; -- la persona ya estaba ligada a otra cuenta
    end if;
  end loop;
  return v_n;
end $$;

-- ============================================================
-- 9. Permisos de ejecución (nada para anon)
-- ============================================================
revoke execute on function
  public.es_docente_de(uuid), public.es_estudiante_de(uuid), public.puede_gestionar_curso(uuid), public.curso_proveedor(text, text),
  public.guardar_seccion(uuid, uuid, text), public.guardar_leccion(uuid, uuid, jsonb), public.ocultar_leccion(uuid, boolean),
  public.ocultar_seccion(uuid, boolean), public.reordenar_lecciones(uuid, uuid[]), public.reordenar_secciones(uuid, uuid[]),
  public.portal_mis_cursos(), public.portal_mis_salones(), public.portal_estudiantes_salon(uuid), public.portal_contenido(uuid),
  public.portal_proximas_clases(), public.portal_sesiones_salon(uuid), public.vincular_cuenta(text, text, uuid), public.desvincular_cuenta(text, uuid),
  public.cuentas_de_persona(text, uuid), public.reclamar_invitaciones()
  from public, anon;
grant execute on function
  public.es_docente_de(uuid), public.es_estudiante_de(uuid), public.puede_gestionar_curso(uuid), public.curso_proveedor(text, text),
  public.guardar_seccion(uuid, uuid, text), public.guardar_leccion(uuid, uuid, jsonb), public.ocultar_leccion(uuid, boolean),
  public.ocultar_seccion(uuid, boolean), public.reordenar_lecciones(uuid, uuid[]), public.reordenar_secciones(uuid, uuid[]),
  public.portal_mis_cursos(), public.portal_mis_salones(), public.portal_estudiantes_salon(uuid), public.portal_contenido(uuid),
  public.portal_proximas_clases(), public.portal_sesiones_salon(uuid), public.vincular_cuenta(text, text, uuid), public.desvincular_cuenta(text, uuid),
  public.cuentas_de_persona(text, uuid), public.reclamar_invitaciones()
  to authenticated;
