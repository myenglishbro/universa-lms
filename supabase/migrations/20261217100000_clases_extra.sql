-- UNIVERSA · Clases extra de un salón (Boost week, Review, Extra class…).
--
--  * salon_sesiones.tipo admite 'extra' y tiene la columna etiqueta (el motivo: «Boost week», «Review», «Extra class»…).
--  * Una clase extra va EN EL CALENDARIO como cualquier sesión (asistencia, tema, materiales, conflictos con el docente) pero NO cuenta para el total
--    de clases del curso: no adelanta el avance, no reduce las clases regulares por generar, no se repone si se cancela y no descuenta horas del paquete.
--  * agregar_clase_extra: solo administración. extra_proponer: el siguiente horario libre del patrón semanal del salón, a continuación de la última clase.
--  * La asistencia de una clase extra se registra pero NO cuenta para el 25 % de inasistencias: portal_mi_asistencia devuelve el tipo y la ficha
--    del estudiante (asistencia_resumen_alumno) las deja fuera.
--
-- Repetible. Requiere el calendario (20261104100000), progreso/horas (20261206110000) y 20261216100000.

begin;

alter table public.salon_sesiones add column if not exists etiqueta text check (etiqueta is null or length(btrim(etiqueta)) between 1 and 40);
alter table public.salon_sesiones drop constraint if exists salon_sesiones_tipo_check;
alter table public.salon_sesiones add constraint salon_sesiones_tipo_check check (tipo in ('regular', 'recuperacion', 'extra'));
alter table public.salon_sesiones drop constraint if exists salon_sesiones_extra_etiqueta;
alter table public.salon_sesiones add constraint salon_sesiones_extra_etiqueta check (tipo <> 'extra' or etiqueta is not null);

-- Las clases extra no cuentan para el total del curso (versiones de 20261104100000 / 20261206110000 con el filtro tipo <> 'extra').
create or replace function public.cal_actualizar_fin(p_salon uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_total integer;
  v_inicio date;
  v_hay boolean;
  v_real integer;
  v_prog integer;
  v_max_prog date;
  v_max_real date;
  v_falta integer;
  v_fin date;
  v_proj date;
begin
  select total_sesiones, fecha_inicio into v_total, v_inicio from public.salones where id = p_salon;
  select count(*) > 0,
         count(*) filter (where estado = 'realizada'),
         count(*) filter (where estado = 'programada'),
         max(fecha) filter (where estado = 'programada'),
         max(fecha) filter (where estado = 'realizada')
    into v_hay, v_real, v_prog, v_max_prog, v_max_real
  from public.salon_sesiones where salon_id = p_salon and tipo <> 'extra';

  if not v_hay or v_total is null then
    return;
  end if;

  v_fin := coalesce(v_max_prog, v_max_real);
  v_falta := v_total - v_real - v_prog;
  if v_falta > 0 then
    select max(fecha_slot) into v_proj
    from public.cal_slots(p_salon, greatest(public.hoy_lima(), v_inicio), v_falta);
    v_fin := greatest(v_fin, v_proj);
  end if;

  update public.salones set fecha_fin_estimada = v_fin
  where id = p_salon and fecha_fin_estimada is distinct from v_fin;
end $$;

create or replace function public.cal_completar(p_salon uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_total integer;
  v_inicio date;
  v_hay boolean;
  v_real integer;
  v_prog integer;
  v_falta integer;
  v_desde date;
begin
  select total_sesiones, fecha_inicio into v_total, v_inicio from public.salones where id = p_salon;
  if v_total is null then
    raise exception 'El salón no tiene total de sesiones definido';
  end if;

  select count(*) > 0,
         count(*) filter (where estado = 'realizada'),
         count(*) filter (where estado = 'programada')
    into v_hay, v_real, v_prog
  from public.salon_sesiones where salon_id = p_salon and tipo <> 'extra';

  v_falta := v_total - v_real - v_prog;
  if v_falta > 0 then
    -- Primera generación: desde la fecha de inicio (si ya pasó, las sesiones quedan por registrar).
    -- Después: nunca se crean sesiones en el pasado.
    v_desde := case when v_hay then greatest(public.hoy_lima(), v_inicio) else v_inicio end;
    insert into public.salon_sesiones (salon_id, fecha, hora_inicio, hora_fin)
    select p_salon, fecha_slot, inicio, fin from public.cal_slots(p_salon, v_desde, v_falta);
  end if;

  perform public.cal_actualizar_fin(p_salon);
end $$;

create or replace function public.cal_crear_recuperacion(p_cancelada uuid, p_fecha date, p_ini time, p_fin time)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c record;
  v_total integer;
  v_real integer;
  v_prog integer;
  v_feriado text;
begin
  select * into v_c from public.salon_sesiones where id = p_cancelada;
  if not found or v_c.estado <> 'cancelada' then
    raise exception 'La recuperación debe corresponder a una sesión cancelada';
  end if;
  if exists (select 1 from public.salon_sesiones r where r.recupera_a = p_cancelada and r.estado <> 'cancelada') then
    raise exception 'Esta sesión cancelada ya tiene una recuperación';
  end if;
  if v_c.tipo = 'extra' then
    raise exception 'Una clase extra cancelada no se repone: no cuenta para el total del curso';
  end if;
  if p_fecha is null or p_ini is null or p_fin is null then
    raise exception 'Indica la fecha y el horario de la recuperación';
  end if;
  if p_fin <= p_ini then
    raise exception 'La hora de fin debe ser posterior a la de inicio';
  end if;
  if p_fecha < public.hoy_lima() then
    raise exception 'La recuperación no puede programarse en una fecha pasada';
  end if;
  if p_fecha < v_c.fecha then
    raise exception 'La recuperación debe ser posterior a la sesión cancelada';
  end if;
  select nombre into v_feriado from public.feriados where fecha = p_fecha;
  if found then
    raise exception 'La fecha elegida es feriado (%)', v_feriado;
  end if;
  if exists (
    select 1 from public.salon_sesiones s
    where s.salon_id = v_c.salon_id and s.fecha = p_fecha and s.hora_inicio = p_ini
  ) then
    raise exception 'Ya existe una sesión de este salón en esa fecha y hora';
  end if;

  select total_sesiones into v_total from public.salones where id = v_c.salon_id;
  select count(*) filter (where estado = 'realizada'), count(*) filter (where estado = 'programada')
    into v_real, v_prog from public.salon_sesiones where salon_id = v_c.salon_id and tipo <> 'extra';
  if v_total is null or v_total - v_real - v_prog <= 0 then
    raise exception 'El calendario ya tiene todas las sesiones necesarias';
  end if;

  insert into public.salon_sesiones (salon_id, fecha, hora_inicio, hora_fin, tipo, recupera_a, manual)
  values (v_c.salon_id, p_fecha, p_ini, p_fin, 'recuperacion', p_cancelada, true);
end $$;

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
   where q.salon_id = p_salon and q.tipo <> 'extra';

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
                                        from public.salon_sesiones q where q.salon_id = p_salon and q.estado = 'programada' and q.tipo <> 'extra'), 0))
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
    'extras', (select count(*) from public.salon_sesiones x where x.salon_id = p_salon and x.tipo = 'extra' and x.estado <> 'cancelada'), 'total', v_s.total_sesiones, 'realizadas', v_real, 'programadas', v_prog, 'canceladas', v_canc,
    'por_registrar', v_pend, 'registradas', v_registradas, 'proxima_fecha', v_prox,
    'con_plan', v_s.plan_id is not null, 'ciclos', v_ciclos, 'horas', v_horas);
end $$;

create or replace function public.sesion_descuenta_horas() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_paquete uuid;
  v_min integer := (extract(epoch from (new.hora_fin - new.hora_inicio)) / 60)::integer;
  v_neto integer;
  v_n integer;
begin
  -- Una clase extra es un regalo de la academia: no descuenta horas del paquete.
  if new.tipo = 'extra' then return new; end if;
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

-- Progreso por salón (vista): las clases extra no entran en el conteo.
create or replace view public.salon_progreso with (security_invoker = true) as
select c.*,
       greatest(c.total_sesiones - c.realizadas, 0) as restantes,
       greatest(c.total_sesiones - c.realizadas - c.programadas, 0) as sin_programar
from (
  select s.id as salon_id,
         s.total_sesiones,
         count(q.id) as sesiones,
         count(q.id) filter (where q.estado = 'realizada') as realizadas,
         count(q.id) filter (where q.estado = 'programada') as programadas,
         count(q.id) filter (where q.estado = 'cancelada') as canceladas,
         count(q.id) filter (where q.estado = 'programada' and q.fecha < public.hoy_lima()) as por_registrar,
         min(q.fecha) filter (where q.estado = 'programada' and q.fecha >= public.hoy_lima()) as proxima_fecha
  from public.salones s
  left join public.salon_sesiones q on q.salon_id = s.id and q.tipo <> 'extra'
  where s.total_sesiones is not null
  group by s.id, s.total_sesiones
) c;

-- ============================================================
-- Agregar, proponer y quitar clases extra
-- ============================================================
create or replace function public.extra_proponer(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_desde date; v_r record;
begin
  perform public.cal_exigir_admin();
  select greatest(public.hoy_lima(), coalesce(max(fecha) + 1, public.hoy_lima())) into v_desde
    from public.salon_sesiones where salon_id = p_salon and estado <> 'cancelada' and tipo <> 'extra';
  select * into v_r from public.cal_slots(p_salon, v_desde, 1);
  if not found then return null; end if;
  return jsonb_build_object('fecha', v_r.fecha_slot, 'hora_inicio', v_r.inicio, 'hora_fin', v_r.fin);
end $$;

create or replace function public.agregar_clase_extra(p_salon uuid, p_fecha date, p_hora_inicio time, p_hora_fin time, p_etiqueta text, p_nota text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_et text := btrim(coalesce(p_etiqueta, ''));
begin
  perform public.cal_exigir_admin();
  perform 1 from public.salones where id = p_salon for update;
  if not found then raise exception 'El salón no existe'; end if;
  if v_et = '' or length(v_et) > 40 then raise exception 'Indica el motivo de la clase extra (máximo 40 caracteres)'; end if;
  if p_fecha is null or p_hora_inicio is null or p_hora_fin is null then raise exception 'Indica la fecha y el horario'; end if;
  if p_hora_fin <= p_hora_inicio then raise exception 'La hora de fin debe ser posterior a la de inicio'; end if;
  if p_fecha < public.hoy_lima() then raise exception 'La clase extra no puede programarse en una fecha pasada'; end if;
  if exists (select 1 from public.salon_sesiones s where s.salon_id = p_salon and s.fecha = p_fecha and s.estado <> 'cancelada'
                and p_hora_inicio < s.hora_fin and p_hora_fin > s.hora_inicio) then
    raise exception 'Ya hay una clase de este salón que se cruza con ese horario';
  end if;
  insert into public.salon_sesiones (salon_id, fecha, hora_inicio, hora_fin, tipo, etiqueta, manual, nota)
  values (p_salon, p_fecha, p_hora_inicio, p_hora_fin, 'extra', v_et, true, nullif(btrim(coalesce(p_nota, '')), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.eliminar_clase_extra(p_sesion uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_s public.salon_sesiones;
begin
  perform public.cal_exigir_admin();
  select * into v_s from public.salon_sesiones where id = p_sesion for update;
  if not found or v_s.tipo <> 'extra' then raise exception 'La clase extra no existe'; end if;
  if v_s.estado = 'realizada' or exists (select 1 from public.asistencias where sesion_id = p_sesion) then
    raise exception 'Esta clase extra ya tiene asistencia registrada: cancélala en lugar de eliminarla';
  end if;
  delete from public.salon_sesiones where id = p_sesion;
end $$;

-- ============================================================
-- Asistencia: la clase extra se registra pero no cuenta para el 25 %
-- ============================================================
drop function if exists public.portal_mi_asistencia(uuid);
create or replace function public.portal_mi_asistencia(p_salon uuid) returns table (
  sesion_id uuid, numero integer, fecha date, hora_inicio time, hora_fin time, estado_registro text, asistencia text, tema text, materiales jsonb, tipo text, etiqueta text)
language plpgsql stable security definer set search_path = '' as $$
declare v_alumno uuid;
begin
  select cr.alumno_id into v_alumno from public.cuenta_roles cr where cr.user_id = (select auth.uid()) and cr.rol = 'estudiante';
  if v_alumno is null or not public.es_estudiante_de(p_salon) then raise exception 'No tienes acceso a este curso' using errcode = '42501'; end if;
  return query
    select t.id, t.numero, t.fecha, t.hora_inicio, t.hora_fin,
           case when t.estado = 'realizada' and t.registrada then 'registrada' else 'pendiente' end,
           a.estado,
           case when t.estado = 'realizada' then r.tema end,
           case when t.estado = 'realizada' then coalesce((
             select jsonb_agg(jsonb_build_object('id', l.id, 'titulo', l.titulo, 'tipo', l.tipo) order by l.created_at)
               from public.curso_lecciones l join public.curso_secciones c on c.id = l.seccion_id
              where l.sesion_id = t.id and not l.oculta and not c.oculta), '[]'::jsonb) else '[]'::jsonb end,
           t.tipo, t.etiqueta
      from (select s.id, s.fecha, s.hora_inicio, s.hora_fin, s.estado, s.tipo, s.etiqueta,
                   (row_number() over (order by s.fecha, s.hora_inicio))::integer as numero,
                   exists (select 1 from public.clase_registros z where z.sesion_id = s.id) as registrada
              from public.salon_sesiones s where s.salon_id = p_salon and s.estado <> 'cancelada') t
      left join public.clase_registros r on r.sesion_id = t.id
      left join public.asistencias a on a.sesion_id = t.id and a.alumno_id = v_alumno
     where t.fecha <= public.hoy_lima()
       and exists (select 1 from public.matriculas m where m.alumno_id = v_alumno and m.salon_id = p_salon
                    and m.fecha_inicio <= t.fecha and (m.fecha_fin is null or m.fecha_fin >= t.fecha))
     order by t.fecha desc, t.hora_inicio desc;
end $$;

drop function if exists public.asistencia_resumen_alumno(uuid);
create or replace function public.asistencia_resumen_alumno(p_alumno uuid) returns table (
  salon_id uuid, codigo text, nombre text, matricula text, presentes integer, ausentes integer, tardanzas integer, justificados integer, total_sesiones integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.tiene_perfil() then raise exception 'No tienes permisos para consultar la asistencia' using errcode = '42501'; end if;
  return query
    select s.id, s.codigo, s.nombre,
           case when exists (select 1 from public.matriculas m where m.alumno_id = p_alumno and m.salon_id = s.id and m.estado = 'activa') then 'activa' else 'retirada' end,
           (select count(*)::integer from public.asistencias x join public.salon_sesiones q on q.id = x.sesion_id where q.salon_id = s.id and q.tipo <> 'extra' and x.alumno_id = p_alumno and x.estado = 'presente'),
           (select count(*)::integer from public.asistencias x join public.salon_sesiones q on q.id = x.sesion_id where q.salon_id = s.id and q.tipo <> 'extra' and x.alumno_id = p_alumno and x.estado = 'ausente'),
           (select count(*)::integer from public.asistencias x join public.salon_sesiones q on q.id = x.sesion_id where q.salon_id = s.id and q.tipo <> 'extra' and x.alumno_id = p_alumno and x.estado = 'tardanza'),
           (select count(*)::integer from public.asistencias x join public.salon_sesiones q on q.id = x.sesion_id where q.salon_id = s.id and q.tipo <> 'extra' and x.alumno_id = p_alumno and x.estado = 'justificado'),
           s.total_sesiones
      from public.salones s
     where s.id in (select m.salon_id from public.matriculas m where m.alumno_id = p_alumno)
     order by s.nombre;
end $$;

revoke execute on function public.extra_proponer(uuid), public.agregar_clase_extra(uuid, date, time, time, text, text), public.eliminar_clase_extra(uuid),
  public.portal_mi_asistencia(uuid), public.asistencia_resumen_alumno(uuid), public.progreso_salon(uuid) from public, anon;
grant execute on function public.extra_proponer(uuid), public.agregar_clase_extra(uuid, date, time, time, text, text), public.eliminar_clase_extra(uuid),
  public.portal_mi_asistencia(uuid), public.asistencia_resumen_alumno(uuid), public.progreso_salon(uuid) to authenticated;

commit;
