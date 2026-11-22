-- UNIVERSA · Banco de ejercicios: clasificación por ciclo (1 al 12), módulo (1 o 2 dentro del ciclo) y uso (Formative o Assessment).
-- Los tres campos son opcionales: los ejercicios que ya existen quedan «sin clasificar» hasta que se editen.

alter table public.ejercicios add column if not exists ciclo smallint;
alter table public.ejercicios add column if not exists modulo smallint;
alter table public.ejercicios add column if not exists uso text;
alter table public.ejercicios drop constraint if exists ejercicios_ciclo_ck;
alter table public.ejercicios add constraint ejercicios_ciclo_ck check (ciclo is null or ciclo between 1 and 12);
alter table public.ejercicios drop constraint if exists ejercicios_modulo_ck;
alter table public.ejercicios add constraint ejercicios_modulo_ck check (modulo is null or modulo between 1 and 2);
alter table public.ejercicios drop constraint if exists ejercicios_uso_ck;
alter table public.ejercicios add constraint ejercicios_uso_ck check (uso is null or uso in ('formative', 'assessment'));
create index if not exists ejercicios_clasificacion_idx on public.ejercicios (ciclo, modulo, uso) where activo;

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
  v_uso text := nullif(btrim(coalesce(p_datos->>'uso', '')), '');
begin
  if not v_admin and v_doc is null then raise exception 'No tienes permisos para crear ejercicios' using errcode = '42501'; end if;
  if btrim(coalesce(p_datos->>'titulo', '')) = '' then raise exception 'Ponle un título al ejercicio'; end if;
  if v_tipo is null or v_tipo not in ('multiple_choice', 'fill_gap', 'matching', 'order_sentences', 'reading', 'listening', 'writing', 'speaking') then
    raise exception 'Tipo de ejercicio no válido';
  end if;
  begin
    v_ciclo := nullif(btrim(coalesce(p_datos->>'ciclo', '')), '')::smallint;
    v_modulo := nullif(btrim(coalesce(p_datos->>'modulo', '')), '')::smallint;
  exception when others then raise exception 'El ciclo y el módulo deben ser números';
  end;
  if v_ciclo is not null and v_ciclo not between 1 and 12 then raise exception 'El ciclo debe estar entre 1 y 12'; end if;
  if v_modulo is not null and v_modulo not between 1 and 2 then raise exception 'El módulo debe ser 1 o 2'; end if;
  if v_uso is not null and v_uso not in ('formative', 'assessment') then raise exception 'El uso debe ser Formative o Assessment'; end if;
  if p_datos->'contenido' is null or p_datos->'datos' is null then raise exception 'El ejercicio no tiene contenido'; end if;
  if v_tipo not in ('writing', 'speaking') and (p_datos->'clave' is null or jsonb_array_length(p_datos->'clave'->'items') = 0) then
    raise exception 'El ejercicio necesita al menos una pregunta con su respuesta';
  end if;
  if v_tipo = 'listening' and coalesce(p_datos->'datos'->>'audio_url', '') !~ '^https://(drive|docs)\.google\.com/' then
    raise exception 'El audio debe ser un enlace de Google Drive';
  end if;

  if p_id is null then
    select case when v_admin then 'Administración' else (select nombre from public.docentes where id = v_doc) end into v_nombre;
    insert into public.ejercicios (titulo, tipo, nivel, tema, ciclo, modulo, uso, datos, contenido, clave, publico, autor_user_id, autor_docente_id, autor_nombre)
    values (btrim(p_datos->>'titulo'), v_tipo, nullif(btrim(p_datos->>'nivel'), ''), nullif(btrim(p_datos->>'tema'), ''), v_ciclo, v_modulo, v_uso,
            p_datos->'datos', p_datos->'contenido', nullif(p_datos->'clave', 'null'::jsonb), v_admin, v_uid,
            case when v_admin then null else v_doc end, coalesce(v_nombre, 'Docente'))
    returning id into v_id;
    return v_id;
  end if;

  select * into v_e from public.ejercicios where id = p_id and activo for update;
  if not found then raise exception 'El ejercicio ya no existe'; end if;
  -- Administración edita el banco; cada docente, solo lo suyo.
  if not ((v_admin and v_e.publico) or (v_e.autor_user_id = v_uid)) then raise exception 'No puedes editar este ejercicio' using errcode = '42501'; end if;
  if v_e.tipo <> v_tipo then raise exception 'No se puede cambiar el tipo de un ejercicio ya creado'; end if;
  update public.ejercicios
     set titulo = btrim(p_datos->>'titulo'), nivel = nullif(btrim(p_datos->>'nivel'), ''), tema = nullif(btrim(p_datos->>'tema'), ''), ciclo = v_ciclo, modulo = v_modulo, uso = v_uso,
         datos = p_datos->'datos', contenido = p_datos->'contenido', clave = nullif(p_datos->'clave', 'null'::jsonb), updated_at = now()
   where id = p_id;
  return p_id;
end $$;

