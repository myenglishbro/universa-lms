-- UNIVERSA · Task Board: checklist dentro del ticket.
--
--  * tickets.checklist (jsonb): lista de pasos [{ id, texto, hecho }]. Se guarda completa con ticket_checklist_guardar (última escritura gana).
--  * Cada cambio actualiza updated_at del ticket (cuenta como movimiento para la marca «estancado») y deja una línea en el historial con el avance (2/5).
--  * Las plantillas por tipo, la marca «estancado» y la vista de calendario se calculan en el navegador: no necesitan SQL.
--
-- Repetible. Requiere 20261130100000_task_board.sql.

begin;

alter table public.tickets add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table public.tickets drop constraint if exists tickets_checklist_array;
alter table public.tickets add constraint tickets_checklist_array check (jsonb_typeof(checklist) = 'array');

create or replace function public.ticket_checklist_guardar(p_id uuid, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v public.tickets; v_n jsonb; v_antes text; v_despues text;
begin
  perform public.ticket_exigir_personal();
  select * into v from public.tickets where id = p_id for update;
  if not found then raise exception 'El ticket no existe'; end if;
  if v.archivado then raise exception 'El ticket está archivado: restáuralo para editar su checklist'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'El checklist no es válido'; end if;
  if jsonb_array_length(p_items) > 40 then raise exception 'Un checklist admite hasta 40 pasos'; end if;
  if exists (select 1 from jsonb_array_elements(p_items) e where length(btrim(coalesce(e ->> 'texto', ''))) > 200) then
    raise exception 'Cada paso admite hasta 200 caracteres';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', coalesce(nullif(e.v ->> 'id', ''), gen_random_uuid()::text),
           'texto', btrim(e.v ->> 'texto'),
           'hecho', coalesce((e.v ->> 'hecho')::boolean, false)) order by e.o), '[]'::jsonb)
    into v_n
    from jsonb_array_elements(p_items) with ordinality e(v, o)
   where btrim(coalesce(e.v ->> 'texto', '')) <> '';

  v_antes := (select count(*) filter (where (x ->> 'hecho')::boolean) || '/' || count(*) from jsonb_array_elements(v.checklist) x);
  v_despues := (select count(*) filter (where (x ->> 'hecho')::boolean) || '/' || count(*) from jsonb_array_elements(v_n) x);

  update public.tickets set checklist = v_n, updated_at = now() where id = p_id;
  if v.checklist is distinct from v_n then
    insert into public.ticket_historial (ticket_id, usuario_id, accion, campo, valor_anterior, valor_nuevo)
    values (p_id, v_uid, 'cambió', 'checklist', v_antes, v_despues);
  end if;
  return v_n;
end $$;

revoke execute on function public.ticket_checklist_guardar(uuid, jsonb) from public, anon;
grant execute on function public.ticket_checklist_guardar(uuid, jsonb) to authenticated;

commit;
