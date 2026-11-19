-- UNIVERSA · Ajustes de Writing Assessment y Oral Project, corrección del detalle JSON y nivel MCER por ciclo.
--
-- Datos ficticios de desarrollo: elimina las notas de prueba de Writing y Project (autorizado por el responsable de desarrollo) para que las rúbricas nuevas
-- nazcan sin notas hechas con la estructura anterior. No toca ninguna otra nota.
--
-- QUÉ HACE
--  1. Project (rúbrica «Project»): pesos 25 / 25 / 15 / 20 / 10 / 5 = 100, con Grammar & Vocabulary dividido en dos subcriterios de 12,5
--     («Grammar & Vocabulary · Grammar» y «· Vocabulary», que la pantalla agrupa con subtotal). Descriptores 0–5 y expectativas MCER en inglés.
--  2. Writing Assessment: los pesos NO cambian (Task 1 = 35 y Task 2 = 65). Se actualizan descripciones, descriptores y expectativas MCER (inglés),
--     con propósito comunicativo, destinatario y registro en Content y una Organisation que permite 5/5 en Task 1 de oraciones independientes.
--  3. eval_resolver_nota y calificar_entrega_rubrica: el detalle guarda UN objeto por criterio, con «nivel» dentro. Antes `array || objeto || objeto`
--     añadía el nivel como un elemento aparte y eval_nota_exacta descartaba la copia de criterios.
--  4. eval_nota_exacta: tolera los elementos {"nivel": n} sueltos de las notas ya guardadas (no se reescribe ningún dato).
--  5. eval_resolver_nota: en componentes Writing y Project con rúbrica rechaza una nota numérica sin detalle (antes se guardaba sin validar niveles).
--  6. guardar_rubrica: las rúbricas de tipo «project» y «writing_task» deben sumar 100; «writing_task» exige Task 1 = 35 y Task 2 = 65.
--  7. eval_evaluacion_detalle: añade «mcer_objetivo», el subnivel MCER del ciclo del módulo (ciclo impar = primera mitad del rango del nivel,
--     par = segunda mitad, único = el nivel completo). Sin ciclo o sin nivel devuelve null y la pantalla usa el nivel del salón.
--
-- NO TOCA: Formative, SPARK, Test, participación, el Grade Chart (ninguna versión), eval_celda, eval_calc_modulo, eval_calc_nivel,
--          las rúbricas «Writing» y «Speaking» del banco, «Listening/Reading (manual)», ni ninguna nota que no sea de Writing o Project.
-- Salvaguarda: al final compara una huella del resto de eval_calificaciones, de ejercicio_entregas y del Grade Chart con la de antes; si difiere, aborta.
-- Requiere 20261208100000 y 20261208110000 (se comprueba). Repetible. Una sola transacción.

begin;

-- ============================================================
-- 0. Comprobaciones previas y huella de los datos que NO deben cambiar
-- ============================================================
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'eval_rubrica_criterios' and column_name = 'niveles_mcer') then
    raise exception 'Falta 20261208100000_motor_rubricas_niveles.sql (columna niveles_mcer)';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eval_rubricas_tipo_check' and pg_get_constraintdef(oid) like '%writing_task%') then
    raise exception 'Falta 20261208100000_motor_rubricas_niveles.sql (tipo writing_task)';
  end if;
  if not exists (select 1 from public.eval_rubricas where lower(btrim(nombre)) = 'project' and tipo = 'project') then
    raise exception 'Falta la rúbrica «Project» (20261208110000_rubricas_2026_contenido.sql)';
  end if;
  if (select count(*) from public.eval_rubrica_criterios c join public.eval_rubricas r on r.id = c.rubrica_id where lower(btrim(r.nombre)) = 'writing assessment' and r.tipo = 'writing_task') <> 8 then
    raise exception 'La rúbrica «Writing Assessment» no tiene los 8 criterios esperados (20261208110000_rubricas_2026_contenido.sql)';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'ciclos') then
    raise exception 'Falta la tabla ciclos (20261105100000_catalogo_academico.sql)';
  end if;
end $$;

-- Notas ficticias de Writing y Project (la rúbrica nueva no es comparable con ellas). Solo componentes de tipo writing/project; máximo las 3 esperadas.
do $$
declare v_n integer;
begin
  select count(*) into v_n from public.eval_calificaciones k
    join public.eval_evaluaciones e on e.id = k.evaluacion_id join public.eval_componentes c on c.id = e.componente_id
   where c.tipo in ('writing', 'project');
  if v_n > 3 then raise exception 'ABORTADO: hay % notas de Writing/Project y se esperaban 3 notas de prueba; revisa antes de borrar', v_n; end if;
  delete from public.eval_calificaciones k using public.eval_evaluaciones e, public.eval_componentes c
   where e.id = k.evaluacion_id and c.id = e.componente_id and c.tipo in ('writing', 'project');
end $$;

create temp table _huella_antes on commit drop as
select
  (select count(*) from public.eval_calificaciones) as n_cal,
  (select coalesce(md5(string_agg(k.id::text || '|' || coalesce(k.puntaje::text, '') || '|' || coalesce(k.estado, '') || '|' || coalesce(k.detalle::text, '') || '|' || coalesce(k.comentario, ''), ',' order by k.id)), '') from public.eval_calificaciones k) as h_cal,
  (select count(*) from public.ejercicio_entregas) as n_ent,
  (select coalesce(md5(string_agg(e.id::text || '|' || coalesce(e.puntaje::text, '') || '|' || coalesce(e.estado, '') || '|' || coalesce(e.detalle::text, ''), ',' order by e.id)), '') from public.ejercicio_entregas e) as h_ent,
  (select count(*) from public.eval_versiones) as n_ver,
  (select coalesce(md5(string_agg(c.id::text || '|' || c.peso::text || '|' || coalesce(c.rubrica_id::text, ''), ',' order by c.id)), '') from public.eval_componentes c) as h_comp;

-- ============================================================
-- 1. Ayudas de contenido (temporales, solo viven en esta transacción)
-- ============================================================
create or replace function pg_temp.bandas(d0 text, d1 text, d2 text, d3 text, d4 text, d5 text) returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('nivel', 0, 'etiqueta', 'Not demonstrated', 'descripcion', d0),
    jsonb_build_object('nivel', 1, 'etiqueta', 'Beginning', 'descripcion', d1),
    jsonb_build_object('nivel', 2, 'etiqueta', 'Basic', 'descripcion', d2),
    jsonb_build_object('nivel', 3, 'etiqueta', 'Developing', 'descripcion', d3),
    jsonb_build_object('nivel', 4, 'etiqueta', 'Achieved', 'descripcion', d4),
    jsonb_build_object('nivel', 5, 'etiqueta', 'Outstanding', 'descripcion', d5)) $$;

create or replace function pg_temp.mcer(a1 text, a2 text, b1 text, b2 text, c1 text) returns jsonb language sql as $$
  select jsonb_build_object('A1', a1, 'A2', a2, 'B1', b1, 'B2', b2, 'C1', c1) $$;

create or replace function pg_temp.crit(n text, d text, peso numeric, b jsonb, m jsonb) returns jsonb language sql as $$
  select jsonb_build_object('n', n, 'd', d, 'max', peso, 'b', b, 'm', m) $$;

-- Deja exactamente estos criterios (por nombre; conserva el id de los que ya existían y retira los que ya no están).
-- Las notas guardadas conservan su propia copia de criterios en eval_calificaciones.detalle y no se tocan.
create or replace function pg_temp.fijar_rubrica(p_nombre text, p_tipo text, p_desc text, p_crit jsonb, p_total numeric) returns uuid language plpgsql as $$
declare v_id uuid; v_c jsonb; v_o integer := 0;
begin
  select id into v_id from public.eval_rubricas where lower(btrim(nombre)) = lower(btrim(p_nombre));
  if v_id is null then raise exception 'La rúbrica «%» no existe', p_nombre; end if;
  update public.eval_rubricas set tipo = p_tipo, descripcion = p_desc, activa = true, updated_at = now() where id = v_id;
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

-- ============================================================
-- 2. Rúbricas: Writing Assessment (pesos intactos) y Project (pesos nuevos)
-- ============================================================
do $$
declare
  -- ---------- Writing Assessment (los mismos descriptores para Task 1 y Task 2) ----------
  b_w_content jsonb := pg_temp.bandas(
    'No text, or the text is unrelated to the task.',
    'Addresses only a very small part of the task; the purpose cannot be recognised; no reader or register is evident.',
    'Covers less than half of what is asked; the purpose is only partly recognisable; reader or register are inappropriate in much of the text.',
    'Covers most of what is asked and the purpose is recognisable; some points are missing or thin; reader and register are generally appropriate, with lapses.',
    'Covers everything asked with relevant, sufficient information; the purpose is clear; reader and register are appropriate.',
    'Covers everything asked with precise information and details or examples suited to the level; purpose, reader and register are fully appropriate.');
  b_w_org jsonb := pg_temp.bandas(
    'No production to assess order.',
    'Ideas or items appear in no recognisable order, or the requested format is not followed, so the text is hard to follow.',
    'The requested order or format is followed in part; in several places it is unclear how ideas relate or which item a sentence answers.',
    'The order is generally clear and the requested format is mostly followed; a few jumps or unclear relationships remain.',
    'The order is logical and the requested format is followed; relationships between ideas are clear where the task calls for them, with minor lapses.',
    'The order is logical and the requested format is followed throughout; relationships between ideas are clear and effective wherever the task calls for them. Nothing beyond what the task asks for is needed.');
  b_w_lang jsonb := pg_temp.bandas(
    'No language to assess.',
    'Minimal resources; errors prevent understanding most of the text.',
    'Limited resources; frequent errors force rereading and make several ideas hard to understand.',
    'Resources are enough for the main ideas; errors are frequent but rarely prevent understanding.',
    'Accurate, level-appropriate grammar and vocabulary; occasional errors that do not affect understanding.',
    'Consistent control and variety appropriate to the level; errors are rare and not systematic.');
  b_w_mech jsonb := pg_temp.bandas(
    'No text to assess.',
    'Errors in spelling, capitalisation and punctuation throughout; reading is difficult.',
    'Frequent errors interrupt reading in several places.',
    'The text can be read without difficulty; errors are visible but not constant.',
    'Occasional errors that do not interrupt reading.',
    'Conventions applied accurately; errors are rare.');

  m_w_content jsonb := pg_temp.mcer(
    'Very short personal messages (details, likes, routines) in simple sentences; the reader is known and an informal register is expected.',
    'Short texts on everyday topics (describing, inviting, thanking) with simple sequences of ideas; informal or neutral register.',
    'Simple connected texts about experiences, plans and opinions with basic reasons and examples; register adjusted to a specific reader.',
    'Clear, detailed texts that develop arguments, advantages and disadvantages with relevant examples; register fits the situation and the reader.',
    'Well-structured, nuanced texts that develop complex points; content and register adapted flexibly to the reader.');
  m_w_org jsonb := pg_temp.mcer(
    'One word, phrase or sentence per item is enough; connectors such as and or but only if the task asks for them. Independent sentences in a logical order can reach 5.',
    'Short sentences in a simple order; and, but, because or then only where the task asks for linked ideas. Independent sentences can reach 5.',
    'Short paragraphs or linked sentences with frequent connectors (first, however, so) when the genre calls for them.',
    'Well-developed paragraphs with varied connectors and a clear progression of ideas.',
    'Flexible structure with precise discourse markers and natural cohesion between paragraphs.');
  m_w_lang jsonb := pg_temp.mcer(
    'Present simple, to be and very frequent vocabulary; basic errors are expected.',
    'Past simple, going to and comparatives with everyday vocabulary; errors that do not prevent understanding.',
    'Varied tenses, simple conditionals and vocabulary of familiar topics; errors that do not affect the message.',
    'Complex structures and wide vocabulary with good control; occasional errors.',
    'Varied grammar and precise, idiomatic vocabulary; rare, hardly noticeable errors.');
  m_w_mech jsonb := pg_temp.mcer(
    'Spelling of very frequent words, capital letters and full stops; common errors are expected.',
    'Spelling of everyday vocabulary and basic punctuation (full stop, comma, question mark).',
    'Generally correct spelling and punctuation; errors in less frequent words.',
    'Good control of spelling and punctuation, including complex sentences.',
    'Accurate, consistent conventions, even in complex structures.');

  -- ---------- Project ----------
  b_p_task jsonb := pg_temp.bandas(
    'No content to assess.',
    'Addresses the topic only minimally; the purpose is not recognisable.',
    'Addresses the topic in part; essential content is missing or not relevant.',
    'Addresses the topic and communicates the main ideas; some parts are incomplete or thin.',
    'Fulfils the topic and purpose with relevant, clear and sufficient content.',
    'Fulfils the purpose with precise, well-developed content and details or examples suited to the level.');
  b_p_gram jsonb := pg_temp.bandas(
    'No language to assess.',
    'Minimal or memorised structures; errors in almost every sentence; the message is lost.',
    'Basic structures with frequent errors that make several ideas hard to understand.',
    'Structures are enough to communicate; errors are frequent but rarely prevent understanding.',
    'Appropriate structures with good control; occasional errors that do not affect understanding.',
    'Consistent control of the structures of the level; errors are rare and not systematic.');
  b_p_vocab jsonb := pg_temp.bandas(
    'No language to assess.',
    'Very limited vocabulary; repeated or inappropriate words; frequent use of another language.',
    'Basic vocabulary; frequent imprecision and little variety; key words for the topic are missing.',
    'Vocabulary is enough for the topic, with some imprecision or repetition.',
    'Relevant and mostly accurate vocabulary, with adequate variety.',
    'Accurate, varied vocabulary suited to the topic and level, with natural word choices.');
  b_p_flu jsonb := pg_temp.bandas(
    'No speech to assess.',
    'Fragmented speech with constant long pauses; the progression cannot be followed.',
    'Frequent pauses and hesitations interrupt the talk; ideas are rarely linked.',
    'The talk moves forward with visible pauses and restarts; the progression can be followed with some effort.',
    'Continuity appropriate to the level; occasional pauses do not break the progression; the parts of the talk are connected.',
    'Clear continuity and progression from start to finish; parts are well connected and pauses sound natural.');
  b_p_pron jsonb := pg_temp.bandas(
    'No speech to assess.',
    'Most of the message cannot be understood because of sounds, word stress or intonation.',
    'Only parts of the message are understood; the listener needs constant effort; word and sentence stress are hardly marked.',
    'Generally intelligible; some words or phrases need effort; word and sentence stress are irregular and intonation varies little.',
    'Clear and intelligible; word stress is correct in most frequent words; sentence stress and intonation support the message, with minor lapses.',
    'Consistently intelligible; word stress and sentence stress are clear; intonation supports meaning; no effort needed from the listener.');
  b_p_inter jsonb := pg_temp.bandas(
    'Answers neither question.',
    'Does not understand most questions even with support; one minimal or off-topic answer and no answer to the other.',
    'Answers one question relevantly, or both only very briefly or partly; needs repeated rephrasing or support.',
    'Answers both with basic relevance; one is more developed than the other, or needs one-off help.',
    'Answers both relevantly and independently, explaining the essentials.',
    'Answers both independently and expands with a reason or example suited to the level.');
  -- Referencias de proporción: «un desliz» = 1 diapositiva · «algunas» = 2 o 3 · «varias» = alrededor de un tercio hasta la mitad · «la mayoría» = más de la mitad.
  b_p_vis jsonb := pg_temp.bandas(
    'No presentation to assess (nothing was presented).',
    'The images-only format is not followed in most of the presentation (text on most slides), or the student reads continuously from slides or notes.',
    'The format is not followed in a substantial part (text on several slides), or the student reads for long stretches; images add little.',
    'The format is followed with some lapses (words on two or three slides, some images unrelated to what is said, or short episodes of reading).',
    'The format is followed with at most one minor slip (for example, a word or short label on one slide); images are relevant and the student does not read continuously.',
    'The format is followed throughout; images are relevant and used purposefully to explain, and the student speaks independently.');

  m_p_task jsonb := pg_temp.mcer(
    'Personal information and very simple messages with memorised phrases and listener support.',
    'Describes routines, places and simple experiences in short sentences with a basic sequence.',
    'Narrates experiences, explains plans and gives opinions with simple reasons and examples.',
    'Presents ideas clearly and in detail, justifies points of view and meets the purpose precisely.',
    'Communicates complex ideas precisely and with nuance, adapted to purpose and audience.');
  m_p_gram jsonb := pg_temp.mcer(
    'Present simple and to be; memorised phrases; basic errors are expected.',
    'Past simple, going to and comparatives; frequent errors that do not prevent understanding.',
    'Varied tenses and simple conditionals; errors that do not affect the message.',
    'Varied structures with good control; occasional errors.',
    'Precise, flexible grammar; rare errors.');
  m_p_vocab jsonb := pg_temp.mcer(
    'Very frequent everyday words (numbers, family, food).',
    'Everyday vocabulary for familiar topics; some repetition.',
    'Vocabulary for familiar topics with some variety; occasional circumlocution.',
    'Wide vocabulary, with some precision on less common topics.',
    'Precise, idiomatic vocabulary with natural collocations.');
  m_p_flu jsonb := pg_temp.mcer(
    'Long pauses and very short phrases are expected; basic connectors (and).',
    'Short phrases with frequent pauses; basic connectors (and, but, because).',
    'Comprehensible speech with pauses to plan; frequent connectors (so, then, however).',
    'Smooth pace with few long pauses and varied connectors linking ideas.',
    'Natural, cohesive speech; pauses are barely noticeable; varied discourse markers.');
  m_p_pron jsonb := pg_temp.mcer(
    'Very frequent words are understood with listener effort; a non-native accent is expected.',
    'The message is understood, though some sounds or stress patterns need the attention of the listener; word stress on the most frequent words.',
    'Generally clear; errors in sounds, stress or intonation do not prevent understanding.',
    'Clear, with word stress, sentence stress and intonation supporting the message; occasional errors.',
    'Constant intelligibility; stress and intonation add nuance to meaning.');
  m_p_inter jsonb := pg_temp.mcer(
    'One word or short phrase in answer to direct questions; Q2 may rely on an image.',
    'Short sentences with one simple detail (what, who, when, a simple why).',
    'Explains with a reason or an example; may narrate briefly.',
    'Develops and justifies answers; may offer a simple hypothesis.',
    'Elaborate, nuanced answers, including implications.');
  m_p_vis jsonb := pg_temp.mcer(
    'Simple images; may glance at brief personal notes.',
    'Images that accompany the message; consults notes only occasionally.',
    'Relevant images integrated into the talk; limited reliance on notes.',
    'Images that organise the talk; no continuous reading.',
    'Images that sustain an autonomous, well-structured talk.');
begin
  -- Writing Assessment: Task 1 = 14 + 7 + 11 + 3 = 35 · Task 2 = 23 + 13 + 23 + 6 = 65 (pesos sin cambio)
  perform pg_temp.fijar_rubrica('Writing Assessment', 'writing_task',
    'Writing Assessment: two independent tasks, each with its own score, comment and status. Task 1 = 35 points and Task 2 = 65 points; the sum is the Writing grade out of 100. The descriptors apply to both tasks and are read against what the task asks for and the CEFR level of the module.',
    jsonb_build_array(
      pg_temp.crit('Task 1 · Content & Task Achievement', 'Fulfils the task: communicative purpose, reader and register are appropriate; information is relevant and sufficient for the task and the level. Grammar errors do not lower this criterion if the message is understood.', 14, b_w_content, m_w_content),
      pg_temp.crit('Task 1 · Organisation & Coherence', 'Logical order and relationship between ideas, judged against what the task asks for. If the task asks for independent sentences, no connectors or paragraphs are expected and 5 can be reached.', 7, b_w_org, m_w_org),
      pg_temp.crit('Task 1 · Language Resource', 'Accuracy and appropriateness of grammar and vocabulary for the task and the level. Advanced structures, or all the structures of the module, are not required.', 11, b_w_lang, m_w_lang),
      pg_temp.crit('Task 1 · Mechanics', 'Spelling, punctuation and capitalisation. Word count is not assessed.', 3, b_w_mech, m_w_mech),
      pg_temp.crit('Task 2 · Content & Task Achievement', 'Fulfils the task: communicative purpose, reader and register are appropriate; information is relevant and sufficient for the task and the level. Grammar errors do not lower this criterion if the message is understood.', 23, b_w_content, m_w_content),
      pg_temp.crit('Task 2 · Organisation & Coherence', 'Logical order and relationship between ideas, judged against what the task asks for. If the task asks for independent sentences, no connectors or paragraphs are expected and 5 can be reached.', 13, b_w_org, m_w_org),
      pg_temp.crit('Task 2 · Language Resource', 'Accuracy and appropriateness of grammar and vocabulary for the task and the level. Advanced structures, or all the structures of the module, are not required.', 23, b_w_lang, m_w_lang),
      pg_temp.crit('Task 2 · Mechanics', 'Spelling, punctuation and capitalisation. Word count is not assessed.', 6, b_w_mech, m_w_mech)),
    100);

  -- Project: 25 + (12,5 + 12,5) + 15 + 20 + 10 + 5 = 100
  perform pg_temp.fijar_rubrica('Project', 'project',
    'Project Assessment: a prepared talk supported by slides that contain only images, followed by two teacher questions. Six criteria, 100 points (Grammar & Vocabulary = Grammar 12.5 + Vocabulary 12.5). It assesses communicative competence, not slide design. Pronunciation values intelligibility, not the absence of a foreign accent.',
    jsonb_build_array(
      pg_temp.crit('Task Achievement & Communication', 'Fulfils the topic and purpose; content is relevant and sufficient for the level. Errors that belong to Grammar & Vocabulary, Fluency or Pronunciation are not penalised again here.', 25, b_p_task, m_p_task),
      pg_temp.crit('Grammar & Vocabulary · Grammar', 'Accuracy and control of structures appropriate to the level. Complexity above the level is not required.', 12.5, b_p_gram, m_p_gram),
      pg_temp.crit('Grammar & Vocabulary · Vocabulary', 'Relevance, accuracy and variety of vocabulary for the topic and the level.', 12.5, b_p_vocab, m_p_vocab),
      pg_temp.crit('Fluency & Coherence', 'Continuity, pauses and progression of ideas. Speed is not fluency. Reading aloud from slides or notes is assessed in Visual Support & Delivery, not here.', 15, b_p_flu, m_p_flu),
      pg_temp.crit('Pronunciation & Intelligibility', 'Intelligibility, word stress, sentence stress, intonation and articulation, judged by their effect on communication and for the level. A non-native accent is not penalised in itself.', 20, b_p_pron, m_p_pron),
      pg_temp.crit('Interaction & Q&A', 'Two teacher questions at the end. Q1: understanding or expanding the content presented. Q2: application, explanation or a new answer related to the project. Comparable difficulty. Each question may be repeated once without penalty. Grammar and pronunciation are not penalised again here.', 10, b_p_inter, m_p_inter),
      pg_temp.crit('Visual Support & Delivery', 'Slides contain only images: no keywords, phrases, sentences or paragraphs. Occasional glances at personal notes are not penalised; continuous reading is. A single minor slip lowers the score by one level at most; levels 1 and 2 are for text on most or several slides, or for continuous reading. Aesthetics, camera quality and eye contact are not assessed.', 5, b_p_vis, m_p_vis)),
    100);
end $$;

-- ============================================================
-- 3. Nota exacta: tolera los elementos {"nivel": n} sueltos que dejó el formato anterior del detalle
--    (y sigue leyendo bien el formato nuevo). Solo cuentan los elementos que traen puntaje y max.
-- ============================================================
create or replace function public.eval_nota_exacta(p_puntaje numeric, p_detalle jsonb) returns numeric
language sql immutable set search_path = '' as $$
  select coalesce(
    case when jsonb_typeof(p_detalle) = 'array'
              and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_detalle) = 'array' then p_detalle else '[]'::jsonb end) x where x ? 'puntaje' or x ? 'max')
              and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_detalle) = 'array' then p_detalle else '[]'::jsonb end) x
                               where (x ? 'puntaje' or x ? 'max')
                                 and (jsonb_typeof(x->'puntaje') is distinct from 'number' or jsonb_typeof(x->'max') is distinct from 'number'))
         then (select 100 * sum((x->>'puntaje')::numeric) / nullif(sum((x->>'max')::numeric), 0)
                 from jsonb_array_elements(case when jsonb_typeof(p_detalle) = 'array' then p_detalle else '[]'::jsonb end) x where x ? 'puntaje' and x ? 'max') end,
    p_puntaje)
$$;

-- ============================================================
-- 4. Calificar con rúbrica: detalle bien formado y sin nota numérica directa en Writing / Project
-- ============================================================
create or replace function public.eval_resolver_nota(p_componente uuid, p_puntaje numeric, p_detalle jsonb, p_unidad text default '') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_rub uuid; v_tipo text; v_item jsonb; v_crit public.eval_rubrica_criterios; v_cid uuid; v_p numeric;
  v_sum numeric := 0; v_max numeric; v_det jsonb := '[]'::jsonb; v_vistos uuid[] := '{}'; v_n integer; v_elem jsonb;
begin
  select rubrica_id, tipo into v_rub, v_tipo from public.eval_componentes where id = p_componente;
  if p_detalle is null or jsonb_typeof(p_detalle) = 'null' or p_detalle = '[]'::jsonb then
    -- Writing y Project con rúbrica solo admiten notas por criterios: una nota numérica directa se saltaría la validación de niveles.
    if p_puntaje is not null and v_rub is not null and v_tipo in ('writing', 'project') then
      raise exception 'This assessment is graded with a rubric: give a level to every criterion';
    end if;
    if p_puntaje is not null and (p_puntaje < 0 or p_puntaje > 100) then raise exception 'La nota debe estar entre 0 y 100'; end if;
    return jsonb_build_object('puntaje', round(p_puntaje, 2), 'detalle', null);
  end if;
  if jsonb_typeof(p_detalle) <> 'array' then raise exception 'El detalle de la rúbrica no es válido'; end if;
  if v_rub is null then raise exception 'Este componente no usa rúbrica'; end if;
  for v_item in select * from jsonb_array_elements(p_detalle) loop
    begin v_cid := (v_item->>'criterio_id')::uuid; exception when others then raise exception 'Criterio no válido'; end;
    select * into v_crit from public.eval_criterios_unidad(v_rub, p_unidad) c where c.id = v_cid;
    if not found then raise exception 'Un criterio no pertenece a la rúbrica de esta evaluación o de esta tarea'; end if;
    if v_cid = any (v_vistos) then raise exception 'Un criterio está repetido'; end if;
    begin v_p := (v_item->>'puntaje')::numeric; exception when others then v_p := null; end;
    perform public.eval_validar_puntaje_criterio(v_crit, v_p);
    v_vistos := v_vistos || v_cid;
    v_sum := v_sum + v_p;
    -- UN objeto por criterio, con «nivel» dentro (jsonb: array || objeto añadiría el objeto como elemento aparte).
    v_elem := jsonb_build_object('criterio', v_crit.nombre, 'max', v_crit.max_puntaje, 'puntaje', v_p)
              || case when public.eval_criterio_por_niveles(v_crit.bandas) then jsonb_build_object('nivel', round(v_p * 5 / v_crit.max_puntaje)) else '{}'::jsonb end;
    v_det := v_det || jsonb_build_array(v_elem);
  end loop;
  select count(*), sum(max_puntaje) into v_n, v_max from public.eval_criterios_unidad(v_rub, p_unidad);
  if cardinality(v_vistos) <> v_n then raise exception 'Faltan criterios por calificar en la rúbrica'; end if;
  return jsonb_build_object('puntaje', round(v_sum / v_max * 100, 2), 'detalle', v_det);
end $$;

-- Writing / Speaking del banco: solo cambia la construcción del detalle (mismo contrato, misma validación).
create or replace function public.calificar_entrega_rubrica(p_entrega uuid, p_detalle jsonb, p_feedback text) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_e public.ejercicio_entregas; v_a public.ejercicio_asignaciones; v_v public.eval_formative_vinculos; v_r public.eval_rubricas;
  v_item jsonb; v_crit public.eval_rubrica_criterios; v_cid uuid; v_p numeric; v_vistos uuid[] := '{}';
  v_sum numeric := 0; v_max numeric; v_n integer; v_det jsonb := '[]'::jsonb; v_nota numeric; v_elem jsonb;
begin
  select * into v_e from public.ejercicio_entregas where id = p_entrega for update;
  if not found then raise exception 'La entrega ya no existe'; end if;
  select * into v_a from public.ejercicio_asignaciones where id = v_e.asignacion_id;
  if not public.puede_gestionar_curso(v_a.salon_id) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_v from public.eval_formative_vinculos where asignacion_id = v_a.id;
  if not found or v_v.rubrica_id is null or v_a.tipo not in ('writing', 'speaking') then raise exception 'Esta actividad no se califica con rúbrica'; end if;
  select * into v_r from public.eval_rubricas where id = v_v.rubrica_id;
  if p_detalle is null or jsonb_typeof(p_detalle) <> 'array' then raise exception 'Califica todos los criterios de la rúbrica'; end if;

  for v_item in select * from jsonb_array_elements(p_detalle) loop
    begin v_cid := (v_item->>'criterio_id')::uuid; exception when others then raise exception 'Criterio no válido'; end;
    select * into v_crit from public.eval_rubrica_criterios where id = v_cid and rubrica_id = v_v.rubrica_id;
    if not found then raise exception 'Un criterio no pertenece a la rúbrica de esta actividad'; end if;
    if v_cid = any (v_vistos) then raise exception 'Un criterio está repetido'; end if;
    begin v_p := (v_item->>'puntaje')::numeric; exception when others then v_p := null; end;
    perform public.eval_validar_puntaje_criterio(v_crit, v_p);
    v_vistos := v_vistos || v_cid;
    v_sum := v_sum + v_p;
    v_elem := jsonb_build_object('criterio', v_crit.nombre, 'max', v_crit.max_puntaje, 'puntaje', v_p)
              || case when public.eval_criterio_por_niveles(v_crit.bandas) then jsonb_build_object('nivel', round(v_p * 5 / v_crit.max_puntaje)) else '{}'::jsonb end;
    v_det := v_det || jsonb_build_array(v_elem);
  end loop;
  select count(*), sum(max_puntaje) into v_n, v_max from public.eval_rubrica_criterios where rubrica_id = v_v.rubrica_id;
  if cardinality(v_vistos) <> v_n then raise exception 'Faltan criterios por calificar en la rúbrica'; end if;

  v_nota := 100 * v_sum / v_max;
  update public.ejercicio_entregas
     set puntaje = round(v_nota, 2), estado = 'revisada', feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
         detalle = jsonb_build_object('rubrica', v_r.nombre, 'rubrica_id', v_r.id, 'criterios', v_det),
         calificado_por = (select auth.uid()), calificado_at = now()
   where id = p_entrega;
  return v_nota;
end $$;

-- ============================================================
-- 5. Administración de rúbricas: pesos oficiales protegidos (solo tipos project y writing_task)
-- ============================================================
create or replace function public.guardar_rubrica(p_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_nombre text := btrim(coalesce(p_datos->>'nombre', ''));
  v_tipo text := coalesce(nullif(p_datos->>'tipo', ''), 'otra');
  v_desc text := nullif(btrim(coalesce(p_datos->>'descripcion', '')), '');
  v_activa boolean := coalesce((p_datos->>'activa')::boolean, true);
  v_crit jsonb := coalesce(p_datos->'criterios', '[]'::jsonb);
  v_c jsonb; v_b jsonb;
  v_nom text; v_max numeric; v_desde numeric; v_hasta numeric; v_niv numeric; v_niveles numeric[];
  v_nombres text[] := '{}';
  v_id uuid; v_orden integer := 0;
  v_total numeric := 0; v_t1 numeric := 0; v_t2 numeric := 0; v_otros integer := 0;
begin
  perform public.cal_exigir_admin();
  if v_nombre = '' then raise exception 'El nombre de la rúbrica es obligatorio'; end if;
  if v_tipo not in ('speaking', 'writing', 'writing_task', 'project', 'formative', 'otra') then raise exception 'Tipo de rúbrica no válido'; end if;
  if jsonb_typeof(v_crit) <> 'array' or jsonb_array_length(v_crit) = 0 then raise exception 'La rúbrica necesita al menos un criterio'; end if;
  if jsonb_array_length(v_crit) > 30 then raise exception 'Una rúbrica admite hasta 30 criterios'; end if;
  if exists (select 1 from public.eval_rubricas where lower(btrim(nombre)) = lower(v_nombre) and id is distinct from p_id) then
    raise exception 'Ya existe una rúbrica con ese nombre';
  end if;

  for v_c in select * from jsonb_array_elements(v_crit) loop
    v_nom := btrim(coalesce(v_c->>'nombre', ''));
    if v_nom = '' then raise exception 'Todos los criterios necesitan nombre'; end if;
    if lower(v_nom) = any(v_nombres) then raise exception 'El criterio «%» está repetido', v_nom; end if;
    v_nombres := v_nombres || lower(v_nom);
    begin v_max := (v_c->>'max_puntaje')::numeric; exception when others then v_max := null; end;
    if v_max is null or v_max <= 0 or v_max > 1000 then raise exception 'El puntaje máximo de «%» debe ser mayor que 0 y hasta 1000', v_nom; end if;
    v_total := v_total + v_max;
    if left(v_nom, 9) = 'Task 1 · ' then v_t1 := v_t1 + v_max;
    elsif left(v_nom, 9) = 'Task 2 · ' then v_t2 := v_t2 + v_max;
    else v_otros := v_otros + 1; end if;
    if jsonb_typeof(coalesce(v_c->'bandas', '[]'::jsonb)) <> 'array' then raise exception 'Las bandas de «%» no son válidas', v_nom; end if;
    if v_c->'niveles_mcer' is not null and jsonb_typeof(v_c->'niveles_mcer') not in ('object', 'null') then
      raise exception 'Las expectativas por nivel MCER de «%» no son válidas', v_nom;
    end if;
    v_niveles := '{}';
    for v_b in select * from jsonb_array_elements(coalesce(v_c->'bandas', '[]'::jsonb)) loop
      if btrim(coalesce(v_b->>'etiqueta', '')) = '' then raise exception 'Cada banda de «%» necesita una etiqueta', v_nom; end if;
      if (v_b->>'nivel') is not null then
        begin v_niv := (v_b->>'nivel')::numeric; exception when others then v_niv := null; end;
        if v_niv is null or v_niv not in (0, 1, 2, 3, 4, 5) or v_niv = any (v_niveles) then
          raise exception 'Los niveles de «%» deben ser 0, 1, 2, 3, 4 y 5 sin repetir', v_nom;
        end if;
        v_niveles := v_niveles || v_niv;
      elsif (v_b->>'desde') is not null or (v_b->>'hasta') is not null then
        begin v_desde := (v_b->>'desde')::numeric; v_hasta := (v_b->>'hasta')::numeric; exception when others then v_desde := null; v_hasta := null; end;
        if v_desde is null or v_hasta is null or v_desde < 0 or v_desde > v_hasta or v_hasta > v_max then
          raise exception 'Los rangos de «%» deben ir de 0 hasta su máximo (%)', v_nom, v_max;
        end if;
      end if;
    end loop;
    if cardinality(v_niveles) > 0 and cardinality(v_niveles) <> 6 then
      raise exception 'Un criterio por niveles («%») necesita los 6 niveles, de 0 a 5', v_nom;
    end if;
  end loop;

  -- Pesos oficiales: Project y Writing Assessment valen 100; Writing Assessment = Task 1 (35) + Task 2 (65), todos los criterios dentro de una tarea.
  if v_tipo in ('project', 'writing_task') and v_total <> 100 then
    raise exception 'Una rúbrica de tipo % debe sumar 100 puntos (suma actual: %)', v_tipo, v_total;
  end if;
  if v_tipo = 'writing_task' then
    if v_otros > 0 then raise exception 'En Writing Assessment todos los criterios deben empezar por «Task 1 · » o «Task 2 · »'; end if;
    if v_t1 <> 35 or v_t2 <> 65 then raise exception 'Writing Assessment: Task 1 debe sumar 35 y Task 2 debe sumar 65 (actual: % y %)', v_t1, v_t2; end if;
  end if;

  if p_id is null then
    insert into public.eval_rubricas (nombre, tipo, descripcion, activa) values (v_nombre, v_tipo, v_desc, v_activa) returning id into v_id;
  else
    update public.eval_rubricas set nombre = v_nombre, tipo = v_tipo, descripcion = v_desc, activa = v_activa, updated_at = now()
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'La rúbrica no existe'; end if;
    delete from public.eval_rubrica_criterios where rubrica_id = v_id;
  end if;
  -- Los componentes que usan la rúbrica quedan apuntando a ella: se reemplazan solo los criterios (las notas ya guardan su copia).
  for v_c in select * from jsonb_array_elements(v_crit) loop
    v_orden := v_orden + 1;
    insert into public.eval_rubrica_criterios (rubrica_id, nombre, descripcion, max_puntaje, orden, bandas, niveles_mcer)
    values (v_id, btrim(v_c->>'nombre'), nullif(btrim(coalesce(v_c->>'descripcion', '')), ''), (v_c->>'max_puntaje')::numeric, v_orden,
            coalesce(v_c->'bandas', '[]'::jsonb), case when jsonb_typeof(v_c->'niveles_mcer') = 'object' then v_c->'niveles_mcer' end);
  end loop;
  return v_id;
end $$;

-- ============================================================
-- 6. Detalle de una evaluación: igual que antes, más «mcer_objetivo» (subnivel MCER del ciclo del módulo)
--    ciclo impar → primera mitad del rango del nivel · ciclo par → segunda mitad · ciclo único → el nivel completo.
--    Sin ciclo, sin nivel o sin MCER → null (la pantalla usa entonces el nivel del salón).
-- ============================================================
create or replace function public.eval_evaluacion_detalle(p_evaluacion uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_e public.eval_evaluaciones; v_salon uuid := public.eval_salon_de(p_evaluacion); v_c public.eval_componentes; v_m public.eval_modulos; v_rub jsonb := null;
  v_mcer text;
begin
  if v_salon is null then raise exception 'La evaluación no existe'; end if;
  if not public.puede_gestionar_curso(v_salon) then raise exception 'No tienes acceso a este salón' using errcode = '42501'; end if;
  select * into v_e from public.eval_evaluaciones where id = p_evaluacion;
  select * into v_c from public.eval_componentes where id = v_e.componente_id;
  select * into v_m from public.eval_modulos where id = v_e.modulo_id;
  if v_c.rubrica_id is not null then
    select jsonb_build_object('id', r.id, 'nombre', r.nombre, 'tipo', r.tipo,
             'criterios', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'nombre', k.nombre, 'descripcion', k.descripcion, 'max_puntaje', k.max_puntaje,
                                                                      'bandas', k.bandas, 'niveles_mcer', k.niveles_mcer) order by k.orden)
                                      from public.eval_rubrica_criterios k where k.rubrica_id = r.id), '[]'::jsonb))
      into v_rub from public.eval_rubricas r where r.id = v_c.rubrica_id;
  end if;
  select nullif(btrim(case ci.posicion
                        when 'impar' then (regexp_split_to_array(n.mcer, '\s*[–-]\s*'))[1]
                        when 'par' then (regexp_split_to_array(n.mcer, '\s*[–-]\s*'))[array_length(regexp_split_to_array(n.mcer, '\s*[–-]\s*'), 1)]
                        else n.mcer end), '')
    into v_mcer
    from public.ciclos ci join public.niveles n on n.id = ci.nivel_id
   where ci.numero = v_m.ciclo
   limit 1;
  return jsonb_build_object(
    'evaluacion', jsonb_build_object('id', v_e.id, 'nombre', v_e.nombre, 'unidades', to_jsonb(v_e.unidades), 'salon_id', v_salon,
                                     'modulo_id', v_m.id, 'modulo', v_m.nombre, 'componente', v_c.nombre, 'tipo', v_c.tipo, 'peso', v_c.peso,
                                     'por_tareas', exists (select 1 from public.eval_tareas_evaluacion(p_evaluacion)),
                                     'mcer_objetivo', v_mcer),
    'rubrica', v_rub,
    'alumnos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'alumno_id', a.id, 'nombre', a.nombre,
        'filas', coalesce((select jsonb_agg(jsonb_build_object(
                    'unidad', k.unidad, 'puntaje', k.puntaje, 'comentario', k.comentario, 'detalle', k.detalle, 'estado', k.estado,
                    'corregida', exists (select 1 from public.eval_historial h where h.calificacion_id = k.id)) order by k.unidad)
                  from public.eval_calificaciones k where k.evaluacion_id = p_evaluacion and k.alumno_id = a.id), '[]'::jsonb)) order by a.nombre)
      from public.alumnos a
     where a.id in (select m2.alumno_id from public.matriculas m2 where m2.salon_id = v_salon and m2.estado = 'activa'
                    union select k2.alumno_id from public.eval_calificaciones k2 where k2.evaluacion_id = p_evaluacion)), '[]'::jsonb));
end $$;

-- ============================================================
-- 7. Salvaguarda final: nada de lo que no se debía tocar cambió
-- ============================================================
do $$
declare a record; d record;
begin
  select * into a from _huella_antes;
  select
    (select count(*) from public.eval_calificaciones) as n_cal,
    (select coalesce(md5(string_agg(k.id::text || '|' || coalesce(k.puntaje::text, '') || '|' || coalesce(k.estado, '') || '|' || coalesce(k.detalle::text, '') || '|' || coalesce(k.comentario, ''), ',' order by k.id)), '') from public.eval_calificaciones k) as h_cal,
    (select count(*) from public.ejercicio_entregas) as n_ent,
    (select coalesce(md5(string_agg(e.id::text || '|' || coalesce(e.puntaje::text, '') || '|' || coalesce(e.estado, '') || '|' || coalesce(e.detalle::text, ''), ',' order by e.id)), '') from public.ejercicio_entregas e) as h_ent,
    (select count(*) from public.eval_versiones) as n_ver,
    (select coalesce(md5(string_agg(c.id::text || '|' || c.peso::text || '|' || coalesce(c.rubrica_id::text, ''), ',' order by c.id)), '') from public.eval_componentes c) as h_comp
    into d;
  if a.n_cal <> d.n_cal or a.h_cal <> d.h_cal then raise exception 'ABORTADO: eval_calificaciones cambió durante la migración'; end if;
  if a.n_ent <> d.n_ent or a.h_ent <> d.h_ent then raise exception 'ABORTADO: ejercicio_entregas cambió durante la migración'; end if;
  if a.n_ver <> d.n_ver or a.h_comp <> d.h_comp then raise exception 'ABORTADO: el Grade Chart (versiones o componentes) cambió durante la migración'; end if;
  if (select count(*) from public.eval_rubrica_criterios c join public.eval_rubricas r on r.id = c.rubrica_id where lower(btrim(r.nombre)) = 'project') <> 7 then
    raise exception 'ABORTADO: Project debe quedar con 7 criterios';
  end if;
  if (select sum(max_puntaje) from public.eval_rubrica_criterios c join public.eval_rubricas r on r.id = c.rubrica_id where lower(btrim(r.nombre)) = 'project') <> 100 then
    raise exception 'ABORTADO: Project debe sumar 100';
  end if;
end $$;

commit;
