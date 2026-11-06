-- UNIVERSA · Creación de accesos desde Universa (Edge Function `gestionar-acceso`).
--
--  * La cuenta de Supabase Auth la crea la Edge Function con la API administrativa (service_role solo en el servidor) y la
--    vincula con vincular_cuenta() EJECUTADA CON LA SESIÓN DEL ADMINISTRADOR: es Postgres quien verifica que sea admin.
--  * Nunca se guardan contraseñas: Supabase Auth guarda solo su hash. Aquí únicamente se guarda si la persona debe cambiarla.
--  * cuenta_seguridad(user_id, debe_cambiar_clave): se marca al crear el acceso y la propia persona lo apaga al cambiar su
--    contraseña (confirmar_cambio_clave). Cada usuario solo puede leer SU fila; nadie escribe directamente.
--  * Funciones de servidor (cuenta_de_persona, usuario_es_personal, marcar_cambio_clave): solo ejecutables por service_role.
--
-- Repetible. Requiere 20261113100000_portales.sql.

-- ============================================================
-- 1. Estado de seguridad de la cuenta
-- ============================================================
create table if not exists public.cuenta_seguridad (
  user_id uuid primary key references auth.users(id) on delete cascade,
  debe_cambiar_clave boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.cuenta_seguridad enable row level security;
revoke all on public.cuenta_seguridad from anon, authenticated;
grant select on public.cuenta_seguridad to authenticated;
drop policy if exists "ver mi seguridad" on public.cuenta_seguridad;
create policy "ver mi seguridad" on public.cuenta_seguridad for select to authenticated using (user_id = (select auth.uid()));

-- La persona confirma que ya cambió su contraseña inicial (solo afecta a su propia fila).
create or replace function public.confirmar_cambio_clave() returns void
language sql security definer set search_path = '' as $$
  update public.cuenta_seguridad set debe_cambiar_clave = false, updated_at = now() where user_id = (select auth.uid())
$$;

-- ============================================================
-- 2. Funciones solo para el servidor (Edge Function con service_role)
-- ============================================================
create or replace function public.marcar_cambio_clave(p_user uuid, p_valor boolean) returns void
language sql security definer set search_path = '' as $$
  insert into public.cuenta_seguridad (user_id, debe_cambiar_clave) values (p_user, coalesce(p_valor, true))
  on conflict (user_id) do update set debe_cambiar_clave = excluded.debe_cambiar_clave, updated_at = now()
$$;

create or replace function public.cuenta_de_persona(p_rol text, p_persona uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select user_id from public.cuenta_roles where rol = p_rol and coalesce(alumno_id, docente_id) = p_persona limit 1
$$;

create or replace function public.usuario_es_personal(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where user_id = p_user)
$$;

-- ============================================================
-- 3. Consultas de administración
-- ============================================================
-- 'libre' si la persona aún no tiene cuenta; 'vinculada' si ya la tiene. Error si la persona no existe.
create or replace function public.acceso_disponible(p_rol text, p_persona uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_existe boolean;
begin
  perform public.cal_exigir_admin();
  if p_rol = 'estudiante' then select exists (select 1 from public.alumnos where id = p_persona) into v_existe;
  elsif p_rol = 'docente' then select exists (select 1 from public.docentes where id = p_persona) into v_existe;
  else raise exception 'Rol no válido'; end if;
  if not v_existe then raise exception 'La persona no existe'; end if;
  return case when exists (select 1 from public.cuenta_roles where rol = p_rol and coalesce(alumno_id, docente_id) = p_persona) then 'vinculada' else 'libre' end;
end $$;

-- Reemplaza la versión anterior: añade si la persona debe cambiar su contraseña inicial.
drop function if exists public.cuentas_de_persona(text, uuid);
create function public.cuentas_de_persona(p_rol text, p_persona uuid) returns table (estado text, correo text, debe_cambiar boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  return query
    select 'vinculada'::text, u.email::text, coalesce(cs.debe_cambiar_clave, false)
      from public.cuenta_roles cr join auth.users u on u.id = cr.user_id
      left join public.cuenta_seguridad cs on cs.user_id = cr.user_id
     where cr.rol = p_rol and coalesce(cr.alumno_id, cr.docente_id) = p_persona
    union all
    select 'invitada'::text, i.correo, false from public.cuenta_invitaciones i
     where i.estado = 'pendiente' and i.rol = p_rol and coalesce(i.alumno_id, i.docente_id) = p_persona;
end $$;

-- ============================================================
-- 4. Permisos de ejecución
-- ============================================================
revoke execute on function public.marcar_cambio_clave(uuid, boolean), public.cuenta_de_persona(text, uuid), public.usuario_es_personal(uuid)
  from public, anon, authenticated;
grant execute on function public.marcar_cambio_clave(uuid, boolean), public.cuenta_de_persona(text, uuid), public.usuario_es_personal(uuid) to service_role;

revoke execute on function public.confirmar_cambio_clave(), public.acceso_disponible(text, uuid), public.cuentas_de_persona(text, uuid) from public, anon;
grant execute on function public.confirmar_cambio_clave(), public.acceso_disponible(text, uuid), public.cuentas_de_persona(text, uuid) to authenticated;
