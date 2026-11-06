-- UNIVERSA · Paso 0. Marca el proyecto como ENTORNO DE PRUEBAS.
-- Ejecutar SOLO en el proyecto de pruebas, recién creado y VACÍO, ANTES de aplicar cualquier migración.
-- Si el proyecto ya tiene datos académicos (como producción), este script se niega a continuar.
do $$
begin
  if to_regclass('public.salones') is not null then
    raise exception 'ABORTADO: este proyecto ya tiene tablas académicas (public.salones). No es un proyecto de pruebas vacío. No continúes aquí.';
  end if;
end $$;

create table if not exists public._entorno_prueba (
  marca text primary key,
  creado_en timestamptz not null default now()
);
insert into public._entorno_prueba (marca) values ('universa-pruebas-fase1') on conflict do nothing;

-- Esperado: una fila con la versión de Postgres de Supabase y marca = universa-pruebas-fase1
select version() as postgres, current_database() as base, (select marca from public._entorno_prueba limit 1) as marca;
