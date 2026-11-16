-- UNIVERSA · Un paquete de horas nuevo crea su propio salón individual.
--
--  * paquetes_horas.salon_id: salón (capacidad 1) enlazado al paquete. Calendario, asistencia, evaluaciones, ejercicios,
--    recursos y vista del estudiante se gestionan en ese salón, igual que en un salón grupal.
--  * registrar_paquete_salon: en UNA transacción crea el salón (guardar_salon, con todas sus validaciones: plan, frecuencia,
--    choque de docente), matricula al alumno y registra el paquete. Si algo falla, no se crea nada.
--  * Renovación o compra adicional (sin p_salon): el paquete nuevo reutiliza el salón del paquete de origen.
--  * Los paquetes anteriores quedan sin salón (salon_id nulo): no se tocan.
--
-- Repetible. Requiere paquetes de horas, matrículas y guardar_salon (20261201100000_bloqueo_docentes.sql).

alter table public.paquetes_horas add column if not exists salon_id uuid references public.salones(id);
create index if not exists paquetes_horas_salon_idx on public.paquetes_horas (salon_id);

-- Misma vista de saldos + salon_id al final (create or replace solo admite columnas nuevas al final).
create or replace view public.paquete_saldos with (security_invoker = true) as
select p.id, p.alumno_id, a.nombre as alumno, p.docente_id, d.nombre as docente, p.nivel_id, n.nombre as nivel,
       p.minutos_contratados, p.precio, p.moneda, p.fecha_compra, p.vigencia_hasta, p.paquete_origen_id, p.anulado, p.notas, p.created_at,
       m.compradas, m.ajustes, m.consumidas, m.disponibles,
       c.programadas, c.clases_programadas,
       m.disponibles - c.programadas as libres,
       pg.pagado, p.precio - pg.pagado as pendiente,
       case when p.anulado then 'anulado'
            when p.vigencia_hasta is not null and p.vigencia_hasta < public.hoy_lima() then 'vencido'
            when m.disponibles <= 0 then 'agotado'
            else 'activo' end as estado,
       p.salon_id
  from public.paquetes_horas p
  join public.alumnos a on a.id = p.alumno_id
  left join public.docentes d on d.id = p.docente_id
  left join public.niveles n on n.id = p.nivel_id
  cross join lateral (
    select coalesce(sum(x.minutos) filter (where x.tipo in ('compra', 'ampliacion')), 0)::integer as compradas,
           coalesce(sum(x.minutos) filter (where x.tipo = 'ajuste'), 0)::integer as ajustes,
           (-coalesce(sum(x.minutos) filter (where x.tipo in ('consumo', 'cancelacion_tardia', 'reversion')), 0))::integer as consumidas,
           coalesce(sum(x.minutos), 0)::integer as disponibles
      from public.paquete_movimientos x where x.paquete_id = p.id) m
  cross join lateral (
    select coalesce(sum(k.minutos) filter (where k.estado = 'programada'), 0)::integer as programadas,
           (count(*) filter (where k.estado = 'programada'))::integer as clases_programadas
      from public.paquete_clases k where k.paquete_id = p.id) c
  cross join lateral (
    select coalesce(sum(y.monto) filter (where not y.anulado), 0)::numeric(10, 2) as pagado
      from public.paquete_pagos y where y.paquete_id = p.id) pg;

revoke all on public.paquete_saldos from anon, authenticated;
grant select on public.paquete_saldos to authenticated;

-- El precio es opcional: vacío = 0 (la validación anterior lo exigía).
create or replace function public.registrar_paquete(p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_alumno uuid := nullif(p_datos->>'alumno_id', '')::uuid;
  v_min integer;
  v_precio numeric(10, 2) := coalesce(nullif(p_datos->>'precio', '')::numeric, 0);
  v_pago numeric(10, 2) := coalesce(nullif(p_datos->>'pago_monto', '')::numeric, 0);
  v_origen uuid := nullif(p_datos->>'paquete_origen_id', '')::uuid;
begin
  perform public.cal_exigir_admin();
  if v_alumno is null or not exists (select 1 from public.alumnos where id = v_alumno) then raise exception 'Selecciona un alumno'; end if;
  v_min := round(coalesce(nullif(p_datos->>'horas', '')::numeric, 0) * 60)::integer;
  if v_min <= 0 then raise exception 'Las horas del paquete deben ser mayores que cero'; end if;
  if v_precio < 0 then raise exception 'El precio no puede ser negativo'; end if;
  if v_pago < 0 or v_pago > v_precio then raise exception 'El primer pago no puede ser mayor que el precio del paquete'; end if;
  if v_origen is not null and not exists (select 1 from public.paquetes_horas where id = v_origen and alumno_id = v_alumno) then
    raise exception 'El paquete anterior no existe o es de otro alumno';
  end if;

  insert into public.paquetes_horas (alumno_id, docente_id, nivel_id, minutos_contratados, precio, moneda, fecha_compra, vigencia_hasta, paquete_origen_id, notas)
  values (v_alumno, nullif(p_datos->>'docente_id', '')::uuid, nullif(p_datos->>'nivel_id', '')::uuid, v_min, v_precio,
          coalesce(nullif(p_datos->>'moneda', ''), 'PEN'), coalesce(nullif(p_datos->>'fecha_compra', '')::date, public.hoy_lima()),
          nullif(p_datos->>'vigencia_hasta', '')::date, v_origen, nullif(btrim(p_datos->>'notas'), ''))
  returning id into v_id;

  insert into public.paquete_movimientos (paquete_id, tipo, minutos, clave) values (v_id, 'compra', v_min, 'compra:' || v_id);
  if v_pago > 0 then
    insert into public.paquete_pagos (paquete_id, monto, metodo) values (v_id, v_pago, nullif(btrim(p_datos->>'pago_metodo'), ''));
  end if;
  return v_id;
end $$;

-- p_paquete: mismas claves que registrar_paquete. p_salon/p_horarios: mismas claves que guardar_salon (capacidad se fuerza a 1).
-- Sin p_salon (renovación): se reutiliza el salón del paquete de origen.
create or replace function public.registrar_paquete_salon(p_paquete jsonb, p_salon jsonb default null, p_horarios jsonb default '[]'::jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_alumno uuid := nullif(p_paquete->>'alumno_id', '')::uuid;
  v_origen uuid := nullif(p_paquete->>'paquete_origen_id', '')::uuid;
  v_salon uuid;
  v_nombre text;
  v_id uuid;
begin
  perform public.cal_exigir_admin();
  if v_alumno is null or not exists (select 1 from public.alumnos where id = v_alumno) then raise exception 'Selecciona un alumno'; end if;

  if p_salon is null then
    if v_origen is not null then
      select salon_id into v_salon from public.paquetes_horas where id = v_origen;
    end if;
  else
    select nombre into v_nombre from public.alumnos where id = v_alumno;
    v_salon := public.guardar_salon(
      null,
      jsonb_set(
        jsonb_set(p_salon, '{capacidad}', '1'::jsonb),
        '{nombre}', to_jsonb(coalesce(nullif(btrim(p_salon->>'nombre'), ''), 'Private · ' || v_nombre))
      ),
      p_horarios
    );
    perform public.matricular_alumnos(v_salon, array[v_alumno]);
  end if;

  v_id := public.registrar_paquete(p_paquete);
  if v_salon is not null then
    update public.paquetes_horas set salon_id = v_salon where id = v_id;
  end if;
  return v_id;
end $$;

revoke execute on function public.registrar_paquete_salon(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.registrar_paquete_salon(jsonb, jsonb, jsonb) to authenticated;
