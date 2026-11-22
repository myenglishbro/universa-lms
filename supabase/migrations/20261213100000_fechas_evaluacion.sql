-- UNIVERSA · Fechas de evaluación por salón.
-- El administrador marca, con anticipación, qué día de un salón habrá evaluación. Es un aviso sobre cualquier día del calendario
-- (no depende de que ese día haya clase). Lo ven administración, comercial, el docente del salón y sus estudiantes matriculados.

create table if not exists public.salon_fechas_evaluacion (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salones(id) on delete cascade,
  fecha date not null,
  titulo text not null check (btrim(titulo) <> '' and length(titulo) <= 80),
  nota text check (nota is null or length(nota) <= 300),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists salon_fechas_evaluacion_unica on public.salon_fechas_evaluacion (salon_id, fecha, lower(btrim(titulo)));
create index if not exists salon_fechas_evaluacion_salon_idx on public.salon_fechas_evaluacion (salon_id, fecha);

alter table public.salon_fechas_evaluacion enable row level security;
revoke all on public.salon_fechas_evaluacion from anon, authenticated;
grant select on public.salon_fechas_evaluacion to authenticated;

drop policy if exists "ver fechas de evaluacion" on public.salon_fechas_evaluacion;
create policy "ver fechas de evaluacion" on public.salon_fechas_evaluacion for select to authenticated
  using ((select public.es_admin()) or public.es_docente_de(salon_id) or public.es_estudiante_de(salon_id) or (select public.tiene_perfil()));

-- Crear o actualizar (con p_id) una fecha de evaluación. Solo administración.
create or replace function public.guardar_fecha_evaluacion(p_salon uuid, p_fecha date, p_titulo text, p_nota text default null, p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
  v_id uuid;
begin
  if not (select public.es_admin()) then raise exception 'No tienes permisos para realizar esta acción' using errcode = '42501'; end if;
  if p_fecha is null then raise exception 'Elige la fecha de la evaluación'; end if;
  if v_titulo = '' then raise exception 'Escribe el nombre de la evaluación'; end if;
  if length(v_titulo) > 80 then raise exception 'El nombre es demasiado largo (máximo 80 caracteres)'; end if;
  if length(coalesce(v_nota, '')) > 300 then raise exception 'La nota es demasiado larga (máximo 300 caracteres)'; end if;
  if not exists (select 1 from public.salones where id = p_salon) then raise exception 'El salón no existe'; end if;
  if exists (select 1 from public.salon_fechas_evaluacion
              where salon_id = p_salon and fecha = p_fecha and lower(btrim(titulo)) = lower(v_titulo) and id is distinct from p_id) then
    raise exception 'Ya hay una evaluación con ese nombre en esa fecha';
  end if;

  if p_id is null then
    insert into public.salon_fechas_evaluacion (salon_id, fecha, titulo, nota, created_by)
    values (p_salon, p_fecha, v_titulo, v_nota, (select auth.uid())) returning id into v_id;
  else
    update public.salon_fechas_evaluacion set fecha = p_fecha, titulo = v_titulo, nota = v_nota
     where id = p_id and salon_id = p_salon returning id into v_id;
    if v_id is null then raise exception 'La fecha de evaluación no existe'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.eliminar_fecha_evaluacion(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.es_admin()) then raise exception 'No tienes permisos para realizar esta acción' using errcode = '42501'; end if;
  delete from public.salon_fechas_evaluacion where id = p_id;
  if not found then raise exception 'La fecha de evaluación no existe'; end if;
end $$;

revoke execute on function public.guardar_fecha_evaluacion(uuid, date, text, text, uuid), public.eliminar_fecha_evaluacion(uuid) from public, anon;
grant execute on function public.guardar_fecha_evaluacion(uuid, date, text, text, uuid), public.eliminar_fecha_evaluacion(uuid) to authenticated;
