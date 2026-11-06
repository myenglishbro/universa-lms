-- UNIVERSA · Paquetes de horas (clases privadas): alumno, paquete, pagos, clases y saldo.
--
-- Separado del avance académico: NO usa planes, ciclos, salones ni salon_sesiones.
-- El saldo de horas es la suma del libro de movimientos (paquete_movimientos), que solo admite altas: nunca se edita ni se borra.
-- Las horas se miden en MINUTOS (duración real de cada clase). Toda escritura pasa por funciones solo-admin (security definer).
-- Anti-duplicados: cada movimiento automático tiene una `clave` única (consumo por clase y por vez dictada, etc.) y las
-- funciones bloquean el paquete (for update), así un doble clic o un reintento no descuenta dos veces.
--
-- Repetible (el SQL Editor no ejecuta el archivo como una transacción). Requiere las migraciones anteriores (cal_exigir_admin, hoy_lima, docentes, niveles).

-- ============================================================
-- 1. Tablas
-- ============================================================
create table if not exists public.alumnos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> ''),
  telefono text,
  correo text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.paquetes_horas (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.alumnos(id),
  docente_id uuid references public.docentes(id),
  nivel_id uuid references public.niveles(id),
  minutos_contratados integer not null check (minutos_contratados > 0),
  precio numeric(10, 2) not null check (precio >= 0), -- precio libre: no hay tarifa por hora
  moneda text not null default 'PEN' check (moneda in ('PEN', 'USD')),
  fecha_compra date not null default public.hoy_lima(),
  vigencia_hasta date,
  paquete_origen_id uuid references public.paquetes_horas(id), -- renovación o compra adicional
  anulado boolean not null default false,
  motivo_anulacion text,
  notas text,
  created_at timestamptz not null default now(),
  check (vigencia_hasta is null or vigencia_hasta >= fecha_compra)
);
create index if not exists paquetes_horas_alumno_idx on public.paquetes_horas (alumno_id);

create table if not exists public.paquete_pagos (
  id uuid primary key default gen_random_uuid(),
  paquete_id uuid not null references public.paquetes_horas(id),
  monto numeric(10, 2) not null check (monto > 0),
  fecha date not null default public.hoy_lima(),
  metodo text,
  nota text,
  anulado boolean not null default false, -- un pago se anula, no se borra
  motivo_anulacion text,
  created_at timestamptz not null default now()
);
create index if not exists paquete_pagos_paquete_idx on public.paquete_pagos (paquete_id);

create table if not exists public.paquete_clases (
  id uuid primary key default gen_random_uuid(),
  paquete_id uuid not null references public.paquetes_horas(id),
  docente_id uuid references public.docentes(id),
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  minutos integer generated always as ((extract(epoch from (hora_fin - hora_inicio)) / 60)::integer) stored,
  estado text not null default 'programada' check (estado in ('programada', 'dictada', 'cancelada')),
  cancelacion text check (cancelacion in ('normal', 'tardia')),
  nota text,
  veces_dictada integer not null default 0, -- cuántas veces se ha confirmado (permite corregir y volver a confirmar)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (hora_fin > hora_inicio)
);
create index if not exists paquete_clases_paquete_idx on public.paquete_clases (paquete_id, fecha);

drop trigger if exists paquete_clases_updated_at on public.paquete_clases;
create trigger paquete_clases_updated_at before update on public.paquete_clases
  for each row execute function public.set_updated_at();

-- Libro de movimientos. minutos con signo: compra/ampliación/reversión suman; consumo/cancelación tardía restan; ajuste ±.
create table if not exists public.paquete_movimientos (
  id uuid primary key default gen_random_uuid(),
  paquete_id uuid not null references public.paquetes_horas(id),
  clase_id uuid references public.paquete_clases(id),
  tipo text not null check (tipo in ('compra', 'ampliacion', 'ajuste', 'consumo', 'cancelacion_tardia', 'reversion')),
  minutos integer not null check (minutos <> 0),
  motivo text,
  clave text unique, -- anti-duplicados
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check ((tipo in ('compra', 'ampliacion', 'reversion') and minutos > 0) or (tipo in ('consumo', 'cancelacion_tardia') and minutos < 0) or tipo = 'ajuste'),
  check (tipo in ('compra', 'consumo') or btrim(coalesce(motivo, '')) <> '')
);
create index if not exists paquete_movimientos_paquete_idx on public.paquete_movimientos (paquete_id, created_at);

create or replace function public.paquete_movimientos_inmutable() returns trigger
language plpgsql as $$
begin
  raise exception 'El historial de movimientos no se puede modificar ni borrar; registra un ajuste o una corrección';
end $$;
drop trigger if exists paquete_movimientos_solo_altas on public.paquete_movimientos;
create trigger paquete_movimientos_solo_altas before update or delete on public.paquete_movimientos
  for each row execute function public.paquete_movimientos_inmutable();

-- ============================================================
-- 2. Seguridad: lectura para quien tenga perfil; escritura solo por funciones
-- ============================================================
alter table public.alumnos enable row level security;
alter table public.paquetes_horas enable row level security;
alter table public.paquete_pagos enable row level security;
alter table public.paquete_clases enable row level security;
alter table public.paquete_movimientos enable row level security;

revoke all on public.alumnos, public.paquetes_horas, public.paquete_pagos, public.paquete_clases, public.paquete_movimientos from anon, authenticated;
grant select on public.alumnos, public.paquetes_horas, public.paquete_pagos, public.paquete_clases, public.paquete_movimientos to authenticated;

drop policy if exists "consultar alumnos" on public.alumnos;
create policy "consultar alumnos" on public.alumnos for select to authenticated using ((select public.tiene_perfil()));
drop policy if exists "consultar paquetes" on public.paquetes_horas;
create policy "consultar paquetes" on public.paquetes_horas for select to authenticated using ((select public.tiene_perfil()));
drop policy if exists "consultar pagos de paquetes" on public.paquete_pagos;
create policy "consultar pagos de paquetes" on public.paquete_pagos for select to authenticated using ((select public.tiene_perfil()));
drop policy if exists "consultar clases de paquetes" on public.paquete_clases;
create policy "consultar clases de paquetes" on public.paquete_clases for select to authenticated using ((select public.tiene_perfil()));
drop policy if exists "consultar movimientos de paquetes" on public.paquete_movimientos;
create policy "consultar movimientos de paquetes" on public.paquete_movimientos for select to authenticated using ((select public.tiene_perfil()));

-- ============================================================
-- 3. Saldo por paquete (todo en minutos). security_invoker: respeta las políticas de las tablas.
--    compradas   = compra + ampliaciones            consumidas = clases dictadas + cancelaciones tardías − reversiones
--    ajustes     = ajustes autorizados (±)          disponibles = suma de todos los movimientos
--    programadas = minutos de clases aún programadas   libres = disponibles − programadas (negativo = faltan horas)
-- ============================================================
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
            else 'activo' end as estado
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

-- ============================================================
-- 4. Funciones (solo administradores). Interna: saldo disponible en minutos.
-- ============================================================
create or replace function public.paquete_disponible(p_paquete uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(minutos), 0)::integer from public.paquete_movimientos where paquete_id = p_paquete
$$;
revoke execute on function public.paquete_disponible(uuid) from public, anon, authenticated;

create or replace function public.texto_horas(p_minutos integer) returns text
language sql immutable set search_path = '' as $$
  select case when p_minutos % 60 = 0 then (p_minutos / 60)::text || ' h'
              when p_minutos < 60 then p_minutos::text || ' min'
              else (p_minutos / 60)::text || ' h ' || (p_minutos % 60)::text || ' min' end
$$;
revoke execute on function public.texto_horas(integer) from public, anon;
grant execute on function public.texto_horas(integer) to authenticated;

create or replace function public.guardar_alumno(p_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.cal_exigir_admin();
  if btrim(coalesce(p_datos->>'nombre', '')) = '' then raise exception 'El nombre del alumno es obligatorio'; end if;
  if p_id is null then
    insert into public.alumnos (nombre, telefono, correo, notas)
    values (btrim(p_datos->>'nombre'), nullif(btrim(p_datos->>'telefono'), ''), nullif(btrim(p_datos->>'correo'), ''), nullif(btrim(p_datos->>'notas'), ''))
    returning id into v_id;
  else
    update public.alumnos set nombre = btrim(p_datos->>'nombre'), telefono = nullif(btrim(p_datos->>'telefono'), ''),
           correo = nullif(btrim(p_datos->>'correo'), ''), notas = nullif(btrim(p_datos->>'notas'), '')
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'El alumno no existe'; end if;
  end if;
  return v_id;
end $$;

-- Registra un paquete (compra nueva, renovación o compra adicional si trae paquete_origen_id) y, si se indica, su primer pago.
-- p_datos: alumno_id, horas, precio, [moneda, docente_id, nivel_id, fecha_compra, vigencia_hasta, paquete_origen_id, notas, pago_monto, pago_metodo]
create or replace function public.registrar_paquete(p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_alumno uuid := nullif(p_datos->>'alumno_id', '')::uuid;
  v_min integer;
  v_precio numeric(10, 2);
  v_pago numeric(10, 2) := coalesce(nullif(p_datos->>'pago_monto', '')::numeric, 0);
  v_origen uuid := nullif(p_datos->>'paquete_origen_id', '')::uuid;
begin
  perform public.cal_exigir_admin();
  if v_alumno is null or not exists (select 1 from public.alumnos where id = v_alumno) then raise exception 'Selecciona un alumno'; end if;
  v_min := round(coalesce(nullif(p_datos->>'horas', '')::numeric, 0) * 60)::integer;
  if v_min <= 0 then raise exception 'Las horas del paquete deben ser mayores que cero'; end if;
  if nullif(p_datos->>'precio', '') is null then raise exception 'Indica el precio del paquete (puede ser 0)'; end if;
  v_precio := (p_datos->>'precio')::numeric;
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

-- Edita datos del paquete (no las horas: para eso están la ampliación y el ajuste). Las claves ausentes se conservan.
create or replace function public.editar_paquete(p_id uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_p public.paquetes_horas; v_pagado numeric;
begin
  perform public.cal_exigir_admin();
  select * into v_p from public.paquetes_horas where id = p_id for update;
  if not found then raise exception 'El paquete no existe'; end if;
  if p_datos ? 'precio' then
    select coalesce(sum(monto), 0) into v_pagado from public.paquete_pagos where paquete_id = p_id and not anulado;
    if (p_datos->>'precio')::numeric < v_pagado then raise exception 'El precio no puede ser menor que lo ya pagado (%)', v_pagado; end if;
  end if;
  update public.paquetes_horas set
    docente_id = case when p_datos ? 'docente_id' then nullif(p_datos->>'docente_id', '')::uuid else docente_id end,
    nivel_id = case when p_datos ? 'nivel_id' then nullif(p_datos->>'nivel_id', '')::uuid else nivel_id end,
    precio = case when p_datos ? 'precio' then (p_datos->>'precio')::numeric else precio end,
    vigencia_hasta = case when p_datos ? 'vigencia_hasta' then nullif(p_datos->>'vigencia_hasta', '')::date else vigencia_hasta end,
    notas = case when p_datos ? 'notas' then nullif(btrim(p_datos->>'notas'), '') else notas end
  where id = p_id;
end $$;

create or replace function public.anular_paquete(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  if btrim(coalesce(p_motivo, '')) = '' then raise exception 'Indica el motivo de la anulación'; end if;
  update public.paquetes_horas set anulado = true, motivo_anulacion = btrim(p_motivo) where id = p_id and not anulado;
end $$;

create or replace function public.registrar_pago(p_paquete uuid, p_monto numeric, p_fecha date default null, p_metodo text default null, p_nota text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_p public.paquetes_horas; v_pagado numeric; v_id uuid;
begin
  perform public.cal_exigir_admin();
  select * into v_p from public.paquetes_horas where id = p_paquete for update;
  if not found then raise exception 'El paquete no existe'; end if;
  if v_p.anulado then raise exception 'El paquete está anulado'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto del pago debe ser mayor que cero'; end if;
  select coalesce(sum(monto), 0) into v_pagado from public.paquete_pagos where paquete_id = p_paquete and not anulado;
  if p_monto > v_p.precio - v_pagado then
    raise exception 'El pago (%) supera el saldo pendiente (%)', p_monto, v_p.precio - v_pagado;
  end if;
  insert into public.paquete_pagos (paquete_id, monto, fecha, metodo, nota)
  values (p_paquete, p_monto, coalesce(p_fecha, public.hoy_lima()), nullif(btrim(p_metodo), ''), nullif(btrim(p_nota), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.anular_pago(p_pago uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  if btrim(coalesce(p_motivo, '')) = '' then raise exception 'Indica el motivo de la anulación del pago'; end if;
  update public.paquete_pagos set anulado = true, motivo_anulacion = btrim(p_motivo) where id = p_pago and not anulado;
end $$;

-- Programar no consume horas ni exige saldo: la pantalla advierte cuando lo programado supera lo disponible.
create or replace function public.programar_clase(p_paquete uuid, p_fecha date, p_inicio time, p_fin time, p_docente uuid default null, p_nota text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_p public.paquetes_horas; v_id uuid;
begin
  perform public.cal_exigir_admin();
  select * into v_p from public.paquetes_horas where id = p_paquete for update;
  if not found then raise exception 'El paquete no existe'; end if;
  if v_p.anulado then raise exception 'El paquete está anulado'; end if;
  if p_fecha is null or p_inicio is null or p_fin is null then raise exception 'Indica fecha y horario de la clase'; end if;
  if p_fin <= p_inicio then raise exception 'La hora de fin debe ser posterior a la de inicio'; end if;
  if v_p.vigencia_hasta is not null and p_fecha > v_p.vigencia_hasta then
    raise exception 'La fecha de la clase es posterior a la vigencia del paquete (%)', v_p.vigencia_hasta;
  end if;
  if exists (select 1 from public.paquete_clases where paquete_id = p_paquete and fecha = p_fecha and estado <> 'cancelada'
             and hora_inicio < p_fin and hora_fin > p_inicio) then
    raise exception 'Ya hay una clase de este paquete que se cruza con ese horario';
  end if;
  insert into public.paquete_clases (paquete_id, docente_id, fecha, hora_inicio, hora_fin, nota)
  values (p_paquete, coalesce(p_docente, v_p.docente_id), p_fecha, p_inicio, p_fin, nullif(btrim(p_nota), ''))
  returning id into v_id;
  return v_id;
end $$;

-- Reprogramar solo mueve la clase: no genera movimientos.
create or replace function public.reprogramar_clase(p_clase uuid, p_fecha date, p_inicio time, p_fin time) returns void
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
  update public.paquete_clases set fecha = p_fecha, hora_inicio = p_inicio, hora_fin = p_fin where id = p_clase;
end $$;

-- Cancelación normal: no consume horas. Tardía: descuenta p_minutos (por defecto, la duración completa), con motivo obligatorio.
-- Repetir la llamada sobre una clase ya cancelada no hace nada (no duplica el descuento).
create or replace function public.cancelar_clase(p_clase uuid, p_tardia boolean default false, p_motivo text default null, p_minutos integer default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_c public.paquete_clases; v_min integer;
begin
  perform public.cal_exigir_admin();
  select paquete_id into v_c.paquete_id from public.paquete_clases where id = p_clase;
  if not found then raise exception 'La clase no existe'; end if;
  perform 1 from public.paquetes_horas where id = v_c.paquete_id for update;
  select * into v_c from public.paquete_clases where id = p_clase for update;
  if v_c.estado = 'cancelada' then return; end if;
  if v_c.estado = 'dictada' then raise exception 'Una clase dictada no se cancela: corrígela primero'; end if;

  if p_tardia then
    if btrim(coalesce(p_motivo, '')) = '' then raise exception 'La cancelación tardía exige un motivo'; end if;
    v_min := coalesce(p_minutos, v_c.minutos);
    if v_min <= 0 or v_min > v_c.minutos then raise exception 'El descuento debe estar entre 1 y % minutos', v_c.minutos; end if;
    if v_min > public.paquete_disponible(v_c.paquete_id) then
      raise exception 'No alcanza el saldo para descontar % (quedan %). Registra una ampliación o un ajuste antes.',
        public.texto_horas(v_min), public.texto_horas(public.paquete_disponible(v_c.paquete_id));
    end if;
    insert into public.paquete_movimientos (paquete_id, clase_id, tipo, minutos, motivo, clave)
    values (v_c.paquete_id, p_clase, 'cancelacion_tardia', -v_min, btrim(p_motivo), 'tardia:' || p_clase);
  end if;
  update public.paquete_clases set estado = 'cancelada', cancelacion = case when p_tardia then 'tardia' else 'normal' end,
         nota = coalesce(nullif(btrim(p_motivo), ''), nota)
   where id = p_clase;
end $$;

-- Confirma la clase como dictada y descuenta su duración real. Idempotente: si ya está dictada, no vuelve a descontar.
-- Devuelve true si descontó ahora, false si ya estaba confirmada.
create or replace function public.marcar_dictada(p_clase uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_c public.paquete_clases; v_p public.paquetes_horas; v_disp integer;
begin
  perform public.cal_exigir_admin();
  select paquete_id into v_c.paquete_id from public.paquete_clases where id = p_clase;
  if not found then raise exception 'La clase no existe'; end if;
  select * into v_p from public.paquetes_horas where id = v_c.paquete_id for update;
  select * into v_c from public.paquete_clases where id = p_clase for update;
  if v_c.estado = 'dictada' then return false; end if;
  if v_c.estado = 'cancelada' then raise exception 'La clase está cancelada'; end if;
  if v_p.anulado then raise exception 'El paquete está anulado'; end if;
  v_disp := public.paquete_disponible(v_c.paquete_id);
  if v_c.minutos > v_disp then
    raise exception 'La clase dura % y solo quedan % en el paquete. Registra una ampliación o un ajuste autorizado antes de confirmarla.',
      public.texto_horas(v_c.minutos), public.texto_horas(greatest(v_disp, 0));
  end if;
  update public.paquete_clases set estado = 'dictada', veces_dictada = veces_dictada + 1 where id = p_clase returning veces_dictada into v_c.veces_dictada;
  insert into public.paquete_movimientos (paquete_id, clase_id, tipo, minutos, clave)
  values (v_c.paquete_id, p_clase, 'consumo', -v_c.minutos, 'consumo:' || p_clase || ':' || v_c.veces_dictada);
  return true;
end $$;

-- Corrige una clase dictada por error: devuelve sus horas con una reversión y la deja otra vez programada.
create or replace function public.corregir_clase(p_clase uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_c public.paquete_clases;
begin
  perform public.cal_exigir_admin();
  if btrim(coalesce(p_motivo, '')) = '' then raise exception 'Indica el motivo de la corrección'; end if;
  select paquete_id into v_c.paquete_id from public.paquete_clases where id = p_clase;
  if not found then raise exception 'La clase no existe'; end if;
  perform 1 from public.paquetes_horas where id = v_c.paquete_id for update;
  select * into v_c from public.paquete_clases where id = p_clase for update;
  if v_c.estado <> 'dictada' then raise exception 'Solo se corrige una clase dictada'; end if;
  insert into public.paquete_movimientos (paquete_id, clase_id, tipo, minutos, motivo, clave)
  values (v_c.paquete_id, p_clase, 'reversion', v_c.minutos, btrim(p_motivo), 'reversion:' || p_clase || ':' || v_c.veces_dictada);
  update public.paquete_clases set estado = 'programada' where id = p_clase;
end $$;

-- Ampliación (suma horas, p. ej. horas de cortesía o compra adicional sin nuevo paquete) o ajuste (±) con motivo obligatorio.
-- p_clave (opcional, generada por el cliente) evita duplicar el movimiento si la petición se repite.
create or replace function public.ajustar_paquete(p_paquete uuid, p_horas numeric, p_tipo text, p_motivo text, p_clave text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_min integer := round(coalesce(p_horas, 0) * 60)::integer;
begin
  perform public.cal_exigir_admin();
  if p_tipo not in ('ampliacion', 'ajuste') then raise exception 'Tipo de movimiento no válido'; end if;
  if v_min = 0 then raise exception 'Indica una cantidad de horas distinta de cero'; end if;
  if btrim(coalesce(p_motivo, '')) = '' then raise exception 'Indica el motivo'; end if;
  if p_tipo = 'ampliacion' and v_min < 0 then raise exception 'Una ampliación debe sumar horas'; end if;
  perform 1 from public.paquetes_horas where id = p_paquete for update;
  if not found then raise exception 'El paquete no existe'; end if;
  if v_min < 0 and public.paquete_disponible(p_paquete) + v_min < 0 then
    raise exception 'El ajuste dejaría el saldo en negativo';
  end if;
  insert into public.paquete_movimientos (paquete_id, tipo, minutos, motivo, clave)
  values (p_paquete, p_tipo, v_min, btrim(p_motivo), case when p_clave is null then null else 'manual:' || p_clave end)
  on conflict (clave) do nothing;
end $$;

revoke execute on function
  public.guardar_alumno(uuid, jsonb), public.registrar_paquete(jsonb), public.editar_paquete(uuid, jsonb), public.anular_paquete(uuid, text),
  public.registrar_pago(uuid, numeric, date, text, text), public.anular_pago(uuid, text),
  public.programar_clase(uuid, date, time, time, uuid, text), public.reprogramar_clase(uuid, date, time, time),
  public.cancelar_clase(uuid, boolean, text, integer), public.marcar_dictada(uuid), public.corregir_clase(uuid, text),
  public.ajustar_paquete(uuid, numeric, text, text, text)
  from public, anon;
grant execute on function
  public.guardar_alumno(uuid, jsonb), public.registrar_paquete(jsonb), public.editar_paquete(uuid, jsonb), public.anular_paquete(uuid, text),
  public.registrar_pago(uuid, numeric, date, text, text), public.anular_pago(uuid, text),
  public.programar_clase(uuid, date, time, time, uuid, text), public.reprogramar_clase(uuid, date, time, time),
  public.cancelar_clase(uuid, boolean, text, integer), public.marcar_dictada(uuid), public.corregir_clase(uuid, text),
  public.ajustar_paquete(uuid, numeric, text, text, text)
  to authenticated;
