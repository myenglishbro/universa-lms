-- UNIVERSA · Task Board (tickets internos del equipo administrativo).
--
-- QUIÉN ACCEDE: el personal activo con perfil (admin, comercial, rrhh) = public.tiene_perfil(). Docentes, estudiantes, postulantes y
-- personal desactivado no ven ni escriben nada (RLS + funciones). Todos los autorizados ven y gestionan todos los tickets.
-- ESCRITURA: ninguna tabla acepta INSERT/UPDATE/DELETE directo. Todo pasa por funciones SECURITY DEFINER que toman la identidad de
-- auth.uid() (el creador, el autor del comentario y el autor del historial no se pueden falsificar). No hay borrado: solo archivado.
-- Requiere 20261124110000_gestion_personal.sql. Repetible. Una sola transacción.

begin;

create sequence if not exists public.tickets_codigo_seq;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default ('TK-' || lpad(nextval('public.tickets_codigo_seq')::text, 4, '0')),
  titulo text not null check (btrim(titulo) <> '' and length(titulo) <= 200),
  descripcion text check (length(descripcion) <= 5000),
  tipo text not null default 'tarea' check (tipo in ('tarea', 'solicitud', 'incidencia')),
  prioridad text not null default 'media' check (prioridad in ('baja', 'media', 'alta', 'urgente')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_proceso', 'en_espera', 'realizado')),
  responsable_id uuid references auth.users(id) on delete set null,
  creado_por uuid references auth.users(id) on delete set null,
  fecha_limite date,
  archivado boolean not null default false,
  n_comentarios integer not null default 0,
  completado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tickets_estado_idx on public.tickets (archivado, estado, updated_at desc);
create index if not exists tickets_responsable_idx on public.tickets (responsable_id) where responsable_id is not null;

create table if not exists public.ticket_comentarios (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  autor_id uuid references auth.users(id) on delete set null,
  texto text not null check (btrim(texto) <> '' and length(texto) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists ticket_comentarios_ticket_idx on public.ticket_comentarios (ticket_id, created_at);

create table if not exists public.ticket_historial (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  usuario_id uuid references auth.users(id) on delete set null,
  accion text not null, -- creó | cambió | comentó | archivó | restauró
  campo text,
  valor_anterior text,
  valor_nuevo text,
  created_at timestamptz not null default now()
);
create index if not exists ticket_historial_ticket_idx on public.ticket_historial (ticket_id, created_at);

create table if not exists public.ticket_notificaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  tipo text not null check (tipo in ('asignado', 'reasignado')),
  mensaje text not null,
  creado_por uuid references auth.users(id) on delete set null,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ticket_notificaciones_user_idx on public.ticket_notificaciones (user_id, leida, created_at desc);

-- Lectura solo para personal activo; la escritura directa está cerrada.
alter table public.tickets enable row level security;
alter table public.ticket_comentarios enable row level security;
alter table public.ticket_historial enable row level security;
alter table public.ticket_notificaciones enable row level security;
revoke all on public.tickets, public.ticket_comentarios, public.ticket_historial, public.ticket_notificaciones from anon, authenticated;
revoke all on sequence public.tickets_codigo_seq from anon, authenticated;
grant select on public.tickets, public.ticket_comentarios, public.ticket_historial, public.ticket_notificaciones to authenticated;

drop policy if exists "personal ve tickets" on public.tickets;
create policy "personal ve tickets" on public.tickets for select to authenticated using ((select public.tiene_perfil()));
drop policy if exists "personal ve comentarios" on public.ticket_comentarios;
create policy "personal ve comentarios" on public.ticket_comentarios for select to authenticated using ((select public.tiene_perfil()));
drop policy if exists "personal ve historial" on public.ticket_historial;
create policy "personal ve historial" on public.ticket_historial for select to authenticated using ((select public.tiene_perfil()));
drop policy if exists "ver mis notificaciones" on public.ticket_notificaciones;
create policy "ver mis notificaciones" on public.ticket_notificaciones for select to authenticated
  using (user_id = (select auth.uid()) and (select public.tiene_perfil()));

-- ============================================================
-- Funciones
-- ============================================================
create or replace function public.ticket_exigir_personal() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not (select public.tiene_perfil()) then
    raise exception 'No tienes permisos para realizar esta acción' using errcode = '42501';
  end if;
end $$;

-- Personal para elegir responsable y mostrar quién hizo cada cosa (correo). Incluye desactivados para poder nombrar acciones pasadas.
create or replace function public.ticket_personal() returns table (user_id uuid, correo text, rol text, activo boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.ticket_exigir_personal();
  return query
    select p.user_id, u.email::text, p.rol, p.activo
      from public.perfiles p join auth.users u on u.id = p.user_id
     where p.rol in ('admin', 'comercial', 'rrhh')
     order by p.activo desc, u.email;
end $$;

create or replace function public.ticket_validar_responsable(p_user uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_user is not null and not exists (select 1 from public.perfiles where user_id = p_user and activo and rol in ('admin', 'comercial', 'rrhh')) then
    raise exception 'El responsable debe ser un usuario administrativo activo';
  end if;
end $$;

create or replace function public.ticket_crear(p_titulo text, p_descripcion text, p_tipo text, p_prioridad text, p_responsable uuid, p_fecha_limite date)
returns public.tickets
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); t public.tickets;
begin
  perform public.ticket_exigir_personal();
  perform public.ticket_validar_responsable(p_responsable);
  if btrim(coalesce(p_titulo, '')) = '' then raise exception 'El título es obligatorio'; end if;
  insert into public.tickets (titulo, descripcion, tipo, prioridad, responsable_id, creado_por, fecha_limite)
  values (btrim(p_titulo), nullif(btrim(coalesce(p_descripcion, '')), ''), coalesce(nullif(p_tipo, ''), 'tarea'), coalesce(nullif(p_prioridad, ''), 'media'),
          p_responsable, v_uid, p_fecha_limite)
  returning * into t;
  insert into public.ticket_historial (ticket_id, usuario_id, accion) values (t.id, v_uid, 'creó');
  if p_responsable is not null and p_responsable <> v_uid then
    insert into public.ticket_notificaciones (user_id, ticket_id, tipo, mensaje, creado_por)
    values (p_responsable, t.id, 'asignado', 'Te asignaron ' || t.codigo || ': ' || t.titulo, v_uid);
  end if;
  return t;
end $$;

-- Cambios sobre un ticket (solo se aplican las claves enviadas): titulo, descripcion, tipo, prioridad, estado, responsable_id, fecha_limite.
create or replace function public.ticket_actualizar(p_id uuid, p_cambios jsonb) returns public.tickets
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v public.tickets; n public.tickets;
begin
  perform public.ticket_exigir_personal();
  select * into v from public.tickets where id = p_id for update;
  if not found then raise exception 'El ticket no existe'; end if;
  if v.archivado then raise exception 'El ticket está archivado: restáuralo para editarlo'; end if;
  n := v;
  if p_cambios ? 'titulo' then
    n.titulo := btrim(coalesce(p_cambios ->> 'titulo', ''));
    if n.titulo = '' then raise exception 'El título es obligatorio'; end if;
  end if;
  if p_cambios ? 'descripcion' then n.descripcion := nullif(btrim(coalesce(p_cambios ->> 'descripcion', '')), ''); end if;
  if p_cambios ? 'tipo' then n.tipo := p_cambios ->> 'tipo'; end if;
  if p_cambios ? 'prioridad' then n.prioridad := p_cambios ->> 'prioridad'; end if;
  if p_cambios ? 'estado' then n.estado := p_cambios ->> 'estado'; end if;
  if p_cambios ? 'fecha_limite' then n.fecha_limite := nullif(p_cambios ->> 'fecha_limite', '')::date; end if;
  if p_cambios ? 'responsable_id' then
    n.responsable_id := nullif(p_cambios ->> 'responsable_id', '')::uuid;
    if n.responsable_id is distinct from v.responsable_id then perform public.ticket_validar_responsable(n.responsable_id); end if;
  end if;

  update public.tickets set titulo = n.titulo, descripcion = n.descripcion, tipo = n.tipo, prioridad = n.prioridad, estado = n.estado,
         fecha_limite = n.fecha_limite, responsable_id = n.responsable_id, updated_at = now(),
         completado_at = case when n.estado = 'realizado' then coalesce(v.completado_at, now()) else null end
   where id = p_id returning * into n;

  insert into public.ticket_historial (ticket_id, usuario_id, accion, campo, valor_anterior, valor_nuevo)
  select p_id, v_uid, 'cambió', c.campo, left(c.antes, 200), left(c.despues, 200)
    from (values
      ('titulo', v.titulo, n.titulo),
      ('descripcion', v.descripcion, n.descripcion),
      ('tipo', v.tipo, n.tipo),
      ('prioridad', v.prioridad, n.prioridad),
      ('estado', v.estado, n.estado),
      ('responsable', v.responsable_id::text, n.responsable_id::text),
      ('fecha_limite', v.fecha_limite::text, n.fecha_limite::text)
    ) as c(campo, antes, despues)
   where c.antes is distinct from c.despues;

  if n.responsable_id is not null and n.responsable_id is distinct from v.responsable_id and n.responsable_id <> v_uid then
    insert into public.ticket_notificaciones (user_id, ticket_id, tipo, mensaje, creado_por)
    values (n.responsable_id, p_id, case when v.responsable_id is null then 'asignado' else 'reasignado' end,
            case when v.responsable_id is null then 'Te asignaron ' else 'Te reasignaron ' end || n.codigo || ': ' || n.titulo, v_uid);
  end if;
  return n;
end $$;

create or replace function public.ticket_comentar(p_id uuid, p_texto text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v public.tickets;
begin
  perform public.ticket_exigir_personal();
  select * into v from public.tickets where id = p_id for update;
  if not found then raise exception 'El ticket no existe'; end if;
  if v.archivado then raise exception 'El ticket está archivado: restáuralo para comentar'; end if;
  if btrim(coalesce(p_texto, '')) = '' then raise exception 'Escribe un comentario'; end if;
  insert into public.ticket_comentarios (ticket_id, autor_id, texto) values (p_id, v_uid, btrim(p_texto));
  insert into public.ticket_historial (ticket_id, usuario_id, accion) values (p_id, v_uid, 'comentó');
  update public.tickets set n_comentarios = n_comentarios + 1, updated_at = now() where id = p_id;
end $$;

create or replace function public.ticket_archivar(p_id uuid, p_archivar boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v public.tickets;
begin
  perform public.ticket_exigir_personal();
  select * into v from public.tickets where id = p_id for update;
  if not found then raise exception 'El ticket no existe'; end if;
  if v.archivado = p_archivar then return; end if;
  update public.tickets set archivado = p_archivar, updated_at = now() where id = p_id;
  insert into public.ticket_historial (ticket_id, usuario_id, accion) values (p_id, v_uid, case when p_archivar then 'archivó' else 'restauró' end);
end $$;

-- Marca como leídas mis notificaciones (todas, o solo las indicadas).
create or replace function public.ticket_marcar_leidas(p_ids uuid[] default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.ticket_exigir_personal();
  update public.ticket_notificaciones set leida = true
   where user_id = (select auth.uid()) and not leida and (p_ids is null or id = any (p_ids));
end $$;

revoke execute on function public.ticket_exigir_personal(), public.ticket_validar_responsable(uuid) from public, anon, authenticated;
revoke execute on function public.ticket_personal(), public.ticket_crear(text, text, text, text, uuid, date), public.ticket_actualizar(uuid, jsonb),
  public.ticket_comentar(uuid, text), public.ticket_archivar(uuid, boolean), public.ticket_marcar_leidas(uuid[]) from public, anon;
grant execute on function public.ticket_personal(), public.ticket_crear(text, text, text, text, uuid, date), public.ticket_actualizar(uuid, jsonb),
  public.ticket_comentar(uuid, text), public.ticket_archivar(uuid, boolean), public.ticket_marcar_leidas(uuid[]) to authenticated;

-- Actualización en vivo entre usuarios (Realtime respeta las políticas RLS de arriba).
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['tickets', 'ticket_comentarios', 'ticket_historial', 'ticket_notificaciones'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;

commit;
