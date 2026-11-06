-- Evaluaciones: grupos por ciclo, módulos sobre 100 y plantilla automática según el número de módulo.
-- Repetible: se puede ejecutar más de una vez. Va después de 20261117100000_matriz_notas.sql.

-- ============================================================
-- 1. Plantillas Universa sobre 100 (versión 2). Los módulos que ya usan la versión 1 la conservan: sus notas no cambian.
-- ============================================================
update public.eval_plantillas set nombre = 'Universa · Módulos 1 a 3' where nombre = 'Universa · Módulos 1 a 3 (25 puntos)'
  and not exists (select 1 from public.eval_plantillas where nombre = 'Universa · Módulos 1 a 3');
update public.eval_plantillas set nombre = 'Universa · Módulo 4 final' where nombre = 'Universa · Módulo 4 final (25 puntos)'
  and not exists (select 1 from public.eval_plantillas where nombre = 'Universa · Módulo 4 final');

do $$
declare v_p record; v_v1 public.eval_versiones; v_v2 uuid;
begin
  for v_p in select id, nombre from public.eval_plantillas where nombre in ('Universa · Módulos 1 a 3', 'Universa · Módulo 4 final') loop
    select * into v_v1 from public.eval_versiones where plantilla_id = v_p.id and estado = 'vigente' and escala_puntos = 25;
    if not found then continue; end if;
    if exists (select 1 from public.eval_versiones where plantilla_id = v_p.id and version > v_v1.version) then continue; end if;
    update public.eval_versiones set estado = 'archivada' where id = v_v1.id;
    insert into public.eval_versiones (plantilla_id, version, estado, escala_puntos, notas)
    values (v_p.id, v_v1.version + 1, 'borrador', 100, 'Cada módulo sobre 100 (pesos de la versión anterior × 4). Formative = participación por clase.')
    returning id into v_v2;
    insert into public.eval_componentes (version_id, nombre, tipo, peso, orden, rubrica_id)
    select v_v2, c.nombre, c.tipo, c.peso * 4, c.orden, c.rubrica_id from public.eval_componentes c where c.version_id = v_v1.id order by c.orden;
    update public.eval_versiones set estado = 'vigente', activada_at = now() where id = v_v2;
  end loop;
end $$;

-- ============================================================
-- 2. Módulos por ciclo: 2 módulos por cada ciclo del grupo, con la plantilla que corresponde al número de módulo.
--    Ciclo 1 → Módulo 1 y 2 · Ciclo 2 → Módulo 3 y 4. El último módulo del último ciclo del plan usa «Módulo 4 final».
-- ============================================================
create or replace function public.eval_crear_modulos(p_salon uuid, p_estricto boolean) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_s public.salones; v_v13 uuid; v_v4 uuid; v_ciclo integer; v_q integer; v_mitad integer; v_ini integer := 1;
  v_k integer; v_n integer; v_pos integer; v_desde integer; v_hasta integer; v_id uuid; v_ult integer; v_creados integer := 0; v_ver uuid;
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
  select v.id into v_v13 from public.eval_versiones v join public.eval_plantillas p on p.id = v.plantilla_id
   where p.nombre = 'Universa · Módulos 1 a 3' and v.estado = 'vigente';
  select v.id into v_v4 from public.eval_versiones v join public.eval_plantillas p on p.id = v.plantilla_id
   where p.nombre = 'Universa · Módulo 4 final' and v.estado = 'vigente';
  if v_v13 is null or v_v4 is null then
    if p_estricto then raise exception 'Faltan las plantillas vigentes de Universa (Módulos 1 a 3 y Módulo 4 final)'; end if;
    return 0;
  end if;
  select max(ciclo) into v_ult from public.plan_ciclos where plan_id = v_s.plan_id;
  for v_ciclo in v_s.ciclo_desde..v_s.ciclo_hasta loop
    select sesiones into v_q from public.plan_ciclos where plan_id = v_s.plan_id and ciclo = v_ciclo;
    -- Posición del ciclo dentro del plan (la numeración de ciclos puede no empezar en 1).
    select count(*) into v_pos from public.plan_ciclos where plan_id = v_s.plan_id and ciclo <= v_ciclo;
    v_mitad := case when v_q >= 2 then ceil(v_q / 2.0)::integer end;
    for v_k in 1..2 loop
      v_n := (v_pos - 1) * 2 + v_k;
      if v_mitad is null then v_desde := null; v_hasta := null;
      elsif v_k = 1 then v_desde := v_ini; v_hasta := v_ini + v_mitad - 1;
      else v_desde := v_ini + v_mitad; v_hasta := v_ini + v_q - 1; end if;
      v_ver := case when v_ciclo = v_ult and v_k = 2 then v_v4 else v_v13 end;
      insert into public.eval_modulos (salon_id, nombre, orden, ciclo, sesion_desde, sesion_hasta, version_id)
      values (p_salon, 'Módulo ' || v_n, v_n, v_ciclo, v_desde, v_hasta, v_ver) returning id into v_id;
      insert into public.eval_evaluaciones (modulo_id, componente_id, nombre)
      select v_id, c.id, c.nombre from public.eval_componentes c where c.version_id = v_ver order by c.orden;
      v_creados := v_creados + 1;
    end loop;
    v_ini := v_ini + coalesce(v_q, 0);
  end loop;
  return v_creados;
end $$;

-- Acción explícita de administración (grupos que ya existían o que no tienen módulos).
create or replace function public.crear_estructura_estandar(p_salon uuid) returns integer
language plpgsql security definer set search_path = '' as $$
begin
  perform public.cal_exigir_admin();
  return public.eval_crear_modulos(p_salon, true);
end $$;

-- Al crear un grupo con plan y ciclo, sus módulos y plantillas se crean solos.
create or replace function public.eval_modulos_al_crear_salon() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.eval_crear_modulos(new.id, false);
  return new;
end $$;

drop trigger if exists salones_crear_modulos on public.salones;
create trigger salones_crear_modulos after insert on public.salones
  for each row execute function public.eval_modulos_al_crear_salon();

-- ============================================================
-- 3. Resultado por ciclo y acumulado sobre 100 (antes: suma de puntos, p. ej. «sobre 50»)
--    nota = puntos publicados / puntos evaluados × 100: nunca penaliza lo que aún no se evalúa.
-- ============================================================
create or replace function public.eval_resumen_alumno(p_salon uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_mods jsonb; v_ciclos jsonb; v_acum jsonb;
begin
  select coalesce(jsonb_agg(public.eval_modulo_efectivo(m.id, p_alumno) order by m.orden), '[]'::jsonb) into v_mods from public.eval_modulos m where m.salon_id = p_salon;
  select coalesce(jsonb_agg(jsonb_build_object('ciclo', q.ciclo,
           'puntos', case when q.ev > 0 then round(q.p / q.ev * 100, 2) else 0 end, 'escala', 100,
           'escala_evaluada', case when q.ev > 0 then 100 else 0 end, 'parcial', q.par, 'remedial', q.rem, 'modulos', q.n)
         order by q.ciclo nulls last), '[]'::jsonb)
    into v_ciclos
    from (select (e->>'ciclo')::smallint ciclo, sum((e->>'puntos')::numeric) p, sum((e->>'peso_evaluado')::numeric) ev,
                 bool_or(coalesce((e->>'parcial')::boolean, true) or coalesce((e->>'sin_plantilla')::boolean, false)) par,
                 bool_or(coalesce((e->>'remedial')::boolean, false)) rem, count(*) n
            from jsonb_array_elements(v_mods) e group by 1) q;
  select jsonb_build_object('puntos', case when coalesce(sum((e->>'peso_evaluado')::numeric), 0) > 0
                                            then round(sum((e->>'puntos')::numeric) / sum((e->>'peso_evaluado')::numeric) * 100, 2) else 0 end,
                            'escala', 100,
                            'escala_evaluada', case when coalesce(sum((e->>'peso_evaluado')::numeric), 0) > 0 then 100 else 0 end,
                            'parcial', coalesce(bool_or(coalesce((e->>'parcial')::boolean, true) or coalesce((e->>'sin_plantilla')::boolean, false)), true),
                            'remedial', coalesce(bool_or(coalesce((e->>'remedial')::boolean, false)), false))
    into v_acum from jsonb_array_elements(v_mods) e;
  return jsonb_build_object('modulos', v_mods, 'ciclos', v_ciclos, 'acumulado', v_acum);
end $$;

-- ============================================================
-- 4. Informe de notas de un estudiante (solo lo publicado): lo ve el propio estudiante o quien gestiona el salón
-- ============================================================
create or replace function public.eval_informe(p_salon uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_c public.eval_consolidacion; v_nivel jsonb; v_res jsonb; v_s record; v_a record;
begin
  select s.nombre, s.codigo, d.nombre docente into v_s from public.salones s left join public.docentes d on d.id = s.docente_id where s.id = p_salon;
  select nombre into v_a from public.alumnos where id = p_alumno;
  select * into v_c from public.eval_consolidacion where salon_id = p_salon;
  -- La nota del nivel solo se muestra cuando Coordinación confirmó la consolidación.
  v_nivel := case when coalesce(v_c.confirmada, false) then public.eval_calc_nivel(p_salon, p_alumno) else jsonb_build_object('definido', false, 'confirmada', false) end;
  v_res := public.eval_resumen_alumno(p_salon, p_alumno);
  return jsonb_build_object(
    'estudiante', v_a.nombre, 'salon', v_s.nombre, 'codigo', v_s.codigo, 'docente', v_s.docente, 'generado', public.hoy_lima(),
    'nivel', v_nivel, 'ciclos', v_res->'ciclos', 'acumulado', v_res->'acumulado',
    'modulos', coalesce((
      select jsonb_agg(public.eval_modulo_efectivo(m.id, p_alumno) || jsonb_build_object(
        'evaluaciones', coalesce((
          select jsonb_agg(jsonb_build_object(
            'nombre', e.nombre, 'peso', c.peso, 'tipo', c.tipo,
            'notas', coalesce((select jsonb_agg(jsonb_build_object('unidad', k.unidad, 'puntaje', k.puntaje, 'comentario', k.comentario,
                                                                  'corregida', exists (select 1 from public.eval_historial h where h.calificacion_id = k.id),
                                                                  'fecha', k.publicada_at,
                                                                  'participacion', case when c.tipo = 'participacion' then k.detalle end) order by k.unidad)
                                 from public.eval_calificaciones k where k.evaluacion_id = e.id and k.alumno_id = p_alumno and k.estado = 'publicada'), '[]'::jsonb))
            order by c.orden)
          from public.eval_evaluaciones e join public.eval_componentes c on c.id = e.componente_id where e.modulo_id = m.id), '[]'::jsonb))
        order by m.orden)
      from public.eval_modulos m where m.salon_id = p_salon), '[]'::jsonb));
end $$;

create or replace function public.portal_mis_calificaciones(p_salon uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_alumno uuid;
begin
  select cr.alumno_id into v_alumno from public.cuenta_roles cr where cr.user_id = (select auth.uid()) and cr.rol = 'estudiante';
  if v_alumno is null or not public.es_estudiante_de(p_salon) then raise exception 'No tienes acceso a este curso' using errcode = '42501'; end if;
  return public.eval_informe(p_salon, v_alumno);
end $$;

-- Docente asignado o administración: el mismo informe de cualquier estudiante matriculado del salón (solo lo publicado).
create or replace function public.informe_alumno(p_salon uuid, p_alumno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_gestionar_curso(p_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  if not exists (select 1 from public.matriculas where salon_id = p_salon and alumno_id = p_alumno and estado = 'activa') then raise exception 'El estudiante no está matriculado en este salón'; end if;
  return public.eval_informe(p_salon, p_alumno);
end $$;

-- ============================================================
-- 5. Permisos: las funciones internas no se exponen; la de administración, solo a usuarios autenticados.
-- ============================================================
revoke execute on function public.eval_crear_modulos(uuid, boolean), public.eval_modulos_al_crear_salon() from public, anon, authenticated;
revoke execute on function public.crear_estructura_estandar(uuid), public.eval_resumen_alumno(uuid, uuid), public.eval_informe(uuid, uuid),
  public.portal_mis_calificaciones(uuid), public.informe_alumno(uuid, uuid) from public, anon, authenticated;
grant execute on function public.crear_estructura_estandar(uuid), public.portal_mis_calificaciones(uuid), public.informe_alumno(uuid, uuid) to authenticated;
