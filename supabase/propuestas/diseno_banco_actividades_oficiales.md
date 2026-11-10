# Diseño vigente · Formative Assessment por elementos (banco + SPARK manual + participación)

Estado: implementado en `supabase/migrations/20261128100000_formative_banco.sql` y en React. **No ejecutado en Supabase.**
Reemplaza las versiones anteriores de este documento y el diseño banco → componente SPARK (eliminado).

## Reparto INTERNO del Formative (cada unidad usa la misma estructura)

| Elemento | Peso | Origen |
|---|---|---|
| Listening / Lessons | 16 % | banco de ejercicios |
| Writing | 16 % | banco de ejercicios (rúbrica Writing) |
| Reading | 16 % | banco de ejercicios |
| Speaking | 16 % | banco de ejercicios (rúbrica Speaking) |
| SPARK Homework | 16 % | nota manual del docente, 0 a 5 por unidad |
| Participación por clase | 20 % | checks de las sesiones (no es asistencia) |

Es el cálculo interno del componente Formative. No son los puntos máximos del módulo ni del nivel.

## Cómo se obtiene con el motor existente (sin tocarlo)

- `20261125` ya define: nota del Formative = (1 − p) × promedio de las 3 unidades + p × participación, con p = `peso_participacion` = 20.
- Cada unidad se califica con una rúbrica de 5 criterios del mismo máximo (5): nota de la unidad = Σ criterios ÷ Σ máximos × 100. Cada criterio pesa 20 % de la unidad y (1 − 0,20) × 20 % = 16 % del Formative.
- La participación sale de los checks por sesión (mecanismo existente).

## Flujo

1. El docente asigna un ejercicio como **práctica** (no afecta notas) o como **actividad oficial** (módulo, unidad y habilidad; en writing/speaking, una rúbrica existente del mismo tipo).
2. Cada habilidad de la unidad = promedio simple de sus actividades **calificadas** (0–100 → 0–5).
3. SPARK Homework: el docente anota 0–5 por estudiante y unidad (0–5 equivale a 0–100 al calcular).
4. «Calificaciones Formative»: ve los 5 elementos por unidad. Con algún elemento pendiente la unidad queda **parcial**: no se publica y nunca se convierte en cero.
5. Con los 5 elementos, el docente confirma. El servidor arma la nota y la escribe con `guardar_calificaciones` + `publicar_evaluacion`; si ya estaba publicada y cambia, con `corregir_calificacion` (motivo + historial).
6. El estudiante solo ve notas publicadas (portal de siempre).

## Grade Chart

- Versión nueva de «Grade Chart Universa»: se quita el componente SPARK separado y su peso pasa al Formative (para no contarlo dos veces). Test, Writing y Project no cambian. El total sigue sumando la escala.
- Solo la usan módulos nuevos. Los módulos existentes conservan su versión, sus notas y su historial.
- Los módulos con la plantilla anterior no usan el banco (el selector lo avisa).

## Decisiones abiertas

1. **Peso del Formative en el módulo.** La migración suma el peso del SPARK al del Formative (p. ej. 3 + 2 = 5 de 25 en módulos 1 a 3 y 2 + 1 = 3 en el módulo final). Confírmalo antes de ejecutar.
2. **Estudiante que nunca entrega un elemento.** Hoy la unidad queda parcial. El docente puede calificar la unidad completa a mano en la matriz si Coordinación lo decide.
3. **Resultado del ejercicio antes de publicar.** El estudiante ve el resultado de su ejercicio al enviarlo (comportamiento del banco), no la nota oficial de la unidad.
4. **Módulos existentes sin notas.** No se reasignan solos; administración puede asignarles la versión nueva.
