-- Enlace opcional a la carpeta de recursos (Google Drive) de cada salón.
-- Se guarda aparte de guardar_salon para no reescribir esa función: la interfaz lo envía justo después de crear o editar el salón.
alter table public.salones add column if not exists enlace_recursos text;
alter table public.salones drop constraint if exists salones_enlace_recursos_check;
alter table public.salones add constraint salones_enlace_recursos_check
  check (enlace_recursos is null or (length(enlace_recursos) <= 2000 and enlace_recursos ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?([/?#][^[:space:]]*)?$'));

-- Administración guarda (o quita, con vacío) el enlace del salón.
create or replace function public.guardar_enlace_recursos(p_salon uuid, p_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_url text := nullif(btrim(p_url), '');
begin
  perform public.cal_exigir_admin();
  if v_url is not null and (length(v_url) > 2000 or v_url !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?([/?#][^[:space:]]*)?$') then
    raise exception 'El enlace debe comenzar con https:// y no puede tener espacios';
  end if;
  update public.salones set enlace_recursos = v_url where id = p_salon;
  if not found then raise exception 'El salón no existe' using errcode = 'P0002'; end if;
end $$;
revoke execute on function public.guardar_enlace_recursos(uuid, text) from public, anon;
grant execute on function public.guardar_enlace_recursos(uuid, text) to authenticated;

-- Lo leen administración, el docente del salón y los estudiantes matriculados.
create or replace function public.portal_enlace_recursos(p_salon uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_gestionar_curso(p_salon) and not public.es_estudiante_de(p_salon) then
    raise exception 'No tienes acceso a este curso' using errcode = '42501';
  end if;
  return (select enlace_recursos from public.salones where id = p_salon);
end $$;
revoke execute on function public.portal_enlace_recursos(uuid) from public, anon;
grant execute on function public.portal_enlace_recursos(uuid) to authenticated;
