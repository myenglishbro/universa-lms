-- UNIVERSA · Los usuarios nuevos NO reciben acceso a datos académicos.
-- La migración anterior creaba un perfil 'comercial' (lectura) automáticamente para cada usuario nuevo.
-- Ahora el acceso exige una asignación explícita de un administrador:
--
--   insert into public.perfiles (user_id, rol)
--   select id, 'comercial' from auth.users where email = 'persona@universa.com';
--
-- Sin fila en public.perfiles, las políticas RLS no devuelven ni permiten nada.
-- Los perfiles ya existentes (por ejemplo el tuyo como admin) no se modifican.
begin;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

commit;
