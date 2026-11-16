-- UNIVERSA · Eliminar un paquete de horas y liberar el horario del docente.
--
--  * eliminar_paquete: borra el paquete con su historial (movimientos, pagos y clases) y sus clases programadas dejan de
--    ocupar al docente. Si el paquete tenía salón y ningún otro paquete lo usa, el salón se elimina (como eliminar_salon);
--    si no se puede eliminar (tiene ejercicios asignados o historial archivado) se deja «finalizado», que también libera
--    al docente. Los paquetes de renovación que apuntaban a este quedan sin «paquete anterior».
--  * anular_paquete: además de anular, finaliza el salón del paquete (si ningún otro paquete activo lo usa) para liberar al docente.
-- Repetible. Requiere 20261206100000 y 20261110100000.

create or replace function public.eliminar_paquete(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.paquetes_horas;
  v_resultado text := 'eliminado';
begin
  perform public.cal_exigir_admin();
  select * into v_p from public.paquetes_horas where id = p_id for update;
  if not found then raise exception 'El paquete no existe'; end if;

  update public.paquetes_horas set paquete_origen_id = null where paquete_origen_id = p_id;
  delete from public.paquete_movimientos where paquete_id = p_id;
  delete from public.paquete_pagos where paquete_id = p_id;
  delete from public.paquete_clases where paquete_id = p_id;
  delete from public.paquetes_horas where id = p_id;

  if v_p.salon_id is not null and not exists (select 1 from public.paquetes_horas where salon_id = v_p.salon_id) then
    update public.matriculas set estado = 'retirada', fecha_fin = public.hoy_lima(), motivo_retiro = 'Paquete eliminado'
     where salon_id = v_p.salon_id and estado = 'activa';
    begin
      perform public.eliminar_salon(v_p.salon_id);
    exception when others then
      update public.salones set estado = 'finalizado' where id = v_p.salon_id;
      v_resultado := 'finalizado';
    end;
  end if;
  return v_resultado;
end $$;

create or replace function public.anular_paquete(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_salon uuid;
begin
  perform public.cal_exigir_admin();
  if btrim(coalesce(p_motivo, '')) = '' then raise exception 'Indica el motivo de la anulación'; end if;
  update public.paquetes_horas set anulado = true, motivo_anulacion = btrim(p_motivo) where id = p_id and not anulado
    returning salon_id into v_salon;
  if v_salon is not null and not exists (select 1 from public.paquetes_horas where salon_id = v_salon and not anulado) then
    update public.salones set estado = 'finalizado' where id = v_salon;
  end if;
end $$;

revoke execute on function public.eliminar_paquete(uuid) from public, anon;
grant execute on function public.eliminar_paquete(uuid) to authenticated;
