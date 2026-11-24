-- UNIVERSA · Task Board: nuevo tipo de ticket «informe» (para informar o reportar algo sin que sea una tarea).
-- Repetible. Reemplaza la restricción del tipo sin importar su nombre.
begin;
do $$
declare v_c text;
begin
  for v_c in
    select c.conname from pg_constraint c
     where c.conrelid = 'public.tickets'::regclass and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%tipo%' and pg_get_constraintdef(c.oid) like '%tarea%'
  loop
    execute format('alter table public.tickets drop constraint %I', v_c);
  end loop;
end $$;
alter table public.tickets add constraint tickets_tipo_check check (tipo in ('tarea', 'solicitud', 'incidencia', 'informe'));
commit;
