-- UNIVERSA · Rúbricas 2026: Writing Assessment (Task 1 y Task 2), Project, Speaking y Writing del banco, con niveles 0–5 y descriptores.
--
-- Escala común (todas las rúbricas analíticas): 0 No demostrado · 1 Inicial · 2 Básico · 3 En desarrollo · 4 Logrado · 5 Destacado.
-- Puntos del criterio = (nivel ÷ 5) × peso del criterio. La nota de la rúbrica es la suma de los puntos; no hay nota sin todos los criterios.
-- Cada criterio guarda además sus expectativas por nivel MCER (A1–C1) en «niveles_mcer»: la pantalla muestra las del nivel del salón.
--
--  · «Writing Assessment» (tipo writing_task, NUEVA): Task 1 = 14 + 7 + 11 + 3 = 35 · Task 2 = 23 + 13 + 23 + 6 = 65. Total 100.
--  · «Writing» (tipo writing): pasa a ser la rúbrica del BANCO de actividades: 35 + 20 + 35 + 10 = 100. No tiene tareas.
--  · «Project»: 20 + 25 + 20 + 15 + 15 + 5 = 100.   · «Speaking» (banco): 30 + 25 + 25 + 10 + 10 = 100.
--  · «Listening (manual)» y «Reading (manual)» (tipo otra, NUEVAS): para notas manuales; no se aplican a ejercicios autocalificados.
--  · SPARK Homework: se agregan los 6 descriptores (0–5) al criterio existente; el registro manual no cambia.
-- Las rúbricas Writing, Speaking y Project que ya existían se copian antes a «… (anterior)» (inactivas) y las versiones del Grade Chart y las actividades
-- del banco que ya las usaban con notas pasan a esa copia; las nuevas actividades usan las rúbricas 2026.
-- Los criterios se actualizan por nombre: los que ya no existen se retiran de la rúbrica; las notas ya guardadas conservan su copia en
-- eval_calificaciones.detalle / ejercicio_entregas.detalle y no se tocan. Los descriptores y las expectativas MCER son PROPUESTAS de
-- UNIVERSA pendientes de validación de Coordinación Académica; se editan en Evaluaciones → Rúbricas.
-- Requiere 20261208100000_motor_rubricas_niveles.sql. Repetible. Una sola transacción.

begin;

create or replace function pg_temp.bandas(d0 text, d1 text, d2 text, d3 text, d4 text, d5 text) returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('nivel', 0, 'etiqueta', 'No demostrado', 'descripcion', d0),
    jsonb_build_object('nivel', 1, 'etiqueta', 'Inicial', 'descripcion', d1),
    jsonb_build_object('nivel', 2, 'etiqueta', 'Básico', 'descripcion', d2),
    jsonb_build_object('nivel', 3, 'etiqueta', 'En desarrollo', 'descripcion', d3),
    jsonb_build_object('nivel', 4, 'etiqueta', 'Logrado', 'descripcion', d4),
    jsonb_build_object('nivel', 5, 'etiqueta', 'Destacado', 'descripcion', d5)) $$;

create or replace function pg_temp.mcer(a1 text, a2 text, b1 text, b2 text, c1 text) returns jsonb language sql as $$
  select jsonb_build_object('A1', a1, 'A2', a2, 'B1', b1, 'B2', b2, 'C1', c1) $$;

-- n = nombre, d = descripción, peso = peso del criterio, b = bandas, m = expectativas MCER
create or replace function pg_temp.crit(n text, d text, peso numeric, b jsonb, m jsonb) returns jsonb language sql as $$
  select jsonb_build_object('n', n, 'd', d, 'max', peso, 'b', b, 'm', m) $$;

-- Antes de reemplazar una rúbrica que ya existía (Writing, Speaking, Project), guarda una COPIA con sus criterios anteriores y la inactiva.
-- Así lo que ya depende de ella conserva su estructura: los componentes de las versiones anteriores del Grade Chart y las actividades del banco
-- ya calificadas (sus notas siguen guardadas con su propia copia de criterios, pero reabrirlas necesita los criterios de entonces).
-- Solo se hace una vez: si la rúbrica ya tiene el criterio nuevo «p_marca», o la copia ya existe, no hace nada.
create or replace function pg_temp.archivar_anterior(p_nombre text, p_marca text) returns void language plpgsql as $$
declare v_old uuid; v_copia uuid; v_nom text := p_nombre || ' (anterior)';
begin
  select id into v_old from public.eval_rubricas where lower(btrim(nombre)) = lower(btrim(p_nombre));
  if v_old is null then return; end if;
  if exists (select 1 from public.eval_rubrica_criterios where rubrica_id = v_old and lower(btrim(nombre)) = lower(btrim(p_marca))) then return; end if;
  if exists (select 1 from public.eval_rubricas where lower(btrim(nombre)) = lower(v_nom)) then return; end if;
  insert into public.eval_rubricas (nombre, tipo, descripcion, activa)
  select v_nom, 'otra', 'Versión anterior de «' || p_nombre || '» conservada para las notas y versiones del Grade Chart que ya la usaban. No se ofrece para notas nuevas.', false
    from public.eval_rubricas where id = v_old returning id into v_copia;
  insert into public.eval_rubrica_criterios (rubrica_id, nombre, descripcion, max_puntaje, orden, bandas)
  select v_copia, nombre, descripcion, max_puntaje, orden, bandas from public.eval_rubrica_criterios where rubrica_id = v_old;
  -- componentes de versiones del Grade Chart que usaban la rúbrica
  update public.eval_componentes set rubrica_id = v_copia where rubrica_id = v_old;
  -- actividades del banco con alguna entrega ya revisada con esa rúbrica
  update public.eval_formative_vinculos v set rubrica_id = v_copia
   where v.rubrica_id = v_old and exists (select 1 from public.ejercicio_entregas e where e.asignacion_id = v.asignacion_id and e.estado = 'revisada');
end $$;

select pg_temp.archivar_anterior('Writing', 'Task Achievement');
select pg_temp.archivar_anterior('Speaking', 'Communicative Achievement');
select pg_temp.archivar_anterior('Project', 'Task Achievement & Communication');

-- Crea la rúbrica si no existe y deja exactamente estos criterios (por nombre; conserva el id de los que ya existían).
create or replace function pg_temp.fijar_rubrica(p_nombre text, p_tipo text, p_desc text, p_crit jsonb, p_total numeric) returns uuid language plpgsql as $$
declare v_id uuid; v_c jsonb; v_o integer := 0;
begin
  select id into v_id from public.eval_rubricas where lower(btrim(nombre)) = lower(btrim(p_nombre));
  if v_id is null then
    insert into public.eval_rubricas (nombre, tipo, descripcion) values (p_nombre, p_tipo, p_desc) returning id into v_id;
  else
    update public.eval_rubricas set tipo = p_tipo, descripcion = p_desc, activa = true, updated_at = now() where id = v_id;
  end if;
  for v_c in select * from jsonb_array_elements(p_crit) loop
    v_o := v_o + 1;
    update public.eval_rubrica_criterios
       set descripcion = v_c->>'d', max_puntaje = (v_c->>'max')::numeric, orden = v_o, bandas = v_c->'b', niveles_mcer = v_c->'m'
     where rubrica_id = v_id and lower(btrim(nombre)) = lower(btrim(v_c->>'n'));
    if not found then
      insert into public.eval_rubrica_criterios (rubrica_id, nombre, descripcion, max_puntaje, orden, bandas, niveles_mcer)
      values (v_id, v_c->>'n', v_c->>'d', (v_c->>'max')::numeric, v_o, v_c->'b', v_c->'m');
    end if;
  end loop;
  delete from public.eval_rubrica_criterios
   where rubrica_id = v_id and lower(btrim(nombre)) <> all (select lower(btrim(x->>'n')) from jsonb_array_elements(p_crit) x);
  if (select sum(max_puntaje) from public.eval_rubrica_criterios where rubrica_id = v_id) <> p_total then
    raise exception 'La rúbrica «%» debe sumar %', p_nombre, p_total;
  end if;
  return v_id;
end $$;

do $$
declare
  -- ===== Descriptores de escritura (Writing Assessment; el banco usa los de Language y Mechanics y adapta Task Achievement y Organisation) =====
  b_w_content jsonb := pg_temp.bandas(
    'No hay contenido pertinente evaluable.',
    'Presenta información mínima sin lograr el propósito comunicativo.',
    'Cumple algunos requisitos, pero omite información esencial.',
    'Cumple buena parte de la consigna, aunque existen omisiones o desarrollo limitado.',
    'Cumple la consigna con información pertinente, clara y suficientemente desarrollada.',
    'Cumple integralmente la consigna con información precisa y bien desarrollada para el nivel.');
  b_w_org jsonb := pg_temp.bandas(
    'No hay producción suficiente para evaluar.',
    'Presenta ideas aisladas sin secuencia comprensible.',
    'Existe cierta secuencia, pero las conexiones son frecuentemente confusas.',
    'Presenta una estructura comprensible con algunas transiciones débiles.',
    'Organiza las ideas claramente y utiliza conexiones apropiadas al género.',
    'Desarrolla una progresión coherente y consistente con conexiones eficaces para el nivel.');
  b_w_lang jsonb := pg_temp.bandas(
    'No hay lenguaje evaluable.',
    'Los recursos son mínimos y los errores impiden comprender gran parte del mensaje.',
    'Utiliza algunos recursos pertinentes, pero los errores dificultan la comprensión.',
    'Utiliza recursos del nivel suficientes para comunicar las ideas principales, con imprecisiones.',
    'Utiliza gramática y vocabulario del nivel con buena precisión y variedad.',
    'Demuestra control preciso, consistente y flexible de los recursos lingüísticos esperados.');
  b_w_mech jsonb := pg_temp.bandas(
    'No hay texto evaluable.',
    'Los errores de ortografía, puntuación y mayúsculas dificultan gravemente la lectura.',
    'Los errores frecuentes interrumpen la lectura.',
    'Las convenciones básicas permiten leer el texto, aunque presenta errores visibles.',
    'Mantiene buen control de las convenciones escritas, con errores menores.',
    'Aplica las convenciones escritas con precisión y consistencia apropiadas al nivel.');
  -- Adaptaciones para actividades breves del banco
  b_b_task jsonb := pg_temp.bandas(
    'No hay contenido pertinente evaluable.',
    'Responde con información mínima sin cumplir el propósito de la actividad.',
    'Cumple parte de la consigna, pero omite información esencial.',
    'Cumple la mayor parte de la consigna, con desarrollo limitado.',
    'Cumple la consigna con información pertinente y clara para la extensión pedida.',
    'Cumple completamente la consigna con información precisa y bien desarrollada para el nivel.');
  b_b_org jsonb := pg_temp.bandas(
    'No hay producción suficiente para evaluar.',
    'Presenta ideas aisladas sin secuencia comprensible.',
    'Existe cierta secuencia, pero las conexiones confunden con frecuencia.',
    'Presenta una secuencia comprensible con algunas conexiones débiles.',
    'Ordena las ideas con conectores apropiados a la actividad.',
    'Desarrolla una progresión clara y consistente con conectores eficaces para el nivel.');

  -- ===== Descriptores orales (Project y Speaking) =====
  b_s_comm jsonb := pg_temp.bandas(
    'No comunica contenido evaluable.',
    'Produce fragmentos mínimos sin lograr el objetivo.',
    'Comunica parte del mensaje, pero omite información esencial.',
    'Comunica las ideas principales, aunque presenta limitaciones de claridad.',
    'Logra el objetivo comunicativo con información clara y suficiente.',
    'Logra plenamente el objetivo con claridad, pertinencia y autonomía para el nivel.');
  b_s_inter jsonb := pg_temp.bandas(
    'No hay interacción evaluable.',
    'Responde mínimamente o no mantiene los intercambios esperados.',
    'Participa de manera limitada y necesita apoyo frecuente.',
    'Participa y responde pertinentemente, aunque necesita apoyo ocasional.',
    'Mantiene intercambios pertinentes con autonomía apropiada al nivel.',
    'Gestiona la interacción eficazmente con autonomía y estrategias apropiadas.');
  b_s_lang jsonb := pg_temp.bandas(
    'No hay lenguaje evaluable.',
    'Utiliza recursos mínimos que impiden comprender gran parte del mensaje.',
    'Emplea algunos recursos pertinentes, pero los errores dificultan la comprensión.',
    'Utiliza recursos del nivel suficientes para transmitir las ideas principales.',
    'Utiliza gramática y vocabulario con buena precisión y variedad.',
    'Demuestra control preciso, consistente y flexible de los recursos esperados.');
  b_s_flu jsonb := pg_temp.bandas(
    'No hay discurso evaluable.',
    'El discurso es fragmentado y sin secuencia comprensible.',
    'Las pausas y conexiones limitadas dificultan seguir el mensaje.',
    'Mantiene una secuencia comprensible con vacilaciones ocasionales.',
    'Se expresa con continuidad y conexiones adecuadas al nivel.',
    'Mantiene un discurso fluido, coherente y bien conectado según el nivel.');
  b_s_pron jsonb := pg_temp.bandas(
    'No hay producción oral evaluable.',
    'Gran parte del mensaje no resulta inteligible.',
    'La pronunciación dificulta comprender varias partes.',
    'El mensaje es generalmente inteligible, aunque algunas partes requieren esfuerzo.',
    'El mensaje es claro e inteligible con dificultades menores.',
    'Mantiene inteligibilidad consistente y recursos fonológicos apropiados al nivel.');
  -- Project (redacción propia de la guía de Project Assessment)
  b_p_task jsonb := pg_temp.bandas(
    'No comunica un mensaje evaluable.',
    'Presenta información mínima sin lograr el propósito.',
    'Aborda parcialmente el tema y omite aspectos esenciales.',
    'Comunica las ideas principales, aunque algunas quedan incompletas.',
    'Cumple el propósito con ideas claras, pertinentes y suficientemente desarrolladas.',
    'Cumple plenamente el propósito con claridad, precisión y desarrollo apropiados al nivel.');
  b_p_flu jsonb := pg_temp.bandas(
    'No hay discurso evaluable.',
    'El discurso es fragmentado y carece de continuidad.',
    'Las pausas prolongadas y conexiones limitadas dificultan seguir las ideas.',
    'Mantiene una secuencia comprensible, aunque presenta vacilaciones y conexiones débiles.',
    'Se expresa con continuidad y organiza claramente las ideas.',
    'Mantiene un discurso fluido, coherente y bien conectado según el nivel.');
  b_p_pron jsonb := pg_temp.bandas(
    'No hay producción oral evaluable.',
    'Gran parte del mensaje no resulta inteligible.',
    'El mensaje es parcialmente inteligible y requiere esfuerzo frecuente.',
    'El mensaje es generalmente inteligible, aunque algunas partes requieren esfuerzo.',
    'La pronunciación es clara y los problemas ocasionales no afectan significativamente el mensaje.',
    'Mantiene inteligibilidad consistente y utiliza recursos fonológicos eficazmente para el nivel.');
  b_p_inter jsonb := pg_temp.bandas(
    'No existe interacción evaluable.',
    'No logra responder pertinentemente a la mayoría de las preguntas apropiadas al nivel.',
    'Responde algunas preguntas, pero necesita apoyo considerable.',
    'Responde las preguntas principales con pertinencia y apoyo ocasional.',
    'Responde con claridad y autonomía, ampliando sus ideas cuando corresponde.',
    'Gestiona las preguntas con autonomía, precisión y desarrollo consistente para el nivel.');
  b_p_vis jsonb := pg_temp.bandas(
    'No hay presentación evaluable.',
    'Los recursos o la forma de presentar dificultan gravemente seguir el mensaje.',
    'Los recursos son poco pertinentes o existe dependencia excesiva de lectura.',
    'Utiliza recursos funcionales, aunque presenta problemas de claridad o dependencia de notas.',
    'Utiliza recursos pertinentes y presenta con claridad y dependencia limitada de notas.',
    'Integra recursos relevantes y accesibles con una presentación eficaz y natural.');

  -- ===== Expectativas por nivel MCER =====
  m_w_content jsonb := pg_temp.mcer(
    'Mensajes muy breves y personales (datos, gustos, rutinas) con frases sencillas y vocabulario muy frecuente.',
    'Textos cortos sobre temas cotidianos (describir, invitar, agradecer) con secuencias simples de ideas.',
    'Textos sencillos y conectados sobre experiencias, planes y opiniones, con razones y ejemplos básicos.',
    'Textos claros y detallados que desarrollan argumentos, ventajas y desventajas con ejemplos pertinentes.',
    'Textos bien estructurados y matizados que desarrollan puntos complejos y adaptan contenido y registro al lector.');
  m_w_org jsonb := pg_temp.mcer(
    'Frases aisladas o muy cortas; conectores básicos como and y but. Un orden simple es suficiente.',
    'Secuencias simples con and, but, because y then; inicio y cierre elementales.',
    'Párrafos breves con conectores frecuentes (first, however, so) y orden lógico claro.',
    'Párrafos bien desarrollados con conectores variados y progresión clara entre ideas.',
    'Estructura flexible con marcadores discursivos precisos y cohesión natural entre párrafos.');
  m_w_lang jsonb := pg_temp.mcer(
    'Presente simple, to be y vocabulario muy frecuente; los errores básicos son esperables.',
    'Pasado simple, going to y comparativos; vocabulario cotidiano con errores que no impiden comprender.',
    'Tiempos variados, condicionales simples y vocabulario de temas familiares; errores que no afectan el mensaje.',
    'Estructuras complejas y vocabulario amplio con buen control; errores ocasionales.',
    'Gramática variada y vocabulario preciso e idiomático; errores raros y poco notorios.');
  m_w_mech jsonb := pg_temp.mcer(
    'Ortografía de palabras muy frecuentes, mayúsculas y punto final; errores comunes esperables.',
    'Ortografía de vocabulario cotidiano y puntuación básica (punto, coma, signo de interrogación).',
    'Ortografía y puntuación generalmente correctas; errores en palabras menos frecuentes.',
    'Buen control de ortografía y puntuación, incluida la de oraciones complejas.',
    'Convenciones escritas precisas y consistentes, incluso en estructuras complejas.');
  m_s_comm jsonb := pg_temp.mcer(
    'Información personal y mensajes muy simples con frases memorizadas y apoyo del interlocutor.',
    'Describe rutinas, lugares y experiencias simples con frases cortas y una secuencia básica.',
    'Narra experiencias, explica planes y da opiniones con razones simples y ejemplos.',
    'Presenta ideas con claridad y detalle, justifica puntos de vista y responde al propósito con precisión.',
    'Comunica ideas complejas con precisión y matices, adaptándose al propósito y a la audiencia.');
  m_s_inter jsonb := pg_temp.mcer(
    'Responde preguntas simples y predecibles con apoyo, repetición o gestos.',
    'Responde preguntas cotidianas y mantiene intercambios breves pidiendo repetición cuando lo necesita.',
    'Mantiene la conversación en temas familiares, pide aclaraciones y amplía sus respuestas con razones.',
    'Interactúa con relativa espontaneidad, reacciona a lo que dice el otro y desarrolla sus respuestas.',
    'Interactúa con fluidez y flexibilidad, anticipa preguntas y gestiona el turno con naturalidad.');
  m_s_lang jsonb := pg_temp.mcer(
    'Frases memorizadas, presente simple y vocabulario muy frecuente; errores básicos esperables.',
    'Pasado simple, going to y vocabulario cotidiano; errores frecuentes que no impiden comprender.',
    'Tiempos variados y vocabulario de temas familiares; errores que no afectan el mensaje.',
    'Estructuras variadas y vocabulario amplio con buen control; errores ocasionales.',
    'Gramática y vocabulario precisos e idiomáticos; errores raros.');
  m_s_flu jsonb := pg_temp.mcer(
    'Pausas largas y frases muy cortas son esperables; conectores básicos (and).',
    'Frases cortas con pausas frecuentes; conectores básicos (and, but, because).',
    'Discurso comprensible con pausas para planear; conectores frecuentes (so, then, however).',
    'Ritmo fluido con pocas pausas largas y conectores variados que enlazan las ideas.',
    'Discurso natural y cohesionado, con pausas casi imperceptibles y marcadores variados.');
  m_s_pron jsonb := pg_temp.mcer(
    'Palabras muy frecuentes comprensibles con esfuerzo del oyente; el acento extranjero es esperable.',
    'Mensaje comprensible aunque algunos sonidos o acentos requieran atención del oyente.',
    'Pronunciación clara en general; los errores de sonidos o entonación no impiden comprender.',
    'Pronunciación clara, con acento y entonación que apoyan el mensaje; errores ocasionales.',
    'Inteligibilidad constante, con entonación y acento que matizan el significado.');
  m_p_vis jsonb := pg_temp.mcer(
    'Apoyos visuales muy simples (imágenes, palabras clave); puede apoyarse en notas breves.',
    'Apoyos visuales con pocas palabras; consulta notas pero mantiene contacto visual ocasional.',
    'Apoyos claros que acompañan el mensaje; presenta con notas mínimas y contacto visual.',
    'Recursos pertinentes integrados al mensaje; presentación natural con poca dependencia de notas.',
    'Recursos relevantes y accesibles; presentación natural, segura y adaptada a la audiencia.');
begin
  -- ============================================================
  -- Writing Assessment: Task 1 (35) y Task 2 (65). La unidad es el prefijo «Task 1 · …» / «Task 2 · …».
  -- ============================================================
  perform pg_temp.fijar_rubrica('Writing Assessment', 'writing_task',
    'Writing Assessment: dos tareas independientes con su propia puntuación, comentario y estado. Task 1 = 35 puntos y Task 2 = 65 puntos; la suma es la nota Writing sobre 100. Los descriptores se aplican a ambas tareas, adaptando las expectativas a la consigna, el género y el nivel MCER.',
    jsonb_build_array(
      pg_temp.crit('Task 1 · Content & Task Achievement', 'Cumplimiento de la consigna: información pertinente, suficiente y bien desarrollada para el nivel y el género.', 14, b_w_content, m_w_content),
      pg_temp.crit('Task 1 · Organisation & Coherence', 'Organización del texto y conexión de las ideas, según el género de la tarea.', 7, b_w_org, m_w_org),
      pg_temp.crit('Task 1 · Language Resource', 'Gramática y vocabulario del nivel: precisión, variedad y control.', 11, b_w_lang, m_w_lang),
      pg_temp.crit('Task 1 · Mechanics', 'Ortografía, puntuación y mayúsculas.', 3, b_w_mech, m_w_mech),
      pg_temp.crit('Task 2 · Content & Task Achievement', 'Cumplimiento de la consigna: información pertinente, suficiente y bien desarrollada para el nivel y el género.', 23, b_w_content, m_w_content),
      pg_temp.crit('Task 2 · Organisation & Coherence', 'Organización del texto y conexión de las ideas, según el género de la tarea.', 13, b_w_org, m_w_org),
      pg_temp.crit('Task 2 · Language Resource', 'Gramática y vocabulario del nivel: precisión, variedad y control.', 23, b_w_lang, m_w_lang),
      pg_temp.crit('Task 2 · Mechanics', 'Ortografía, puntuación y mayúsculas.', 6, b_w_mech, m_w_mech)),
    100);

  -- ============================================================
  -- Writing del banco (actividades breves del Formative): rúbrica independiente, sin tareas.
  -- ============================================================
  perform pg_temp.fijar_rubrica('Writing', 'writing',
    'Writing del banco de actividades (Formative): actividades breves con enfoque comunicativo. Es independiente del Writing Assessment: no tiene Task 1 ni Task 2.',
    jsonb_build_array(
      pg_temp.crit('Task Achievement', 'Cumplimiento de la consigna de la actividad: información pertinente y suficiente para la extensión pedida.', 35, b_b_task, m_w_content),
      pg_temp.crit('Organisation & Coherence', 'Orden de las ideas y conectores apropiados a la actividad.', 20, b_b_org, m_w_org),
      pg_temp.crit('Grammar & Vocabulary', 'Gramática y vocabulario del nivel: precisión y variedad.', 35, b_w_lang, m_w_lang),
      pg_temp.crit('Mechanics', 'Ortografía, puntuación y mayúsculas.', 10, b_w_mech, m_w_mech)),
    100);

  -- ============================================================
  -- Project Assessment
  -- ============================================================
  perform pg_temp.fijar_rubrica('Project', 'project',
    'Project Assessment: 6 criterios, 100 puntos. Evalúa prioritariamente la competencia comunicativa, no el diseño de las diapositivas. La pronunciación valora la inteligibilidad, no la ausencia de acento extranjero.',
    jsonb_build_array(
      pg_temp.crit('Task Achievement & Communication', 'Logro del propósito del proyecto: mensaje claro, pertinente y desarrollado para el nivel.', 20, b_p_task, m_s_comm),
      pg_temp.crit('Grammar & Vocabulary', 'Gramática y vocabulario del nivel: precisión, variedad y control.', 25, b_s_lang, m_s_lang),
      pg_temp.crit('Fluency & Coherence', 'Continuidad del discurso y conexión de las ideas.', 20, b_p_flu, m_s_flu),
      pg_temp.crit('Pronunciation & Intelligibility', 'Inteligibilidad del mensaje. No se exige acento nativo.', 15, b_p_pron, m_s_pron),
      pg_temp.crit('Interaction & Q&A', 'Comprensión y respuesta a las preguntas apropiadas al nivel, con autonomía.', 15, b_p_inter, m_s_inter),
      pg_temp.crit('Visual Support & Delivery', 'Apoyo visual y forma de presentar. No evalúa el diseño de las diapositivas.', 5, b_p_vis, m_p_vis)),
    100);

  -- ============================================================
  -- Speaking del banco
  -- ============================================================
  perform pg_temp.fijar_rubrica('Speaking', 'speaking',
    'Speaking del banco de actividades (Formative): interacción y producción oral apropiadas al nivel.',
    jsonb_build_array(
      pg_temp.crit('Communicative Achievement', 'Logro del objetivo comunicativo de la actividad.', 30, b_s_comm, m_s_comm),
      pg_temp.crit('Interaction & Responsiveness', 'Participación y respuesta en el intercambio, con la autonomía esperada para el nivel.', 25, b_s_inter, m_s_inter),
      pg_temp.crit('Grammar & Vocabulary', 'Gramática y vocabulario del nivel: precisión y variedad.', 25, b_s_lang, m_s_lang),
      pg_temp.crit('Fluency & Coherence', 'Continuidad del discurso y conexión de las ideas.', 10, b_s_flu, m_s_flu),
      pg_temp.crit('Pronunciation & Intelligibility', 'Inteligibilidad del mensaje. No se exige acento nativo.', 10, b_s_pron, m_s_pron)),
    100);

  -- ============================================================
  -- Listening y Reading con calificación MANUAL (referencia; los ejercicios autocalificados conservan su corrección automática)
  -- ============================================================
  perform pg_temp.fijar_rubrica('Listening (manual)', 'otra',
    'Para actividades de Listening calificadas por el docente (no se aplica a ejercicios autocalificados). Evalúa comprensión auditiva, no producción.',
    jsonb_build_array(
      pg_temp.crit('General Understanding', 'Comprensión de la idea general, el tema y el propósito del audio.', 35,
        pg_temp.bandas('No hay evidencia evaluable de comprensión.', 'Capta palabras aisladas; no identifica el tema ni el propósito.', 'Identifica el tema general con apoyo, pero pierde ideas principales.',
          'Comprende las ideas principales, aunque pierde partes del mensaje.', 'Comprende con claridad la idea general y la mayoría de las ideas principales.', 'Comprende plena y consistentemente la idea general y la organización del audio para el nivel.'),
        pg_temp.mcer('Frases muy lentas y claras sobre temas personales, con repetición.', 'Diálogos y mensajes breves y claros sobre temas cotidianos.', 'Conversaciones y anuncios sobre temas familiares, a ritmo normal y claro.', 'Audios extensos y conversaciones a ritmo natural sobre temas variados.', 'Discurso extenso, rápido o poco estructurado, y en acentos variados.')),
      pg_temp.crit('Specific Information', 'Identificación de datos y detalles concretos pedidos.', 35,
        pg_temp.bandas('No hay evidencia evaluable de comprensión.', 'Identifica muy pocos datos concretos; la mayoría son incorrectos.', 'Identifica algunos datos concretos, con errores o confusiones frecuentes.',
          'Identifica buena parte de los datos pedidos, con algunos errores.', 'Identifica casi todos los datos y detalles pedidos con precisión.', 'Identifica con precisión y consistencia los datos y detalles pedidos, incluso con información distractora propia del nivel.'),
        pg_temp.mcer('Números, nombres, horas y datos concretos en mensajes muy breves y lentos.', 'Datos concretos (horarios, precios, lugares) en mensajes breves.', 'Datos y detalles relevantes en diálogos y anuncios, ignorando información secundaria.', 'Detalles en audios largos con información distractora.', 'Detalles precisos y matices en audio complejo.')),
      pg_temp.crit('Interpretation', 'Interpretación de actitudes, motivos e intenciones del hablante, apropiada al nivel.', 30,
        pg_temp.bandas('No hay evidencia evaluable de interpretación.', 'Reconoce solo el significado literal de fragmentos muy breves.', 'Interpreta algunas intenciones o actitudes simples, con errores frecuentes.',
          'Interpreta intenciones y actitudes evidentes, con algunas imprecisiones.', 'Interpreta con apoyo adecuado en el audio las actitudes, motivos o intenciones del hablante.', 'Interpreta con precisión y evidencia del audio actitudes, motivos e implicaciones apropiados al nivel.'),
        pg_temp.mcer('Reconoce el significado literal de frases con apoyo de imágenes.', 'Reconoce emociones y propósitos simples (pedir, invitar) con contexto claro.', 'Interpreta actitudes, motivos e intenciones sencillas del hablante.', 'Interpreta opiniones, actitudes y significados implícitos.', 'Interpreta tono, ironía, actitud e implicaciones sutiles.'))),
    100);

  perform pg_temp.fijar_rubrica('Reading (manual)', 'otra',
    'Para actividades de Reading calificadas por el docente (no se aplica a ejercicios autocalificados). Evalúa comprensión lectora; no se evalúa la gramática de producción escrita.',
    jsonb_build_array(
      pg_temp.crit('Global Comprehension', 'Comprensión de la idea global, el tema y el propósito del texto.', 35,
        pg_temp.bandas('No hay evidencia evaluable de comprensión.', 'Reconoce palabras aisladas; no identifica el tema ni el propósito.', 'Identifica el tema general con apoyo, pero pierde ideas principales.',
          'Comprende las ideas principales, aunque pierde partes del texto.', 'Comprende con claridad la idea global y la mayoría de las ideas principales.', 'Comprende plena y consistentemente la idea global y la organización del texto para el nivel.'),
        pg_temp.mcer('Textos muy breves con apoyo visual (carteles, mensajes) sobre temas personales.', 'Textos cortos y simples (anuncios, correos breves) sobre temas cotidianos.', 'Textos claros sobre temas familiares (noticias simples, correos, artículos breves).', 'Textos extensos sobre temas variados, identificando la idea principal y el propósito.', 'Textos largos y complejos, captando la idea global, el tono y la intención del autor.')),
      pg_temp.crit('Specific Information', 'Identificación de datos y detalles concretos pedidos.', 35,
        pg_temp.bandas('No hay evidencia evaluable de comprensión.', 'Identifica muy pocos datos concretos; la mayoría son incorrectos.', 'Identifica algunos datos concretos, con errores o confusiones frecuentes.',
          'Identifica buena parte de los datos pedidos, con algunos errores.', 'Identifica casi todos los datos y detalles pedidos con precisión.', 'Identifica con precisión y consistencia los datos y detalles pedidos, incluso con información distractora propia del nivel.'),
        pg_temp.mcer('Palabras y datos concretos (nombres, números, lugares) en textos muy breves.', 'Datos concretos (horarios, precios, fechas) en textos cortos y predecibles.', 'Datos y detalles en textos de uso cotidiano, distinguiendo la información relevante.', 'Detalles y datos dentro de textos extensos, incluso con información distractora.', 'Detalles y matices en textos extensos y densos.')),
      pg_temp.crit('Inference & Interpretation', 'Inferencias e interpretación de información, apropiadas al nivel.', 30,
        pg_temp.bandas('No hay evidencia evaluable de interpretación.', 'Reconoce solo el significado literal de fragmentos muy breves.', 'Deduce algunos significados simples, con errores frecuentes.',
          'Hace inferencias evidentes, con algunas imprecisiones.', 'Hace inferencias adecuadas apoyándose en el texto.', 'Interpreta con precisión y evidencia del texto actitudes, relaciones e implicaciones apropiadas al nivel.'),
        pg_temp.mcer('Relaciona palabras o frases con imágenes y significado literal; casi no infiere.', 'Deduce el significado de palabras sencillas a partir del contexto cercano.', 'Hace inferencias sencillas (actitud, causa, intención) apoyándose en el texto.', 'Infiere opiniones, actitudes y relaciones implícitas con evidencia del texto.', 'Interpreta significados implícitos, ironía y posturas con evidencia del texto.'))),
    100);

  -- ============================================================
  -- SPARK Homework: descriptores 0–5 en el criterio existente (el registro manual 0–5 no cambia)
  -- ============================================================
  update public.eval_rubrica_criterios c
     set bandas = pg_temp.bandas(
       'No existe evidencia evaluable de las actividades requeridas.',
       'Presenta evidencia mínima y no demuestra aplicación suficiente de los contenidos.',
       'Completa parcialmente las actividades, con omisiones importantes y aplicación limitada.',
       'Cumple buena parte de los requisitos y aplica contenidos principales, aunque presenta errores relevantes.',
       'Completa las actividades requeridas y demuestra aplicación adecuada y consistente.',
       'Completa las actividades con calidad y demuestra aplicación precisa, autónoma y consistente.')
    from public.eval_rubricas r
   where c.rubrica_id = r.id and lower(btrim(r.nombre)) = lower('Formative Assessment · elementos') and lower(btrim(c.nombre)) = 'spark homework';
  if not found then raise notice 'SPARK Homework: no se encontró el criterio (¿falta 20261128100000_formative_banco.sql?); los descriptores de SPARK se omiten'; end if;
end $$;

commit;
