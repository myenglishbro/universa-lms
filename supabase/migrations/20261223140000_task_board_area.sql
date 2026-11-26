-- UNIVERSA · Task Board: cada ticket indica a qué área va dirigido.
--
--  * tickets.area: academica, administracion, finanzas, admisiones, soporte, tecnologia o direccion (puede quedar vacío en los tickets anteriores).
--  * ticket_crear recibe p_area; ticket_actualizar acepta la clave «area». El historial registra el cambio de área.
--
-- Repetible. Requiere 20261214100000_task_board_varios_responsables.sql. Aplicar con `supabase db query --remote --yes --file` (nunca db push).

begin;

alter table public.tickets add column if not exists area text;
alter table public.tickets drop constraint if exists tickets_area_check;
alter table public.tickets add constraint tickets_area_check
  check (area is null or area in ('academica', 'administracion', 'finanzas', 'admisiones', 'soporte', 'tecnologia', 'direccion'));
create index if not exists tickets_area_idx on public.tickets (area) where area is not null;

drop function if exists public.ticket_crear(text, text, text, text, uuid[], date);
create or replace function public.ticket_crear(p_titulo text, p_descripcion text, p_tipo text, p_prioridad text, p_responsables uuid[], p_fecha_limite date, p_area text default null)
returns public.tickets
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); t public.tickets; v_resp uuid[]; v_u uuid; v_area text := nullif(btrim(coalesce(p_area, '')), '');
begin
  perform public.ticket_exigir_personal();
  v_resp := public.ticket_normalizar_responsables(p_responsables);
  if btrim(coalesce(p_titulo, '')) = '' then raise exception 'El título es obligatorio'; end if;
  if v_area is not null and v_area not in ('academica', 'administracion', 'finanzas', 'admisiones', 'soporte', 'tecnologia', 'direccion') then
    raise exception 'El área no es válida';
  end if;
  insert into public.tickets (titulo, descripcion, tipo, prioridad, area, responsable_id, responsables, creado_por, fecha_limite)
  values (btrim(p_titulo), nullif(btrim(coalesce(p_descripcion, '')), ''), coalesce(nullif(p_tipo, ''), 'tarea'), coalesce(nullif(p_prioridad, ''), 'media'),
          v_area, v_resp[1], v_resp, v_uid, p_fecha_limite)
  returning * into t;
  insert into public.ticket_historial (ticket_id, usuario_id, accion) values (t.id, v_uid, 'creó');
  foreach v_u in array v_resp loop
    if v_u <> v_uid then
      insert into public.ticket_notificaciones (user_id, ticket_id, tipo, mensaje, creado_por)
      values (v_u, t.id, 'asignado', 'Te asignaron ' || t.codigo || ': ' || t.titulo, v_uid);
    end if;
  end loop;
  return t;
end $$;

-- Cambios sobre un ticket (solo se aplican las claves enviadas): titulo, descripcion, tipo, prioridad, estado, area, responsables, fecha_limite.
create or replace function public.ticket_actualizar(p_id uuid, p_cambios jsonb) returns public.tickets
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v public.tickets; n public.tickets; v_u uuid;
begin
  perform public.ticket_exigir_personal();
  select * into v from public.tickets where id = p_id for update;
  if not found then raise exception 'El ticket no existe'; end if;
  if v.archivado then raise exception 'El ticket está archivado: restáuralo para editarlo'; end if;
  n := v;
  if p_cambios ? 'titulo' then
    n.titulo := btrim(coalesce(p_cambios ->> 'titulo', ''));
    if n.titulo = '' then raise exception 'El título es obligatorio'; end if;
  end if;
  if p_cambios ? 'descripcion' then n.descripcion := nullif(btrim(coalesce(p_cambios ->> 'descripcion', '')), ''); end if;
  if p_cambios ? 'tipo' then n.tipo := p_cambios ->> 'tipo'; end if;
  if p_cambios ? 'prioridad' then n.prioridad := p_cambios ->> 'prioridad'; end if;
  if p_cambios ? 'estado' then n.estado := p_cambios ->> 'estado'; end if;
  if p_cambios ? 'area' then n.area := nullif(btrim(coalesce(p_cambios ->> 'area', '')), ''); end if;
  if p_cambios ? 'fecha_limite' then n.fecha_limite := nullif(p_cambios ->> 'fecha_limite', '')::date; end if;

  if p_cambios ? 'responsables' then
    n.responsables := array(select e::uuid from jsonb_array_elements_text(coalesce(nullif(p_cambios -> 'responsables', 'null'::jsonb), '[]'::jsonb)) e);
  elsif p_cambios ? 'responsable_id' then
    n.responsables := case when nullif(p_cambios ->> 'responsable_id', '') is null then '{}'::uuid[] else array[(p_cambios ->> 'responsable_id')::uuid] end;
  end if;
  if p_cambios ? 'responsables' or p_cambios ? 'responsable_id' then
    -- Solo se valida a quien se suma: un responsable que ya estaba y se desactivó después no impide editar el resto.
    n.responsables := array(select x from (select x, min(o) as o from unnest(n.responsables) with ordinality t(x, o) where x is not null group by x) s order by o);
    foreach v_u in array n.responsables loop
      if not (v_u = any (v.responsables)) then perform public.ticket_validar_responsable(v_u); end if;
    end loop;
    n.responsable_id := n.responsables[1];
  end if;

  update public.tickets set titulo = n.titulo, descripcion = n.descripcion, tipo = n.tipo, prioridad = n.prioridad, estado = n.estado, area = n.area,
         fecha_limite = n.fecha_limite, responsable_id = n.responsable_id, responsables = n.responsables, updated_at = now(),
         completado_at = case when n.estado = 'realizado' then coalesce(v.completado_at, now()) else null end
   where id = p_id returning * into n;

  insert into public.ticket_historial (ticket_id, usuario_id, accion, campo, valor_anterior, valor_nuevo)
  select p_id, v_uid, 'cambió', c.campo, left(c.antes, 400), left(c.despues, 400)
    from (values
      ('titulo', v.titulo, n.titulo),
      ('descripcion', v.descripcion, n.descripcion),
      ('tipo', v.tipo, n.tipo),
      ('prioridad', v.prioridad, n.prioridad),
      ('estado', v.estado, n.estado),
      ('area', v.area, n.area),
      ('responsables', array_to_string(v.responsables, ','), array_to_string(n.responsables, ',')),
      ('fecha_limite', v.fecha_limite::text, n.fecha_limite::text)
    ) as c(campo, antes, despues)
   where c.antes is distinct from c.despues;

  foreach v_u in array n.responsables loop
    if not (v_u = any (v.responsables)) and v_u <> v_uid then
      insert into public.ticket_notificaciones (user_id, ticket_id, tipo, mensaje, creado_por)
      values (v_u, p_id, case when cardinality(v.responsables) = 0 then 'asignado' else 'reasignado' end,
              case when cardinality(v.responsables) = 0 then 'Te asignaron ' else 'Te sumaron a ' end || n.codigo || ': ' || n.titulo, v_uid);
    end if;
  end loop;
  return n;
end $$;

revoke execute on function public.ticket_crear(text, text, text, text, uuid[], date, text) from public, anon;
grant execute on function public.ticket_crear(text, text, text, text, uuid[], date, text) to authenticated;
revoke execute on function public.ticket_actualizar(uuid, jsonb) from public, anon;
grant execute on function public.ticket_actualizar(uuid, jsonb) to authenticated;

commit;
