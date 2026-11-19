# Aplicación segura de `20261209100000_ajustes_writing_project_detalle.sql`

**Estado: APLICADA en producción (2026-11-18/19)** con `supabase db query --remote --yes --file …` (no `db push`). Incluye el borrado de las 3 notas ficticias de Writing/Project.
El contenido de rúbricas y funciones ya estaba en producción antes del respaldo `antes-aplicar` (alguien lo aplicó antes); la ejecución fue idempotente. El estado anterior real está en `universa-respaldos/ensayo-2026-11-18`.
Los pasos de abajo quedan como referencia.

## Qué cambia y qué no
- Cambia: rúbricas `Project` (7 criterios, pesos 25 / 12,5 + 12,5 / 15 / 20 / 10 / 5) y `Writing Assessment` (solo textos; pesos 35/65 intactos); funciones
  `eval_nota_exacta`, `eval_resolver_nota`, `calificar_entrega_rubrica`, `guardar_rubrica`, `eval_evaluacion_detalle`.
- No cambia: ninguna fila de `eval_calificaciones` ni `ejercicio_entregas`, ninguna versión ni componente del Grade Chart, Formative, SPARK, Test,
  participación, rúbricas `Writing`/`Speaking` del banco, `Listening/Reading (manual)`.
- La migración **se aborta sola** (una transacción) si: falta un requisito, o al final la huella (md5) de calificaciones, entregas, componentes o
  el número de versiones es distinta de la de antes.
- Las dos migraciones 20261207 siguen sin tocarse. `20261207100000` no hace nada hoy. **No ejecutar `20261207110000` nunca**: sobrescribiría
  los descriptores de SPARK Homework con el formato antiguo por rangos.

## Grade Chart: versiones residuales (comprobado, solo lectura)
Las dos versiones «vigente» de 25 puntos (`Universa · Módulos 1 a 3` y `Universa · Módulo 4 final`) son de **otras plantillas** y no tienen módulos
(0 de 10). Cada módulo calcula con su `version_id` (la v7 de «Grade Chart Universa»), y las funciones que eligen «la vigente» filtran por la plantilla
«Grade Chart Universa». No afectan los cálculos. No se eliminan ni modifican.

## Pasos exactos
1. **Código listo**: `npm test` → 61 pruebas, 0 fallos; `npx vite build` sin errores.
2. **Respaldo verificable** (solo lectura), justo antes de aplicar:
   `node supabase/propuestas/respaldo_antes_de_aplicar.mjs "C:/Users/Carlos/OneDrive/Desktop/universa-respaldos/antes-2026-12-09"`
   Debe terminar con `RESPALDO VÁLIDO`. Si dice `RESPALDO NO VÁLIDO`, **detenerse**. Guarda `manifest.json` (filas y sha256 por tabla) y la definición
   actual de las 5 funciones (`funcion_*.sql`) para poder revertir. (Ya se hizo un ensayo el 2026-11-18 en `universa-respaldos/ensayo-2026-11-18`: 13 tablas y 5 funciones.)
3. **Estado previo** (SQL Editor, solo SELECT): ejecutar la sección «VERIFICACIÓN DESPUÉS de aplicar» de `pruebas_motor_rubricas.sql`.
   Antes de aplicar deben ser `false` solo las filas de Project (7 criterios, pesos en orden, 6 niveles) y las de `eval_nota_exacta` con formato antiguo;
   las demás `true`. Si algo más es `false`, **detenerse**.
4. **Aplicar**: abrir el archivo `20261209100000_ajustes_writing_project_detalle.sql` en el SQL Editor de Supabase y ejecutarlo completo.
   No usar `supabase db push` (el historial remoto está vacío y intentaría aplicar las 50 migraciones). Si hay un error, la transacción entera se revierte.
5. **Verificar**: repetir la sección de verificación → todas las filas `ok = true`. La consulta de ciclos debe dar 0→A1.1 … 12→C2.2 y
   `modulos_sin_mcer_objetivo = 0`.
6. **Comprobar que no se tocó nada**: repetir el respaldo en otra carpeta y comparar sha256:
   `eval_calificaciones.json`, `ejercicio_entregas.json`, `eval_componentes.json`, `eval_versiones.json`, `eval_formative_vinculos.json` deben ser idénticos
   a los del respaldo previo (Get-FileHash o `sha256sum`). Cambian, como se espera: `eval_rubricas.json` y `eval_rubrica_criterios.json`.
7. **Desplegar el frontend** (después de la migración; con la base antigua también funciona, pero sin el nivel MCER por ciclo).
8. **Revisión en pantalla**: abrir la nota de Project publicada (debe mostrar 7 criterios en nivel 4 = 80, con el aviso de «saved with an earlier version»);
   abrir una evaluación de Writing (Task 1 y Task 2 con 35 y 65 puntos); un módulo de ciclo 1 debe mostrar solo expectativas A1, uno de ciclo 3, solo A2.

## Límites conocidos
- La nota de Project publicada (80/100, rúbrica anterior) se conserva sin recalcular y se consulta sin errores (mismos niveles con los pesos actuales).
  **Corregirla** aplica la rúbrica actual: se reescribe con los pesos nuevos (en este caso también da 80, porque todos sus criterios están en nivel 4).
  Si el docente cambia algún nivel, el resultado usa los pesos y descriptores actuales.
- Las notas guardadas antes conservan en `detalle` el nivel como elemento aparte; `eval_nota_exacta` lo tolera. No se reescriben.
  Efecto visible mínimo: la nota exacta de Writing Task 2 pasa a leerse como 63,0769 (la guardada sigue siendo 63,08); la nota oficial entera no cambia.
- Los botones 0–5 muestran siempre las etiquetas en inglés, también en rúbricas que no se tocan (Speaking/Writing del banco, Listening/Reading, SPARK);
  sus descripciones siguen en el idioma en que están guardadas.
- Los módulos de ciclo 11 y 12 (C2) no tienen expectativas escritas: la pantalla lo avisa.

## Cómo revertir (si hace falta, con autorización)
- **Funciones**: ejecutar en el SQL Editor cada `funcion_*.sql` del respaldo previo (son `create or replace` con la definición anterior).
- **Rúbricas**: restaurar los criterios de `Project` y `Writing Assessment` desde `eval_rubrica_criterios.json` del respaldo
  (`delete` de los criterios de esa rúbrica + `insert … select * from jsonb_populate_recordset(null::public.eval_rubrica_criterios, '<json filtrado>')`).
  Las notas no se ven afectadas porque guardan su propia copia de criterios.
