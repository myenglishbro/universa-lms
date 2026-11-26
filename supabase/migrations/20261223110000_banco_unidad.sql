-- UNIVERSA · Banco de ejercicios: clasificación por nivel + unidad y origen en el libro.
--
-- Estructura del currículo:
--   * Cada nivel tiene 2 ciclos (el Funcional solo el ciclo 0, que contiene los 4 módulos), 4 módulos y 12 unidades.
--   * Módulo 1 = unidades 1-3, Módulo 2 = 4-6, Módulo 3 = 7-9, Módulo 4 = 10-12 (igual en todos los niveles).
--   * Primer ciclo del nivel = módulos 1 y 2; segundo ciclo = módulos 3 y 4.
-- Por eso en la base: ciclo 0 al 12, módulo 1 al 4 (dentro del nivel), unidad 1 al 12, y el módulo debe ser coherente con la unidad y el ciclo.
-- Se agrega `fuente` (texto libre: página y ejercicio del libro del nivel). Nivel, uso, ciclo, módulo y unidad son obligatorios al guardar.
--
-- Los ejercicios que ya existen: el módulo antiguo era «1 o 2 dentro del ciclo», así que en ciclos pares (segundo ciclo del nivel) pasa a ser 3 o 4.
-- Siguen sin unidad hasta que administración los edite.
-- Reemplaza guardar_ejercicio completo (incluye la regla de 20261223100000: solo administración crea y edita).
-- Repetible (idempotente). Aplicar con `supabase db query --remote --yes --file` (nunca db push).

alter table public.ejercicios add column if not exists unidad smallint;
alter table public.ejercicios add column if not exists fuente text;

alter table public.ejercicios drop constraint if exists ejercicios_ciclo_ck;
alter table public.ejercicios drop constraint if exists ejercicios_modulo_ck;
alter table public.ejercicios drop constraint if exists ejercicios_unidad_ck;
alter table public.ejercicios drop constraint if exists ejercicios_fuente_ck;

-- Conversión del módulo antiguo (1-2 dentro del ciclo) al módulo del nivel (1-4). Solo si aún tiene el significado antiguo.
update public.ejercicios set modulo = modulo + 2 where ciclo is not null and ciclo > 0 and ciclo % 2 = 0 and modulo in (1, 2) and unidad is null;

alter table public.ejercicios add constraint ejercicios_ciclo_ck check (ciclo is null or ciclo between 0 and 12);
alter table public.ejercicios add constraint ejercicios_modulo_ck check (modulo is null or modulo between 1 and 4);
alter table public.ejercicios add constraint ejercicios_unidad_ck check (unidad is null or unidad between 1 and 12);
alter table public.ejercicios add constraint ejercicios_fuente_ck check (fuente is null or length(fuente) <= 200);
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
  v_fuente text := nullif(btrim(coalesce(p_datos->>'fuente', '')), '');
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
    raise exception 'Indica el nivel, la unidad y el uso del ejercicio';
  end if;
  if v_ciclo not between 0 and 12 then raise exception 'El ciclo debe estar entre 0 y 12'; end if;
  if v_unidad not between 1 and 12 then raise exception 'La unidad debe estar entre 1 y 12'; end if;
  -- El módulo sale de la unidad (3 unidades por módulo) y el ciclo de ambos: ciclo impar = módulos 1-2, ciclo par = módulos 3-4, ciclo 0 = los 4.
  if v_modulo <> ceil(v_unidad / 3.0)::smallint then raise exception 'La unidad % pertenece al módulo %, no al %', v_unidad, ceil(v_unidad / 3.0)::int, v_modulo; end if;
  if v_ciclo > 0 and (v_ciclo % 2 = 1) <> (v_modulo <= 2) then raise exception 'El ciclo % no corresponde al módulo %', v_ciclo, v_modulo; end if;
  if v_uso not in ('formative', 'assessment') then raise exception 'El uso debe ser Formative o Assessment'; end if;
  if length(coalesce(v_fuente, '')) > 200 then raise exception 'La referencia del libro es demasiado larga (máximo 200 caracteres)'; end if;
  if p_datos->'contenido' is null or p_datos->'datos' is null then raise exception 'El ejercicio no tiene contenido'; end if;
  if v_tipo not in ('writing', 'speaking') and (p_datos->'clave' is null or jsonb_array_length(p_datos->'clave'->'items') = 0) then
    raise exception 'El ejercicio necesita al menos una pregunta con su respuesta';
  end if;
  if v_tipo = 'listening' and coalesce(p_datos->'datos'->>'audio_url', '') !~ '^https://(drive|docs)\.google\.com/' then
    raise exception 'El audio debe ser un enlace de Google Drive';
  end if;

  if p_id is null then
    insert into public.ejercicios (titulo, tipo, nivel, tema, ciclo, modulo, unidad, fuente, uso, datos, contenido, clave, publico, autor_user_id, autor_docente_id, autor_nombre)
    values (btrim(p_datos->>'titulo'), v_tipo, v_nivel, nullif(btrim(p_datos->>'tema'), ''), v_ciclo, v_modulo, v_unidad, v_fuente, v_uso,
            p_datos->'datos', p_datos->'contenido', nullif(p_datos->'clave', 'null'::jsonb), true, v_uid, null, 'Administración')
    returning id into v_id;
    return v_id;
  end if;

  select * into v_e from public.ejercicios where id = p_id and activo for update;
  if not found then raise exception 'El ejercicio ya no existe'; end if;
  if v_e.tipo <> v_tipo then raise exception 'No se puede cambiar el tipo de un ejercicio ya creado'; end if;
  update public.ejercicios
     set titulo = btrim(p_datos->>'titulo'), nivel = v_nivel, tema = nullif(btrim(p_datos->>'tema'), ''), ciclo = v_ciclo, modulo = v_modulo, unidad = v_unidad, fuente = v_fuente, uso = v_uso,
         datos = p_datos->'datos', contenido = p_datos->'contenido', clave = nullif(p_datos->'clave', 'null'::jsonb), updated_at = now()
   where id = p_id;
  return p_id;
end $$;

revoke execute on function public.guardar_ejercicio(uuid, jsonb) from public, anon;
grant execute on function public.guardar_ejercicio(uuid, jsonb) to authenticated;
