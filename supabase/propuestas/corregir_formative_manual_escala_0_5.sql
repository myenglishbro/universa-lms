-- Corrección de notas manuales del Formative cargadas el 23-24/11/2026 en escala 0-5 dentro de casillas de 0-100.
-- Afecta SOLO a Herben Basilio Espinoza Martel, Paula Sofia Carranza Garcia y Yessica Rocio Quesada Yarassi (72 filas, todas <= 4.75).
-- Las notas manuales se guardan en escala 0-5 (nota/100 ÷ 20): 3.5 tipeado quedó 0.175 y debe ser 3.5 (= 70/100) -> se multiplica por 20.
-- Idempotente: solo toca filas con puntaje <= 0.25 (valor corregido mínimo no nulo es 0.25*20 = 5 > 0.25).
-- Aplicar con: npx supabase db query --remote --yes --file <este archivo>   (una sola transacción)

create table if not exists public.respaldo_formative_manual_20261125 as
  select m.*, now() as respaldado_at from public.eval_formative_manual m where false;
create table if not exists public.respaldo_eval_calificaciones_20261125 as
  select k.*, now() as respaldado_at from public.eval_calificaciones k where false;

with alumnos_afectados as (
  select id from public.alumnos
   where nombre ilike '%ESPINOZA MARTEL%' and nombre ilike 'HERBEN%'
      or nombre ilike 'PAULA SOFIA CARRANZA%'
      or nombre ilike 'YESSICA ROCIO QUESADA%'
)
insert into public.respaldo_formative_manual_20261125
select m.*, now() from public.eval_formative_manual m
 where m.alumno_id in (select id from alumnos_afectados) and m.puntaje <= 0.25
   and not exists (select 1 from public.respaldo_formative_manual_20261125 r
                    where r.evaluacion_id = m.evaluacion_id and r.alumno_id = m.alumno_id and r.unidad = m.unidad and r.habilidad = m.habilidad);

insert into public.respaldo_eval_calificaciones_20261125
select k.*, now() from public.eval_calificaciones k
 where exists (select 1 from public.respaldo_formative_manual_20261125 r
                where r.evaluacion_id = k.evaluacion_id and r.alumno_id = k.alumno_id and r.unidad = k.unidad)
   and not exists (select 1 from public.respaldo_eval_calificaciones_20261125 b where b.id = k.id);

update public.eval_formative_manual m
   set puntaje = m.puntaje * 20, updated_at = now()
 where m.puntaje <= 0.25 and m.puntaje > 0
   and exists (select 1 from public.respaldo_formative_manual_20261125 r
                where r.evaluacion_id = m.evaluacion_id and r.alumno_id = m.alumno_id and r.unidad = m.unidad and r.habilidad = m.habilidad);

-- Recalcula las unidades afectadas (actualiza la nota publicada y deja historial).
do $$
declare r record;
begin
  for r in select distinct evaluacion_id, alumno_id, unidad from public.respaldo_formative_manual_20261125 loop
    perform public.formative_sincronizar(r.evaluacion_id, r.alumno_id, r.unidad);
  end loop;
end $$;

-- Resultado para verificar
select a.nombre, m.unidad, m.habilidad, round(m.puntaje * 20, 2) as nota_sobre_100
  from public.eval_formative_manual m join public.alumnos a on a.id = m.alumno_id
 where exists (select 1 from public.respaldo_formative_manual_20261125 r
                where r.evaluacion_id = m.evaluacion_id and r.alumno_id = m.alumno_id and r.unidad = m.unidad and r.habilidad = m.habilidad)
 order by a.nombre, m.unidad, m.habilidad limit 8;
