-- UNIVERSA · Descriptores por nivel de desempeño para Writing, Speaking y SPARK Homework.
-- Mismo formato que la rúbrica «Project» (20261205100000): cada criterio lleva bandas con rango y descriptor, y la pantalla de calificación
-- muestra el descriptor de la banda que corresponde al puntaje escrito (y adapta «the student's CEFR level» al nivel MCER del salón).
-- Solo ACTUALIZA bandas y descripción de los criterios existentes (por nombre): los ids no cambian, así que las notas ya guardadas no se tocan.
-- Los descriptores son una propuesta general de UNIVERSA (no una rúbrica oficial MCER); se pueden ajustar luego en Evaluaciones → Rúbricas.
-- Repetible. Si una rúbrica o un criterio fue renombrado a mano, ese criterio se omite y se avisa con un NOTICE.

do $$
declare
  r record; v_n integer;
begin
  for r in
    select * from (values
      -- ===== Writing: 5 criterios de 20 · Low 0–8 / Fair 9–15 / Excellent 16–20 =====
      ('writing', 'Content / Ideas', 'Relevance, development and completeness of ideas in relation to the task.', 20, 8, 15,
        'Ideas are mostly irrelevant, undeveloped or missing parts of the task. The text is too short or hard to follow.',
        'Ideas are relevant and cover most of the task, though some are underdeveloped or repetitive.',
        'Ideas are relevant, well developed and fully cover the task. The text meets the length and purpose required for the student''s CEFR level.'),
      ('writing', 'Coherence and cohesion', 'Organisation of the text and linking of ideas.', 20, 8, 15,
        'Little organisation. Ideas are disconnected and linkers are missing or misused.',
        'Basic organisation is visible (e.g. beginning, middle, end). Uses simple linkers, sometimes repetitively or incorrectly.',
        'Clearly organised and easy to follow. Uses a suitable range of linkers and paragraphing for the student''s CEFR level.'),
      ('writing', 'Grammar', 'Accuracy and range of grammar for the student''s CEFR level.', 20, 8, 15,
        'Frequent grammatical errors often interfere with understanding. Target structures are rarely used or used incorrectly.',
        'Uses basic and some target structures with reasonable accuracy. Errors are noticeable but usually do not prevent understanding.',
        'Consistent and accurate use of grammar appropriate to the student''s CEFR level. Target structures are used naturally. Errors are rare.'),
      ('writing', 'Spelling and punctuation', 'Correct spelling, capitalisation and punctuation.', 20, 8, 15,
        'Frequent spelling and punctuation errors make the text hard to read.',
        'Some spelling and punctuation errors, but the text is generally readable.',
        'Spelling, capitalisation and punctuation are accurate, with only occasional slips.'),
      ('writing', 'Vocabulary', 'Range and precision of vocabulary for the student''s CEFR level.', 20, 8, 15,
        'Vocabulary is very limited, repetitive or often inaccurate. Word choice problems affect understanding.',
        'Adequate range of vocabulary with some repetition or inaccuracy. Meaning is generally clear.',
        'Wide and accurate range of vocabulary for the student''s CEFR level. Words are chosen precisely, with little repetition.')
    ) t(tipo, criterio, descripcion, max, tope_low, tope_fair, d_low, d_fair, d_exc)
  loop
    update public.eval_rubrica_criterios c
       set descripcion = r.descripcion,
           bandas = jsonb_build_array(
             jsonb_build_object('etiqueta', 'Low', 'desde', 0, 'hasta', r.tope_low, 'descripcion', r.d_low),
             jsonb_build_object('etiqueta', 'Fair', 'desde', r.tope_low + 1, 'hasta', r.tope_fair, 'descripcion', r.d_fair),
             jsonb_build_object('etiqueta', 'Excellent', 'desde', r.tope_fair + 1, 'hasta', r.max, 'descripcion', r.d_exc))
      from public.eval_rubricas ru
     where c.rubrica_id = ru.id and ru.activa and lower(btrim(ru.nombre)) = r.tipo and lower(btrim(c.nombre)) = lower(r.criterio);
    get diagnostics v_n = row_count;
    if v_n = 0 then raise notice 'Writing: criterio «%» no encontrado, se omite', r.criterio; end if;
  end loop;

  -- ===== Speaking: 5 criterios de 10 · Bajo 0–3 / Regular 4–5 / Bueno 6–7 / Excelente 8–10 (las 4 bandas que ya tenía) =====
  for r in
    select * from (values
      ('speaking', 'Communicative ability', 'Length of utterances and flexibility to communicate.',
        'Only isolated words or very short phrases. Needs constant help to communicate.',
        'Short, simple sentences. Communication is often interrupted by hesitation or the need for repetition.',
        'Connects ideas into longer utterances. Communicates the main message with only occasional hesitation.',
        'Speaks at length and communicates flexibly and effectively for the student''s CEFR level, adapting to the listener.'),
      ('speaking', 'Accuracy/grammar', 'Accuracy and appropriateness of grammar.',
        'Frequent errors that often prevent understanding.',
        'Basic structures are mostly correct, but errors are frequent and sometimes affect meaning.',
        'Good control of the structures expected at the student''s CEFR level. Errors are noticeable but do not affect meaning.',
        'Accurate and appropriate use of grammar for the student''s CEFR level. Errors are rare and do not affect communication.'),
      ('speaking', 'Vocabulary', 'Variety and choice of words and phrases.',
        'Very limited vocabulary; frequent wrong or missing words.',
        'Basic vocabulary, repetitive. Some wrong word choices.',
        'Adequate and varied vocabulary for the topic, with some imprecision.',
        'Wide and precise vocabulary for the student''s CEFR level, used naturally with little repetition.'),
      ('speaking', 'Pronunciation', 'Intonation, stress and sounds. A native-like accent is not required.',
        'Pronunciation often makes the message hard to understand.',
        'Understandable with effort. Frequent errors in sounds, stress or intonation.',
        'Generally clear. Some errors that rarely require extra effort from the listener.',
        'Consistently clear and intelligible. Stress and intonation support meaning.'),
      ('speaking', 'Content', 'Development of the topic, organisation, coherence and cohesion.',
        'Little or no relevant content. Ideas are not organised.',
        'Some relevant ideas, little development or organisation.',
        'Relevant, mostly organised and connected ideas, with some development.',
        'Fully relevant, well developed and clearly organised. Ideas are logically connected.')
    ) t(tipo, criterio, descripcion, d_bajo, d_regular, d_bueno, d_exc)
  loop
    update public.eval_rubrica_criterios c
       set descripcion = r.descripcion,
           bandas = jsonb_build_array(
             jsonb_build_object('etiqueta', 'Bajo', 'desde', 0, 'hasta', 3, 'descripcion', r.d_bajo),
             jsonb_build_object('etiqueta', 'Regular', 'desde', 4, 'hasta', 5, 'descripcion', r.d_regular),
             jsonb_build_object('etiqueta', 'Bueno', 'desde', 6, 'hasta', 7, 'descripcion', r.d_bueno),
             jsonb_build_object('etiqueta', 'Excelente', 'desde', 8, 'hasta', 10, 'descripcion', r.d_exc))
      from public.eval_rubricas ru
     where c.rubrica_id = ru.id and ru.activa and lower(btrim(ru.nombre)) = r.tipo and lower(btrim(c.nombre)) = lower(r.criterio);
    get diagnostics v_n = row_count;
    if v_n = 0 then raise notice 'Speaking: criterio «%» no encontrado, se omite', r.criterio; end if;
  end loop;

  -- ===== SPARK Homework (nota manual del docente, 0 a 5 por unidad) =====
  update public.eval_rubrica_criterios c
     set bandas = jsonb_build_array(
           jsonb_build_object('etiqueta', 'Low', 'desde', 0, 'hasta', 2, 'descripcion', 'Little or no SPARK work completed in the unit, or most activities left unfinished.'),
           jsonb_build_object('etiqueta', 'Fair', 'desde', 3, 'hasta', 3, 'descripcion', 'About half of the SPARK activities completed, or completed with low scores.'),
           jsonb_build_object('etiqueta', 'Good', 'desde', 4, 'hasta', 4, 'descripcion', 'Most SPARK activities completed with good results.'),
           jsonb_build_object('etiqueta', 'Excellent', 'desde', 5, 'hasta', 5, 'descripcion', 'All SPARK activities completed on time with strong results.'))
    from public.eval_rubricas ru
   where c.rubrica_id = ru.id and lower(btrim(ru.nombre)) = lower('Formative Assessment · elementos') and c.nombre = 'SPARK Homework';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise notice 'SPARK Homework: criterio no encontrado, se omite'; end if;
end $$;
