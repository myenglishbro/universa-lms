-- UNIVERSA · Task Board: un ticket puede tener más de un responsable.
--
--  * tickets.responsables (uuid[]): todos los responsables, en el orden en que se eligieron. tickets.responsable_id se conserva y
--    siempre es el primero (compatibilidad con lo ya guardado y con cualquier vista o consulta que lo use).
--  * ticket_crear recibe p_responsables; ticket_actualizar acepta la clave «responsables» (lista de usuarios). La clave anterior
--    «responsable_id» sigue funcionando y equivale a un solo responsable.
--  * Cada persona que se suma recibe su notificación «Te asignaron …». El historial registra el cambio de la lista.
--
-- Repetible. Requiere 20261130100000_task_board.sql.

begin;

alter table public.tickets add column if not exists responsables uuid[] not null default '{}';
update public.tickets set responsables = array[responsable_id] where responsable_id is not null and cardinality(responsables) = 0;
create index if not exists tickets_responsables_idx on public.tickets using gin (responsables);

-- Valida una lista de responsables (todos administrativos activos) y la devuelve sin repetidos, conservando el orden.
create or replace function public.ticket_normalizar_responsables(p_lista uuid[]) returns uuid[]
language plpgsql stable security definer set search_path = '' as $$
declare v_res uuid[]; v_u uuid;
begin
  v_res := array(select x from (select x, min(o) as o from unnest(coalesce(p_lista, '{}')) with ordinality t(x, o) where x is not null group by x) s order by o);
  foreach v_u in array v_res loop
    perform public.ticket_validar_responsable(v_u);
  end loop;
  return v_res;
end $$;
revoke execute on function public.ticket_normalizar_responsables(uuid[]) from public, anon, authenticated;

drop function if exists public.ticket_crear(text, text, text, text, uuid, date);
create or replace function public.ticket_crear(p_titulo text, p_descripcion text, p_tipo text, p_prioridad text, p_responsables uuid[], p_fecha_limite date)
returns public.tickets
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); t public.tickets; v_resp uuid[]; v_u uuid;
begin
  perform public.ticket_exigir_personal();
  v_resp := public.ticket_normalizar_responsables(p_responsables);
  if btrim(coalesce(p_titulo, '')) = '' then raise exception 'El título es obligatorio'; end if;
  insert into public.tickets (titulo, descripcion, tipo, prioridad, responsable_id, responsables, creado_por, fecha_limite)
  values (btrim(p_titulo), nullif(btrim(coalesce(p_descripcion, '')), ''), coalesce(nullif(p_tipo, ''), 'tarea'), coalesce(nullif(p_prioridad, ''), 'media'),
          v_resp[1], v_resp, v_uid, p_fecha_limite)
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

-- Cambios sobre un ticket (solo se aplican las claves enviadas): titulo, descripcion, tipo, prioridad, estado, responsables, fecha_limite.
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

  update public.tickets set titulo = n.titulo, descripcion = n.descripcion, tipo = n.tipo, prioridad = n.prioridad, estado = n.estado,
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

revoke execute on function public.ticket_crear(text, text, text, text, uuid[], date) from public, anon;
grant execute on function public.ticket_crear(text, text, text, text, uuid[], date) to authenticated;
revoke execute on function public.ticket_actualizar(uuid, jsonb) from public, anon;
grant execute on function public.ticket_actualizar(uuid, jsonb) to authenticated;

commit;
