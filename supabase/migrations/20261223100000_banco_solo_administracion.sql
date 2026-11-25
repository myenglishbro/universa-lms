-- UNIVERSA · Banco de ejercicios: solo administración crea, edita y quita ejercicios.
-- Los docentes únicamente los ven y los asignan a sus salones (asignar_ejercicio no cambia).
-- Los ejercicios que algún docente creó antes siguen existiendo y se pueden asignar, pero ya nadie salvo administración los toca.
-- Repetible (idempotente). Aplicar con `supabase db query --remote --yes --file` (nunca db push).

do $$
declare v_def text;
begin
  -- guardar_ejercicio: se exige administración al inicio de la función vigente (la de 20261214100000).
  v_def := pg_get_functiondef('public.guardar_ejercicio(uuid, jsonb)'::regprocedure);
  if v_def not like '%Solo administración puede%' then
    v_def := replace(v_def,
      E'  if not v_admin and v_doc is null then raise exception ''No tienes permisos para crear ejercicios'' using errcode = ''42501''; end if;',
      E'  if not v_admin then raise exception ''Solo administración puede crear o editar ejercicios del banco'' using errcode = ''42501''; end if;');
    if v_def not like '%Solo administración puede%' then raise exception 'No se pudo actualizar guardar_ejercicio: revisa su definición'; end if;
    execute v_def;
  end if;
end $$;

create or replace function public.archivar_ejercicio(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_e public.ejercicios;
begin
  if not public.es_admin() then raise exception 'Solo administración puede quitar ejercicios del banco' using errcode = '42501'; end if;
  select * into v_e from public.ejercicios where id = p_id and activo;
  if not found then raise exception 'El ejercicio ya no existe'; end if;
  update public.ejercicios set activo = false, updated_at = now() where id = p_id;
end $$;

revoke execute on function public.guardar_ejercicio(uuid, jsonb), public.archivar_ejercicio(uuid) from public, anon;
grant execute on function public.guardar_ejercicio(uuid, jsonb), public.archivar_ejercicio(uuid) to authenticated;
