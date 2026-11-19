-- Perfil interno de docentes (SOLO administración): descripción breve y campos propios que se definen desde la plataforma (p. ej. «Age group»,
-- «Specialty»), para filtrar docentes al asignarlos. Además, administración puede actualizar la disponibilidad semanal de un docente con cuenta.
-- Nada de esto lo ven docentes ni estudiantes: las tablas solo se leen con es_admin() y se escriben únicamente por las funciones de abajo.
begin;

-- 1. Campos definidos por administración: cada uno es una lista de opciones; el docente puede tener varias de cada campo.
create table if not exists public.docente_campos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 1 and 60),
  opciones text[] not null default '{}',
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists docente_campos_nombre_uq on public.docente_campos (lower(btrim(nombre)));

-- 2. Perfil interno: descripción y valores por campo ({ "<id del campo>": ["opción", …] }).
create table if not exists public.docente_perfil_interno (
  docente_id uuid primary key references public.docentes(id) on delete cascade,
  descripcion text not null default '' check (length(descripcion) <= 1000),
  atributos jsonb not null default '{}'::jsonb check (jsonb_typeof(atributos) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.docente_campos enable row level security;
alter table public.docente_perfil_interno enable row level security;
drop policy if exists "admin consulta" on public.docente_campos;
create policy "admin consulta" on public.docente_campos for select to authenticated using ((select public.es_admin()));
drop policy if exists "admin consulta" on public.docente_perfil_interno;
create policy "admin consulta" on public.docente_perfil_interno for select to authenticated using ((select public.es_admin()));

-- 3. Crear o editar un campo. Al quitar opciones, también se quitan de los perfiles que las tenían.
create or replace function public.admin_guardar_campo_docente(p_id uuid, p_nombre text, p_opciones text[], p_orden integer default 0, p_activo boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_opc text[];
begin
  perform public.cal_exigir_admin();
  if p_nombre is null or length(btrim(p_nombre)) not between 1 and 60 then raise exception 'El nombre del campo debe tener entre 1 y 60 caracteres'; end if;
  select coalesce(array_agg(distinct btrim(x)) filter (where btrim(x) <> ''), '{}') into v_opc from unnest(coalesce(p_opciones, '{}')) x;
  if cardinality(v_opc) > 60 or exists (select 1 from unnest(v_opc) y where length(y) > 40) then raise exception 'Cada campo admite hasta 60 opciones de 40 caracteres'; end if;
  if p_id is null then
    insert into public.docente_campos (nombre, opciones, orden, activo) values (btrim(p_nombre), v_opc, coalesce(p_orden, 0), coalesce(p_activo, true)) returning id into v_id;
  else
    update public.docente_campos set nombre = btrim(p_nombre), opciones = v_opc, orden = coalesce(p_orden, 0), activo = coalesce(p_activo, true) where id = p_id returning id into v_id;
    if v_id is null then raise exception 'El campo no existe'; end if;
    update public.docente_perfil_interno p
       set atributos = p.atributos || jsonb_build_object(v_id::text, coalesce((select jsonb_agg(x) from jsonb_array_elements_text(p.atributos -> v_id::text) x where x = any (v_opc)), '[]'::jsonb))
     where p.atributos ? v_id::text;
  end if;
  return v_id;
exception when unique_violation then raise exception 'Ya existe un campo con ese nombre';
end $$;

create or replace function public.admin_eliminar_campo_docente(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  delete from public.docente_campos where id = p_id;
  update public.docente_perfil_interno set atributos = atributos - p_id::text where atributos ? p_id::text;
end $$;

-- 4. Guardar el perfil interno de un docente. Las opciones nuevas que se escriban se agregan al campo.
create or replace function public.admin_guardar_perfil_docente(p_docente uuid, p_descripcion text, p_atributos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_clave text; v_val jsonb; v_limpio jsonb := '{}'::jsonb; v_vals text[];
begin
  perform public.cal_exigir_admin();
  if not exists (select 1 from public.docentes where id = p_docente) then raise exception 'El docente no existe'; end if;
  if length(coalesce(p_descripcion, '')) > 1000 then raise exception 'La descripción no puede pasar de 1000 caracteres'; end if;
  p_atributos := coalesce(p_atributos, '{}'::jsonb);
  if jsonb_typeof(p_atributos) <> 'object' then raise exception 'Atributos no válidos'; end if;
  for v_clave, v_val in select key, value from jsonb_each(p_atributos) loop
    if not exists (select 1 from public.docente_campos where id::text = v_clave) then continue; end if; -- un campo ya eliminado se ignora
    if jsonb_typeof(v_val) <> 'array' then raise exception 'Atributos no válidos'; end if;
    select coalesce(array_agg(distinct btrim(x)) filter (where btrim(x) <> ''), '{}') into v_vals from jsonb_array_elements_text(v_val) x;
    if cardinality(v_vals) > 60 or exists (select 1 from unnest(v_vals) y where length(y) > 40) then raise exception 'Cada campo admite hasta 60 opciones de 40 caracteres'; end if;
    update public.docente_campos c set opciones = c.opciones || (select coalesce(array_agg(y), '{}') from unnest(v_vals) y where y <> all (c.opciones)) where c.id::text = v_clave;
    v_limpio := v_limpio || jsonb_build_object(v_clave, to_jsonb(v_vals));
  end loop;
  insert into public.docente_perfil_interno (docente_id, descripcion, atributos, updated_at, updated_by)
  values (p_docente, btrim(coalesce(p_descripcion, '')), v_limpio, now(), (select auth.uid()))
  on conflict (docente_id) do update set descripcion = excluded.descripcion, atributos = excluded.atributos, updated_at = now(), updated_by = excluded.updated_by;
end $$;

-- 5. Administración actualiza la disponibilidad semanal de un docente con cuenta (reemplaza toda la lista: [{ "dia": 1, "hora": 7 }, …]).
create or replace function public.admin_guardar_disponibilidad_docente(p_docente uuid, p_slots jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  perform public.cal_exigir_admin();
  select cr.user_id into v_user from public.cuenta_roles cr where cr.docente_id = p_docente and cr.rol = 'docente' limit 1;
  if v_user is null then raise exception 'Este docente aún no tiene cuenta de acceso: la disponibilidad se guarda en su cuenta'; end if;
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) > 112 then raise exception 'Disponibilidad no válida'; end if;
  delete from public.docente_disponibilidad where user_id = v_user;
  insert into public.docente_disponibilidad (user_id, dia, hora)
  select distinct v_user, x.dia::smallint, x.hora::smallint from jsonb_to_recordset(p_slots) as x(dia int, hora int) where x.dia between 1 and 7 and x.hora between 7 and 22;
end $$;

revoke execute on function public.admin_guardar_campo_docente(uuid, text, text[], integer, boolean), public.admin_eliminar_campo_docente(uuid),
  public.admin_guardar_perfil_docente(uuid, text, jsonb), public.admin_guardar_disponibilidad_docente(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_guardar_campo_docente(uuid, text, text[], integer, boolean), public.admin_eliminar_campo_docente(uuid),
  public.admin_guardar_perfil_docente(uuid, text, jsonb), public.admin_guardar_disponibilidad_docente(uuid, jsonb) to authenticated;

-- 6. Campos de partida (se pueden renombrar, ampliar o eliminar desde la plataforma). Solo si aún no hay ninguno.
insert into public.docente_campos (nombre, opciones, orden)
select v.n, v.o, v.ord from (values
  ('Age group', array['Kids', 'Teens', 'Adults'], 1),
  ('Specialty', array['Business English', 'Exam preparation', 'Conversation', 'Grammar & writing'], 2),
  ('Teaching style', array['Structured', 'Conversational', 'Playful'], 3)) as v(n, o, ord)
where not exists (select 1 from public.docente_campos);

commit;
