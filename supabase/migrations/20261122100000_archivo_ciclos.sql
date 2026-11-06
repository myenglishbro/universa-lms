-- UNIVERSA · Archivo de ciclos.
--
-- Al terminar un ciclo, los salones finalizados se «archivan» bajo el nombre del ciclo (ej. «2026-II»):
--   * Salen de las listas de trabajo (Salones, portales de docente y estudiante) para no confundir.
--   * Se guarda una copia fija de cada estudiante con su informe de notas tal como quedó al cerrar,
--     así el historial no cambia aunque después se editen plantillas, rúbricas o notas.
--   * No se borra nada: salón, sesiones, asistencia, evaluaciones y matrículas siguen en la base.
--
-- Las matrículas activas del salón pasan a «retirada» con el motivo «Ciclo cerrado: …» (es el único estado final que existe),
-- y la copia conserva el estado real que tenían al cerrar. Repetible (idempotente).

-- ============================================================
-- 1. Marca de archivo en el salón
-- ============================================================
alter table public.salones
  add column if not exists archivado_at timestamptz,
  add column if not exists ciclo_archivo text;
create index if not exists salones_archivo_idx on public.salones (ciclo_archivo) where archivado_at is not null;

-- ============================================================
-- 2. Copia fija por estudiante y salón
-- ============================================================
create table if not exists public.archivo_alumnos (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salones(id),
  alumno_id uuid not null references public.alumnos(id),
  alumno_nombre text not null,
  ciclo text not null,
  matricula_estado text not null,      -- estado de la matrícula al cerrar: 'activa' (terminó el ciclo) o 'retirada' (se fue antes)
  fecha_inicio date,
  fecha_fin date,
  motivo_retiro text,
  informe jsonb,                       -- salida de eval_informe al cerrar; null si no se pudo generar
  archivado_at timestamptz not null default now(),
  unique (salon_id, alumno_id)
);
create index if not exists archivo_alumnos_ciclo_idx on public.archivo_alumnos (ciclo);
create index if not exists archivo_alumnos_alumno_idx on public.archivo_alumnos (alumno_id);

alter table public.archivo_alumnos enable row level security;
revoke all on public.archivo_alumnos from anon, authenticated;
grant select on public.archivo_alumnos to authenticated;
-- Contiene notas: solo administración.
drop policy if exists "consultar archivo" on public.archivo_alumnos;
create policy "consultar archivo" on public.archivo_alumnos for select to authenticated using ((select public.es_admin()));

-- ============================================================
-- 3. Archivar salones finalizados bajo un ciclo
-- ============================================================
create or replace function public.archivar_salones(p_salones uuid[], p_ciclo text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_ciclo text := btrim(coalesce(p_ciclo, ''));
  v_malos text;
  v_s record; v_m record; v_inf jsonb; v_n integer := 0;
begin
  if not public.es_admin() then raise exception 'Solo administración puede archivar ciclos' using errcode = '42501'; end if;
  if v_ciclo = '' then raise exception 'Escribe el nombre del ciclo (por ejemplo 2026-II)'; end if;
  if coalesce(array_length(p_salones, 1), 0) = 0 then raise exception 'Elige al menos un salón'; end if;

  perform 1 from public.salones where id = any(p_salones) for update;

  select string_agg(s.nombre, ', ') into v_malos from public.salones s
   where s.id = any(p_salones) and (s.estado <> 'finalizado' or s.archivado_at is not null);
  if v_malos is not null then raise exception 'Solo se archivan salones finalizados que no estén archivados. Revisa: %', v_malos; end if;
  if (select count(*) from public.salones where id = any(p_salones)) <> (select count(distinct x) from unnest(p_salones) x) then
    raise exception 'Algún salón ya no existe; recarga la lista';
  end if;

  for v_s in select id from public.salones where id = any(p_salones) loop
    for v_m in
      select distinct on (m.alumno_id) m.alumno_id, a.nombre, m.estado, m.fecha_inicio, m.fecha_fin, m.motivo_retiro
        from public.matriculas m join public.alumnos a on a.id = m.alumno_id
       where m.salon_id = v_s.id
       order by m.alumno_id, m.created_at desc
    loop
      begin
        v_inf := public.eval_informe(v_s.id, v_m.alumno_id);
      exception when others then
        v_inf := null; -- un informe que no se pueda generar no debe impedir cerrar el ciclo
      end;
      insert into public.archivo_alumnos (salon_id, alumno_id, alumno_nombre, ciclo, matricula_estado, fecha_inicio, fecha_fin, motivo_retiro, informe)
      values (v_s.id, v_m.alumno_id, v_m.nombre, v_ciclo, v_m.estado, v_m.fecha_inicio, v_m.fecha_fin, v_m.motivo_retiro, v_inf)
      on conflict (salon_id, alumno_id) do update
        set ciclo = excluded.ciclo, matricula_estado = excluded.matricula_estado, fecha_inicio = excluded.fecha_inicio,
            fecha_fin = excluded.fecha_fin, motivo_retiro = excluded.motivo_retiro, informe = excluded.informe, archivado_at = now();
    end loop;

    update public.matriculas
       set estado = 'retirada', fecha_fin = public.hoy_lima(), motivo_retiro = 'Ciclo cerrado: ' || v_ciclo
     where salon_id = v_s.id and estado = 'activa';

    update public.salones set archivado_at = now(), ciclo_archivo = v_ciclo where id = v_s.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

revoke execute on function public.archivar_salones(uuid[], text) from public, anon;
grant execute on function public.archivar_salones(uuid[], text) to authenticated;

-- ============================================================
-- 4. Los portales no muestran salones archivados
-- ============================================================
create or replace function public.portal_mis_cursos() returns table (
  salon_id uuid, codigo text, nombre text, nivel text, docente text, estado text, fecha_inicio date,
  horarios jsonb, lecciones integer, matriculado_desde date)
language sql stable security definer set search_path = '' as $$
  select s.id, s.codigo, s.nombre, n.nombre, d.nombre, s.estado, s.fecha_inicio,
         coalesce((select jsonb_agg(jsonb_build_object('dia', h.dia, 'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin) order by h.dia, h.hora_inicio)
                     from public.salon_horarios h where h.salon_id = s.id), '[]'::jsonb),
         (select count(*)::integer from public.curso_lecciones l join public.curso_secciones c on c.id = l.seccion_id
           where l.salon_id = s.id and not l.oculta and not c.oculta),
         m.fecha_inicio
    from public.cuenta_roles cr
    join public.matriculas m on m.alumno_id = cr.alumno_id and m.estado = 'activa'
    join public.salones s on s.id = m.salon_id and s.archivado_at is null
    left join public.niveles n on n.id = s.nivel_id
    left join public.docentes d on d.id = s.docente_id
   where cr.user_id = (select auth.uid()) and cr.rol = 'estudiante'
   order by s.estado = 'finalizado', s.nombre
$$;

create or replace function public.portal_mis_salones() returns table (
  salon_id uuid, codigo text, nombre text, nivel text, estado text, fecha_inicio date, capacidad integer,
  estudiantes integer, horarios jsonb, lecciones integer)
language sql stable security definer set search_path = '' as $$
  select s.id, s.codigo, s.nombre, n.nombre, s.estado, s.fecha_inicio, s.capacidad,
         (select count(*)::integer from public.matriculas m where m.salon_id = s.id and m.estado = 'activa'),
         coalesce((select jsonb_agg(jsonb_build_object('dia', h.dia, 'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin) order by h.dia, h.hora_inicio)
                     from public.salon_horarios h where h.salon_id = s.id), '[]'::jsonb),
         (select count(*)::integer from public.curso_lecciones l where l.salon_id = s.id and not l.oculta)
    from public.cuenta_roles cr
    join public.salones s on s.docente_id = cr.docente_id and s.archivado_at is null
    left join public.niveles n on n.id = s.nivel_id
   where cr.user_id = (select auth.uid()) and cr.rol = 'docente'
   order by s.estado = 'finalizado', s.nombre
$$;
