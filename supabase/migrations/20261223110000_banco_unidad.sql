-- UNIVERSA · Banco de ejercicios: unidad (1 al 12) y clasificación obligatoria al guardar.
-- Un ejercicio nuevo o editado necesita ciclo (1-12), módulo (1-2), unidad (1-12), uso (Formative/Assessment) y nivel.
-- Los ejercicios que ya existen quedan sin unidad hasta que administración los edite.
-- Reemplaza guardar_ejercicio completo (incluye la regla de 20261223100000: solo administración crea y edita).
-- Repetible (idempotente). Aplicar con `supabase db query --remote --yes --file` (nunca db push).

alter table public.ejercicios add column if not exists unidad smallint;
alter table public.ejercicios drop constraint if exists ejercicios_unidad_ck;
alter table public.ejercicios add constraint ejercicios_unidad_ck check (unidad is null or unidad between 1 and 12);
create index if not exists ejercicios_unidad_idx on public.ejercicios (ciclo, modulo, unidad) where activo;

create or replace function public.guardar_ejercicio(p_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_admin boolean := public.es_admin();
  v_uid uuid := (select auth.uid());
  v_tipo text := p_datos->>'tipo';
  v_e public.ejercicios;
  v_id uuid;
  v_ciclo smallint;
  v_modulo smallint;
  v_unidad smallint;
  v_uso text := nullif(btrim(coalesce(p_datos->>'uso', '')), '');
  v_nivel text := nullif(btrim(coalesce(p_datos->>'nivel', '')), '');
begin
  if not v_admin then raise exception 'Solo administración puede crear o editar ejercicios del banco' using errcode = '42501'; end if;
  if btrim(coalesce(p_datos->>'titulo', '')) = '' then raise exception 'Ponle un título al ejercicio'; end if;
  if v_tipo is null or v_tipo not in ('multiple_choice', 'fill_gap', 'matching', 'order_sentences', 'reading', 'listening', 'writing', 'speaking') then
    raise exception 'Tipo de ejercicio no válido';
  end if;
  begin
    v_ciclo := nullif(btrim(coalesce(p_datos->>'ciclo', '')), '')::smallint;
    v_modulo := nullif(btrim(coalesce(p_datos->>'modulo', '')), '')::smallint;
    v_unidad := nullif(btrim(coalesce(p_datos->>'unidad', '')), '')::smallint;
  exception when others then raise exception 'El ciclo, el módulo y la unidad deben ser números';
  end;
  if v_ciclo is null or v_modulo is null or v_unidad is null or v_uso is null or v_nivel is null then
    raise exception 'Indica el ciclo, el módulo, la unidad, el uso y el nivel del ejercicio';
  end if;
  if v_ciclo not between 1 and 12 then raise exception 'El ciclo debe estar entre 1 y 12'; end if;
  if v_modulo not between 1 and 2 then raise exception 'El módulo debe ser 1 o 2'; end if;
  if v_unidad not between 1 and 12 then raise exception 'La unidad debe estar entre 1 y 12'; end if;
  if v_uso not in ('formative', 'assessment') then raise exception 'El uso debe ser Formative o Assessment'; end if;
  if p_datos->'contenido' is null or p_datos->'datos' is null then raise exception 'El ejercicio no tiene contenido'; end if;
  if v_tipo not in ('writing', 'speaking') and (p_datos->'clave' is null or jsonb_array_length(p_datos->'clave'->'items') = 0) then
    raise exception 'El ejercicio necesita al menos una pregunta con su respuesta';
  end if;
  if v_tipo = 'listening' and coalesce(p_datos->'datos'->>'audio_url', '') !~ '^https://(drive|docs)\.google\.com/' then
    raise exception 'El audio debe ser un enlace de Google Drive';
  end if;

  if p_id is null then
    insert into public.ejercicios (titulo, tipo, nivel, tema, ciclo, modulo, unidad, uso, datos, contenido, clave, publico, autor_user_id, autor_docente_id, autor_nombre)
    values (btrim(p_datos->>'titulo'), v_tipo, v_nivel, nullif(btrim(p_datos->>'tema'), ''), v_ciclo, v_modulo, v_unidad, v_uso,
            p_datos->'datos', p_datos->'contenido', nullif(p_datos->'clave', 'null'::jsonb), true, v_uid, null, 'Administración')
    returning id into v_id;
    return v_id;
  end if;

  select * into v_e from public.ejercicios where id = p_id and activo for update;
  if not found then raise exception 'El ejercicio ya no existe'; end if;
  if v_e.tipo <> v_tipo then raise exception 'No se puede cambiar el tipo de un ejercicio ya creado'; end if;
  update public.ejercicios
     set titulo = btrim(p_datos->>'titulo'), nivel = v_nivel, tema = nullif(btrim(p_datos->>'tema'), ''), ciclo = v_ciclo, modulo = v_modulo, unidad = v_unidad, uso = v_uso,
         datos = p_datos->'datos', contenido = p_datos->'contenido', clave = nullif(p_datos->'clave', 'null'::jsonb), updated_at = now()
   where id = p_id;
  return p_id;
end $$;

revoke execute on function public.guardar_ejercicio(uuid, jsonb) from public, anon;
grant execute on function public.guardar_ejercicio(uuid, jsonb) to authenticated;
