-- UNIVERSA · Project Assessment: nueva rúbrica con descriptores Low / Fair / Excellent.
-- 5 criterios principales, 6 campos de calificación, 10 + 20 + 20 + (15 + 10) + 25 = 100.
-- «Discourse Fluency & Pronunciation» (25) = Fluency (15) + Pronunciation (10): el prefijo común hace que la pantalla los agrupe y sume.
-- UNIVERSA está en desarrollo: se REEMPLAZAN directamente los criterios de la rúbrica «Project» (sin versionado histórico).
-- Las notas de prueba ya guardadas conservan su copia de criterios en eval_calificaciones.detalle y no se tocan.
-- Los descriptores son una propuesta general de UNIVERSA (no una rúbrica oficial MCER) y se pueden ajustar luego por nivel (A1–C1) en Evaluaciones → Rúbricas.
-- Repetible: si ya se ejecutó la versión anterior de esta migración, la rúbrica «Project» activa es la que se actualiza.

do $$
declare v_r uuid;
begin
  select id into v_r from public.eval_rubricas where lower(btrim(nombre)) = 'project' and activa order by created_at desc limit 1;
  if v_r is null then
    insert into public.eval_rubricas (nombre, tipo, descripcion) values ('Project', 'project', 'x') returning id into v_r;
  end if;

  update public.eval_rubricas
     set descripcion = 'Project Assessment: 5 criterios (Discourse se divide en 2 campos), 100 puntos. Discourse Fluency & Pronunciation = Fluency (15) + Pronunciation (10).', updated_at = now()
   where id = v_r;

  delete from public.eval_rubrica_criterios where rubrica_id = v_r;
  insert into public.eval_rubrica_criterios (rubrica_id, nombre, descripcion, max_puntaje, orden, bandas)
  select v_r, t.n, t.d, t.m, t.o, t.b
    from (values
    (1, 'Visual Material & Non-Verbal Skills', 'Effective use of visual aids, eye contact, posture, confidence and delivery.', 10::numeric, '[{"etiqueta": "Low", "desde": 0, "hasta": 4, "descripcion": "Visual materials are unclear, irrelevant, or poorly connected to the presentation. Limited eye contact, closed posture, and heavy reliance on reading or notes."}, {"etiqueta": "Fair", "desde": 5, "hasta": 7, "descripcion": "Visual materials are generally relevant and support the presentation, though with some weaknesses. Eye contact, posture, and confidence are acceptable but inconsistent."}, {"etiqueta": "Excellent", "desde": 8, "hasta": 10, "descripcion": "Visual materials are clear, relevant, and effectively support the presentation. Maintains good eye contact, confident posture, and a natural, engaging delivery with minimal reliance on notes."}]'::jsonb),
    (2, 'Grammar Accuracy & Target Structures', 'Accuracy and range of grammar and use of the target structures for the student''s CEFR level.', 20::numeric, '[{"etiqueta": "Low", "desde": 0, "hasta": 8, "descripcion": "Frequent grammatical errors often interfere with understanding. Target structures are rarely used or used incorrectly for the student''s CEFR level."}, {"etiqueta": "Fair", "desde": 9, "hasta": 15, "descripcion": "Uses basic and some target structures with reasonable accuracy. Errors are noticeable but usually do not prevent understanding for the student''s CEFR level."}, {"etiqueta": "Excellent", "desde": 16, "hasta": 20, "descripcion": "Demonstrates consistent and accurate use of grammatical structures appropriate to the student''s CEFR level. Target structures are used naturally and effectively. Errors are rare and do not affect communication."}]'::jsonb),
    (3, 'Vocabulary Range & Resource', 'Range, precision and appropriateness of vocabulary for the student''s CEFR level.', 20::numeric, '[{"etiqueta": "Low", "desde": 0, "hasta": 8, "descripcion": "Vocabulary is very limited, repetitive, or often inaccurate for the student''s CEFR level. Frequent word choice problems affect understanding."}, {"etiqueta": "Fair", "desde": 9, "hasta": 15, "descripcion": "Uses an adequate range of vocabulary for the student''s CEFR level, with some repetition or inaccuracy. Meaning is generally clear."}, {"etiqueta": "Excellent", "desde": 16, "hasta": 20, "descripcion": "Uses a wide and accurate range of vocabulary appropriate to the student''s CEFR level. Words and expressions are chosen precisely, with little repetition."}]'::jsonb),
    (4, 'Discourse Fluency & Pronunciation · Fluency', 'Continuity of speech, pace, natural pauses and linking of ideas.', 15::numeric, '[{"etiqueta": "Low", "desde": 0, "hasta": 6, "descripcion": "Speech is frequently interrupted by long pauses, hesitations, or restarts. Ideas are difficult to follow."}, {"etiqueta": "Fair", "desde": 7, "hasta": 11, "descripcion": "Speech is generally continuous, with some hesitation or pauses. Ideas are mostly connected and understandable."}, {"etiqueta": "Excellent", "desde": 12, "hasta": 15, "descripcion": "Speech flows smoothly with natural pace and only occasional, natural pauses. Ideas are clearly connected and easy to follow."}]'::jsonb),
    (5, 'Discourse Fluency & Pronunciation · Pronunciation', 'Intelligibility, articulation, stress and intonation. A native-like accent is not required.', 10::numeric, '[{"etiqueta": "Low", "desde": 0, "hasta": 4, "descripcion": "Pronunciation often makes the message difficult to understand. Frequent errors in sounds, stress, or intonation."}, {"etiqueta": "Fair", "desde": 5, "hasta": 7, "descripcion": "Pronunciation is generally understandable, with some errors that occasionally require extra effort from the listener."}, {"etiqueta": "Excellent", "desde": 8, "hasta": 10, "descripcion": "Pronunciation is consistently clear and intelligible. Stress and intonation support meaning. A native-like accent is not required."}]'::jsonb),
    (6, 'Interaction & Communicative Effectiveness', 'Understanding and responding to questions appropriate to the student''s CEFR level and keeping the interaction going.', 25::numeric, '[{"etiqueta": "Low", "desde": 0, "hasta": 10, "descripcion": "Has significant difficulty understanding or responding to questions appropriate to the student''s CEFR level. Answers are very short, unclear, or off-topic."}, {"etiqueta": "Fair", "desde": 11, "hasta": 18, "descripcion": "Understands and responds to most questions appropriate to the student''s CEFR level, sometimes needing repetition or support. Answers are relevant but not always developed."}, {"etiqueta": "Excellent", "desde": 19, "hasta": 25, "descripcion": "Understands questions appropriate to the student''s CEFR level and responds spontaneously, clearly, and relevantly. Develops ideas and keeps the interaction going."}]'::jsonb)
    ) t(o, n, d, m, b);

  -- Todos los componentes Project (cualquier versión, incluidas las que usaban una rúbrica anterior o «legacy») pasan a la rúbrica nueva.
  update public.eval_componentes set rubrica_id = v_r where tipo = 'project' and rubrica_id is distinct from v_r;

  if (select sum(max_puntaje) from public.eval_rubrica_criterios where rubrica_id = v_r) <> 100 then
    raise exception 'La rúbrica Project debe sumar 100';
  end if;
end $$;
