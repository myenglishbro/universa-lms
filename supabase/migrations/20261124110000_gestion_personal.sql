-- Gestión del personal desde Universa (pantalla «Usuarios del personal», solo administración):
--  * Una cuenta = un solo rol. Una cuenta de personal (admin, rrhh, comercial) no puede ser a la vez docente, estudiante
--    ni profesor registrado, y viceversa. Cambiar de rol sí lo puede hacer administración (reemplaza el anterior).
--  * Quitar acceso = desactivar (perfiles.activo = false): se corta de inmediato, aunque la persona tenga la sesión abierta,
--    y se puede reactivar. La Edge Function además bloquea el inicio de sesión en Auth.
-- Requiere 20261124100000_rol_rrhh.sql.

alter table public.perfiles add column if not exists activo boolean not null default true;

-- Un perfil desactivado deja de valer en TODAS las políticas (todas pasan por estas funciones).
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where user_id = (select auth.uid()) and rol = 'admin' and activo)
$$;
create or replace function public.es_rrhh() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where user_id = (select auth.uid()) and rol = 'rrhh' and activo)
$$;
create or replace function public.ve_personas() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where user_id = (select auth.uid()) and rol in ('admin', 'rrhh') and activo)
$$;
create or replace function public.tiene_perfil() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where user_id = (select auth.uid()) and rol in ('admin', 'comercial', 'rrhh') and activo)
$$;

-- Lista del personal con su estado (solo administración).
create or replace function public.admin_personal() returns table (
  user_id uuid, correo text, rol text, activo boolean, ultimo_acceso timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.es_admin()) then raise exception 'No tienes permisos para realizar esta acción' using errcode = '42501'; end if;
  return query
    select p.user_id, u.email::text, p.rol, p.activo, u.last_sign_in_at, p.created_at
      from public.perfiles p join auth.users u on u.id = p.user_id
     order by p.activo desc, p.rol, u.email;
end $$;

-- Asigna (o cambia) el rol de personal de una cuenta. Nunca sobre la cuenta de quien llama.
create or replace function public.asignar_rol_personal(p_user uuid, p_rol text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.es_admin()) then raise exception 'No tienes permisos para realizar esta acción' using errcode = '42501'; end if;
  if p_rol not in ('admin', 'rrhh', 'comercial') then raise exception 'Rol no válido'; end if;
  if p_user = (select auth.uid()) then raise exception 'No puedes cambiar tu propio rol'; end if;
  if exists (select 1 from public.cuenta_roles where user_id = p_user) or exists (select 1 from public.docente_registros where user_id = p_user) then
    raise exception 'Esta cuenta ya es de docente o estudiante: una cuenta solo puede tener un rol';
  end if;
  insert into public.perfiles (user_id, rol, activo) values (p_user, p_rol, true)
  on conflict (user_id) do update set rol = excluded.rol;
end $$;

-- Activa o desactiva el acceso de una cuenta de personal. Nunca la propia.
create or replace function public.cambiar_estado_personal(p_user uuid, p_activo boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.es_admin()) then raise exception 'No tienes permisos para realizar esta acción' using errcode = '42501'; end if;
  if p_user = (select auth.uid()) then raise exception 'No puedes quitarte el acceso a ti mismo'; end if;
  update public.perfiles set activo = p_activo where user_id = p_user;
  if not found then raise exception 'Esa cuenta no es de personal'; end if;
end $$;

revoke execute on function public.admin_personal(), public.asignar_rol_personal(uuid, text), public.cambiar_estado_personal(uuid, boolean) from public, anon;
grant execute on function public.admin_personal(), public.asignar_rol_personal(uuid, text), public.cambiar_estado_personal(uuid, boolean) to authenticated;

-- Una cuenta de personal no puede vincularse como docente o estudiante (un solo rol por cuenta).
-- (Si ya existen cuentas con ambos roles, se conservan: esto solo evita crear más.)
create or replace function public.bloquear_rol_doble() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.perfiles where user_id = new.user_id) then
    raise exception 'Esta cuenta es de personal de Universa: una cuenta solo puede tener un rol';
  end if;
  return new;
end $$;
drop trigger if exists cuenta_roles_un_solo_rol on public.cuenta_roles;
create trigger cuenta_roles_un_solo_rol before insert on public.cuenta_roles for each row execute function public.bloquear_rol_doble();
