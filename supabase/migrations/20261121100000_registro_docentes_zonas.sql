-- UNIVERSA · Registro de profesores, disponibilidad, foto de perfil y zonas de documentos (Teacher Zone / Student Zone).
--
--  * docente_registros: datos que un profesor deja al registrarse (nombres, apellidos, celular, dirección, foto). La cuenta de
--    Auth la crea la Edge Function `registro-docente` (correo ya confirmado) y la fila la inserta registrar_postulante() (solo servidor).
--    Un registrado NO tiene acceso a datos académicos: solo ve y edita lo suyo hasta que administración lo convierta en docente.
--  * convertir_en_docente(): administración crea (o reutiliza por correo) el docente y vincula la cuenta al portal docente.
--  * docente_disponibilidad: franjas de 1 hora (07:00–23:00, lunes a domingo) que marca cada profesor. Sirve para sugerir docentes al crear un salón.
--  * zona_documentos: documentos (enlaces de Drive) que administración publica para docentes (Teacher Zone) o estudiantes (Student Zone).
--  * Contraseñas: las cambia SOLO administración (Edge Function `gestionar-acceso`); aquí no se guarda ninguna.
--
-- Repetible. Requiere las migraciones de portales (20261113) y accesos (20261114).

-- ============================================================
-- 1. Registro de profesores
-- ============================================================
create table if not exists public.docente_registros (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombres text not null check (btrim(nombres) <> '' and length(nombres) <= 100),
  apellidos text not null check (btrim(apellidos) <> '' and length(apellidos) <= 100),
  celular text not null check (btrim(celular) <> '' and length(celular) <= 30),
  direccion text not null check (btrim(direccion) <> '' and length(direccion) <= 200),
  foto_url text check (foto_url is null or (foto_url ~ '^https://(drive|docs)\.google\.com/' and length(foto_url) <= 2000)),
  docente_id uuid references public.docentes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists docente_registros_docente_unico on public.docente_registros (docente_id) where docente_id is not null;

alter table public.docente_registros enable row level security;
drop policy if exists "ver mi registro" on public.docente_registros;
create policy "ver mi registro" on public.docente_registros for select to authenticated using (user_id = (select auth.uid()));
-- Sin políticas de escritura: se escribe solo con las funciones de abajo.

-- Alta desde el servidor (Edge Function con service_role), justo después de crear la cuenta.
create or replace function public.registrar_postulante(p_user uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.docente_registros (user_id, nombres, apellidos, celular, direccion)
  values (p_user, btrim(p_datos->>'nombres'), btrim(p_datos->>'apellidos'), btrim(p_datos->>'celular'), btrim(p_datos->>'direccion'));
end $$;

-- El profesor completa o corrige sus propios datos y su foto (enlace de Drive o Docs). También lo usan los docentes creados
-- a mano por administración que aún no tienen registro. Los cuatro datos son obligatorios.
create or replace function public.guardar_mi_registro(p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_foto text := nullif(btrim(coalesce(p_datos->>'foto_url', '')), '');
  v_nom text := btrim(coalesce(p_datos->>'nombres', ''));
  v_ape text := btrim(coalesce(p_datos->>'apellidos', ''));
  v_cel text := btrim(coalesce(p_datos->>'celular', ''));
  v_dir text := btrim(coalesce(p_datos->>'direccion', ''));
begin
  if not exists (select 1 from public.docente_registros where user_id = v_user) and not public.tiene_rol_portal('docente') then
    raise exception 'No tienes un registro de profesor';
  end if;
  if v_nom = '' or v_ape = '' or v_cel = '' or v_dir = '' then raise exception 'Completa nombres, apellidos, celular y dirección'; end if;
  if v_foto is not null and (v_foto !~ '^https://(drive|docs)\.google\.com/' or length(v_foto) > 2000) then
    raise exception 'La foto debe ser un enlace de Google Drive';
  end if;
  insert into public.docente_registros (user_id, nombres, apellidos, celular, direccion, foto_url)
  values (v_user, v_nom, v_ape, v_cel, v_dir, v_foto)
  on conflict (user_id) do update
    set nombres = excluded.nombres, apellidos = excluded.apellidos, celular = excluded.celular,
        direccion = excluded.direccion, foto_url = excluded.foto_url, updated_at = now();
end $$;

-- ============================================================
-- 2. Administración: ver registros y convertirlos en docentes
-- ============================================================
create or replace function public.admin_registros_docentes() returns table (
  user_id uuid, nombres text, apellidos text, celular text, direccion text, foto_url text, correo text,
  docente_id uuid, docente_activo boolean, created_at timestamptz, disponibilidad jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  return query
    select r.user_id, r.nombres, r.apellidos, r.celular, r.direccion, r.foto_url, u.email::text,
           r.docente_id, d.activo, r.created_at,
           coalesce((select jsonb_agg(jsonb_build_object('dia', x.dia, 'hora', x.hora)) from public.docente_disponibilidad x where x.user_id = r.user_id), '[]'::jsonb)
      from public.docente_registros r
      join auth.users u on u.id = r.user_id
      left join public.docentes d on d.id = r.docente_id
     order by (r.docente_id is null) desc, r.created_at desc;
end $$;

create or replace function public.convertir_en_docente(p_user uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.docente_registros; v_correo text; v_doc uuid;
begin
  perform public.cal_exigir_admin();
  select * into r from public.docente_registros where user_id = p_user;
  if not found then raise exception 'Ese usuario no se registró como profesor'; end if;
  if r.docente_id is not null then raise exception 'Ya es docente'; end if;
  select lower(email) into v_correo from auth.users where id = p_user;

  -- Si administración ya había creado al docente con ese correo, se reutiliza en vez de duplicarlo.
  select id into v_doc from public.docentes where lower(btrim(correo)) = v_correo limit 1;
  if v_doc is null then
    begin
      insert into public.docentes (nombre, correo, activo) values (btrim(r.nombres || ' ' || r.apellidos), v_correo, true) returning id into v_doc;
    exception when unique_violation then
      raise exception 'Ya existe un docente llamado «%». Edita su correo para que coincida con el del registro y vuelve a intentar', btrim(r.nombres || ' ' || r.apellidos);
    end;
  else
    update public.docentes set activo = true where id = v_doc;
  end if;
  if exists (select 1 from public.cuenta_roles where rol = 'docente' and docente_id = v_doc and user_id <> p_user) then
    raise exception 'Ese docente ya tiene otra cuenta vinculada';
  end if;
  insert into public.cuenta_roles (user_id, rol, docente_id) values (p_user, 'docente', v_doc) on conflict do nothing;
  update public.docente_registros set docente_id = v_doc, updated_at = now() where user_id = p_user;
  return v_doc;
end $$;

-- Quita el acceso docente (no borra al docente ni su historial: queda inactivo).
create or replace function public.quitar_docente(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_doc uuid;
begin
  perform public.cal_exigir_admin();
  select docente_id into v_doc from public.docente_registros where user_id = p_user;
  if v_doc is null then raise exception 'Ese usuario aún no es docente'; end if;
  delete from public.cuenta_roles where user_id = p_user and rol = 'docente';
  update public.docentes set activo = false where id = v_doc;
  update public.docente_registros set docente_id = null, updated_at = now() where user_id = p_user;
end $$;

-- ============================================================
-- 3. Disponibilidad semanal (franjas de 1 hora: hora = 7 significa 07:00–08:00 … 22 = 22:00–23:00)
-- ============================================================
create table if not exists public.docente_disponibilidad (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia smallint not null check (dia between 1 and 7), -- 1 = lunes … 7 = domingo (igual que salon_horarios.dia)
  hora smallint not null check (hora between 7 and 22),
  primary key (user_id, dia, hora)
);
alter table public.docente_disponibilidad enable row level security;
drop policy if exists "ver mi disponibilidad" on public.docente_disponibilidad;
create policy "ver mi disponibilidad" on public.docente_disponibilidad for select to authenticated using (user_id = (select auth.uid()));

-- Reemplaza TODA la disponibilidad del profesor por la lista enviada: [{ "dia": 1, "hora": 7 }, …].
create or replace function public.guardar_mi_disponibilidad(p_slots jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.docente_registros where user_id = (select auth.uid())) and not public.tiene_rol_portal('docente') then
    raise exception 'No tienes un registro de profesor';
  end if;
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) > 112 then raise exception 'Disponibilidad no válida'; end if;
  delete from public.docente_disponibilidad where user_id = (select auth.uid());
  insert into public.docente_disponibilidad (user_id, dia, hora)
  select distinct (select auth.uid()), x.dia::smallint, x.hora::smallint
    from jsonb_to_recordset(p_slots) as x(dia int, hora int)
   where x.dia between 1 and 7 and x.hora between 7 and 22;
end $$;

-- Para personal de Universa: disponibilidad de los docentes con cuenta (al crear o editar un salón).
create or replace function public.disponibilidad_docentes() returns table (docente_id uuid, dia integer, hora integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.tiene_perfil()) then raise exception 'No tienes permisos para realizar esta acción' using errcode = '42501'; end if;
  return query
    select cr.docente_id, x.dia::integer, x.hora::integer
      from public.cuenta_roles cr join public.docente_disponibilidad x on x.user_id = cr.user_id
     where cr.rol = 'docente' and cr.docente_id is not null;
end $$;

-- Foto y celular de cada docente (sin dirección) para mostrar su perfil al personal.
create or replace function public.docentes_perfil() returns table (docente_id uuid, foto_url text, celular text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.tiene_perfil()) then raise exception 'No tienes permisos para realizar esta acción' using errcode = '42501'; end if;
  return query
    select cr.docente_id, r.foto_url, r.celular
      from public.cuenta_roles cr join public.docente_registros r on r.user_id = cr.user_id
     where cr.rol = 'docente' and cr.docente_id is not null;
end $$;

-- ============================================================
-- 4. Zonas de documentos (Teacher Zone / Student Zone)
-- ============================================================
create or replace function public.tiene_rol_portal(p_rol text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cuenta_roles where user_id = (select auth.uid()) and rol = p_rol)
$$;

create table if not exists public.zona_documentos (
  id uuid primary key default gen_random_uuid(),
  zona text not null check (zona in ('docentes', 'estudiantes')),
  titulo text not null check (btrim(titulo) <> '' and length(titulo) <= 200),
  descripcion text check (length(descripcion) <= 1000),
  categoria text not null default 'General' check (btrim(categoria) <> '' and length(categoria) <= 60),
  url text not null check (url ~ '^https://[^[:space:]]+$' and length(url) <= 2000),
  orden integer not null default 0,
  oculto boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists zona_documentos_zona_idx on public.zona_documentos (zona, categoria, orden);

alter table public.zona_documentos enable row level security;
drop policy if exists "personal ve zonas" on public.zona_documentos;
drop policy if exists "docentes ven su zona" on public.zona_documentos;
drop policy if exists "estudiantes ven su zona" on public.zona_documentos;
create policy "personal ve zonas" on public.zona_documentos for select to authenticated using ((select public.tiene_perfil()));
create policy "docentes ven su zona" on public.zona_documentos for select to authenticated
  using (zona = 'docentes' and not oculto and (select public.tiene_rol_portal('docente')));
create policy "estudiantes ven su zona" on public.zona_documentos for select to authenticated
  using (zona = 'estudiantes' and not oculto and (select public.tiene_rol_portal('estudiante')));

create or replace function public.guardar_zona_documento(p_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id;
begin
  perform public.cal_exigir_admin();
  if p_datos->>'zona' not in ('docentes', 'estudiantes') then raise exception 'Zona no válida'; end if;
  if coalesce(p_datos->>'url', '') !~ '^https://[^[:space:]]+$' then raise exception 'El enlace debe comenzar con https:// y no puede tener espacios'; end if;
  if v_id is null then
    insert into public.zona_documentos (zona, titulo, descripcion, categoria, url, oculto)
    values (p_datos->>'zona', btrim(p_datos->>'titulo'), nullif(btrim(coalesce(p_datos->>'descripcion', '')), ''),
            coalesce(nullif(btrim(coalesce(p_datos->>'categoria', '')), ''), 'General'), btrim(p_datos->>'url'), coalesce((p_datos->>'oculto')::boolean, false))
    returning id into v_id;
  else
    update public.zona_documentos
       set titulo = btrim(p_datos->>'titulo'), descripcion = nullif(btrim(coalesce(p_datos->>'descripcion', '')), ''),
           categoria = coalesce(nullif(btrim(coalesce(p_datos->>'categoria', '')), ''), 'General'), url = btrim(p_datos->>'url'),
           oculto = coalesce((p_datos->>'oculto')::boolean, oculto), updated_at = now()
     where id = v_id;
    if not found then raise exception 'El documento no existe'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.eliminar_zona_documento(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  delete from public.zona_documentos where id = p_id;
end $$;

-- ============================================================
-- 5. Permisos de ejecución
-- ============================================================
revoke execute on function public.registrar_postulante(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_postulante(uuid, jsonb) to service_role;

revoke execute on function
  public.guardar_mi_registro(jsonb), public.admin_registros_docentes(), public.convertir_en_docente(uuid), public.quitar_docente(uuid),
  public.guardar_mi_disponibilidad(jsonb), public.disponibilidad_docentes(), public.docentes_perfil(), public.tiene_rol_portal(text),
  public.guardar_zona_documento(uuid, jsonb), public.eliminar_zona_documento(uuid)
  from public, anon;
grant execute on function
  public.guardar_mi_registro(jsonb), public.admin_registros_docentes(), public.convertir_en_docente(uuid), public.quitar_docente(uuid),
  public.guardar_mi_disponibilidad(jsonb), public.disponibilidad_docentes(), public.docentes_perfil(), public.tiene_rol_portal(text),
  public.guardar_zona_documento(uuid, jsonb), public.eliminar_zona_documento(uuid)
  to authenticated;
