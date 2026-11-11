-- UNIVERSA · Ficha completa del estudiante: nombres y apellidos, documento, nacimiento, nacionalidad, género y acceso a MaskPark.
--
-- * `nombre` se conserva (lo usa todo el sistema) y pasa a ser «nombres + apellidos» cuando se registran por separado.
--   Los estudiantes anteriores no se tocan: su `nombres`/`apellidos` quedan vacíos hasta que se editen.
-- * El celular es el campo `telefono` de siempre. La edad NO se guarda: se calcula en pantalla desde la fecha de nacimiento.
-- * El usuario y la contraseña de MaskPark viven en `alumno_plataforma`, una tabla aparte que SOLO lee un administrador
--   (el resto del personal, aunque vea la ficha del estudiante, no puede leerla). Se guardan tal cual: es una clave de una
--   plataforma externa que administra la academia, no la del sistema.
-- * Documento único por tipo (dos estudiantes no pueden tener el mismo DNI) y usuario de MaskPark único.
--
-- Repetible. Requiere paquetes de horas (alumnos), matrículas (guardar_alumno) y es_admin.

-- ============================================================
-- 1. Columnas nuevas
-- ============================================================
alter table public.alumnos
  add column if not exists nombres text,
  add column if not exists apellidos text,
  add column if not exists tipo_documento text,
  add column if not exists numero_documento text,
  add column if not exists fecha_nacimiento date,
  add column if not exists pais_nacionalidad text,
  add column if not exists genero text;

do $$ begin
  begin
    alter table public.alumnos add constraint alumnos_tipo_documento_chk check (tipo_documento is null or tipo_documento in ('dni', 'ce', 'pasaporte', 'licencia', 'otro'));
  exception when duplicate_object then null; end;
  begin
    alter table public.alumnos add constraint alumnos_genero_chk check (genero is null or genero in ('M', 'F', 'O'));
  exception when duplicate_object then null; end;
  begin
    alter table public.alumnos add constraint alumnos_documento_completo_chk check ((tipo_documento is null) = (numero_documento is null));
  exception when duplicate_object then null; end;
  begin
    alter table public.alumnos add constraint alumnos_nacimiento_chk check (fecha_nacimiento is null or (fecha_nacimiento >= date '1900-01-01' and fecha_nacimiento <= current_date));
  exception when duplicate_object then null; end;
end $$;

-- Un mismo documento no puede pertenecer a dos estudiantes (solo si los datos actuales no tienen repetidos).
do $$ begin
  create unique index if not exists alumnos_documento_unico on public.alumnos (tipo_documento, lower(btrim(numero_documento))) where numero_documento is not null;
exception when others then raise notice 'alumnos_documento_unico no creado: %', sqlerrm;
end $$;

-- ============================================================
-- 2. Acceso a MaskPark (solo administradores)
-- ============================================================
create table if not exists public.alumno_plataforma (
  alumno_id uuid primary key references public.alumnos(id) on delete cascade,
  usuario text not null check (btrim(usuario) <> ''),
  clave text,
  updated_at timestamptz not null default now()
);
create unique index if not exists alumno_plataforma_usuario_unico on public.alumno_plataforma (lower(btrim(usuario)));

drop trigger if exists alumno_plataforma_updated_at on public.alumno_plataforma;
create trigger alumno_plataforma_updated_at before update on public.alumno_plataforma
  for each row execute function public.set_updated_at();

alter table public.alumno_plataforma enable row level security;
revoke all on public.alumno_plataforma from anon, authenticated;
grant select on public.alumno_plataforma to authenticated;
drop policy if exists "solo admin lee la plataforma" on public.alumno_plataforma;
create policy "solo admin lee la plataforma" on public.alumno_plataforma for select to authenticated using ((select public.es_admin()));

-- ============================================================
-- 3. guardar_alumno: igual que la versión de matrículas + datos completos
--    Las claves que no vienen en p_datos se conservan (otros formularios pueden enviar solo algunos campos).
-- ============================================================
create or replace function public.guardar_alumno(p_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_nombres text := btrim(regexp_replace(coalesce(p_datos->>'nombres', ''), '\s+', ' ', 'g'));
  v_apellidos text := btrim(regexp_replace(coalesce(p_datos->>'apellidos', ''), '\s+', ' ', 'g'));
  v_nombre text;
  v_correo text := nullif(lower(btrim(coalesce(p_datos->>'correo', ''))), '');
  v_tel text := nullif(regexp_replace(coalesce(p_datos->>'telefono', ''), '\D', '', 'g'), '');
  v_tipo text := nullif(btrim(coalesce(p_datos->>'tipo_documento', '')), '');
  v_doc text := nullif(upper(regexp_replace(coalesce(p_datos->>'numero_documento', ''), '\s+', '', 'g')), '');
  v_nac date := nullif(p_datos->>'fecha_nacimiento', '')::date;
  v_pais text := nullif(btrim(coalesce(p_datos->>'pais_nacionalidad', '')), '');
  v_genero text := nullif(btrim(coalesce(p_datos->>'genero', '')), '');
  v_usuario text := nullif(btrim(coalesce(p_datos->>'maskpark_usuario', '')), '');
  v_clave text := nullif(coalesce(p_datos->>'maskpark_clave', ''), '');
  v_otro text;
begin
  perform public.cal_exigir_admin();

  -- Nombre completo: «nombres + apellidos» si vienen separados; si no, el campo `nombre` de siempre.
  if v_nombres <> '' then
    v_nombre := btrim(v_nombres || ' ' || v_apellidos);
  else
    v_nombre := btrim(regexp_replace(coalesce(p_datos->>'nombre', ''), '\s+', ' ', 'g'));
  end if;
  if v_nombre = '' then raise exception 'El nombre del alumno es obligatorio'; end if;
  if p_id is null and p_datos ? 'nombres' and v_apellidos = '' then raise exception 'Los apellidos del alumno son obligatorios'; end if;

  -- Documento: tipo y número juntos, con el formato de cada tipo.
  if (v_tipo is null) <> (v_doc is null) then raise exception 'Indica el tipo y el número de documento (o deja ambos vacíos)'; end if;
  if v_tipo is not null then
    if v_tipo not in ('dni', 'ce', 'pasaporte', 'licencia', 'otro') then raise exception 'El tipo de documento no es válido'; end if;
    if v_tipo = 'dni' and v_doc !~ '^[0-9]{8}$' then raise exception 'El DNI debe tener 8 dígitos'; end if;
    if v_tipo <> 'dni' and v_doc !~ '^[A-Z0-9-]{5,20}$' then raise exception 'El número de documento debe tener entre 5 y 20 letras o números'; end if;
    select nombre into v_otro from public.alumnos
     where id is distinct from p_id and tipo_documento = v_tipo and lower(btrim(numero_documento)) = lower(v_doc) limit 1;
    if v_otro is not null then raise exception 'Ese documento ya pertenece al estudiante «%»', v_otro; end if;
  end if;
  if v_nac is not null and (v_nac > public.hoy_lima() or v_nac < date '1900-01-01') then raise exception 'La fecha de nacimiento no es válida'; end if;
  if v_genero is not null and v_genero not in ('M', 'F', 'O') then raise exception 'El género no es válido'; end if;
  if v_clave is not null and v_usuario is null then raise exception 'Indica el usuario de MaskPark para guardar su contraseña'; end if;

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
  if v_usuario is not null then
    select a.nombre into v_otro from public.alumno_plataforma ap join public.alumnos a on a.id = ap.alumno_id
     where ap.alumno_id is distinct from p_id and lower(btrim(ap.usuario)) = lower(v_usuario) limit 1;
    if v_otro is not null then raise exception 'El usuario de MaskPark ya pertenece al estudiante «%»', v_otro; end if;
  end if;

  if p_id is null then
    insert into public.alumnos (nombre, nombres, apellidos, telefono, correo, notas, tipo_documento, numero_documento, fecha_nacimiento, pais_nacionalidad, genero)
    values (v_nombre, nullif(v_nombres, ''), nullif(v_apellidos, ''), nullif(btrim(p_datos->>'telefono'), ''), nullif(btrim(p_datos->>'correo'), ''),
            nullif(btrim(p_datos->>'notas'), ''), v_tipo, v_doc, v_nac, v_pais, v_genero)
    returning id into v_id;
  else
    update public.alumnos set
           nombre = v_nombre,
           nombres = case when p_datos ? 'nombres' then nullif(v_nombres, '') else nombres end,
           apellidos = case when p_datos ? 'apellidos' then nullif(v_apellidos, '') else apellidos end,
           telefono = nullif(btrim(p_datos->>'telefono'), ''),
           correo = nullif(btrim(p_datos->>'correo'), ''),
           notas = nullif(btrim(p_datos->>'notas'), ''),
           tipo_documento = case when p_datos ? 'tipo_documento' then v_tipo else tipo_documento end,
           numero_documento = case when p_datos ? 'numero_documento' then v_doc else numero_documento end,
           fecha_nacimiento = case when p_datos ? 'fecha_nacimiento' then v_nac else fecha_nacimiento end,
           pais_nacionalidad = case when p_datos ? 'pais_nacionalidad' then v_pais else pais_nacionalidad end,
           genero = case when p_datos ? 'genero' then v_genero else genero end,
           activo = case when p_datos ? 'activo' then (p_datos->>'activo')::boolean else activo end
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'El alumno no existe'; end if;
  end if;

  -- MaskPark: solo si el formulario lo envió. Usuario vacío = quitar el acceso guardado; contraseña vacía = conservar la actual.
  if p_datos ? 'maskpark_usuario' then
    if v_usuario is null then
      delete from public.alumno_plataforma where alumno_id = v_id;
    else
      insert into public.alumno_plataforma (alumno_id, usuario, clave) values (v_id, v_usuario, v_clave)
      on conflict (alumno_id) do update
        set usuario = excluded.usuario, clave = coalesce(excluded.clave, public.alumno_plataforma.clave);
    end if;
  end if;
  return v_id;
end $$;

revoke execute on function public.guardar_alumno(uuid, jsonb) from public, anon;
grant execute on function public.guardar_alumno(uuid, jsonb) to authenticated;
