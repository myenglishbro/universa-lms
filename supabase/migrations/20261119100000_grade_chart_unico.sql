-- Evaluaciones: un solo Grade Chart de Universa con dos columnas de peso (módulos 1 a 3 / módulo final).
-- El sistema decide solo cuál usar: el último módulo del último ciclo del plan es el módulo final.
-- Repetible. Va después de 20261118100000_ciclos_base_100.sql.

-- ============================================================
-- 1. Estructura: peso y nombre para el módulo final, variante «final» de una versión y marca de módulo final
-- ============================================================
alter table public.eval_componentes add column if not exists peso_final numeric(6,2);
alter table public.eval_componentes add column if not exists nombre_final text;
alter table public.eval_componentes drop constraint if exists eval_componentes_final_ck;
alter table public.eval_componentes add constraint eval_componentes_final_ck
  check ((peso_final is null or (peso_final > 0 and peso_final <= 1000)) and (nombre_final is null or (btrim(nombre_final) <> '' and length(nombre_final) <= 80)));

-- La variante «final» es una copia interna de la versión con los pesos del módulo final: así todo el cálculo existente sigue igual.
alter table public.eval_versiones add column if not exists variante text not null default 'normal';
alter table public.eval_versiones drop constraint if exists eval_versiones_variante_ck;
alter table public.eval_versiones add constraint eval_versiones_variante_ck check (variante in ('normal', 'final'));
alter table public.eval_versiones add column if not exists origen_id uuid references public.eval_versiones(id) on delete cascade;
alter table public.eval_versiones drop constraint if exists eval_versiones_plantilla_id_version_key;
create unique index if not exists eval_versiones_unica on public.eval_versiones (plantilla_id, version, variante);
drop index if exists public.eval_versiones_una_vigente;
create unique index eval_versiones_una_vigente on public.eval_versiones (plantilla_id, variante) where estado = 'vigente';
drop index if exists public.eval_versiones_un_borrador;
create unique index eval_versiones_un_borrador on public.eval_versiones (plantilla_id, variante) where estado = 'borrador';

alter table public.eval_modulos add column if not exists es_final boolean not null default false;

-- ============================================================
-- 2. Editar una versión: pesos de módulos 1 a 3 y, opcionalmente, pesos y nombres del módulo final
-- ============================================================
create or replace function public.guardar_version(p_version uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_v public.eval_versiones;
  v_escala numeric;
  v_comp jsonb := coalesce(p_datos->'componentes', '[]'::jsonb);
  v_c jsonb; v_nom text; v_peso numeric; v_pf numeric; v_nf text; v_tipo text; v_rub uuid;
  v_nombres text[] := '{}'; v_nombres_f text[] := '{}'; v_orden integer := 0; v_con_final integer := 0;
begin
  perform public.cal_exigir_admin();
  select * into v_v from public.eval_versiones where id = p_version for update;
  if not found then raise exception 'La versión no existe'; end if;
  if v_v.variante <> 'normal' then raise exception 'Esta es una copia interna del módulo final; edita la versión principal'; end if;
  if v_v.estado <> 'borrador' then raise exception 'Solo se puede editar una versión en borrador; crea una versión nueva para cambiar pesos'; end if;
  begin v_escala := coalesce((p_datos->>'escala_puntos')::numeric, v_v.escala_puntos); exception when others then v_escala := null; end;
  if v_escala is null or v_escala <= 0 or v_escala > 1000 then raise exception 'La escala de puntos debe ser mayor que 0'; end if;
  if jsonb_typeof(v_comp) <> 'array' or jsonb_array_length(v_comp) > 12 then raise exception 'Una plantilla admite hasta 12 componentes'; end if;

  select count(*) into v_con_final from jsonb_array_elements(v_comp) x where nullif(btrim(coalesce(x->>'peso_final', '')), '') is not null;
  if v_con_final > 0 and v_con_final <> jsonb_array_length(v_comp) then
    raise exception 'Si defines pesos para el módulo final, deben estar todos los componentes (o ninguno)';
  end if;

  for v_c in select * from jsonb_array_elements(v_comp) loop
    v_nom := btrim(coalesce(v_c->>'nombre', ''));
    if v_nom = '' then raise exception 'Todos los componentes necesitan nombre'; end if;
    if lower(v_nom) = any(v_nombres) then raise exception 'El componente «%» está repetido', v_nom; end if;
    v_nombres := v_nombres || lower(v_nom);
    begin v_peso := (v_c->>'peso')::numeric; exception when others then v_peso := null; end;
    if v_peso is null or v_peso <= 0 then raise exception 'El peso de «%» debe ser mayor que 0', v_nom; end if;
    if v_peso > v_escala then raise exception 'El peso de «%» no puede superar la escala (%)', v_nom, v_escala; end if;
    if v_con_final > 0 then
      begin v_pf := (v_c->>'peso_final')::numeric; exception when others then v_pf := null; end;
      if v_pf is null or v_pf <= 0 then raise exception 'El peso de «%» en el módulo final debe ser mayor que 0', v_nom; end if;
      if v_pf > v_escala then raise exception 'El peso de «%» en el módulo final no puede superar la escala (%)', v_nom, v_escala; end if;
      v_nf := coalesce(nullif(btrim(coalesce(v_c->>'nombre_final', '')), ''), v_nom);
      if lower(v_nf) = any(v_nombres_f) then raise exception 'El nombre «%» está repetido en el módulo final', v_nf; end if;
      v_nombres_f := v_nombres_f || lower(v_nf);
    end if;
    v_tipo := coalesce(nullif(v_c->>'tipo', ''), 'otro');
    if v_tipo not in ('test', 'writing', 'project', 'formative', 'spark', 'speaking', 'participacion', 'otro') then raise exception 'Tipo de componente no válido'; end if;
    v_rub := nullif(v_c->>'rubrica_id', '')::uuid;
    if v_rub is not null and v_tipo = 'participacion' then raise exception '«%» es una participación por clase y no usa rúbrica', v_nom; end if;
    if v_rub is not null and not exists (select 1 from public.eval_rubricas where id = v_rub and activa) then
      raise exception 'La rúbrica elegida para «%» no existe o está inactiva', v_nom;
    end if;
  end loop;

  update public.eval_versiones set escala_puntos = v_escala, notas = nullif(btrim(coalesce(p_datos->>'notas', '')), '') where id = p_version;
  delete from public.eval_componentes where version_id = p_version;
  for v_c in select * from jsonb_array_elements(v_comp) loop
    v_orden := v_orden + 1;
    insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id, peso_final, nombre_final)
    values (p_version, btrim(v_c->>'nombre'), coalesce(nullif(v_c->>'tipo', ''), 'otro'), (v_c->>'peso')::numeric, v_orden, nullif(v_c->>'rubrica_id', '')::uuid,
            case when v_con_final > 0 then (v_c->>'peso_final')::numeric end,
            case when v_con_final > 0 then nullif(btrim(coalesce(v_c->>'nombre_final', '')), '') end);
  end loop;
end $$;

create or replace function public.nueva_version(p_plantilla uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_ult public.eval_versiones; v_id uuid;
begin
  perform public.cal_exigir_admin();
  perform 1 from public.eval_plantillas where id = p_plantilla for update;
  if not found then raise exception 'La plantilla no existe'; end if;
  if exists (select 1 from public.eval_versiones where plantilla_id = p_plantilla and estado = 'borrador' and variante = 'normal') then
    raise exception 'Ya hay una versión en borrador: edítala o actívala';
  end if;
  select * into v_ult from public.eval_versiones where plantilla_id = p_plantilla and variante = 'normal' order by version desc limit 1;
  insert into public.eval_versiones (plantilla_id, version, escala_puntos, notas)
  values (p_plantilla, v_ult.version + 1, v_ult.escala_puntos, v_ult.notas) returning id into v_id;
  insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id, peso_final, nombre_final)
  select v_id, nombre, tipo, peso, orden, rubrica_id, peso_final, nombre_final from public.eval_componentes where version_id = v_ult.id;
  return v_id;
end $$;

-- ============================================================
-- 3. Activar: valida ambas columnas de peso y genera la variante del módulo final. Uso interno de la copia.
-- ============================================================
create or replace function public.eval_generar_final(p_version uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_v public.eval_versiones; v_id uuid;
begin
  select * into v_v from public.eval_versiones where id = p_version;
  if not found or v_v.variante <> 'normal' then return null; end if;
  delete from public.eval_versiones where origen_id = p_version and variante = 'final';
  if not exists (select 1 from public.eval_componentes where version_id = p_version and peso_final is not null) then return null; end if;
  insert into public.eval_versiones (plantilla_id, version, estado, escala_puntos, notas, activada_at, variante, origen_id)
  values (v_v.plantilla_id, v_v.version, v_v.estado, v_v.escala_puntos, v_v.notas, v_v.activada_at, 'final', p_version) returning id into v_id;
  insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id)
  select v_id, coalesce(nombre_final, nombre), tipo, peso_final, orden, rubrica_id from public.eval_componentes where version_id = p_version;
  return v_id;
end $$;

create or replace function public.activar_version(p_version uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_v public.eval_versiones; v_suma numeric; v_suma_f numeric; v_n integer; v_nf integer;
begin
  perform public.cal_exigir_admin();
  select * into v_v from public.eval_versiones where id = p_version for update;
  if not found then raise exception 'La versión no existe'; end if;
  if v_v.variante <> 'normal' then raise exception 'Activa la versión principal, no su copia del módulo final'; end if;
  if v_v.estado <> 'borrador' then raise exception 'Solo se puede activar una versión en borrador'; end if;
  select coalesce(sum(peso), 0), coalesce(sum(peso_final), 0), count(*), count(peso_final)
    into v_suma, v_suma_f, v_n, v_nf from public.eval_componentes where version_id = p_version;
  if v_n = 0 then raise exception 'La versión no tiene componentes'; end if;
  if v_suma <> v_v.escala_puntos then
    raise exception 'Los pesos de los módulos 1 a 3 suman % y deben sumar % (la escala de la plantilla)', v_suma, v_v.escala_puntos;
  end if;
  if v_nf > 0 and v_suma_f <> v_v.escala_puntos then
    raise exception 'Los pesos del módulo final suman % y deben sumar % (la escala de la plantilla)', v_suma_f, v_v.escala_puntos;
  end if;
  update public.eval_versiones set estado = 'archivada' where plantilla_id = v_v.plantilla_id and estado = 'vigente';
  update public.eval_versiones set estado = 'vigente', activada_at = now() where id = p_version;
  perform public.eval_generar_final(p_version);
end $$;

-- ============================================================
-- 4. Asignar plantilla a un módulo: elige sola la columna de pesos según sea o no el módulo final
-- ============================================================
create or replace function public.eval_aplicar_version(p_modulo uuid, p_principal uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_m public.eval_modulos; v_usar uuid; v_n integer;
begin
  select * into v_m from public.eval_modulos where id = p_modulo;
  v_usar := case when v_m.es_final then coalesce((select id from public.eval_versiones where origen_id = p_principal and variante = 'final'), p_principal) else p_principal end;
  if exists (select 1 from public.eval_calificaciones k join public.eval_evaluaciones e on e.id = k.evaluacion_id where e.modulo_id = p_modulo) then
    raise exception 'El módulo ya tiene notas registradas; no se puede cambiar su plantilla';
  end if;
  delete from public.eval_evaluaciones where modulo_id = p_modulo;
  update public.eval_modulos set version_id = v_usar where id = p_modulo;
  insert into public.eval_evaluaciones (modulo_id, componente_id, nombre)
  select p_modulo, c.id, c.nombre from public.eval_componentes c where c.version_id = v_usar order by c.orden;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.asignar_plantilla(p_modulo uuid, p_version uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_v public.eval_versiones;
begin
  perform public.cal_exigir_admin();
  perform 1 from public.eval_modulos where id = p_modulo for update;
  if not found then raise exception 'El módulo no existe'; end if;
  select * into v_v from public.eval_versiones where id = p_version;
  if not found or v_v.variante <> 'normal' then raise exception 'La versión no existe'; end if;
  if v_v.estado <> 'vigente' then raise exception 'Solo se puede asignar una versión vigente (activa la versión primero)'; end if;
  return public.eval_aplicar_version(p_modulo, p_version);
end $$;

-- Marca o desmarca un módulo como «módulo final» (usa los pesos del módulo final de la plantilla). Solo si aún no tiene notas.
create or replace function public.definir_modulo_final(p_modulo uuid, p_final boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_m public.eval_modulos; v_principal uuid;
begin
  perform public.cal_exigir_admin();
  select * into v_m from public.eval_modulos where id = p_modulo for update;
  if not found then raise exception 'El módulo no existe'; end if;
  if v_m.es_final = coalesce(p_final, false) then return; end if;
  if exists (select 1 from public.eval_calificaciones k join public.eval_evaluaciones e on e.id = k.evaluacion_id where e.modulo_id = p_modulo) then
    raise exception 'El módulo ya tiene notas registradas; no se puede cambiar';
  end if;
  update public.eval_modulos set es_final = coalesce(p_final, false) where id = p_modulo;
  if v_m.version_id is not null then
    select coalesce(origen_id, id) into v_principal from public.eval_versiones where id = v_m.version_id;
    perform public.eval_aplicar_version(p_modulo, v_principal);
  end if;
end $$;

-- ============================================================
-- 5. Módulos por ciclo: usa el Grade Chart único; el último módulo del último ciclo es el módulo final
-- ============================================================
create or replace function public.eval_crear_modulos(p_salon uuid, p_estricto boolean) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_s public.salones; v_principal uuid; v_final uuid; v_ciclo integer; v_q integer; v_mitad integer; v_ini integer := 1;
  v_k integer; v_n integer; v_pos integer; v_desde integer; v_hasta integer; v_id uuid; v_ult integer; v_creados integer := 0;
  v_es_final boolean; v_ver uuid;
begin
  select * into v_s from public.salones where id = p_salon for update;
  if not found then raise exception 'El salón no existe'; end if;
  if v_s.plan_id is null or v_s.ciclo_desde is null then
    if p_estricto then raise exception 'El grupo no tiene plan académico ni ciclo: crea los módulos a mano'; end if;
    return 0;
  end if;
  if v_s.ciclo_hasta - v_s.ciclo_desde + 1 > 2 then
    if p_estricto then raise exception 'Un grupo abarca como máximo 2 ciclos; configura los módulos a mano'; end if;
    return 0;
  end if;
  if exists (select 1 from public.eval_modulos where salon_id = p_salon) then
    if p_estricto then raise exception 'El grupo ya tiene módulos'; end if;
    return 0;
  end if;
  select v.id into v_principal from public.eval_versiones v join public.eval_plantillas p on p.id = v.plantilla_id
   where p.nombre = 'Grade Chart Universa' and v.estado = 'vigente' and v.variante = 'normal';
  if v_principal is null then
    if p_estricto then raise exception 'Falta la plantilla vigente «Grade Chart Universa»'; end if;
    return 0;
  end if;
  select id into v_final from public.eval_versiones where origen_id = v_principal and variante = 'final';
  select max(ciclo) into v_ult from public.plan_ciclos where plan_id = v_s.plan_id;
  for v_ciclo in v_s.ciclo_desde..v_s.ciclo_hasta loop
    select sesiones into v_q from public.plan_ciclos where plan_id = v_s.plan_id and ciclo = v_ciclo;
    select count(*) into v_pos from public.plan_ciclos where plan_id = v_s.plan_id and ciclo <= v_ciclo;
    v_mitad := case when v_q >= 2 then ceil(v_q / 2.0)::integer end;
    for v_k in 1..2 loop
      v_n := (v_pos - 1) * 2 + v_k;
      if v_mitad is null then v_desde := null; v_hasta := null;
      elsif v_k = 1 then v_desde := v_ini; v_hasta := v_ini + v_mitad - 1;
      else v_desde := v_ini + v_mitad; v_hasta := v_ini + v_q - 1; end if;
      v_es_final := (v_ciclo = v_ult and v_k = 2);
      v_ver := case when v_es_final and v_final is not null then v_final else v_principal end;
      insert into public.eval_modulos (salon_id, nombre, orden, ciclo, sesion_desde, sesion_hasta, version_id, es_final)
      values (p_salon, 'Módulo ' || v_n, v_n, v_ciclo, v_desde, v_hasta, v_ver, v_es_final) returning id into v_id;
      insert into public.eval_evaluaciones (modulo_id, componente_id, nombre)
      select v_id, c.id, c.nombre from public.eval_componentes c where c.version_id = v_ver order by c.orden;
      v_creados := v_creados + 1;
    end loop;
    v_ini := v_ini + coalesce(v_q, 0);
  end loop;
  return v_creados;
end $$;

-- ============================================================
-- 6. Estructura del salón: ahora indica qué módulo es el final
-- ============================================================
create or replace function public.eval_estructura_salon(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_c public.eval_consolidacion;
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_c from public.eval_consolidacion where salon_id = p_salon;
  return jsonb_build_object(
    'consolidacion', jsonb_build_object('metodo', coalesce(v_c.metodo, 'sin_definir'), 'confirmada', coalesce(v_c.confirmada, false)),
    'modulos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'nombre', m.nombre, 'orden', m.orden, 'ciclo', m.ciclo, 'aporte_nivel', m.aporte_nivel, 'version_id', m.version_id, 'es_final', m.es_final,
        'plantilla', p.nombre, 'version', v.version, 'escala', v.escala_puntos,
        'sesion_desde', m.sesion_desde, 'sesion_hasta', m.sesion_hasta, 'clases', (select count(*) from public.eval_sesiones_modulo(m.id)),
        'evaluaciones', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', e.id, 'nombre', e.nombre, 'tipo', c.tipo, 'peso', c.peso, 'unidades', to_jsonb(e.unidades), 'con_rubrica', c.rubrica_id is not null,
            'borradores', (select count(*) from public.eval_calificaciones k where k.evaluacion_id = e.id and k.estado = 'borrador'),
            'publicadas', (select count(*) from public.eval_calificaciones k where k.evaluacion_id = e.id and k.estado = 'publicada'))
            order by c.orden)
          from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id where e.modulo_id = m.id), '[]'::jsonb))
        order by m.orden)
      from public.eval_modulos m
      left join public.eval_versiones v on v.id = m.version_id
      left join public.eval_plantillas p on p.id = v.plantilla_id
     where m.salon_id = p_salon), '[]'::jsonb),
    'estudiantes', (select count(*) from public.matriculas where salon_id = p_salon and estado = 'activa'));
end $$;

-- ============================================================
-- 7. Grade Chart Universa (único) y limpieza de las plantillas anteriores
-- ============================================================
do $$
declare v_wri uuid; v_pro uuid; v_p uuid; v_v uuid; v_mod record; v_dest uuid; v_final uuid; v_viejo_final boolean;
begin
  select id into v_wri from public.eval_rubricas where lower(nombre) = 'writing';
  select id into v_pro from public.eval_rubricas where lower(nombre) = 'project';

  select id into v_p from public.eval_plantillas where nombre = 'Grade Chart Universa';
  if v_p is null then
    insert into public.eval_plantillas (nombre, descripcion)
    values ('Grade Chart Universa', 'Cada módulo vale 100. Dos columnas de peso: módulos 1 a 3 y módulo final (el último del nivel). Formative = participación por clase.')
    returning id into v_p;
    insert into public.eval_versiones (plantilla_id, version, estado, escala_puntos, notas, activada_at)
    values (v_p, 1, 'vigente', 100, 'Grades Chart de Universa. Para cambiar pesos, crear una versión nueva.', now()) returning id into v_v;
    insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id, peso_final, nombre_final) values
      (v_v, 'Test', 'test', 28, 1, null, 32, 'Final Test'),
      (v_v, 'Writing', 'writing', 24, 2, v_wri, 24, null),
      (v_v, 'Project', 'project', 28, 3, v_pro, 32, 'Final Project'),
      (v_v, 'Formative Assessment', 'participacion', 12, 4, null, 8, null),
      (v_v, 'SPARK Homework', 'spark', 8, 5, null, 4, null);
    perform public.eval_generar_final(v_v);
  end if;

  -- Módulos que usaban las plantillas anteriores de Universa: pasan al Grade Chart único (mismas notas, mismo orden de componentes).
  select v.id into v_v from public.eval_versiones v where v.plantilla_id = v_p and v.estado = 'vigente' and v.variante = 'normal';
  select id into v_final from public.eval_versiones where origen_id = v_v and variante = 'final';
  for v_mod in
    select m.id, pl.nombre
      from public.eval_modulos m
      join public.eval_versiones vv on vv.id = m.version_id
      join public.eval_plantillas pl on pl.id = vv.plantilla_id
     where pl.nombre in ('Universa · Módulos 1 a 3', 'Universa · Módulo 4 final', 'Universa · Módulos 1 a 3 (25 puntos)', 'Universa · Módulo 4 final (25 puntos)')
  loop
    v_viejo_final := v_mod.nombre like 'Universa · Módulo 4 final%';
    v_dest := case when v_viejo_final and v_final is not null then v_final else v_v end;
    update public.eval_evaluaciones e set componente_id = nuevo.id
      from public.eval_componentes viejo, public.eval_componentes nuevo
     where e.modulo_id = v_mod.id and viejo.id = e.componente_id and nuevo.version_id = v_dest and nuevo.orden = viejo.orden;
    update public.eval_modulos set version_id = v_dest, es_final = v_viejo_final where id = v_mod.id;
  end loop;

  -- Se borran las plantillas anteriores (de prueba) que ya no usa ningún módulo.
  delete from public.eval_plantillas p
   where (p.nombre in ('Universa · Módulos 1 a 3', 'Universa · Módulo 4 final', 'Universa · Módulos 1 a 3 (25 puntos)', 'Universa · Módulo 4 final (25 puntos)')
          or p.nombre like 'Referencia ·%')
     and not exists (select 1 from public.eval_modulos m join public.eval_versiones vv on vv.id = m.version_id where vv.plantilla_id = p.id);
end $$;

-- ============================================================
-- 8. Permisos
-- ============================================================
revoke execute on function public.eval_generar_final(uuid), public.eval_aplicar_version(uuid, uuid), public.definir_modulo_final(uuid, boolean) from public, anon, authenticated;
grant execute on function public.definir_modulo_final(uuid, boolean) to authenticated;
