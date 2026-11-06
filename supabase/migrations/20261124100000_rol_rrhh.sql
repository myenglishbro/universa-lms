-- Reparto de accesos del personal:
--   admin     → todo.
--   rrhh      → dashboard, salones grupales, alumnos registrados, profesores registrados y feriados (solo lectura).
--   comercial → solo el dashboard (salones + progreso), sin datos personales de alumnos ni paquetes.
-- La interfaz solo adapta el menú; esto es lo que de verdad protege los datos.

-- 1. Nuevo rol
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check check (rol in ('admin', 'comercial', 'rrhh'));

create or replace function public.es_rrhh() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where user_id = (select auth.uid()) and rol = 'rrhh')
$$;

-- Personal que ve datos de personas (alumnos, matrículas, profesores registrados): administración y RR. HH.
create or replace function public.ve_personas() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where user_id = (select auth.uid()) and rol in ('admin', 'rrhh'))
$$;

revoke execute on function public.es_rrhh(), public.ve_personas() from public, anon;
grant execute on function public.es_rrhh(), public.ve_personas() to authenticated;

-- 2. tiene_perfil() = cualquier personal. Sigue abriendo los datos compartidos (salones, sesiones, docentes, niveles, feriados, catálogo).
create or replace function public.tiene_perfil() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where user_id = (select auth.uid()) and rol in ('admin', 'comercial', 'rrhh'))
$$;

-- 3. Datos de personas: administración y RR. HH. (antes los veía también comercial)
drop policy if exists "consultar alumnos" on public.alumnos;
create policy "consultar alumnos" on public.alumnos for select to authenticated using ((select public.ve_personas()));
drop policy if exists "consultar matriculas" on public.matriculas;
create policy "consultar matriculas" on public.matriculas for select to authenticated using ((select public.ve_personas()));

-- 4. Dinero y asistencia: solo administración
drop policy if exists "consultar paquetes" on public.paquetes_horas;
create policy "consultar paquetes" on public.paquetes_horas for select to authenticated using ((select public.es_admin()));
drop policy if exists "consultar pagos de paquetes" on public.paquete_pagos;
create policy "consultar pagos de paquetes" on public.paquete_pagos for select to authenticated using ((select public.es_admin()));
drop policy if exists "consultar clases de paquetes" on public.paquete_clases;
create policy "consultar clases de paquetes" on public.paquete_clases for select to authenticated using ((select public.es_admin()));
drop policy if exists "consultar movimientos de paquetes" on public.paquete_movimientos;
create policy "consultar movimientos de paquetes" on public.paquete_movimientos for select to authenticated using ((select public.es_admin()));
drop policy if exists "personal consulta registros" on public.clase_registros;
create policy "personal consulta registros" on public.clase_registros for select to authenticated using ((select public.es_admin()));
drop policy if exists "personal consulta asistencias" on public.asistencias;
create policy "personal consulta asistencias" on public.asistencias for select to authenticated using ((select public.es_admin()));

-- 5. Profesores registrados: RR. HH. los consulta (activar, quitar y cambiar claves sigue siendo solo de administración)
create or replace function public.admin_registros_docentes() returns table (
  user_id uuid, nombres text, apellidos text, celular text, direccion text, foto_url text, correo text,
  docente_id uuid, docente_activo boolean, created_at timestamptz, disponibilidad jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.ve_personas()) then
    raise exception 'No tienes permisos para realizar esta acción' using errcode = '42501';
  end if;
  return query
    select r.user_id, r.nombres, r.apellidos, r.celular, r.direccion, r.foto_url, u.email::text,
           r.docente_id, d.activo, r.created_at,
           coalesce((select jsonb_agg(jsonb_build_object('dia', x.dia, 'hora', x.hora)) from public.docente_disponibilidad x where x.user_id = r.user_id), '[]'::jsonb)
      from public.docente_registros r
      join auth.users u on u.id = r.user_id
      left join public.docentes d on d.id = r.docente_id
     order by (r.docente_id is null) desc, r.created_at desc;
end $$;

-- Para dar el rol (ejecutar a mano, con el correo de la persona):
--   insert into public.perfiles (user_id, rol) select id, 'rrhh' from auth.users where email = 'persona@universa.com'
--   on conflict (user_id) do update set rol = excluded.rol;
