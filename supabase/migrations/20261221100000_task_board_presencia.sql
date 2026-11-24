-- UNIVERSA · Task Board: estado de cada persona en la oficina del equipo y elección de su rincón.
--
--  * ticket_avatares gana: estado (disponible, ocupado, reunion, almuerzo, fuera), mensaje corto, rincon (escritorio, reunion, pizarra, sala, cafe, archivo) y estado_fecha.
--  * Quien marca «almuerzo» o «fuera» no aparece en su puesto, pero sus tickets pendientes siguen a la vista.
--  * Los estados se vencen al terminar el día (lo resuelve el navegador con estado_fecha): al día siguiente la persona vuelve a «disponible».
--  * ticket_avatares_listar() ahora devuelve también estos datos; ticket_presencia_guardar(...) cambia solo los propios.
--
-- Repetible. Requiere 20261220100000_task_board_avatares.sql.

begin;

alter table public.ticket_avatares add column if not exists estado text not null default 'disponible';
alter table public.ticket_avatares add column if not exists mensaje text not null default '';
alter table public.ticket_avatares add column if not exists rincon text;
alter table public.ticket_avatares add column if not exists estado_fecha date not null default current_date;

alter table public.ticket_avatares drop constraint if exists ticket_avatares_estado_check;
alter table public.ticket_avatares add constraint ticket_avatares_estado_check check (estado in ('disponible', 'ocupado', 'reunion', 'almuerzo', 'fuera'));
alter table public.ticket_avatares drop constraint if exists ticket_avatares_mensaje_check;
alter table public.ticket_avatares add constraint ticket_avatares_mensaje_check check (char_length(mensaje) <= 60);
alter table public.ticket_avatares drop constraint if exists ticket_avatares_rincon_check;
alter table public.ticket_avatares add constraint ticket_avatares_rincon_check check (rincon is null or rincon in ('escritorio', 'reunion', 'pizarra', 'sala', 'cafe', 'archivo'));

drop function if exists public.ticket_avatares_listar();
create or replace function public.ticket_avatares_listar()
returns table (user_id uuid, config jsonb, estado text, mensaje text, rincon text, estado_fecha date)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.ticket_exigir_personal();
  return query select a.user_id, a.config, a.estado, a.mensaje, a.rincon, a.estado_fecha from public.ticket_avatares a;
end $$;

-- p_fecha: el día en el que se marcó el estado (la fecha de Lima la manda el navegador).
create or replace function public.ticket_presencia_guardar(p_estado text, p_mensaje text, p_rincon text, p_fecha date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_msg text := left(btrim(coalesce(p_mensaje, '')), 60);
begin
  perform public.ticket_exigir_personal();
  if p_estado not in ('disponible', 'ocupado', 'reunion', 'almuerzo', 'fuera') then raise exception 'El estado no es válido'; end if;
  if p_rincon is not null and p_rincon not in ('escritorio', 'reunion', 'pizarra', 'sala', 'cafe', 'archivo') then raise exception 'El rincón no es válido'; end if;
  insert into public.ticket_avatares (user_id, estado, mensaje, rincon, estado_fecha)
  values ((select auth.uid()), p_estado, v_msg, p_rincon, coalesce(p_fecha, current_date))
  on conflict (user_id) do update
    set estado = excluded.estado, mensaje = excluded.mensaje, rincon = excluded.rincon, estado_fecha = excluded.estado_fecha, updated_at = now();
end $$;

revoke execute on function public.ticket_avatares_listar(), public.ticket_presencia_guardar(text, text, text, date) from public, anon;
grant execute on function public.ticket_avatares_listar(), public.ticket_presencia_guardar(text, text, text, date) to authenticated;

commit;
