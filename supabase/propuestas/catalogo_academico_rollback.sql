-- UNIVERSA · Reversión del catálogo académico (Fase 1). Solo elimina objetos creados por 20261105100000_catalogo_academico.sql.
-- No toca salones, salon_sesiones, el calendario ni el Dashboard (la Fase 1 no tiene dependencias hacia ellos).
-- IMPORTANTE: en cuanto exista salones.plan_id (Fase 2) esta reversión fallará mientras haya salones vinculados, a propósito.
begin;

drop view if exists public.catalogo_combinaciones;
drop view if exists public.catalogo_planes;
drop function if exists public.catalogo_verificar();

drop table if exists public.plan_pendientes;
drop table if exists public.reglas_pendientes;
drop table if exists public.plan_ciclos;
drop table if exists public.planes_academicos;
drop table if exists public.horario_patrones;
drop table if exists public.modalidades;
drop table if exists public.ciclos;
drop table if exists public.niveles;

drop function if exists public.catalogo_validar_plan();
drop function if exists public.catalogo_plan_inmutable();
drop function if exists public.catalogo_plan_ciclos_inmutable();

commit;
