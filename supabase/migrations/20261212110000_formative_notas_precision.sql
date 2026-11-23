-- UNIVERSA · Las notas manuales del Formative conservan su valor exacto.
-- Se guardan en escala 0-5 (la nota de 0 a 100 dividida entre 20) con solo 2 decimales: 4.5 / 20 = 0.225 se redondeaba a 0.23 y volvía como 4.6.
-- Con 4 decimales cualquier nota de 0 a 100 con 2 decimales (0.01 / 20 = 0.0005) se conserva exacta. Las notas ya guardadas no cambian.
alter table public.eval_formative_manual alter column puntaje type numeric(8, 4);
alter table public.eval_formative_spark alter column puntaje type numeric(8, 4);
