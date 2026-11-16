-- UNIVERSA · Las clases del salón de un paquete descuentan sus horas y el progreso se muestra en horas.
--
--  * Cada sesión del calendario que pasa a «realizada» en un salón enlazado a un paquete registra un movimiento de consumo
--    (minutos de la sesión). Si la sesión deja de estar realizada (corrección), se devuelve con una reversión. Es idempotente
--    (clave única por sesión) y NUNCA bloquea el registro de la clase: si no quedan horas, el saldo queda en negativo y se avisa.
--  * Paquete al que se descuenta: el más antiguo del salón con horas disponibles; si ninguno tiene, el más reciente.
--  * paquete_saldos suma a «programadas» las sesiones programadas del salón (en el paquete que corresponde).
--  * progreso_salon devuelve además `horas` (contratadas, consumidas, disponibles, programadas, en minutos) cuando el salón
--    tiene paquete: el estudiante ve su avance en horas en lugar de clases.
--  * Al crear un paquete con salón y sin plan ni total de sesiones, el total se calcula: horas del paquete ÷ duración de la clase.
--
-- Repetible. Requiere 20261206100000_paquete_salon.sql.

alter table public.paquete_movimientos add column if not exists sesion_id uuid references public.salon_sesiones(id) on delete set null;
create index if not exists paquete_movimientos_sesion_idx on public.paquete_movimientos (sesion_id) where sesion_id is not null;

-- Saldo disponible en minutos (suma de movimientos) de un paquete, sin permisos: uso interno.
create or replace function public.paquete_disponible_int(p_paquete uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(minutos), 0)::integer from public.paquete_movimientos where paquete_id = p_paquete
$$;

-- Paquete al que se descuentan las clases del salón.
create or replace function public.paquete_para_salon(p_salon uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.paquetes_horas p
   where p.salon_id = p_salon and not p.anulado
   order by (public.paquete_disponible_int(p.id) > 0) desc,
            case when public.paquete_disponible_int(p.id) > 0 then p.created_at end asc,
            p.created_at desc
   limit 1
$$;

create or replace function public.sesion_descuenta_horas() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_paquete uuid;
  v_min integer := (extract(epoch from (new.hora_fin - new.hora_inicio)) / 60)::integer;
  v_neto integer;
  v_n integer;
begin
  select coalesce(sum(minutos), 0), count(*) filter (where tipo = 'consumo')
    into v_neto, v_n from public.paquete_movimientos where sesion_id = new.id;

  if new.estado = 'realizada' and v_neto >= 0 then
    v_paquete := public.paquete_para_salon(new.salon_id);
    if v_paquete is not null then
      insert into public.paquete_movimientos (paquete_id, tipo, minutos, sesion_id, clave)
      values (v_paquete, 'consumo', -v_min, new.id, 'sesion:' || new.id || ':' || (v_n + 1));
    end if;
  elsif new.estado <> 'realizada' and v_neto < 0 then
    select paquete_id into v_paquete from public.paquete_movimientos where sesion_id = new.id order by created_at desc limit 1;
    insert into public.paquete_movimientos (paquete_id, tipo, minutos, motivo, sesion_id, clave)
    values (v_paquete, 'reversion', -v_neto, 'Session no longer marked as held', new.id, 'sesion-rev:' || new.id || ':' || v_n);
  end if;
  return new;
end $$;

drop trigger if exists salon_sesiones_descuenta_horas on public.salon_sesiones;
create trigger salon_sesiones_descuenta_horas after insert or update of estado on public.salon_sesiones
  for each row execute function public.sesion_descuenta_horas();

-- Vista de saldos: programadas incluye las sesiones programadas del salón.
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
    select (coalesce(sum(k.minutos) filter (where k.estado = 'programada'), 0) + coalesce(ss.minutos, 0))::integer as programadas,
           ((count(*) filter (where k.estado = 'programada')) + coalesce(ss.n, 0))::integer as clases_programadas
      from (select 1) u
      left join public.paquete_clases k on k.paquete_id = p.id
      left join lateral (
        select (sum(extract(epoch from (q.hora_fin - q.hora_inicio)) / 60))::integer as minutos, count(*)::integer as n
          from public.salon_sesiones q
         where p.salon_id is not null and q.salon_id = p.salon_id and q.estado = 'programada'
           and not p.anulado and p.id = public.paquete_para_salon(p.salon_id)) ss on true
     group by ss.minutos, ss.n) c
  cross join lateral (
    select coalesce(sum(y.monto) filter (where not y.anulado), 0)::numeric(10, 2) as pagado
      from public.paquete_pagos y where y.paquete_id = p.id) pg;

revoke all on public.paquete_saldos from anon, authenticated;
grant select on public.paquete_saldos to authenticated;

-- progreso_salon: igual que 20261115100000_asistencia.sql + `horas` cuando el salón tiene paquete.
create or replace function public.progreso_salon(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_s public.salones;
  v_real integer;
  v_prog integer;
  v_canc integer;
  v_pend integer;
  v_registradas integer;
  v_prox date;
  v_ciclos jsonb := '[]'::jsonb;
  v_horas jsonb := null;
begin
  select * into v_s from public.salones where id = p_salon;
  if not found then raise exception 'El salón no existe'; end if;
  if not (public.puede_gestionar_curso(p_salon) or public.es_estudiante_de(p_salon)) then
    raise exception 'No tienes acceso a este salón' using errcode = '42501';
  end if;
  select count(*) filter (where q.estado = 'realizada'),
         count(*) filter (where q.estado = 'programada'),
         count(*) filter (where q.estado = 'cancelada'),
         count(*) filter (where q.estado <> 'cancelada' and q.fecha <= public.hoy_lima() and not (q.estado = 'realizada' and r.sesion_id is not null)),
         count(*) filter (where q.estado = 'realizada' and r.sesion_id is not null),
         min(q.fecha) filter (where q.estado = 'programada' and q.fecha >= public.hoy_lima())
    into v_real, v_prog, v_canc, v_pend, v_registradas, v_prox
    from public.salon_sesiones q left join public.clase_registros r on r.sesion_id = q.id
   where q.salon_id = p_salon;

  if v_s.plan_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('ciclo', c.ciclo, 'sesiones', c.sesiones, 'realizadas', greatest(0, least(c.sesiones, v_real - c.antes))) order by c.ciclo), '[]'::jsonb)
      into v_ciclos
      from (select pc.ciclo, pc.sesiones, (sum(pc.sesiones) over (order by pc.ciclo) - pc.sesiones)::integer as antes
              from public.plan_ciclos pc
             where pc.plan_id = v_s.plan_id and pc.ciclo between v_s.ciclo_desde and v_s.ciclo_hasta) c;
  end if;

  if exists (select 1 from public.paquetes_horas where salon_id = p_salon and not anulado) then
    select jsonb_build_object(
             'contratadas', coalesce(sum(m.compradas + m.ajustes), 0),
             'consumidas', coalesce(sum(m.consumidas), 0),
             'disponibles', coalesce(sum(m.disponibles), 0),
             'programadas', coalesce((select sum(extract(epoch from (q.hora_fin - q.hora_inicio)) / 60)::integer
                                        from public.salon_sesiones q where q.salon_id = p_salon and q.estado = 'programada'), 0))
      into v_horas
      from public.paquetes_horas p
      cross join lateral (
        select coalesce(sum(x.minutos) filter (where x.tipo in ('compra', 'ampliacion')), 0)::integer as compradas,
               coalesce(sum(x.minutos) filter (where x.tipo = 'ajuste'), 0)::integer as ajustes,
               (-coalesce(sum(x.minutos) filter (where x.tipo in ('consumo', 'cancelacion_tardia', 'reversion')), 0))::integer as consumidas,
               coalesce(sum(x.minutos), 0)::integer as disponibles
          from public.paquete_movimientos x where x.paquete_id = p.id) m
     where p.salon_id = p_salon and not p.anulado;
  end if;

  return jsonb_build_object(
    'total', v_s.total_sesiones, 'realizadas', v_real, 'programadas', v_prog, 'canceladas', v_canc,
    'por_registrar', v_pend, 'registradas', v_registradas, 'proxima_fecha', v_prox,
    'con_plan', v_s.plan_id is not null, 'ciclos', v_ciclos, 'horas', v_horas);
end $$;

-- registrar_paquete_salon: igual que 20261206100000 + total de sesiones calculado desde las horas cuando no hay plan ni total.
create or replace function public.registrar_paquete_salon(p_paquete jsonb, p_salon jsonb default null, p_horarios jsonb default '[]'::jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_alumno uuid := nullif(p_paquete->>'alumno_id', '')::uuid;
  v_origen uuid := nullif(p_paquete->>'paquete_origen_id', '')::uuid;
  v_salon uuid;
  v_nombre text;
  v_datos jsonb;
  v_clase integer;
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
    v_datos := jsonb_set(
      jsonb_set(p_salon, '{capacidad}', '1'::jsonb),
      '{nombre}', to_jsonb(coalesce(nullif(btrim(p_salon->>'nombre'), ''), 'Private · ' || v_nombre)));
    if nullif(p_salon->>'total_sesiones', '') is null and nullif(p_salon->>'plan_id', '') is null
       and coalesce(nullif(p_paquete->>'horas', '')::numeric, 0) > 0 and jsonb_array_length(coalesce(p_horarios, '[]'::jsonb)) > 0 then
      v_clase := (extract(epoch from ((p_horarios->0->>'hora_fin')::time - (p_horarios->0->>'hora_inicio')::time)) / 60)::integer;
      if v_clase > 0 then
        v_datos := jsonb_set(v_datos, '{total_sesiones}', to_jsonb(ceil((p_paquete->>'horas')::numeric * 60 / v_clase)::integer));
      end if;
    end if;
    v_salon := public.guardar_salon(null, v_datos, p_horarios);
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
revoke execute on function public.progreso_salon(uuid) from public, anon;
grant execute on function public.progreso_salon(uuid) to authenticated;
-- La vista paquete_saldos (security_invoker) llama a estas dos funciones: deben ser ejecutables por authenticated.
revoke execute on function public.paquete_disponible_int(uuid), public.paquete_para_salon(uuid) from public, anon;
grant execute on function public.paquete_disponible_int(uuid), public.paquete_para_salon(uuid) to authenticated;
revoke all on function public.sesion_descuenta_horas() from public, anon, authenticated;
