-- UNIVERSA · Paso 2. Asigna rol a los dos usuarios de prueba creados en Authentication > Users.
-- Antes crea (Add user > Create new user, marcando Auto Confirm User) estos dos usuarios con cualquier contraseña:
--   admin-prueba@universa.test      comercial-prueba@universa.test
do $$
declare
  v_admin uuid;
  v_comercial uuid;
begin
  if to_regclass('public._entorno_prueba') is null then
    raise exception 'ABORTADO: este proyecto no está marcado como entorno de pruebas (ejecuta el paso 0 solo en el proyecto de pruebas).';
  end if;
  select id into v_admin from auth.users where email = 'admin-prueba@universa.test';
  select id into v_comercial from auth.users where email = 'comercial-prueba@universa.test';
  if v_admin is null or v_comercial is null then
    raise exception 'Faltan usuarios: crea admin-prueba@universa.test y comercial-prueba@universa.test en Authentication > Users.';
  end if;
  insert into public.perfiles (user_id, rol) values (v_admin, 'admin'), (v_comercial, 'comercial')
  on conflict (user_id) do update set rol = excluded.rol;
end $$;

-- Esperado: 2 filas (admin-prueba = admin, comercial-prueba = comercial)
select u.email, p.rol from public.perfiles p join auth.users u on u.id = p.user_id order by p.rol;
