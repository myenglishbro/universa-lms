-- UNIVERSA · Corregir la fecha de inicio de una matrícula (matrículas retroactivas).
--
-- PROBLEMA: la matrícula toma como inicio el día en que se registra al estudiante. La asistencia de una clase solo permite marcar a quienes
-- estaban matriculados ese día (asist_roster), así que un estudiante agregado hoy a un salón que empezó antes no aparece en las clases pasadas.
--
-- SOLUCIÓN: el administrador puede llevar la fecha de inicio de la matrícula hacia atrás (p. ej. al inicio del salón). No se permite una fecha
-- futura ni posterior al retiro. No recalcula notas ya publicadas (la participación publicada solo cambia corrigiéndola con motivo).
-- Solo administradores. Repetible.

begin;

-- Una matrícula: nueva fecha de inicio.
create or replace function public.corregir_fecha_matricula(p_matricula uuid, p_fecha date) returns void
language plpgsql security definer set search_path = '' as $$
declare v_m public.matriculas;
begin
  perform public.cal_exigir_admin();
  if p_fecha is null then raise exception 'Indica la fecha de inicio de la matrícula'; end if;
  select * into v_m from public.matriculas where id = p_matricula for update;
  if not found then raise exception 'La matrícula no existe'; end if;
  if p_fecha > public.hoy_lima() then raise exception 'La fecha de inicio no puede ser futura'; end if;
  if p_fecha < date '2000-01-01' then raise exception 'La fecha de inicio está fuera de rango'; end if;
  if v_m.fecha_fin is not null and p_fecha > v_m.fecha_fin then
    raise exception 'La fecha de inicio no puede ser posterior al retiro (%)', to_char(v_m.fecha_fin, 'DD/MM/YYYY');
  end if;
  update public.matriculas set fecha_inicio = p_fecha where id = p_matricula;
end $$;

-- Todas las matrículas activas de un salón que empezaron después de p_fecha pasan a empezar en p_fecha. Devuelve cuántas cambió.
create or replace function public.corregir_fecha_matriculas_salon(p_salon uuid, p_fecha date) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  perform public.cal_exigir_admin();
  if p_fecha is null then raise exception 'Indica la fecha de inicio de la matrícula'; end if;
  if not exists (select 1 from public.salones where id = p_salon) then raise exception 'El salón no existe'; end if;
  if p_fecha > public.hoy_lima() then raise exception 'La fecha de inicio no puede ser futura'; end if;
  if p_fecha < date '2000-01-01' then raise exception 'La fecha de inicio está fuera de rango'; end if;
  update public.matriculas set fecha_inicio = p_fecha where salon_id = p_salon and estado = 'activa' and fecha_inicio > p_fecha;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke execute on function public.corregir_fecha_matricula(uuid, date), public.corregir_fecha_matriculas_salon(uuid, date) from public, anon;
grant execute on function public.corregir_fecha_matricula(uuid, date), public.corregir_fecha_matriculas_salon(uuid, date) to authenticated;

commit;
