-- UNIVERSA · Pruebas del catálogo académico (Fase 1).
-- Ejecutar SOLO en el proyecto de pruebas (marcado con el paso 0) DESPUÉS de aplicar la migración.
-- Requiere los usuarios admin-prueba@universa.test y comercial-prueba@universa.test con su perfil (paso 2).
-- Todo ocurre dentro de una transacción que termina en ROLLBACK: no deja nada. Cualquier fallo lanza una excepción.
-- Si todo pasa, la última consulta devuelve 'PRUEBAS OK'. Si algo falla, ejecuta  rollback;  y revisa el mensaje.
begin;

do $$
begin
  if to_regclass('public._entorno_prueba') is null then
    raise exception 'ABORTADO: este proyecto no está marcado como entorno de pruebas. Estas pruebas no se ejecutan en producción.';
  end if;
end $$;

create function pg_temp.debe_fallar(p_sql text, p_estado text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_estado then
      return;
    end if;
    raise exception 'Falló con % (%), se esperaba %: %', sqlstate, sqlerrm, p_estado, p_sql;
  end;
  raise exception 'Debía fallar con % y se ejecutó: %', p_estado, p_sql;
end $$;

create function pg_temp.uid_de(p_email text) returns uuid
language sql as $$ select id from auth.users where email = p_email $$;

-- ------------------------------------------------------------
-- A. Conteos y reglas de integridad (catalogo_verificar)
-- ------------------------------------------------------------
do $$
declare
  v_n integer;
  v_fallas text;
begin
  select string_agg(prueba || ': ' || detalle, E'\n') into v_fallas from public.catalogo_verificar() where not ok;
  if v_fallas is not null then raise exception 'catalogo_verificar: %', v_fallas; end if;
  select count(*) into v_n from public.catalogo_verificar();
  if v_n <> 9 then raise exception 'catalogo_verificar debía tener 9 pruebas y tiene %', v_n; end if;

  if (select count(*) from public.niveles) <> 7 then raise exception 'niveles <> 7'; end if;
  if (select count(*) from public.ciclos) <> 13 then raise exception 'ciclos <> 13'; end if;
  if (select count(*) from public.modalidades) <> 2 then raise exception 'modalidades <> 2'; end if;
  if (select count(*) from public.horario_patrones) <> 6 then raise exception 'patrones <> 6'; end if;
  if (select count(*) from public.planes_academicos) <> 58 then raise exception 'planes <> 58'; end if;
  if (select count(*) from public.plan_ciclos) <> 112 then raise exception 'plan_ciclos <> 112'; end if;
  if (select count(*) from public.reglas_pendientes where estado = 'abierta') <> 11 then raise exception 'reglas abiertas <> 11'; end if;
end $$;

-- Planes inferidos: ninguno aprobado ni confirmado; todos con su fuente; los de Acelerado enlazados a P02.
do $$
begin
  if exists (select 1 from public.planes_academicos where aprobado_en is not null or aprobado_por is not null or estado_dato <> 'inferido') then
    raise exception 'Hay planes aprobados o confirmados en el catálogo inicial';
  end if;
  if exists (select 1 from public.planes_academicos where fuente is null or btrim(fuente) = '') then
    raise exception 'Hay planes sin fuente';
  end if;
  if exists (
    select 1 from public.planes_academicos p join public.modalidades m on m.id = p.modalidad_id
    where m.codigo = 'acelerado'
      and not exists (select 1 from public.plan_pendientes pp join public.reglas_pendientes r on r.id = pp.regla_id
                      where pp.plan_id = p.id and r.codigo = 'P02')) then
    raise exception 'Hay planes Acelerados sin enlace a P02';
  end if;
  if (select count(*) from public.plan_pendientes pp join public.reglas_pendientes r on r.id = pp.regla_id where r.codigo = 'P03') <> 6 then
    raise exception 'P03 debe afectar exactamente a los 6 planes Estándar 90 min alumno nuevo';
  end if;
  if exists (select 1 from public.plan_pendientes pp join public.reglas_pendientes r on r.id = pp.regla_id
             where r.codigo in ('P05', 'P08', 'P09', 'P10')) then
    raise exception 'P05, P08, P09 y P10 no deben estar enlazadas a planes';
  end if;
end $$;

-- ------------------------------------------------------------
-- B. Expansión de los 58 planes a las 103 combinaciones (consistencia interna)
--    NO sustituye la comparación con el CSV original (ver informe).
-- ------------------------------------------------------------
do $$
begin
  if (select count(*) from public.catalogo_combinaciones) <> 103 then raise exception 'combinaciones <> 103'; end if;
  if (select count(*) from public.catalogo_combinaciones where nivel_codigo = 'funcional') <> 7 then raise exception 'Funcional <> 7'; end if;
  if (select count(*) from public.catalogo_combinaciones where nivel_codigo <> 'funcional') <> 96 then raise exception 'otros niveles <> 96'; end if;
  if (select count(*) from public.catalogo_combinaciones where modalidad_codigo = 'estandar') <> 61 then raise exception 'Estándar <> 61'; end if;
  if (select count(*) from public.catalogo_combinaciones where modalidad_codigo = 'acelerado') <> 42 then raise exception 'Acelerado <> 42'; end if;
  if (select count(*) from (
        select distinct nivel_codigo, modalidad_codigo, patron_codigo, coalesce(tipo_alumno, '-') from public.catalogo_combinaciones) d) <> 103 then
    raise exception 'Hay combinaciones repetidas en la expansión';
  end if;
  if (select count(distinct patron_codigo) from public.catalogo_combinaciones) <> 6 then raise exception 'Se esperaban los 6 horarios'; end if;
  -- Cada combinación conserva las cuotas por ciclo y suman el total
  if exists (select 1 from public.catalogo_combinaciones c
             where coalesce(c.sesiones_ciclo_impar, 0) + coalesce(c.sesiones_ciclo_par, 0) <> c.total_sesiones
                or coalesce(c.horas_ciclo_impar, 0) + coalesce(c.horas_ciclo_par, 0) <> c.horas_totales) then
    raise exception 'Alguna combinación no conserva la suma por ciclo';
  end if;
  -- Valores de referencia del documento (§3): una muestra por modalidad/duración
  if not exists (select 1 from public.catalogo_combinaciones where nivel_codigo = 'basico' and modalidad_codigo = 'estandar'
                 and patron_codigo = 'LMV-90' and tipo_alumno = 'nuevo'
                 and total_sesiones = 81 and horas_totales = 121.5 and sesiones_ciclo_impar = 40 and sesiones_ciclo_par = 41) then
    raise exception 'Básico Estándar LMV-90 nuevo no coincide con el documento';
  end if;
  if not exists (select 1 from public.catalogo_combinaciones where nivel_codigo = 'master' and modalidad_codigo = 'acelerado'
                 and patron_codigo = 'MiJ-180' and tipo_alumno = 'continuo'
                 and total_sesiones = 28 and horas_totales = 82.5 and horas_ciclo_impar = 39.0 and horas_ciclo_par = 43.5) then
    raise exception 'Máster Acelerado MiJ-180 no coincide con el documento';
  end if;
  if not exists (select 1 from public.catalogo_combinaciones where nivel_codigo = 'funcional' and patron_codigo = 'LV-60'
                 and total_sesiones = 122 and horas_totales = 122 and sesiones_ciclo_par is null) then
    raise exception 'Funcional LV-60 no coincide con el documento';
  end if;
end $$;

-- ------------------------------------------------------------
-- C. Pruebas negativas: estas operaciones DEBEN fallar
-- ------------------------------------------------------------
-- Usuarios reales de prueba (paso 2): deben existir con el rol esperado
do $$
begin
  if not exists (select 1 from public.perfiles where user_id = pg_temp.uid_de('admin-prueba@universa.test') and rol = 'admin')
     or not exists (select 1 from public.perfiles where user_id = pg_temp.uid_de('comercial-prueba@universa.test') and rol = 'comercial') then
    raise exception 'Faltan los usuarios de prueba o su perfil: ejecuta el paso 2.';
  end if;
end $$;

-- (23505 unique, 23514 check, 23503 foreign key, P0001 trigger, 42501 permiso)
select pg_temp.debe_fallar($q$
  insert into public.planes_academicos (nivel_id, modalidad_id, minutos_clase, sesiones_semana, tipo_alumno, total_sesiones, horas_totales, semanas, fuente)
  select nivel_id, modalidad_id, minutos_clase, sesiones_semana, tipo_alumno, total_sesiones, horas_totales, semanas, 'prueba'
  from public.planes_academicos
  where tipo_alumno = 'unico' and minutos_clase = 60 and nivel_id = (select id from public.niveles where codigo = 'basico')
    and modalidad_id = (select id from public.modalidades where codigo = 'estandar')$q$, 'P0001');   -- duplicado vigente

select pg_temp.debe_fallar($q$
  insert into public.planes_academicos (nivel_id, modalidad_id, minutos_clase, sesiones_semana, tipo_alumno, total_sesiones, horas_totales, semanas, fuente)
  select nivel_id, modalidad_id, minutos_clase, sesiones_semana, 'ambos', 81, 121.5, 27, 'prueba'
  from public.planes_academicos
  where tipo_alumno = 'nuevo' and nivel_id = (select id from public.niveles where codigo = 'basico')$q$, 'P0001');   -- solapamiento 'ambos' vs 'nuevo'/'continuo'

select pg_temp.debe_fallar($q$
  insert into public.planes_academicos (nivel_id, modalidad_id, minutos_clase, sesiones_semana, tipo_alumno, total_sesiones, horas_totales, semanas, vigente, vigente_hasta, fuente)
  select nivel_id, modalidad_id, minutos_clase, sesiones_semana, tipo_alumno, total_sesiones, horas_totales, semanas, false, current_date, 'prueba'
  from public.planes_academicos
  where tipo_alumno = 'unico' and minutos_clase = 60 and nivel_id = (select id from public.niveles where codigo = 'basico')
    and modalidad_id = (select id from public.modalidades where codigo = 'estandar')$q$, '23505');   -- misma versión repetida

select pg_temp.debe_fallar($q$
  insert into public.planes_academicos (nivel_id, modalidad_id, minutos_clase, sesiones_semana, tipo_alumno, total_sesiones, horas_totales, semanas, version, reemplaza_a, vigente, vigente_hasta, fuente)
  select nivel_id, modalidad_id, minutos_clase, sesiones_semana, tipo_alumno, total_sesiones, 100.0, semanas, 2, id, false, current_date, 'prueba'
  from public.planes_academicos
  where tipo_alumno = 'unico' and minutos_clase = 60 and nivel_id = (select id from public.niveles where codigo = 'basico')
    and modalidad_id = (select id from public.modalidades where codigo = 'estandar')$q$, '23514');   -- horas incorrectas

select pg_temp.debe_fallar($q$
  insert into public.planes_academicos (nivel_id, modalidad_id, minutos_clase, sesiones_semana, total_sesiones, horas_totales, semanas, fuente)
  values ((select id from public.niveles where codigo = 'funcional'), (select id from public.modalidades where codigo = 'acelerado'),
          60, 5, 86, 86.0, 18, 'prueba')$q$, 'P0001');   -- Funcional no existe en Acelerado

select pg_temp.debe_fallar($q$
  insert into public.planes_academicos (nivel_id, modalidad_id, minutos_clase, sesiones_semana, total_sesiones, horas_totales, semanas, fuente)
  values ((select id from public.niveles where codigo = 'basico'), (select id from public.modalidades where codigo = 'estandar'),
          75, 4, 60, 75.0, 20, 'prueba')$q$, 'P0001');   -- horario inexistente

select pg_temp.debe_fallar($q$
  insert into public.planes_academicos (nivel_id, modalidad_id, minutos_clase, sesiones_semana, total_sesiones, horas_totales, semanas, version, vigente, vigente_hasta, fuente)
  values ((select id from public.niveles where codigo = 'funcional'), (select id from public.modalidades where codigo = 'estandar'),
          60, 5, 122, 122.0, 25, 2, false, current_date, 'prueba')$q$, '23514');   -- versión 2 sin reemplaza_a

select pg_temp.debe_fallar($q$
  insert into public.planes_academicos (nivel_id, modalidad_id, minutos_clase, sesiones_semana, total_sesiones, horas_totales, semanas, vigente, fuente)
  values ((select id from public.niveles where codigo = 'funcional'), (select id from public.modalidades where codigo = 'estandar'),
          60, 5, 122, 122.0, 25, false, 'prueba')$q$, '23514');   -- no vigente sin vigente_hasta

select pg_temp.debe_fallar(format($q$
  update public.planes_academicos set aprobado_en = now(), aprobado_por = %L
  where id = (select id from public.planes_academicos limit 1)$q$, pg_temp.uid_de('admin-prueba@universa.test')), '23514');   -- un plan inferido no puede figurar aprobado

select pg_temp.debe_fallar($q$
  update public.planes_academicos set total_sesiones = total_sesiones + 1, horas_totales = horas_totales + 1
  where id = (select id from public.planes_academicos limit 1)$q$, 'P0001');   -- datos de negocio inmutables

select pg_temp.debe_fallar($q$
  update public.plan_ciclos set sesiones = sesiones + 1 where (plan_id, ciclo) = (select plan_id, ciclo from public.plan_ciclos limit 1)$q$, 'P0001');

select pg_temp.debe_fallar($q$
  insert into public.plan_ciclos (plan_id, nivel_id, ciclo, sesiones, horas)
  select p.id, p.nivel_id, 12, 10, 10.0 from public.planes_academicos p
  where p.nivel_id = (select id from public.niveles where codigo = 'basico') limit 1$q$, '23503');   -- ciclo de otro nivel

select pg_temp.debe_fallar($q$
  insert into public.plan_ciclos (plan_id, nivel_id, ciclo, sesiones, horas)
  select p.id, (select id from public.niveles where codigo = 'master'), 12, 10, 10.0 from public.planes_academicos p
  where p.nivel_id = (select id from public.niveles where codigo = 'basico') limit 1$q$, '23503');   -- nivel que no es el del plan

select pg_temp.debe_fallar($q$
  insert into public.ciclos (numero, nivel_id, posicion, fuente) values (13, (select id from public.niveles where codigo = 'master'), 'impar', 'prueba')$q$, '23514');
select pg_temp.debe_fallar($q$
  insert into public.ciclos (numero, nivel_id, posicion, fuente) values (2, (select id from public.niveles where codigo = 'master'), 'impar', 'prueba')$q$, '23514');   -- paridad incorrecta
select pg_temp.debe_fallar($q$
  insert into public.horario_patrones (codigo, nombre, dias, minutos_clase, fuente) values ('X', 'x', '{1,9}', 60, 'prueba')$q$, '23514');
select pg_temp.debe_fallar($q$
  insert into public.plan_pendientes (plan_id, regla_id) values (gen_random_uuid(), (select id from public.reglas_pendientes limit 1))$q$, '23503');
select pg_temp.debe_fallar($q$
  insert into public.reglas_pendientes (codigo, tema, descripcion, impacto, estado, fuente) values ('PX', 't', 'd', 'horas', 'resuelta', 'prueba')$q$, '23514');

-- Una corrección legítima sí es posible: metadatos editables, datos de negocio no.
update public.planes_academicos set notas = 'nota de prueba' where id = (select id from public.planes_academicos limit 1);

-- ------------------------------------------------------------
-- D. El detector encuentra daños reales (se simulan con los triggers desactivados y se deshacen)
-- ------------------------------------------------------------
do $$
declare
  v_plan uuid := (select p.id from public.planes_academicos p join public.niveles n on n.id = p.nivel_id
                  where n.codigo = 'basico' and p.minutos_clase = 60 and p.tipo_alumno = 'unico' and p.modalidad_id = (select id from public.modalidades where codigo = 'estandar'));
  v_fallos text;
begin
  alter table public.plan_ciclos disable trigger plan_ciclos_inmutable;
  update public.plan_ciclos set sesiones = sesiones + 1, horas = horas + 1 where plan_id = v_plan and ciclo = 1;
  select string_agg(prueba, ',' order by prueba) into v_fallos from public.catalogo_verificar() where not ok;
  if v_fallos is distinct from 'horas_suman_total,sesiones_suman_total' then
    raise exception 'Sesiones/horas alteradas: se esperaban 2 detecciones y salió %', v_fallos;
  end if;
  update public.plan_ciclos set sesiones = sesiones - 1, horas = horas - 1 where plan_id = v_plan and ciclo = 1;

  update public.plan_ciclos set horas = horas + 0.5 where plan_id = v_plan and ciclo = 1;
  select string_agg(prueba, ',' order by prueba) into v_fallos from public.catalogo_verificar() where not ok;
  if v_fallos is distinct from 'horas_por_ciclo_correctas,horas_suman_total' then
    raise exception 'Horas por ciclo alteradas: salió %', v_fallos;
  end if;
  update public.plan_ciclos set horas = horas - 0.5 where plan_id = v_plan and ciclo = 1;

  delete from public.plan_ciclos where plan_id = v_plan and ciclo = 2;
  select string_agg(prueba, ',' order by prueba) into v_fallos from public.catalogo_verificar() where not ok;
  if v_fallos is distinct from 'cantidad_ciclos,ciclos_exactos,horas_suman_total,sesiones_suman_total' then
    raise exception 'Ciclo faltante: salió %', v_fallos;
  end if;
  alter table public.plan_ciclos enable trigger plan_ciclos_inmutable;

  alter table public.planes_academicos disable trigger planes_validar;
  insert into public.planes_academicos (nivel_id, modalidad_id, minutos_clase, sesiones_semana, tipo_alumno, total_sesiones, horas_totales, semanas, fuente)
  select nivel_id, modalidad_id, minutos_clase, sesiones_semana, 'continuo', total_sesiones, horas_totales, semanas, 'prueba'
  from public.planes_academicos where id = v_plan;
  select string_agg(prueba, ',' order by prueba) into v_fallos from public.catalogo_verificar() where not ok;
  if v_fallos not like '%sin_planes_duplicados%' then
    raise exception 'Plan duplicado no detectado: salió %', v_fallos;
  end if;
  alter table public.planes_academicos enable trigger planes_validar;
  raise exception 'FIN_SIMULACION';   -- deshace los daños simulados
exception when others then
  if sqlerrm <> 'FIN_SIMULACION' then raise; end if;
end $$;

-- Tras deshacer la simulación el catálogo vuelve a estar íntegro
do $$
begin
  if exists (select 1 from public.catalogo_verificar() where not ok) then raise exception 'El catálogo quedó dañado tras la simulación'; end if;
  if (select count(*) from public.plan_ciclos) <> 112 then raise exception 'plan_ciclos cambió'; end if;
end $$;

-- ------------------------------------------------------------
-- E. Permisos y RLS (usa los usuarios temporales creados antes de la sección C)
-- ------------------------------------------------------------

-- anon: sin acceso a nada
set local role anon;
select pg_temp.debe_fallar('select count(*) from public.niveles', '42501');
select pg_temp.debe_fallar('select count(*) from public.planes_academicos', '42501');
select pg_temp.debe_fallar('select count(*) from public.catalogo_planes', '42501');
select pg_temp.debe_fallar('select count(*) from public.catalogo_combinaciones', '42501');
select pg_temp.debe_fallar('select * from public.catalogo_verificar()', '42501');
reset role;

-- authenticated SIN perfil: las políticas devuelven 0 filas
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
do $$
begin
  if (select count(*) from public.niveles) <> 0 or (select count(*) from public.ciclos) <> 0
     or (select count(*) from public.modalidades) <> 0 or (select count(*) from public.horario_patrones) <> 0
     or (select count(*) from public.planes_academicos) <> 0 or (select count(*) from public.plan_ciclos) <> 0
     or (select count(*) from public.reglas_pendientes) <> 0 or (select count(*) from public.plan_pendientes) <> 0
     or (select count(*) from public.catalogo_planes) <> 0 or (select count(*) from public.catalogo_combinaciones) <> 0 then
    raise exception 'Un usuario sin perfil puede ver el catálogo';
  end if;
end $$;
reset role;

-- comercial y admin: leen todo, no escriben nada
do $$
declare
  v_uid text;
  v_tabla text;
  v_col text;
begin
  foreach v_uid in array array[pg_temp.uid_de('comercial-prueba@universa.test')::text, pg_temp.uid_de('admin-prueba@universa.test')::text] loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
    if (select count(*) from public.niveles) <> 7 or (select count(*) from public.ciclos) <> 13
       or (select count(*) from public.modalidades) <> 2 or (select count(*) from public.horario_patrones) <> 6
       or (select count(*) from public.planes_academicos) <> 58 or (select count(*) from public.plan_ciclos) <> 112
       or (select count(*) from public.reglas_pendientes) <> 11 or (select count(*) from public.plan_pendientes) = 0
       or (select count(*) from public.catalogo_planes) <> 58 or (select count(*) from public.catalogo_combinaciones) <> 103 then
      raise exception 'El usuario % no ve el catálogo completo', v_uid;
    end if;
    if exists (select 1 from public.catalogo_verificar() where not ok) then
      raise exception 'catalogo_verificar falla para %', v_uid;
    end if;
    foreach v_tabla in array array['niveles', 'ciclos', 'modalidades', 'horario_patrones', 'planes_academicos',
                                   'plan_ciclos', 'reglas_pendientes', 'plan_pendientes'] loop
      v_col := (select attname from pg_attribute where attrelid = ('public.' || v_tabla)::regclass and attnum > 0 and not attisdropped order by attnum limit 1);
      perform pg_temp.debe_fallar(format('update public.%I set %I = %I where false', v_tabla, v_col, v_col), '42501');
      perform pg_temp.debe_fallar(format('delete from public.%I where false', v_tabla), '42501');
      perform pg_temp.debe_fallar(format('insert into public.%I default values', v_tabla), '42501');
    end loop;
    reset role;
  end loop;
end $$;

-- ------------------------------------------------------------
-- F. Versionado: una versión nueva NO cambia retroactivamente lo que ya referencia el plan anterior
--    (zz_salon_demo imita la futura columna salones.plan_id con ON DELETE RESTRICT)
-- ------------------------------------------------------------
create table public.zz_salon_demo (salon text primary key, plan_id uuid not null references public.planes_academicos(id) on delete restrict);

do $$
declare
  v1 uuid;
  v2 uuid;
  v_antes text;
  v_despues text;
  v_hash text := $h$select md5(row(p.total_sesiones, p.horas_totales, p.semanas, p.receso_semanas, p.version, p.vigente_desde, p.tipo_alumno)::text
                     || (select string_agg(pc.ciclo || ':' || pc.sesiones || ':' || pc.horas, ',' order by pc.ciclo)
                           from public.plan_ciclos pc where pc.plan_id = p.id))
                     from public.planes_academicos p where p.id = $1$h$;
begin
  select p.id into v1
  from public.planes_academicos p
  join public.niveles n on n.id = p.nivel_id join public.modalidades m on m.id = p.modalidad_id
  where n.codigo = 'basico' and m.codigo = 'estandar' and p.minutos_clase = 90 and p.tipo_alumno = 'nuevo';
  insert into public.zz_salon_demo values ('salon-existente', v1);
  execute v_hash into v_antes using v1;

  -- Publicar la versión 2 (80 sesiones, como plantea P03): primero se retira la vigente, luego se inserta la nueva
  update public.planes_academicos set vigente = false, vigente_hasta = current_date where id = v1;
  insert into public.planes_academicos
    (nivel_id, modalidad_id, minutos_clase, sesiones_semana, tipo_alumno, total_sesiones, horas_totales, semanas,
     receso_semanas, version, reemplaza_a, estado_dato, fuente)
  select nivel_id, modalidad_id, minutos_clase, sesiones_semana, tipo_alumno, 80, 120.0, semanas,
         receso_semanas, 2, id, 'inferido', 'prueba de versionado'
  from public.planes_academicos where id = v1
  returning id into v2;
  insert into public.plan_ciclos (plan_id, nivel_id, ciclo, sesiones, horas)
  select v2, nivel_id, ciclo, case ciclo when 1 then 39 else 41 end, case ciclo when 1 then 58.5 else 61.5 end
  from public.plan_ciclos where plan_id = v1;

  -- 1. El plan histórico queda exactamente igual (datos de negocio y cuotas por ciclo)
  execute v_hash into v_despues using v1;
  if v_antes is distinct from v_despues then raise exception 'La versión 2 alteró el plan histórico'; end if;
  -- 2. El salón sigue apuntando al plan con el que se creó y ve los valores originales (81 sesiones)
  if (select p.total_sesiones from public.zz_salon_demo d join public.planes_academicos p on p.id = d.plan_id where d.salon = 'salon-existente') <> 81 then
    raise exception 'El salón existente ya no ve el plan original';
  end if;
  -- 3. El catálogo vigente ofrece solo la versión nueva y sigue habiendo 103 combinaciones
  if (select count(*) from public.catalogo_combinaciones) <> 103 then raise exception 'Con la versión 2 deben seguir siendo 103 combinaciones'; end if;
  if exists (select 1 from public.catalogo_combinaciones where plan_id = v1) then raise exception 'La versión retirada sigue en el catálogo vigente'; end if;
  if (select total_sesiones from public.catalogo_combinaciones where plan_id = v2 limit 1) <> 80 then raise exception 'La versión 2 no figura vigente'; end if;
  -- 4. Trazabilidad e integridad
  if (select reemplaza_a from public.planes_academicos where id = v2) <> v1 then raise exception 'reemplaza_a incorrecto'; end if;
  if exists (select 1 from public.catalogo_verificar() where not ok) then raise exception 'catalogo_verificar falla tras versionar'; end if;
  -- 5. El histórico no se puede borrar mientras un salón lo use, ni reactivar junto a la nueva versión
  perform pg_temp.debe_fallar(format('delete from public.planes_academicos where id = %L', v1), '23503');
  perform pg_temp.debe_fallar(format('update public.planes_academicos set vigente = true, vigente_hasta = null where id = %L', v1), 'P0001');
  perform pg_temp.debe_fallar(format('update public.planes_academicos set total_sesiones = 80, horas_totales = 120.0 where id = %L', v1), 'P0001');
end $$;

rollback;

select 'PRUEBAS OK: integridad, negativas, versionado, permisos y RLS (anon, sin perfil, comercial, admin)' as resultado;
