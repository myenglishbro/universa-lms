-- UNIVERSA · Los cursos (salones) respetan la estructura curricular.
--
-- Estructura (la misma para todos los niveles; ver src/lib/curriculo.js):
--   * Cada nivel tiene 2 ciclos (el Funcional solo el ciclo 0) y cada ciclo 2 módulos. El ciclo 0 contiene los 4 módulos.
--   * 4 módulos por nivel y 3 unidades por módulo: Módulo 1 = Unit 1-3, Módulo 2 = Unit 4-6, Módulo 3 = Unit 7-9, Módulo 4 = Unit 10-12.
--   * Primer ciclo del nivel (impar) = módulos 1 y 2; segundo ciclo (par) = módulos 3 y 4; ciclo 0 = módulos 1 a 4.
--   * Un salón no puede cruzar de nivel: su plan pertenece a un nivel y sus ciclos salen de ese plan (ya lo garantizan las FK de salones).
--
-- Qué hace esta migración:
--   1. Los módulos que se crean solos con el salón siguen esa numeración. Antes el ciclo 0 (Funcional) recibía solo 2 módulos: ahora recibe 4.
--   2. Un módulo nuevo (a mano) toma el siguiente número que le corresponde a su ciclo, y un salón no puede repetir un número de módulo.
--   3. Un trigger rechaza un módulo cuyo número no corresponde a su ciclo (por ejemplo el módulo 1 en un salón del ciclo 2).
--   4. Las unidades del Formative de un módulo solo pueden ser las 3 que le tocan.
--   5. Al final se avisa (NOTICE) de lo que ya existe y no cumple. No se modifica ni se borra ningún dato existente.
-- Los módulos que ya existen no se tocan: las reglas se aplican a lo que se cree o edite desde ahora.
-- Repetible (idempotente). Aplicar con `supabase db query --remote --yes --file` (nunca db push).

begin;

-- ============================================================
-- 1. Números de módulo permitidos para un ciclo
-- ============================================================
create or replace function public.curriculo_modulos_permitidos(p_ciclo smallint) returns integer[]
language sql immutable set search_path = '' as $$
  select case
    when p_ciclo is null or p_ciclo = 0 then array[1, 2, 3, 4]
    when p_ciclo % 2 = 1 then array[1, 2]
    else array[3, 4]
  end
$$;

-- ============================================================
-- 2. Módulos creados con el salón: numeración por nivel y 4 módulos en el ciclo 0
-- ============================================================
create or replace function public.eval_crear_modulos(p_salon uuid, p_estricto boolean) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_s public.salones; v_principal uuid; v_ciclo integer; v_q integer; v_partes integer; v_tam integer; v_ini integer := 1;
  v_k integer; v_n integer; v_desde integer; v_hasta integer; v_id uuid; v_creados integer := 0;
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
  for v_ciclo in v_s.ciclo_desde..v_s.ciclo_hasta loop
    select sesiones into v_q from public.plan_ciclos where plan_id = v_s.plan_id and ciclo = v_ciclo;
    -- Ciclo 0 (Funcional): 4 módulos. Resto: 2 por ciclo.
    v_partes := case when v_ciclo = 0 then 4 else 2 end;
    v_tam := case when v_q >= v_partes then ceil(v_q / v_partes::numeric)::integer end;
    for v_k in 1..v_partes loop
      -- Número de módulo dentro del nivel: ciclo impar = 1 y 2, ciclo par = 3 y 4, ciclo 0 = 1 a 4.
      v_n := case when v_ciclo = 0 then v_k else ((v_ciclo - 1) % 2) * 2 + v_k end;
      if v_tam is null then v_desde := null; v_hasta := null;
      else v_desde := v_ini + (v_k - 1) * v_tam; v_hasta := least(v_ini + v_k * v_tam - 1, v_ini + v_q - 1); end if;
      insert into public.eval_modulos (salon_id, nombre, orden, ciclo, sesion_desde, sesion_hasta, version_id, es_final)
      values (p_salon, 'Módulo ' || v_n, v_n, v_ciclo, v_desde, v_hasta, v_principal, false) returning id into v_id;
      insert into public.eval_evaluaciones (modulo_id, componente_id, nombre)
      select v_id, c.id, c.nombre from public.eval_componentes c where c.version_id = v_principal order by c.orden;
      v_creados := v_creados + 1;
    end loop;
    v_ini := v_ini + coalesce(v_q, 0);
  end loop;
  return v_creados;
end $$;

-- ============================================================
-- 3. Módulos a mano: el número lo da el ciclo, no se repite y no se sale de la estructura
-- ============================================================
create or replace function public.guardar_modulo(p_id uuid, p_salon uuid, p_nombre text, p_ciclo smallint default null, p_aporte numeric default 1) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_nombre text := btrim(coalesce(p_nombre, '')); v_s public.salones; v_id uuid; v_orden integer;
begin
  perform public.cal_exigir_admin();
  select * into v_s from public.salones where id = p_salon;
  if not found then raise exception 'El salón no existe'; end if;
  if v_nombre = '' then raise exception 'El nombre del módulo es obligatorio'; end if;
  if p_aporte is null or p_aporte <= 0 then raise exception 'El aporte del módulo debe ser mayor que 0'; end if;
  if p_ciclo is not null and (v_s.plan_id is null or p_ciclo < v_s.ciclo_desde or p_ciclo > v_s.ciclo_hasta) then
    raise exception 'El ciclo % no pertenece al plan de este salón', p_ciclo;
  end if;
  if exists (select 1 from public.eval_modulos where salon_id = p_salon and lower(btrim(nombre)) = lower(v_nombre) and id is distinct from p_id) then
    raise exception 'Ya existe un módulo con ese nombre en este salón';
  end if;
  if p_id is null then
    -- El primer número libre de los que le tocan a ese ciclo (1-2 en el primer ciclo del nivel, 3-4 en el segundo, 1-4 en el ciclo 0).
    select min(n) into v_orden from unnest(public.curriculo_modulos_permitidos(p_ciclo)) n
     where not exists (select 1 from public.eval_modulos m where m.salon_id = p_salon and m.orden = n);
    if v_orden is null then
      raise exception 'Este salón ya tiene todos los módulos que le corresponden (los módulos van del 1 al 4 por nivel)';
    end if;
    insert into public.eval_modulos (salon_id, nombre, orden, ciclo, aporte_nivel)
    values (p_salon, v_nombre, v_orden, p_ciclo, p_aporte) returning id into v_id;
  else
    update public.eval_modulos set nombre = v_nombre, ciclo = p_ciclo, aporte_nivel = p_aporte where id = p_id and salon_id = p_salon returning id into v_id;
    if v_id is null then raise exception 'El módulo no existe en este salón'; end if;
  end if;
  return v_id;
end $$;

-- ============================================================
-- 4. Un módulo solo puede tener el número que le corresponde a su ciclo, y no repetirse en el salón
-- ============================================================
create or replace function public.eval_modulo_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not (new.orden = any (public.curriculo_modulos_permitidos(new.ciclo))) then
    raise exception 'El módulo % no corresponde al ciclo %: ciclo 0 = módulos 1 a 4, ciclos impares = módulos 1 y 2, ciclos pares = módulos 3 y 4', new.orden, coalesce(new.ciclo::text, '(sin ciclo)');
  end if;
  if exists (select 1 from public.eval_modulos m where m.salon_id = new.salon_id and m.orden = new.orden and m.id is distinct from new.id) then
    raise exception 'Este salón ya tiene el módulo %', new.orden;
  end if;
  return new;
end $$;

drop trigger if exists eval_modulos_validar on public.eval_modulos;
create trigger eval_modulos_validar before insert or update of orden, ciclo, salon_id on public.eval_modulos
  for each row execute function public.eval_modulo_validar();

-- ============================================================
-- 5. Unidades del Formative: solo las 3 de su módulo (Módulo 2 = Unit 4, 5 y 6)
-- ============================================================
create or replace function public.configurar_unidades(p_evaluacion uuid, p_unidades text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_salon uuid := public.eval_salon_de(p_evaluacion); v_u text[]; v_x text; v_orden integer; v_tipo text;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes permisos para esta evaluación' using errcode = '42501'; end if;
  select coalesce(array_agg(u order by n), '{}') into v_u
    from (select btrim(x) u, min(n) n from unnest(coalesce(p_unidades, '{}')) with ordinality t(x, n) where btrim(x) <> '' group by btrim(x)) q;
  if cardinality(v_u) > 12 then raise exception 'Una evaluación admite hasta 12 unidades'; end if;
  foreach v_x in array v_u loop
    if length(v_x) > 60 then raise exception 'El nombre de una unidad es demasiado largo'; end if;
  end loop;
  select m.orden, c.tipo into v_orden, v_tipo
    from public.eval_evaluaciones e join public.eval_modulos m on m.id = e.modulo_id join public.eval_componentes c on c.id = e.componente_id
   where e.id = p_evaluacion;
  if v_tipo = 'formative' and v_orden between 1 and 4 then
    foreach v_x in array v_u loop
      if v_x !~ '^Unit \d+$' or substring(v_x from '\d+$')::integer not between (v_orden - 1) * 3 + 1 and v_orden * 3 then
        raise exception 'El módulo % solo admite las unidades Unit % a Unit % (3 unidades por módulo)', v_orden, (v_orden - 1) * 3 + 1, v_orden * 3;
      end if;
    end loop;
  end if;
  if exists (select 1 from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion
              and not (k.unidad = any (case when cardinality(v_u) = 0 then array[''] else v_u end))) then
    raise exception 'Hay notas registradas en una unidad que quieres quitar';
  end if;
  update public.eval_evaluaciones set unidades = v_u where id = p_evaluacion;
end $$;

-- ============================================================
-- 6. Permisos
-- ============================================================
revoke execute on function public.curriculo_modulos_permitidos(smallint), public.eval_modulo_validar(), public.eval_crear_modulos(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.guardar_modulo(uuid, uuid, text, smallint, numeric), public.configurar_unidades(uuid, text[]) from public, anon;
grant execute on function public.guardar_modulo(uuid, uuid, text, smallint, numeric), public.configurar_unidades(uuid, text[]) to authenticated;

-- ============================================================
-- 7. Aviso de lo que ya existe y no cumple (no se modifica nada)
-- ============================================================
do $$
declare r record; v_n integer := 0;
begin
  for r in
    select s.codigo, m.nombre, m.orden, m.ciclo
      from public.eval_modulos m join public.salones s on s.id = m.salon_id
     where m.ciclo is not null and not (m.orden = any (public.curriculo_modulos_permitidos(m.ciclo)))
     order by s.codigo, m.orden
  loop
    v_n := v_n + 1;
    raise notice 'Módulo con número que no corresponde a su ciclo: salón %, «%» (módulo %, ciclo %)', r.codigo, r.nombre, r.orden, r.ciclo;
  end loop;
  for r in
    select s.codigo, count(m.id) as modulos
      from public.salones s left join public.eval_modulos m on m.salon_id = s.id
     where s.ciclo_desde = 0
     group by s.id, s.codigo having count(m.id) < 4
  loop
    v_n := v_n + 1;
    raise notice 'Salón del nivel Funcional (ciclo 0) con % módulos: debe tener 4. Salón %', r.modulos, r.codigo;
  end loop;
  if v_n = 0 then raise notice 'Todos los salones cumplen la estructura curricular'; end if;
end $$;

commit;
