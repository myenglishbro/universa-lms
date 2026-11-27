-- UNIVERSA · Banco de ejercicios: los docentes vuelven a poder crear ejercicios.
-- Administración sigue creando los del banco (públicos, los ven todos los docentes).
-- Cada docente crea los suyos (privados: solo él los ve y los asigna) y puede editar y quitar solo esos.
-- Clasificación como en 20261223110000_banco_unidad.sql, salvo que Assessment pide ciclo y módulo (sin unidad).
-- Repetible (idempotente). Aplicar con `supabase db query --remote --yes --file` (nunca db push).

create or replace function public.guardar_ejercicio(p_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_admin boolean := public.es_admin();
  v_doc uuid := public.docente_actual();
  v_uid uuid := (select auth.uid());
  v_tipo text := p_datos->>'tipo';
  v_e public.ejercicios;
  v_id uuid;
  v_nombre text;
  v_ciclo smallint;
  v_modulo smallint;
  v_unidad smallint;
  v_uso text := nullif(btrim(coalesce(p_datos->>'uso', '')), '');
  v_nivel text := nullif(btrim(coalesce(p_datos->>'nivel', '')), '');
  v_fuente text := nullif(btrim(coalesce(p_datos->>'fuente', '')), '');
begin
  if not v_admin and v_doc is null then raise exception 'No tienes permisos para crear ejercicios' using errcode = '42501'; end if;
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
  if v_uso is null or v_uso not in ('formative', 'assessment') then raise exception 'El uso debe ser Formative o Assessment'; end if;
  if v_ciclo is null or v_nivel is null then raise exception 'Indica el nivel, el ciclo y el uso del ejercicio'; end if;
  if v_ciclo not between 0 and 12 then raise exception 'El ciclo debe estar entre 0 y 12'; end if;
  if v_uso = 'assessment' then
    -- Los Assessment se piden por ciclo y módulo: sin unidad.
    v_unidad := null;
    if v_modulo is null or v_modulo not between 1 and 4 then raise exception 'Indica el módulo del Assessment'; end if;
    if v_ciclo > 0 and (v_ciclo % 2 = 1) <> (v_modulo <= 2) then raise exception 'El ciclo % no corresponde al módulo %', v_ciclo, v_modulo; end if;
  else
    if v_modulo is null or v_unidad is null then raise exception 'Indica el nivel, la unidad y el uso del ejercicio'; end if;
    if v_unidad not between 1 and 12 then raise exception 'La unidad debe estar entre 1 y 12'; end if;
    if v_modulo <> ceil(v_unidad / 3.0)::smallint then raise exception 'La unidad % pertenece al módulo %, no al %', v_unidad, ceil(v_unidad / 3.0)::int, v_modulo; end if;
    if v_ciclo > 0 and (v_ciclo % 2 = 1) <> (v_modulo <= 2) then raise exception 'El ciclo % no corresponde al módulo %', v_ciclo, v_modulo; end if;
  end if;
  if length(coalesce(v_fuente, '')) > 200 then raise exception 'La referencia del libro es demasiado larga (máximo 200 caracteres)'; end if;
  if p_datos->'contenido' is null or p_datos->'datos' is null then raise exception 'El ejercicio no tiene contenido'; end if;
  if v_tipo not in ('writing', 'speaking') and (p_datos->'clave' is null or jsonb_array_length(p_datos->'clave'->'items') = 0) then
    raise exception 'El ejercicio necesita al menos una pregunta con su respuesta';
  end if;
  if v_tipo = 'listening' and coalesce(p_datos->'datos'->>'audio_url', '') !~ '^https://(drive|docs)\.google\.com/' then
    raise exception 'El audio debe ser un enlace de Google Drive';
  end if;

  if p_id is null then
    select case when v_admin then 'Administración' else (select nombre from public.docentes where id = v_doc) end into v_nombre;
    insert into public.ejercicios (titulo, tipo, nivel, tema, ciclo, modulo, unidad, fuente, uso, datos, contenido, clave, publico, autor_user_id, autor_docente_id, autor_nombre)
    values (btrim(p_datos->>'titulo'), v_tipo, v_nivel, nullif(btrim(p_datos->>'tema'), ''), v_ciclo, v_modulo, v_unidad, v_fuente, v_uso,
            p_datos->'datos', p_datos->'contenido', nullif(p_datos->'clave', 'null'::jsonb), v_admin, v_uid,
            case when v_admin then null else v_doc end, coalesce(v_nombre, 'Docente'))
    returning id into v_id;
    return v_id;
  end if;

  select * into v_e from public.ejercicios where id = p_id and activo for update;
  if not found then raise exception 'El ejercicio ya no existe'; end if;
  -- Administración edita el banco; cada docente, solo lo suyo.
  if not ((v_admin and v_e.publico) or v_e.autor_user_id = v_uid) then raise exception 'No puedes editar este ejercicio' using errcode = '42501'; end if;
  if v_e.tipo <> v_tipo then raise exception 'No se puede cambiar el tipo de un ejercicio ya creado'; end if;
  update public.ejercicios
     set titulo = btrim(p_datos->>'titulo'), nivel = v_nivel, tema = nullif(btrim(p_datos->>'tema'), ''), ciclo = v_ciclo, modulo = v_modulo, unidad = v_unidad, fuente = v_fuente, uso = v_uso,
         datos = p_datos->'datos', contenido = p_datos->'contenido', clave = nullif(p_datos->'clave', 'null'::jsonb), updated_at = now()
   where id = p_id;
  return p_id;
end $$;

create or replace function public.archivar_ejercicio(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_e public.ejercicios;
begin
  select * into v_e from public.ejercicios where id = p_id and activo;
  if not found then raise exception 'El ejercicio ya no existe'; end if;
  if not ((public.es_admin() and v_e.publico) or v_e.autor_user_id = (select auth.uid())) then raise exception 'No puedes quitar este ejercicio' using errcode = '42501'; end if;
  update public.ejercicios set activo = false, updated_at = now() where id = p_id;
end $$;

revoke execute on function public.guardar_ejercicio(uuid, jsonb), public.archivar_ejercicio(uuid) from public, anon;
grant execute on function public.guardar_ejercicio(uuid, jsonb), public.archivar_ejercicio(uuid) to authenticated;
