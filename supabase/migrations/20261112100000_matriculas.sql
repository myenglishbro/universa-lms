-- UNIVERSA · Matrículas (alumno ↔ salón), alumnos sin duplicados y docente por clase particular.
--
--  * matriculas: relación alumno–salón con historial. Retirar o cambiar de salón NO borra nada: la matrícula pasa a «retirada»
--    con su fecha y motivo, y un cambio de salón enlaza la matrícula nueva con la anterior.
--  * Una matrícula NO es un pago ni un paquete de horas: no toca paquetes_horas, paquete_pagos ni paquete_movimientos.
--  * Capacidad: matricular_alumnos y cambiar_salon_matricula bloquean el salón (for update) y comprueban los cupos, así dos
--    personas matriculando a la vez no superan la capacidad. Un trigger impide bajar la capacidad por debajo de los matriculados.
--  * Sin duplicados: índice único de matrícula activa por (alumno, salón); guardar_alumno rechaza nombre, correo o teléfono repetidos.
--  * reprogramar_clase admite cambiar el docente de una clase particular. agenda_sesiones expone alumno_id (clases particulares).
--
-- Repetible (cada paso es idempotente). Requiere las migraciones anteriores, incluida 20261111100000_agenda_academica.sql.

-- ============================================================
-- 1. Tabla de matrículas
-- ============================================================
create table if not exists public.matriculas (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.alumnos(id),
  salon_id uuid not null references public.salones(id),
  estado text not null default 'activa' check (estado in ('activa', 'retirada')),
  fecha_inicio date not null default public.hoy_lima(),
  fecha_fin date,
  motivo_retiro text,
  matricula_origen_id uuid references public.matriculas(id), -- matrícula anterior, si vino de un cambio de salón
  created_at timestamptz not null default now(),
  check ((estado = 'activa' and fecha_fin is null) or (estado = 'retirada' and fecha_fin is not null))
);
create unique index if not exists matriculas_activa_unica on public.matriculas (alumno_id, salon_id) where estado = 'activa';
create index if not exists matriculas_salon_idx on public.matriculas (salon_id, estado);
create index if not exists matriculas_alumno_idx on public.matriculas (alumno_id, estado);

alter table public.matriculas enable row level security;
revoke all on public.matriculas from anon, authenticated;
grant select on public.matriculas to authenticated;
drop policy if exists "consultar matriculas" on public.matriculas;
create policy "consultar matriculas" on public.matriculas for select to authenticated using ((select public.tiene_perfil()));

-- ============================================================
-- 2. Capacidad del salón nunca por debajo de los matriculados
-- ============================================================
create or replace function public.salones_validar_capacidad() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  select count(*) into v_n from public.matriculas where salon_id = new.id and estado = 'activa';
  if new.capacidad < v_n then
    raise exception 'No se puede reducir la capacidad a %: el salón tiene % estudiantes matriculados', new.capacidad, v_n;
  end if;
  return new;
end $$;
drop trigger if exists salones_capacidad_ck on public.salones;
create trigger salones_capacidad_ck before update of capacidad on public.salones
  for each row execute function public.salones_validar_capacidad();

-- ============================================================
-- 3. Funciones de matrícula (solo administradores)
-- ============================================================
-- Matricula a uno o varios alumnos en un salón. Todo o nada: si alguno ya está matriculado o no hay cupos, no se matricula a nadie.
create or replace function public.matricular_alumnos(p_salon uuid, p_alumnos uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_s public.salones;
  v_ids uuid[] := array(select distinct x from unnest(coalesce(p_alumnos, '{}')) x where x is not null);
  v_ocupados integer;
  v_dup text;
  v_inactivos text;
begin
  perform public.cal_exigir_admin();
  if coalesce(array_length(v_ids, 1), 0) = 0 then raise exception 'Selecciona al menos un estudiante'; end if;
  select * into v_s from public.salones where id = p_salon for update;
  if not found then raise exception 'El salón no existe'; end if;
  if v_s.estado = 'finalizado' then raise exception 'El salón está finalizado: no admite nuevas matrículas'; end if;
  if (select count(*) from public.alumnos where id = any(v_ids)) <> array_length(v_ids, 1) then
    raise exception 'Alguno de los estudiantes no existe';
  end if;
  select string_agg(nombre, ', ') into v_inactivos from public.alumnos where id = any(v_ids) and not activo;
  if v_inactivos is not null then raise exception 'Estudiantes inactivos: %. Actívalos antes de matricularlos', v_inactivos; end if;
  select string_agg(a.nombre, ', ') into v_dup
    from public.matriculas m join public.alumnos a on a.id = m.alumno_id
   where m.salon_id = p_salon and m.estado = 'activa' and m.alumno_id = any(v_ids);
  if v_dup is not null then raise exception 'Ya matriculados en este salón: %', v_dup; end if;
  select count(*) into v_ocupados from public.matriculas where salon_id = p_salon and estado = 'activa';
  if v_ocupados + array_length(v_ids, 1) > v_s.capacidad then
    raise exception 'No hay cupos suficientes: el salón tiene capacidad para % y ya hay % matriculados (quedan %)',
      v_s.capacidad, v_ocupados, greatest(v_s.capacidad - v_ocupados, 0);
  end if;
  insert into public.matriculas (alumno_id, salon_id) select unnest(v_ids), p_salon;
  return array_length(v_ids, 1);
end $$;

-- Retira al alumno del salón conservando la matrícula como historial. Repetir la llamada no hace nada.
create or replace function public.retirar_matricula(p_matricula uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  if not exists (select 1 from public.matriculas where id = p_matricula) then raise exception 'La matrícula no existe'; end if;
  update public.matriculas set estado = 'retirada', fecha_fin = public.hoy_lima(), motivo_retiro = nullif(btrim(p_motivo), '')
   where id = p_matricula and estado = 'activa';
end $$;

-- Cambia al alumno de salón: retira la matrícula actual y crea la nueva, enlazadas, en una sola transacción.
create or replace function public.cambiar_salon_matricula(p_matricula uuid, p_salon_nuevo uuid, p_motivo text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_m public.matriculas;
  v_s public.salones;
  v_ocupados integer;
  v_id uuid;
begin
  perform public.cal_exigir_admin();
  select * into v_m from public.matriculas where id = p_matricula;
  if not found then raise exception 'La matrícula no existe'; end if;
  select * into v_s from public.salones where id = p_salon_nuevo for update;
  if not found then raise exception 'El salón de destino no existe'; end if;
  select * into v_m from public.matriculas where id = p_matricula for update;
  if v_m.estado <> 'activa' then raise exception 'La matrícula ya fue retirada'; end if;
  if v_m.salon_id = p_salon_nuevo then raise exception 'El estudiante ya está en ese salón'; end if;
  if v_s.estado = 'finalizado' then raise exception 'El salón de destino está finalizado'; end if;
  if exists (select 1 from public.matriculas where alumno_id = v_m.alumno_id and salon_id = p_salon_nuevo and estado = 'activa') then
    raise exception 'El estudiante ya está matriculado en el salón de destino';
  end if;
  select count(*) into v_ocupados from public.matriculas where salon_id = p_salon_nuevo and estado = 'activa';
  if v_ocupados >= v_s.capacidad then raise exception 'El salón de destino no tiene cupos disponibles'; end if;

  update public.matriculas set estado = 'retirada', fecha_fin = public.hoy_lima(),
         motivo_retiro = coalesce(nullif(btrim(p_motivo), ''), 'Cambio de salón')
   where id = p_matricula;
  insert into public.matriculas (alumno_id, salon_id, matricula_origen_id) values (v_m.alumno_id, p_salon_nuevo, p_matricula)
  returning id into v_id;
  return v_id;
end $$;

-- ============================================================
-- 4. Alumnos sin duplicados (nombre, correo o teléfono) y activación
-- ============================================================
create or replace function public.guardar_alumno(p_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_nombre text := btrim(regexp_replace(coalesce(p_datos->>'nombre', ''), '\s+', ' ', 'g'));
  v_correo text := nullif(lower(btrim(coalesce(p_datos->>'correo', ''))), '');
  v_tel text := nullif(regexp_replace(coalesce(p_datos->>'telefono', ''), '\D', '', 'g'), '');
  v_otro text;
begin
  perform public.cal_exigir_admin();
  if v_nombre = '' then raise exception 'El nombre del alumno es obligatorio'; end if;

  select nombre into v_otro from public.alumnos
   where id is distinct from p_id and lower(btrim(regexp_replace(nombre, '\s+', ' ', 'g'))) = lower(v_nombre) limit 1;
  if v_otro is not null then
    raise exception 'Ya existe un estudiante con el nombre «%». Si es otra persona, agrega el segundo apellido para diferenciarla', v_otro;
  end if;
  if v_correo is not null then
    select nombre into v_otro from public.alumnos where id is distinct from p_id and lower(btrim(correo)) = v_correo limit 1;
    if v_otro is not null then raise exception 'El correo ya pertenece al estudiante «%»', v_otro; end if;
  end if;
  if v_tel is not null then
    select nombre into v_otro from public.alumnos where id is distinct from p_id and regexp_replace(coalesce(telefono, ''), '\D', '', 'g') = v_tel limit 1;
    if v_otro is not null then raise exception 'El teléfono ya pertenece al estudiante «%»', v_otro; end if;
  end if;

  if p_id is null then
    insert into public.alumnos (nombre, telefono, correo, notas)
    values (v_nombre, nullif(btrim(p_datos->>'telefono'), ''), nullif(btrim(p_datos->>'correo'), ''), nullif(btrim(p_datos->>'notas'), ''))
    returning id into v_id;
  else
    update public.alumnos set nombre = v_nombre, telefono = nullif(btrim(p_datos->>'telefono'), ''),
           correo = nullif(btrim(p_datos->>'correo'), ''), notas = nullif(btrim(p_datos->>'notas'), ''),
           activo = case when p_datos ? 'activo' then (p_datos->>'activo')::boolean else activo end
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'El alumno no existe'; end if;
  end if;
  return v_id;
end $$;

-- Refuerzo contra carreras (dos altas simultáneas): índices únicos, solo si los datos actuales no tienen repetidos.
do $$ begin
  begin
    create unique index if not exists alumnos_nombre_unico on public.alumnos (lower(btrim(nombre)));
  exception when others then raise notice 'alumnos_nombre_unico no creado (hay nombres repetidos): %', sqlerrm; end;
  begin
    create unique index if not exists alumnos_correo_unico on public.alumnos (lower(btrim(correo))) where correo is not null;
  exception when others then raise notice 'alumnos_correo_unico no creado (hay correos repetidos): %', sqlerrm; end;
end $$;

-- ============================================================
-- 5. Clases particulares: docente propio al reprogramar
-- ============================================================
drop function if exists public.reprogramar_clase(uuid, date, time, time);
create or replace function public.reprogramar_clase(p_clase uuid, p_fecha date, p_inicio time, p_fin time, p_docente uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_c public.paquete_clases; v_p public.paquetes_horas;
begin
  perform public.cal_exigir_admin();
  select paquete_id into v_c.paquete_id from public.paquete_clases where id = p_clase;
  if not found then raise exception 'La clase no existe'; end if;
  select * into v_p from public.paquetes_horas where id = v_c.paquete_id for update;
  select * into v_c from public.paquete_clases where id = p_clase for update;
  if v_c.estado <> 'programada' then raise exception 'Solo se puede reprogramar una clase programada'; end if;
  if p_fin <= p_inicio then raise exception 'La hora de fin debe ser posterior a la de inicio'; end if;
  if v_p.vigencia_hasta is not null and p_fecha > v_p.vigencia_hasta then
    raise exception 'La fecha de la clase es posterior a la vigencia del paquete (%)', v_p.vigencia_hasta;
  end if;
  if exists (select 1 from public.paquete_clases where paquete_id = v_c.paquete_id and id <> p_clase and fecha = p_fecha and estado <> 'cancelada'
             and hora_inicio < p_fin and hora_fin > p_inicio) then
    raise exception 'Ya hay una clase de este paquete que se cruza con ese horario';
  end if;
  update public.paquete_clases set fecha = p_fecha, hora_inicio = p_inicio, hora_fin = p_fin, docente_id = coalesce(p_docente, docente_id)
   where id = p_clase;
end $$;

-- ============================================================
-- 6. Agenda: alumno de cada clase particular (columna nueva al final de la vista)
-- ============================================================
create or replace view public.agenda_sesiones with (security_invoker = true) as
select 'grupal'::text as origen, s.id, s.salon_id, null::uuid as paquete_id, sa.docente_id, d.nombre as docente,
       s.fecha, s.hora_inicio, s.hora_fin,
       (extract(epoch from (s.hora_fin - s.hora_inicio)) / 60)::integer as minutos,
       s.estado, s.tipo, sa.nombre as titulo, sa.codigo as detalle, null::uuid as alumno_id
  from public.salon_sesiones s
  join public.salones sa on sa.id = s.salon_id
  left join public.docentes d on d.id = sa.docente_id
union all
select 'particular'::text, c.id, null::uuid, c.paquete_id, coalesce(c.docente_id, p.docente_id), d.nombre,
       c.fecha, c.hora_inicio, c.hora_fin, c.minutos,
       case c.estado when 'dictada' then 'realizada' else c.estado end, 'regular'::text, a.nombre, 'Clase particular'::text, a.id
  from public.paquete_clases c
  join public.paquetes_horas p on p.id = c.paquete_id and not p.anulado
  join public.alumnos a on a.id = p.alumno_id
  left join public.docentes d on d.id = coalesce(c.docente_id, p.docente_id);

revoke execute on function public.matricular_alumnos(uuid, uuid[]), public.retirar_matricula(uuid, text), public.cambiar_salon_matricula(uuid, uuid, text),
  public.guardar_alumno(uuid, jsonb), public.reprogramar_clase(uuid, date, time, time, uuid) from public, anon;
grant execute on function public.matricular_alumnos(uuid, uuid[]), public.retirar_matricula(uuid, text), public.cambiar_salon_matricula(uuid, uuid, text),
  public.guardar_alumno(uuid, jsonb), public.reprogramar_clase(uuid, date, time, time, uuid) to authenticated;
