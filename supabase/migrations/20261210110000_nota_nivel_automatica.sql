-- La nota final del nivel deja de depender de una confirmación manual de Coordinación: método único = promedio ponderado de las notas de los módulos,
-- siempre confirmado. Aplica a los salones existentes y a los que se creen después. Las notas siguen mostrándose como «parciales» mientras falte algo por publicar.
-- No cambia notas de módulos ni de ciclos. Repetible.
begin;

insert into public.eval_consolidacion (salon_id, metodo, confirmada)
select s.id, 'promedio_modulos', true from public.salones s
on conflict (salon_id) do update set metodo = 'promedio_modulos', confirmada = true, updated_at = now();

-- Salones nuevos: nacen con el método automático.
create or replace function public.eval_consolidacion_al_crear_salon() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.eval_consolidacion (salon_id, metodo, confirmada) values (new.id, 'promedio_modulos', true) on conflict (salon_id) do nothing;
  return new;
end $$;

drop trigger if exists salones_consolidacion_automatica on public.salones;
create trigger salones_consolidacion_automatica after insert on public.salones
  for each row execute function public.eval_consolidacion_al_crear_salon();

revoke execute on function public.eval_consolidacion_al_crear_salon() from public, anon, authenticated;

do $$
begin
  if (select count(*) from public.salones) <> (select count(*) from public.eval_consolidacion where metodo = 'promedio_modulos' and confirmada) then
    raise exception 'La nota de nivel automática no quedó en todos los salones';
  end if;
end $$;

commit;
