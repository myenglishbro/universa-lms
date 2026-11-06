-- UNIVERSA · Migración inicial: roles, programas, docentes, salones y horarios.
-- Seguridad: RLS activa en todas las tablas; el rol público (anon) no tiene acceso.
-- Roles: 'admin' (crea y edita) y 'comercial' (solo consulta). Se guardan en public.perfiles.
-- Se ejecuta como una sola transacción: si algo falla, no queda nada a medias.
begin;

-- ============================================================
-- 1. Perfiles y roles
-- ============================================================
create table public.perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rol text not null default 'comercial' check (rol in ('admin', 'comercial')),
  created_at timestamptz not null default now()
);

-- Todo usuario nuevo nace con el rol de menor privilegio. Para ascender a admin se usa SQL (ver README).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (user_id, rol) values (new.id, 'comercial') on conflict do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuarios que ya existan antes de esta migración
insert into public.perfiles (user_id, rol)
select id, 'comercial' from auth.users on conflict do nothing;

-- Funciones auxiliares para las políticas (security definer para poder leer perfiles sin recursión de RLS)
create function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where user_id = (select auth.uid()) and rol = 'admin')
$$;

create function public.tiene_perfil() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where user_id = (select auth.uid()))
$$;

revoke execute on function public.es_admin(), public.tiene_perfil() from public, anon;
grant execute on function public.es_admin(), public.tiene_perfil() to authenticated;

-- ============================================================
-- 2. Tablas académicas
-- ============================================================
create table public.programas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden smallint not null
);

insert into public.programas (nombre, orden) values
  ('Starter', 1), ('Prebásico', 2), ('Básico', 3), ('Intermedio', 4),
  ('Avanzado', 5), ('Experto', 6), ('Proficiente', 7);

create table public.docentes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  correo text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index docentes_nombre_unico on public.docentes (lower(btrim(nombre)));

create table public.salones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nombre text not null,
  programa_id uuid not null references public.programas(id),
  curso text,
  docente_id uuid references public.docentes(id) on delete set null,
  fecha_inicio date not null,
  fecha_fin_estimada date,
  capacidad integer not null check (capacidad > 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_curso', 'finalizado')),
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fecha_fin_estimada is null or fecha_fin_estimada >= fecha_inicio)
);
create unique index salones_codigo_unico on public.salones (lower(btrim(codigo)));
create index salones_programa_idx on public.salones (programa_id);
create index salones_docente_idx on public.salones (docente_id);

create table public.salon_horarios (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salones(id) on delete cascade,
  dia smallint not null check (dia between 1 and 7), -- 1 = lunes ... 7 = domingo
  hora_inicio time not null,
  hora_fin time not null,
  check (hora_fin > hora_inicio)
);
create index salon_horarios_salon_idx on public.salon_horarios (salon_id);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger salones_updated_at before update on public.salones
  for each row execute function public.set_updated_at();

-- ============================================================
-- 3. Permisos de tabla (mínimos) y RLS
-- ============================================================
revoke all on public.perfiles, public.programas, public.docentes, public.salones, public.salon_horarios
  from anon, authenticated;

grant select on public.perfiles, public.programas to authenticated;
grant select, insert, update on public.docentes, public.salones to authenticated;
grant select, insert, update, delete on public.salon_horarios to authenticated;
-- Nadie borra salones ni docentes desde la aplicación.

alter table public.perfiles       enable row level security;
alter table public.programas      enable row level security;
alter table public.docentes       enable row level security;
alter table public.salones        enable row level security;
alter table public.salon_horarios enable row level security;

-- Cada usuario solo ve su propio perfil; nadie puede modificar roles desde la aplicación.
create policy "ver mi perfil" on public.perfiles for select to authenticated
  using (user_id = (select auth.uid()));

-- Consulta: cualquier usuario con perfil (admin o comercial)
create policy "consultar programas" on public.programas for select to authenticated
  using ((select public.tiene_perfil()));
create policy "consultar docentes" on public.docentes for select to authenticated
  using ((select public.tiene_perfil()));
create policy "consultar salones" on public.salones for select to authenticated
  using ((select public.tiene_perfil()));
create policy "consultar horarios" on public.salon_horarios for select to authenticated
  using ((select public.tiene_perfil()));

-- Escritura: solo admin
create policy "admin crea docentes" on public.docentes for insert to authenticated
  with check ((select public.es_admin()));
create policy "admin edita docentes" on public.docentes for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

create policy "admin crea salones" on public.salones for insert to authenticated
  with check ((select public.es_admin()));
create policy "admin edita salones" on public.salones for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

create policy "admin crea horarios" on public.salon_horarios for insert to authenticated
  with check ((select public.es_admin()));
create policy "admin edita horarios" on public.salon_horarios for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
create policy "admin borra horarios" on public.salon_horarios for delete to authenticated
  using ((select public.es_admin()));

-- ============================================================
-- 4. Guardado transaccional: salón + horarios en una sola operación
-- ============================================================
-- p_id null = crear, con valor = editar. p_horarios: [{"dia":1,"hora_inicio":"18:00","hora_fin":"19:30"}, ...]
-- Se ejecuta con los permisos de quien llama (RLS aplica). Si algo falla, se revierte todo.
-- Importante: no recibe ni modifica ningún dato de matrícula; la fecha de fin es un valor independiente.
create function public.guardar_salon(p_id uuid, p_salon jsonb, p_horarios jsonb)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid;
begin
  if not (select public.es_admin()) then
    raise exception 'No tienes permisos para realizar esta acción' using errcode = '42501';
  end if;

  if p_id is null then
    insert into public.salones (
      codigo, nombre, programa_id, curso, docente_id, fecha_inicio,
      fecha_fin_estimada, capacidad, estado, observaciones
    ) values (
      btrim(p_salon->>'codigo'),
      btrim(p_salon->>'nombre'),
      (p_salon->>'programa_id')::uuid,
      nullif(btrim(p_salon->>'curso'), ''),
      nullif(p_salon->>'docente_id', '')::uuid,
      (p_salon->>'fecha_inicio')::date,
      nullif(p_salon->>'fecha_fin_estimada', '')::date,
      (p_salon->>'capacidad')::integer,
      coalesce(nullif(p_salon->>'estado', ''), 'pendiente'),
      nullif(btrim(p_salon->>'observaciones'), '')
    ) returning id into v_id;
  else
    update public.salones set
      codigo = btrim(p_salon->>'codigo'),
      nombre = btrim(p_salon->>'nombre'),
      programa_id = (p_salon->>'programa_id')::uuid,
      curso = nullif(btrim(p_salon->>'curso'), ''),
      docente_id = nullif(p_salon->>'docente_id', '')::uuid,
      fecha_inicio = (p_salon->>'fecha_inicio')::date,
      fecha_fin_estimada = nullif(p_salon->>'fecha_fin_estimada', '')::date,
      capacidad = (p_salon->>'capacidad')::integer,
      estado = coalesce(nullif(p_salon->>'estado', ''), 'pendiente'),
      observaciones = nullif(btrim(p_salon->>'observaciones'), '')
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'El salón no existe' using errcode = 'P0002';
    end if;
  end if;

  delete from public.salon_horarios where salon_id = v_id;

  insert into public.salon_horarios (salon_id, dia, hora_inicio, hora_fin)
  select v_id, (h->>'dia')::smallint, (h->>'hora_inicio')::time, (h->>'hora_fin')::time
  from jsonb_array_elements(coalesce(p_horarios, '[]'::jsonb)) as h;

  return v_id;
end $$;

revoke execute on function public.guardar_salon(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.guardar_salon(uuid, jsonb, jsonb) to authenticated;

commit;
