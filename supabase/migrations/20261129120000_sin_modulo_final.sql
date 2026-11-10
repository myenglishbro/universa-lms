-- UNIVERSA · Todos los módulos pesan igual: ya no existe el «módulo final» con pesos distintos.
--  * Los módulos nuevos nunca nacen como finales.
--  * Los módulos hoy marcados como finales y SIN notas vuelven a los pesos normales. Los que ya tienen notas no se tocan (cambiarles los pesos
--    alteraría notas existentes): se listan con un aviso para que administración decida.
-- Repetible. Requiere 20261119100000_grade_chart_unico.sql.

begin;

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
      v_es_final := false; -- todos los módulos pesan igual
      v_ver := v_principal;
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

do $$
declare v_m record; v_principal uuid; v_pendientes text := '';
begin
  for v_m in select m.id, m.nombre, m.version_id from public.eval_modulos m where m.es_final loop
    if exists (select 1 from public.eval_calificaciones k join public.eval_evaluaciones e on e.id = k.evaluacion_id where e.modulo_id = v_m.id) then
      v_pendientes := v_pendientes || v_m.nombre || ', ';
      continue;
    end if;
    update public.eval_modulos set es_final = false where id = v_m.id;
    if v_m.version_id is not null then
      select coalesce(origen_id, id) into v_principal from public.eval_versiones where id = v_m.version_id;
      perform public.eval_aplicar_version(v_m.id, v_principal);
    end if;
  end loop;
  if v_pendientes <> '' then raise notice 'Siguen como final (ya tienen notas): %', v_pendientes; end if;
end $$;

commit;
