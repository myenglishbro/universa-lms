-- Videos y grabaciones: además de YouTube y Google Drive, se aceptan enlaces de Vimeo.
alter table public.curso_lecciones drop constraint if exists curso_lecciones_proveedor_check;
alter table public.curso_lecciones add constraint curso_lecciones_proveedor_check
  check (proveedor in ('youtube', 'drive', 'vimeo', 'externo'));

create or replace function public.curso_proveedor(p_url text, p_tipo text) returns text
language plpgsql immutable set search_path = '' as $$
declare v_host text; v_prov text;
begin
  if p_tipo is null or p_tipo not in ('grabacion', 'video', 'documento', 'enlace') then
    raise exception 'Tipo de recurso no válido';
  end if;
  if p_url is null or length(p_url) > 2000 or p_url !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?([/?#][^[:space:]]*)?$' then
    raise exception 'El enlace debe comenzar con https:// y no puede tener espacios';
  end if;
  v_host := lower(substring(p_url from '^https://([A-Za-z0-9.-]+)'));
  v_prov := case
    when v_host in ('youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com') then 'youtube'
    when v_host in ('drive.google.com', 'docs.google.com') then 'drive'
    when v_host in ('vimeo.com', 'www.vimeo.com', 'player.vimeo.com') then 'vimeo'
    else 'externo' end;
  if p_tipo in ('grabacion', 'video') and v_prov = 'externo' then
    raise exception 'Los videos y grabaciones deben ser enlaces de YouTube, Vimeo o Google Drive';
  end if;
  if p_tipo = 'documento' and v_prov <> 'drive' then
    raise exception 'Los documentos deben ser enlaces de Google Drive (Drive, Docs o Slides)';
  end if;
  return v_prov;
end $$;
