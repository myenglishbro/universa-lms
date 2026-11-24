-- UNIVERSA · Task Board: cada persona elige el aspecto de su personaje en la oficina del equipo.
--
--  * ticket_avatares: una fila por usuario con su aspecto (jsonb: sexo, peinado, colores, gafas, gorro, camisa).
--  * ticket_avatares_listar(): lo ven todos los usuarios administrativos (el equipo se muestra completo a todos).
--  * ticket_avatar_guardar(config): cada persona cambia solo el suyo.
--  Quien no ha elegido nada ve un personaje automático según su correo. El navegador valida los valores al dibujar.
--
-- Repetible (también si ya se había ejecutado una versión anterior de este archivo). Requiere 20261130100000_task_board.sql.

begin;

create table if not exists public.ticket_avatares (
  user_id uuid primary key references auth.users (id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
-- Versiones anteriores guardaban estilo/semilla/color: se descartan (esas personas vuelven al personaje automático).
alter table public.ticket_avatares add column if not exists config jsonb not null default '{}'::jsonb;
alter table public.ticket_avatares drop column if exists estilo;
alter table public.ticket_avatares drop column if exists semilla;
alter table public.ticket_avatares drop column if exists color;
alter table public.ticket_avatares drop constraint if exists ticket_avatares_config_check;
alter table public.ticket_avatares add constraint ticket_avatares_config_check
  check (jsonb_typeof(config) = 'object' and pg_column_size(config) < 1000);
alter table public.ticket_avatares enable row level security;
-- Sin políticas: solo se accede con las funciones de abajo.

drop function if exists public.ticket_avatares_listar();
drop function if exists public.ticket_avatar_guardar(text, text);
drop function if exists public.ticket_avatar_guardar(text, text, text);

create or replace function public.ticket_avatares_listar() returns table (user_id uuid, config jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.ticket_exigir_personal();
  return query select a.user_id, a.config from public.ticket_avatares a;
end $$;

create or replace function public.ticket_avatar_guardar(p_config jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.ticket_exigir_personal();
  if p_config is null or jsonb_typeof(p_config) <> 'object' or pg_column_size(p_config) >= 1000 then
    raise exception 'El personaje no es válido';
  end if;
  insert into public.ticket_avatares (user_id, config) values ((select auth.uid()), p_config)
  on conflict (user_id) do update set config = excluded.config, updated_at = now();
end $$;

revoke execute on function public.ticket_avatares_listar(), public.ticket_avatar_guardar(jsonb) from public, anon;
grant execute on function public.ticket_avatares_listar(), public.ticket_avatar_guardar(jsonb) to authenticated;

commit;
