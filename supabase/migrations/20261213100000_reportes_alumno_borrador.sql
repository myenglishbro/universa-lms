-- Reporte del ciclo: lo que escribe quien lo emite (comentarios, informe por habilidad, siguiente paso…) se guarda por salón, estudiante y ciclo
-- para no volver a escribirlo. Solo lo leen y escriben quienes gestionan el curso (administración y el docente del salón), igual que el informe.
begin;

create table if not exists public.reportes_alumno (
  salon_id uuid not null references public.salones(id) on delete cascade,
  alumno_id uuid not null references public.alumnos(id) on delete cascade,
  ciclo text not null default '', -- '' = sin ciclo
  datos jsonb not null default '{}'::jsonb check (jsonb_typeof(datos) = 'object' and length(datos::text) <= 40000),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (salon_id, alumno_id, ciclo)
);
create index if not exists reportes_alumno_alumno_idx on public.reportes_alumno (alumno_id);
alter table public.reportes_alumno enable row level security; -- sin políticas: solo se accede por las funciones de abajo

-- Guarda (o reemplaza) el borrador del reporte de un ciclo.
create or replace function public.guardar_reporte_alumno(p_salon uuid, p_alumno uuid, p_ciclo text, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  if not exists (select 1 from public.matriculas where salon_id = p_salon and alumno_id = p_alumno) then raise exception 'El estudiante no está matriculado en este salón'; end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then raise exception 'Datos del reporte no válidos'; end if;
  if length(p_datos::text) > 40000 then raise exception 'El reporte es demasiado largo'; end if;
  insert into public.reportes_alumno (salon_id, alumno_id, ciclo, datos, updated_at, updated_by)
  values (p_salon, p_alumno, coalesce(p_ciclo, ''), p_datos, now(), (select auth.uid()))
  on conflict (salon_id, alumno_id, ciclo) do update set datos = excluded.datos, updated_at = now(), updated_by = excluded.updated_by;
end $$;

-- Borradores guardados de un estudiante en un salón: { "<ciclo>": { …datos } }.
create or replace function public.leer_reportes_alumno(p_salon uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  return coalesce((select jsonb_object_agg(ciclo, datos) from public.reportes_alumno where salon_id = p_salon and alumno_id = p_alumno), '{}'::jsonb);
end $$;

revoke execute on function public.guardar_reporte_alumno(uuid, uuid, text, jsonb), public.leer_reportes_alumno(uuid, uuid) from public, anon, authenticated;
grant execute on function public.guardar_reporte_alumno(uuid, uuid, text, jsonb), public.leer_reportes_alumno(uuid, uuid) to authenticated;

commit;
