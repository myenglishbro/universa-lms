-- UNIVERSA · Task Board: se elimina la oficina de personajes (avatares y presencia del equipo), que ya no se usa.
-- Borra la tabla ticket_avatares y las funciones que la leían o escribían. No toca tickets, comentarios, checklist ni notificaciones.
-- Repetible (idempotente). Aplicar con `supabase db query --remote --yes --file` (nunca db push).

drop function if exists public.ticket_avatares_listar();
drop function if exists public.ticket_avatar_guardar(jsonb);
drop function if exists public.ticket_presencia_guardar(text, text, text, date);
drop table if exists public.ticket_avatares;
