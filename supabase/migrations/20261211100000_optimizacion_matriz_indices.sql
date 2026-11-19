-- Optimización: (1) la fila de UN estudiante de la matriz, para no recalcular el salón completo tras cada nota; (2) índices en las claves foráneas que se consultan.
-- No cambia notas, rúbricas ni permisos. Repetible.
begin;

-- 1. Fila de un estudiante: mismo contenido que cada elemento de «alumnos» en eval_matriz_salon (el estudiante debe estar matriculado y activo).
create or replace function public.eval_matriz_alumno(p_salon uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_fila jsonb;
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select jsonb_build_object(
           'alumno_id', a.id, 'nombre', a.nombre,
           'celdas', coalesce((select jsonb_object_agg(e.id::text, public.eval_celda(e.id, a.id))
                                 from public.eval_evaluaciones e join public.eval_modulos m on m.id = e.modulo_id where m.salon_id = p_salon), '{}'::jsonb),
           'resumen', public.eval_resumen_alumno(p_salon, a.id),
           'nivel', public.eval_calc_nivel(p_salon, a.id))
    into v_fila
    from public.alumnos a
   where a.id = p_alumno and exists (select 1 from public.matriculas m2 where m2.salon_id = p_salon and m2.alumno_id = a.id and m2.estado = 'activa');
  if v_fila is null then raise exception 'El estudiante no está matriculado en este salón'; end if;
  return v_fila;
end $$;

revoke execute on function public.eval_matriz_alumno(uuid, uuid) from public, anon, authenticated;
grant execute on function public.eval_matriz_alumno(uuid, uuid) to authenticated;

-- 2. Índices en claves foráneas de entidades del dominio (se omiten las columnas de auditoría: «quién lo hizo» no se usa para buscar).
do $$
declare r record; n integer := 0;
begin
  for r in
    select c.conrelid::regclass::text tabla, a.attname col, c.conrelid
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.connamespace = 'public'::regnamespace and cardinality(c.conkey) = 1
       and a.attname !~ '(^|_)(por|updated_by|creado_por|created_by|calificado_por|aplicado_por|aprobado_por|asignado_por|aceptada_por|registrado_por|autor_user_id|usuario_id|autor_id|reemplaza_a)$'
       and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
  loop
    execute format('create index if not exists %I on %s (%I)', left(replace(r.tabla, 'public.', '') || '_' || r.col || '_idx', 63), r.tabla, r.col);
    n := n + 1;
  end loop;
  raise notice 'Índices creados: %', n;
end $$;

commit;
