-- Frecuencias de clase (Coordinación Académica, frecuencias.xlsx) y su uso en los salones.
-- Aditiva y repetible: no modifica los 58 planes ni sus reglas, ni los salones, sesiones o calendarios existentes.
-- Una frecuencia es independiente del plan académico: NO se vincula con ningún plan por coincidir horas semanales.
begin;

-- ============================================================
-- 1. Tablas
-- ============================================================
create or replace function public.frecuencia_horas(p_minutos smallint[]) returns numeric
language sql immutable set search_path = '' as $$
  select case when p_minutos is null then null else round((select sum(m) from unnest(p_minutos) m) / 60.0, 2) end
$$;

-- Una fila por frecuencia y formato. minutos_por_clase tiene un valor por clase (admite clases de distinta duración).
-- clases_semana / minutos_por_clase vacíos = fila incompleta en el Excel (queda pendiente y no puede activarse).
create table if not exists public.frecuencias (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  formato text not null check (formato in ('grupal', 'privado')),
  intensidad text,
  clases_semana smallint,
  minutos_por_clase smallint[],
  dias smallint[],                       -- opcional: solo si Coordinación define los días
  horas_semana numeric(5,2) generated always as (public.frecuencia_horas(minutos_por_clase)) stored,
  activa boolean not null default false,
  estado_dato text not null default 'pendiente' check (estado_dato in ('confirmado', 'pendiente')),
  fuente text not null,
  notas text,
  orden smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint frecuencias_estructura check (
    (clases_semana is null and minutos_por_clase is null)
    or (clases_semana > 0 and cardinality(minutos_por_clase) = clases_semana and 0 < all (minutos_por_clase))
  ),
  constraint frecuencias_dias check (dias is null or dias <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  constraint frecuencias_confirmada check (estado_dato <> 'confirmado' or clases_semana is not null),
  constraint frecuencias_activa check (not activa or estado_dato = 'confirmado')
);
create unique index if not exists frecuencias_nombre_unico on public.frecuencias (formato, lower(btrim(nombre)));

drop trigger if exists frecuencias_updated_at on public.frecuencias;
create trigger frecuencias_updated_at before update on public.frecuencias
  for each row execute function public.set_updated_at();

-- Modalidades (Estándar 120 h / Acelerado 80 h por nivel) con las que se puede usar cada frecuencia.
create table if not exists public.frecuencia_modalidades (
  frecuencia_id uuid not null references public.frecuencias(id) on delete cascade,
  modalidad_id uuid not null references public.modalidades(id),
  primary key (frecuencia_id, modalidad_id)
);

-- Duración teórica = horas del nivel de la modalidad / horas por semana (la misma fórmula del Excel).
-- NO es una fecha de finalización: no considera feriados, recesos, evaluaciones ni la fecha de inicio.
create or replace view public.frecuencia_duraciones with (security_invoker = true) as
select f.id as frecuencia_id, m.id as modalidad_id, m.codigo as modalidad_codigo, m.nombre as modalidad,
       m.horas_referencia_nivel as horas_nivel, f.horas_semana,
       round(m.horas_referencia_nivel / f.horas_semana, 1) as semanas_teoricas,
       round(m.horas_referencia_nivel / f.horas_semana / 4, 1) as meses_teoricos
from public.frecuencias f
join public.frecuencia_modalidades fm on fm.frecuencia_id = f.id
join public.modalidades m on m.id = fm.modalidad_id
where f.horas_semana > 0;

-- ============================================================
-- 2. Seguridad: lectura para usuarios con perfil; la escritura solo por las funciones de administración
-- ============================================================
revoke all on public.frecuencias, public.frecuencia_modalidades, public.frecuencia_duraciones from anon, authenticated;
grant select on public.frecuencias, public.frecuencia_modalidades, public.frecuencia_duraciones to authenticated;
alter table public.frecuencias enable row level security;
alter table public.frecuencia_modalidades enable row level security;
drop policy if exists "consultar frecuencias" on public.frecuencias;
create policy "consultar frecuencias" on public.frecuencias for select to authenticated using ((select public.tiene_perfil()));
drop policy if exists "consultar frecuencias y modalidades" on public.frecuencia_modalidades;
create policy "consultar frecuencias y modalidades" on public.frecuencia_modalidades for select to authenticated
  using ((select public.tiene_perfil()));

-- ============================================================
-- 3. Datos de frecuencias.xlsx (Coordinación Académica)
-- ============================================================
-- Pendientes (inactivas): "Interdiario 3" (5 clases por semana pese a llamarse interdiario) y la fila sin nombre ni clases.
-- "Diario 4" e "Interdiario 10" traen las horas por clase como texto en el Excel; se cargan tal como lo describe el texto.
insert into public.frecuencias (codigo, nombre, formato, intensidad, clases_semana, minutos_por_clase, dias, activa, estado_dato, fuente, notas, orden)
select v.codigo, v.nombre, v.formato, v.intensidad, v.clases, v.minutos, v.dias,
       v.estado = 'confirmado', v.estado, 'frecuencias.xlsx, hoja ' || v.hoja || ', fila ' || v.fila, v.notas, v.orden
from (values
  ('privado-diaria-if-1',   'Diaria IF 1',    'privado', 'Inmersivo Fast', 5, array_fill(480::smallint, array[5]), null::smallint[], 'confirmado', 'Continuo Privado', 6,  null::text, 1),
  ('privado-diaria-if-2',   'Diaria IF 2',    'privado', 'Inmersivo Fast', 5, array_fill(360::smallint, array[5]), null, 'confirmado', 'Continuo Privado', 7,  null, 2),
  ('privado-diaria-if-3',   'Diaria IF 3',    'privado', 'Inmersivo Fast', 5, array_fill(240::smallint, array[5]), null, 'confirmado', 'Continuo Privado', 8,  null, 3),
  ('privado-diario-1',      'Diario 1',       'privado', 'Superintensivo', 5, array_fill(180::smallint, array[5]), null, 'confirmado', 'Continuo Privado', 9,  null, 4),
  ('privado-interdiario-1', 'Interdiario 1',  'privado', 'Superintensivo', 3, array_fill(240::smallint, array[3]), null, 'confirmado', 'Continuo Privado', 10, null, 5),
  ('privado-diario-2',      'Diario 2',       'privado', 'Superintensivo', 5, array_fill(120::smallint, array[5]), null, 'confirmado', 'Continuo Privado', 11, null, 6),
  ('privado-interdiario-2', 'Interdiario 2',  'privado', 'Superintensivo', 3, array_fill(180::smallint, array[3]), null, 'confirmado', 'Continuo Privado', 12, null, 7),
  ('privado-interdiario-3', 'Interdiario 3',  'privado', 'Superintensivo', 5, array_fill(90::smallint,  array[5]), null, 'pendiente',  'Continuo Privado', 13,
     'Pendiente: el Excel indica 5 clases por semana (7,5 h), pero el nombre sugiere una frecuencia interdiaria. Coordinación debe confirmarla.', 8),
  ('privado-interdiario-4', 'Interdiario 4',  'privado', 'Intensivo',      2, array_fill(180::smallint, array[2]), null, 'confirmado', 'Continuo Privado', 14, null, 9),
  ('privado-diario-4',      'Diario 4',       'privado', 'Intensivo',      6, array_fill(60::smallint,  array[6]), array[1,2,3,4,5,6]::smallint[], 'confirmado', 'Continuo Privado', 15,
     'Horas por clase escritas como texto en el Excel: «1 (lunes a sábado)».', 10),
  ('privado-interdiario-5', 'Interdiario 5',  'privado', 'Intensivo',      3, array_fill(120::smallint, array[3]), null, 'confirmado', 'Continuo Privado', 16, null, 11),
  ('privado-interdiario-10','Interdiario 10', 'privado', 'Intensivo',      3, array[120, 120, 60]::smallint[],     null, 'confirmado', 'Continuo Privado', 17,
     'Clases de distinta duración, según el texto del Excel: «2 horas (2 días) + 1 hora (1 día)».', 12),
  ('privado-diario-3',      'Diario 3',       'privado', 'Intensivo',      5, array_fill(60::smallint,  array[5]), null, 'confirmado', 'Continuo Privado', 18, null, 13),
  ('privado-interdiario-6', 'Interdiario 6',  'privado', 'Semiintensivo',  3, array_fill(90::smallint,  array[3]), null, 'confirmado', 'Continuo Privado', 19, null, 14),
  ('privado-interdiario-7', 'Interdiario 7',  'privado', 'Semiintensivo',  2, array_fill(120::smallint, array[2]), null, 'confirmado', 'Continuo Privado', 20, null, 15),
  ('privado-sabatino-1',    'Sabatino 1',     'privado', 'Semiintensivo',  1, array_fill(240::smallint, array[1]), null, 'confirmado', 'Continuo Privado', 21, null, 16),
  ('privado-interdiario-8', 'Interdiario 8',  'privado', 'Regular',        3, array_fill(60::smallint,  array[3]), null, 'confirmado', 'Continuo Privado', 22, null, 17),
  ('privado-interdiario-9', 'Interdiario 9',  'privado', 'Regular',        2, array_fill(90::smallint,  array[2]), null, 'confirmado', 'Continuo Privado', 23, null, 18),
  ('privado-sabatino-2',    'Sabatino 2',     'privado', 'Regular',        1, array_fill(180::smallint, array[1]), null, 'confirmado', 'Continuo Privado', 24, null, 19),
  ('privado-sin-nombre',    'Sin nombre',     'privado', 'Regular',        null, null::smallint[],                 null, 'pendiente',  'Continuo Privado', 25,
     'Pendiente: fila sin nombre, sin clases por semana ni horas por clase; solo indica 2,5 h por semana y 10 h por mes.', 20),
  ('privado-sabatino-3',    'Sabatino 3',     'privado', 'Regular',        1, array_fill(120::smallint, array[1]), null, 'confirmado', 'Continuo Privado', 26, null, 21),
  ('grupal-diario-2',       'Diario 2',       'grupal',  'Super Intensivo Grupal', 5, array_fill(120::smallint, array[5]), null, 'confirmado', 'Continuo Grupal', 6, null, 1),
  ('grupal-interdiario-2',  'Interdiario 2',  'grupal',  'Super Intensivo Grupal', 3, array_fill(180::smallint, array[3]), null, 'confirmado', 'Continuo Grupal', 7, null, 2),
  ('grupal-diario-4',       'Diario 4',       'grupal',  'Intensivo Grupal',       6, array_fill(60::smallint,  array[6]), array[1,2,3,4,5,6]::smallint[], 'confirmado', 'Continuo Grupal', 8,
     'Horas por clase escritas como texto en el Excel: «1 (lunes a sábado)».', 3),
  ('grupal-interdiario-5',  'Interdiario 5',  'grupal',  'Intensivo Grupal',       3, array_fill(120::smallint, array[3]), null, 'confirmado', 'Continuo Grupal', 9, null, 4),
  ('grupal-diario-3',       'Diario 3',       'grupal',  'Semiintensivo Grupal',   5, array_fill(60::smallint,  array[5]), null, 'confirmado', 'Continuo Grupal', 10, null, 5),
  ('grupal-interdiario-6',  'Interdiario 6',  'grupal',  'Semiintensivo Grupal',   3, array_fill(90::smallint,  array[3]), null, 'confirmado', 'Continuo Grupal', 11, null, 6)
) as v(codigo, nombre, formato, intensidad, clases, minutos, dias, estado, hoja, fila, notas, orden)
on conflict (codigo) do nothing;

-- Modalidades compatibles según el Excel: la hoja Privada trae 80 h (Acelerado) y 120 h (Estándar); la Grupal solo 120 h (Estándar).
-- Si Coordinación define frecuencias grupales Aceleradas, se agregan desde la pantalla de administración.
insert into public.frecuencia_modalidades (frecuencia_id, modalidad_id)
select f.id, m.id
from public.frecuencias f
join public.modalidades m on (f.formato = 'privado' or m.codigo = 'estandar')
where f.codigo <> 'privado-sin-nombre' and f.fuente like 'frecuencias.xlsx%'
on conflict do nothing;

-- ============================================================
-- 4. Administración (solo admin)
-- ============================================================
-- p_datos: {nombre, formato, intensidad, clases_semana, minutos_por_clase: [..], dias: [..]|null, estado_dato, activa, notas}
create or replace function public.guardar_frecuencia(p_id uuid, p_datos jsonb, p_modalidades uuid[])
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_nombre text := btrim(coalesce(p_datos->>'nombre', ''));
  v_formato text := p_datos->>'formato';
  v_clases integer := nullif(p_datos->>'clases_semana', '')::integer;
  v_min smallint[];
  v_dias smallint[];
  v_estado text := coalesce(nullif(p_datos->>'estado_dato', ''), 'pendiente');
  v_activa boolean := coalesce((p_datos->>'activa')::boolean, false);
  v_codigo text;
  v_base text;
  v_n integer := 1;
begin
  perform public.cal_exigir_admin();

  if v_nombre = '' then raise exception 'El nombre de la frecuencia es obligatorio'; end if;
  if v_formato is null or v_formato not in ('grupal', 'privado') then raise exception 'El formato debe ser grupal o privado'; end if;

  if jsonb_typeof(p_datos->'minutos_por_clase') = 'array' and jsonb_array_length(p_datos->'minutos_por_clase') > 0 then
    select array_agg(x::smallint order by o) into v_min from jsonb_array_elements_text(p_datos->'minutos_por_clase') with ordinality t(x, o);
  end if;
  if jsonb_typeof(p_datos->'dias') = 'array' and jsonb_array_length(p_datos->'dias') > 0 then
    select array_agg(distinct x::smallint) into v_dias from jsonb_array_elements_text(p_datos->'dias') t(x);
  end if;

  if v_min is not null then
    if v_clases is null or cardinality(v_min) <> v_clases then
      raise exception 'Indica la duración en minutos de cada una de las % clases por semana', coalesce(v_clases, 0);
    end if;
    if 0 >= any (v_min) then raise exception 'La duración de cada clase debe ser mayor que cero'; end if;
  elsif v_clases is not null then
    raise exception 'Indica la duración en minutos de cada una de las % clases por semana', v_clases;
  end if;
  if v_estado = 'confirmado' and v_min is null then
    raise exception 'Una frecuencia confirmada necesita sus clases por semana y la duración de cada clase';
  end if;
  if v_activa and v_estado <> 'confirmado' then
    raise exception 'Una frecuencia pendiente no puede estar activa: confírmala primero';
  end if;

  if p_id is null then
    v_base := v_formato || '-' || trim(both '-' from regexp_replace(lower(translate(v_nombre, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')), '[^a-z0-9]+', '-', 'g'));
    v_codigo := v_base;
    while exists (select 1 from public.frecuencias where codigo = v_codigo) loop
      v_n := v_n + 1;
      v_codigo := v_base || '-' || v_n;
    end loop;
    insert into public.frecuencias (codigo, nombre, formato, intensidad, clases_semana, minutos_por_clase, dias, activa, estado_dato, fuente, notas, orden)
    values (v_codigo, v_nombre, v_formato, nullif(btrim(p_datos->>'intensidad'), ''), v_clases, v_min, v_dias, v_activa, v_estado,
            'Creada desde Universa', nullif(btrim(p_datos->>'notas'), ''),
            (select coalesce(max(orden), 0) + 1 from public.frecuencias where formato = v_formato))
    returning id into v_id;
  else
    update public.frecuencias set
      nombre = v_nombre, formato = v_formato, intensidad = nullif(btrim(p_datos->>'intensidad'), ''),
      clases_semana = v_clases, minutos_por_clase = v_min, dias = v_dias,
      activa = v_activa, estado_dato = v_estado, notas = nullif(btrim(p_datos->>'notas'), '')
    where id = p_id
    returning id into v_id;
    if not found then raise exception 'La frecuencia no existe' using errcode = 'P0002'; end if;
  end if;

  delete from public.frecuencia_modalidades where frecuencia_id = v_id;
  insert into public.frecuencia_modalidades (frecuencia_id, modalidad_id)
  select v_id, m from unnest(coalesce(p_modalidades, '{}'::uuid[])) as m
  on conflict do nothing;

  return v_id;
end $$;

create or replace function public.activar_frecuencia(p_id uuid, p_activa boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  if p_activa and exists (select 1 from public.frecuencias where id = p_id and estado_dato <> 'confirmado') then
    raise exception 'Una frecuencia pendiente no puede activarse: edítala y márcala como confirmada primero';
  end if;
  update public.frecuencias set activa = p_activa where id = p_id;
  if not found then raise exception 'La frecuencia no existe' using errcode = 'P0002'; end if;
end $$;

revoke execute on function public.guardar_frecuencia(uuid, jsonb, uuid[]), public.activar_frecuencia(uuid, boolean) from public, anon;
grant execute on function public.guardar_frecuencia(uuid, jsonb, uuid[]), public.activar_frecuencia(uuid, boolean) to authenticated;

-- ============================================================
-- 5. Salones con frecuencia (con o sin plan académico)
-- ============================================================
alter table public.salones add column if not exists frecuencia_id uuid;
alter table public.salones drop constraint if exists salones_frecuencia_fk;
alter table public.salones add constraint salones_frecuencia_fk foreign key (frecuencia_id) references public.frecuencias(id);
create index if not exists salones_frecuencia_idx on public.salones (frecuencia_id);

-- Valida los horarios de un salón contra su frecuencia: número de clases por semana y duración de cada una
-- (en cualquier orden, admite clases de distinta duración). Los días solo avisan, y únicamente si la frecuencia los define.
create or replace function public.validar_horarios_frecuencia(p_frecuencia_id uuid, p_horarios jsonb)
returns table (severidad text, mensaje text)
language plpgsql stable set search_path = '' as $$
declare
  v_f public.frecuencias;
  v_n integer;
  v_reales integer[];
  v_esperadas integer[];
  v_dias smallint[];
  v_nombres text;
begin
  select * into v_f from public.frecuencias where id = p_frecuencia_id;
  if not found then raise exception 'La frecuencia seleccionada no existe'; end if;
  if v_f.minutos_por_clase is null then
    return query select 'error'::text, format('La frecuencia «%s» está incompleta y no puede usarse.', v_f.nombre);
    return;
  end if;

  select count(*) into v_n from jsonb_array_elements(coalesce(p_horarios, '[]'::jsonb));
  if v_n = 0 then return; end if;

  if v_n <> v_f.clases_semana then
    return query select 'error'::text,
      format('La frecuencia «%s» exige %s clase(s) por semana y el salón tiene %s.', v_f.nombre, v_f.clases_semana, v_n);
    return;
  end if;

  select array_agg((extract(epoch from ((h->>'hora_fin')::time - (h->>'hora_inicio')::time)) / 60)::integer)
    into v_reales from jsonb_array_elements(p_horarios) h;
  select array_agg(m::integer order by m) into v_esperadas from unnest(v_f.minutos_por_clase) m;
  select array_agg(x order by x) into v_reales from unnest(v_reales) x;
  if v_reales is distinct from v_esperadas then
    return query select 'error'::text,
      format('Las clases deberían durar %s min y duran %s min (frecuencia «%s»).',
             array_to_string(v_esperadas, ' + '), array_to_string(v_reales, ' + '), v_f.nombre);
    return;
  end if;

  if v_f.dias is not null then
    select array_agg(d order by d) into v_dias from (select distinct (h->>'dia')::smallint as d from jsonb_array_elements(p_horarios) h) x;
    if v_dias is distinct from (select array_agg(d order by d) from unnest(v_f.dias) d) then
      select string_agg((array['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'])[d], ' · ' order by d) into v_nombres from unnest(v_f.dias) d;
      return query select 'advertencia'::text, format('La frecuencia «%s» define los días %s.', v_f.nombre, v_nombres);
    end if;
  end if;
end $$;

-- Validación combinada que usa el formulario y guardar_salon.
create or replace function public.validar_horarios_salon(p_plan_id uuid, p_frecuencia_id uuid, p_horarios jsonb)
returns table (severidad text, mensaje text)
language plpgsql stable set search_path = '' as $$
declare
  v_f public.frecuencias;
  v_p public.planes_academicos;
begin
  if p_plan_id is not null and p_frecuencia_id is not null then
    select * into v_p from public.planes_academicos where id = p_plan_id;
    select * into v_f from public.frecuencias where id = p_frecuencia_id;
    if v_p.id is not null and v_f.id is not null and v_f.minutos_por_clase is not null
       and (v_f.clases_semana <> v_p.sesiones_semana or exists (select 1 from unnest(v_f.minutos_por_clase) m where m <> v_p.minutos_clase)) then
      return query select 'error'::text,
        format('La frecuencia «%s» no corresponde a la duración y frecuencia del plan (%s clases de %s min por semana). Elige otra frecuencia o cambia el plan.',
               v_f.nombre, v_p.sesiones_semana, v_p.minutos_clase);
      return;
    end if;
  end if;
  if p_plan_id is not null then
    return query select * from public.validar_horarios_plan(p_plan_id, p_horarios);
  end if;
  if p_frecuencia_id is not null then
    return query select * from public.validar_horarios_frecuencia(p_frecuencia_id, p_horarios);
  end if;
end $$;

revoke execute on function public.validar_horarios_frecuencia(uuid, jsonb), public.validar_horarios_salon(uuid, uuid, jsonb) from public, anon;
grant execute on function public.validar_horarios_frecuencia(uuid, jsonb), public.validar_horarios_salon(uuid, uuid, jsonb) to authenticated;

-- guardar_salon: igual que la versión anterior, más frecuencia_id (opcional; si la clave no viene se conserva la actual).
-- Una frecuencia nueva para el salón debe estar activa. El total de sesiones sigue saliendo del plan; sin plan es manual.
create or replace function public.guardar_salon(p_id uuid, p_salon jsonb, p_horarios jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_total integer := nullif(p_salon->>'total_sesiones', '')::integer;
  v_inicio date := (p_salon->>'fecha_inicio')::date;
  v_total_ant integer;
  v_inicio_ant date;
  v_hay boolean := false;
  v_real integer := 0;
  v_old jsonb;
  v_new jsonb;
  v_plan uuid;
  v_desde smallint;
  v_hasta smallint;
  v_frec uuid;
  v_frec_ant uuid;
  v_n_ciclos integer;
  v_cuota integer;
  v_errores text;
begin
  perform public.cal_exigir_admin();

  if p_id is not null then
    perform 1 from public.salones where id = p_id for update;
    select total_sesiones, fecha_inicio, frecuencia_id into v_total_ant, v_inicio_ant, v_frec_ant from public.salones where id = p_id;
    if not found then
      raise exception 'El salón no existe' using errcode = 'P0002';
    end if;
    select count(*) > 0, count(*) filter (where estado = 'realizada')
      into v_hay, v_real from public.salon_sesiones where salon_id = p_id;
  end if;

  -- Plan académico
  if p_salon ? 'plan_id' then
    v_plan := nullif(p_salon->>'plan_id', '')::uuid;
    v_desde := nullif(p_salon->>'ciclo_desde', '')::smallint;
    v_hasta := nullif(p_salon->>'ciclo_hasta', '')::smallint;
  elsif p_id is not null then
    select plan_id, ciclo_desde, ciclo_hasta into v_plan, v_desde, v_hasta from public.salones where id = p_id;
  end if;

  -- Frecuencia
  if p_salon ? 'frecuencia_id' then
    v_frec := nullif(p_salon->>'frecuencia_id', '')::uuid;
  else
    v_frec := v_frec_ant;
  end if;
  if v_frec is not null and v_frec is distinct from v_frec_ant then
    if not exists (select 1 from public.frecuencias where id = v_frec) then
      raise exception 'La frecuencia seleccionada no existe';
    end if;
    if not exists (select 1 from public.frecuencias where id = v_frec and activa and estado_dato = 'confirmado') then
      raise exception 'La frecuencia seleccionada está inactiva o pendiente de confirmación';
    end if;
  end if;

  if v_plan is not null then
    if not exists (select 1 from public.planes_academicos where id = v_plan) then
      raise exception 'El plan académico seleccionado no existe';
    end if;
    if v_desde is null then select min(ciclo) into v_desde from public.plan_ciclos where plan_id = v_plan; end if;
    if v_hasta is null then select max(ciclo) into v_hasta from public.plan_ciclos where plan_id = v_plan; end if;
    select count(*), sum(sesiones) into v_n_ciclos, v_cuota
      from public.plan_ciclos where plan_id = v_plan and ciclo between v_desde and v_hasta;
    if v_desde > v_hasta or v_n_ciclos <> v_hasta - v_desde + 1 then
      raise exception 'Los ciclos seleccionados (% a %) no pertenecen al plan', v_desde, v_hasta;
    end if;
    if not v_hay then
      v_total := v_cuota;
    end if;
  else
    v_desde := null;
    v_hasta := null;
  end if;

  if v_plan is not null or v_frec is not null then
    select string_agg(mensaje, ' ') into v_errores from public.validar_horarios_salon(v_plan, v_frec, p_horarios) where severidad = 'error';
    if v_errores is not null then
      raise exception 'Los horarios no corresponden al plan o a la frecuencia. %', v_errores;
    end if;
  end if;

  if p_id is null then
    insert into public.salones (
      codigo, nombre, programa_id, curso, docente_id, fecha_inicio,
      fecha_fin_estimada, capacidad, estado, observaciones, total_sesiones,
      plan_id, ciclo_desde, ciclo_hasta, frecuencia_id
    ) values (
      btrim(p_salon->>'codigo'),
      btrim(p_salon->>'nombre'),
      (p_salon->>'programa_id')::uuid,
      nullif(btrim(p_salon->>'curso'), ''),
      nullif(p_salon->>'docente_id', '')::uuid,
      v_inicio,
      nullif(p_salon->>'fecha_fin_estimada', '')::date,
      (p_salon->>'capacidad')::integer,
      coalesce(nullif(p_salon->>'estado', ''), 'pendiente'),
      nullif(btrim(p_salon->>'observaciones'), ''),
      v_total,
      v_plan, v_desde, v_hasta, v_frec
    ) returning id into v_id;
  else
    if v_hay then
      if v_total is null then
        raise exception 'No se puede quitar el total de sesiones: el salón ya tiene sesiones registradas';
      end if;
      if v_total < v_real then
        raise exception 'El total de sesiones (%) no puede ser menor que las sesiones ya realizadas (%)', v_total, v_real;
      end if;
      if v_inicio <> v_inicio_ant then
        raise exception 'La fecha de inicio no puede cambiarse cuando el salón ya tiene sesiones registradas';
      end if;
    end if;

    select coalesce(jsonb_agg(jsonb_build_array(h.dia, h.hora_inicio, h.hora_fin) order by h.dia, h.hora_inicio, h.hora_fin), '[]'::jsonb)
      into v_old from public.salon_horarios h where h.salon_id = p_id;

    update public.salones set
      codigo = btrim(p_salon->>'codigo'),
      nombre = btrim(p_salon->>'nombre'),
      programa_id = (p_salon->>'programa_id')::uuid,
      curso = nullif(btrim(p_salon->>'curso'), ''),
      docente_id = nullif(p_salon->>'docente_id', '')::uuid,
      fecha_inicio = v_inicio,
      fecha_fin_estimada = case when v_hay then fecha_fin_estimada
                                else nullif(p_salon->>'fecha_fin_estimada', '')::date end,
      capacidad = (p_salon->>'capacidad')::integer,
      estado = coalesce(nullif(p_salon->>'estado', ''), 'pendiente'),
      observaciones = nullif(btrim(p_salon->>'observaciones'), ''),
      total_sesiones = v_total,
      plan_id = v_plan, ciclo_desde = v_desde, ciclo_hasta = v_hasta, frecuencia_id = v_frec
    where id = p_id
    returning id into v_id;
  end if;

  delete from public.salon_horarios where salon_id = v_id;
  insert into public.salon_horarios (salon_id, dia, hora_inicio, hora_fin)
  select v_id, (h->>'dia')::smallint, (h->>'hora_inicio')::time, (h->>'hora_fin')::time
  from jsonb_array_elements(coalesce(p_horarios, '[]'::jsonb)) as h;

  if p_id is not null and v_hay then
    select coalesce(jsonb_agg(jsonb_build_array(h.dia, h.hora_inicio, h.hora_fin) order by h.dia, h.hora_inicio, h.hora_fin), '[]'::jsonb)
      into v_new from public.salon_horarios h where h.salon_id = v_id;
    if v_total is distinct from v_total_ant or v_old is distinct from v_new then
      perform public.cal_recalcular(v_id);
    end if;
  end if;

  return v_id;
end $$;

revoke execute on function public.guardar_salon(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.guardar_salon(uuid, jsonb, jsonb) to authenticated;

commit;
