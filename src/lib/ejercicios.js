// Banco de ejercicios: tipos, compilación (autoría → lo que ve el estudiante + clave), prompts para IA y lectura de su respuesta.
// La calificación real la hace Supabase (entregar_ejercicio); aquí solo se prepara el material.

export const TIPOS = [
  { id: 'multiple_choice', label: 'Multiple choice', desc: 'Questions with 4 options and one correct answer', icono: 'list', tono: 'brand', auto: true },
  { id: 'fill_gap', label: 'Fill in the gap', desc: 'Sentences with gaps to fill in', icono: 'pen', tono: 'peach', auto: true },
  { id: 'matching', label: 'Matching', desc: 'Match each item with its pair', icono: 'link', tono: 'brand', auto: true },
  { id: 'order_sentences', label: 'Order sentences', desc: 'Put the words in order to form the sentence', icono: 'switch', tono: 'peach', auto: true },
  { id: 'reading', label: 'Reading', desc: 'A text with true / false, questions and gap-fill', icono: 'book', tono: 'brand', auto: true },
  { id: 'listening', label: 'Listening', desc: 'A Drive audio with multiple-choice questions', icono: 'headphones', tono: 'peach', auto: true },
  { id: 'writing', label: 'Writing', desc: 'Free written answer, reviewed by the teacher', icono: 'pencil', tono: 'brand', auto: false },
  { id: 'speaking', label: 'Speaking', desc: 'The student records their voice, reviewed by the teacher', icono: 'mic', tono: 'peach', auto: false },
]
export const tipoDe = (id) => TIPOS.find((t) => t.id === id)
export const esManual = (tipo) => tipo === 'writing' || tipo === 'speaking'
// Writing Assessment: examen de dos tareas (Task 1 y Task 2) con tiempo límite y un solo intento. Es un Writing con modo = 'assessment'.
export const esExamen = (d) => d?.modo === 'assessment'
export const TAREAS_EXAMEN = ['Task 1', 'Task 2']
export const datosExamen = (anteriores = {}) => ({
  modo: 'assessment',
  instrucciones: anteriores.instrucciones ?? '',
  minutos: 60,
  tareas: [
    { genero: '', consigna: '', min_palabras: 80 },
    { genero: '', consigna: '', min_palabras: 150 },
  ],
})
export const NIVELES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

// Clasificación del banco (ver lib/curriculo.js): al elegir nivel y unidad se deducen ciclo (0 al 12), módulo (1 al 4) y nivel MCER.
export const CICLOS = Array.from({ length: 13 }, (_, i) => i)
export const MODULOS = [1, 2, 3, 4]
export const UNIDADES = Array.from({ length: 12 }, (_, i) => i + 1)
export const USOS = [
  { id: 'formative', label: 'Formative' },
  { id: 'assessment', label: 'Assessment' },
]
export const usoLabel = (id) => USOS.find((u) => u.id === id)?.label ?? ''
// «Cycle 3 · Module 1 · Unit 5 · Formative» (solo lo que esté definido; el ciclo 0 es válido).
const hay = (v) => v !== null && v !== undefined && v !== ''
export const clasificacionTexto = (e) => [hay(e.ciclo) ? `Cycle ${e.ciclo}` : '', e.modulo ? `Module ${e.modulo}` : '', e.unidad ? `Unit ${e.unidad}` : '', usoLabel(e.uso)].filter(Boolean).join(' · ')
// Para guardar: Formative pide nivel + unidad (de ahí salen ciclo, módulo y MCER); Assessment nivel + ciclo + módulo (sin unidad).
// Devuelve el mensaje de lo que falta ('' si está completo).
export function faltaClasificacion(m) {
  const campos = m.uso === 'assessment' ? [['programa', 'level'], ['ciclo', 'cycle'], ['modulo', 'module'], ['uso', 'use (Formative or Assessment)']] : [['programa', 'level'], ['unidad', 'unit'], ['uso', 'use (Formative or Assessment)']]
  const faltan = campos.filter(([k]) => !String(m[k] ?? '').trim()).map(([, t]) => t)
  return faltan.length ? `Choose the ${faltan.join(', ')} before saving` : ''
}

export const TONOS = {
  brand: 'bg-brand-100 text-brand-700',
  peach: 'bg-peach-100 text-peach-700',
}

const LETRAS = 'ABCDEFGH'
const texto = (v) => String(v ?? '').trim()

// ------------------------------------------------------------
// Datos de partida para el editor
// ------------------------------------------------------------
// Reading: cada ítem tiene una forma: 'tf' (true / false), 'choice' (pregunta con opciones) o 'gap' (completar con [[ ]] según el texto).
export const FORMAS_LECTURA = [
  { id: 'tf', label: 'True / False' },
  { id: 'choice', label: 'Question' },
  { id: 'gap', label: 'Fill in the gap' },
]
export const formaDe = (a, def = 'tf') => a?.forma ?? def
// Reading y Listening comparten los ítems mixtos. Listening heredó preguntas sin `forma`, que son de opción múltiple.
export const formaPorDefecto = (tipo) => (tipo === 'listening' ? 'choice' : 'tf')
export const itemLectura = (forma) =>
  forma === 'choice' ? { forma, enunciado: '', opciones: ['', '', '', ''], correcta: 0 } : forma === 'gap' ? { forma, texto: '' } : { forma: 'tf', enunciado: '', verdadero: true }
const preguntaVacia = () => ({ enunciado: '', opciones: ['', '', '', ''], correcta: 0 })
export function datosVacios(tipo) {
  switch (tipo) {
    case 'multiple_choice':
      return { instrucciones: 'Choose the correct option.', preguntas: [preguntaVacia()] }
    case 'listening':
      return { instrucciones: 'Listen to the audio and choose the correct option.', audio_url: '', preguntas: [preguntaVacia()] }
    case 'fill_gap':
      return { instrucciones: 'Complete the sentences.', oraciones: [{ texto: '' }] }
    case 'matching':
      return { instrucciones: 'Match each item with its pair.', pares: [{ izq: '', der: '' }, { izq: '', der: '' }] }
    case 'order_sentences':
      return { instrucciones: 'Put the words in the correct order.', oraciones: [''] }
    case 'reading':
      return { instrucciones: 'Read the text and answer the questions.', texto: '', afirmaciones: [itemLectura('tf')] }
    case 'writing':
      return { instrucciones: '', consigna: '', min_palabras: 80 }
    case 'speaking':
      return { instrucciones: '', consigna: '', segundos_max: 90 }
    default:
      return {}
  }
}
export const itemVacio = (tipo) =>
  ({
    multiple_choice: preguntaVacia(),
    listening: preguntaVacia(),
    fill_gap: { texto: '' },
    matching: { izq: '', der: '' },
    order_sentences: '',
    reading: itemLectura('tf'),
  })[tipo]
// Nombre de la lista de elementos dentro de `datos` (null si el tipo no tiene lista).
export const claveLista = (tipo) =>
  ({ multiple_choice: 'preguntas', listening: 'preguntas', fill_gap: 'oraciones', matching: 'pares', order_sentences: 'oraciones', reading: 'afirmaciones' })[tipo] ?? null

// ------------------------------------------------------------
// Drive: enlace para escuchar el audio dentro de la página
// ------------------------------------------------------------
export function audioDriveEmbed(url) {
  const m = String(url ?? '').trim().match(/^https:\/\/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]+)/)
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : null
}

// ------------------------------------------------------------
// Validación de lo que se edita
// ------------------------------------------------------------
function validarMixtos(lista, def) {
  for (const [i, a] of lista.entries()) {
    const f = formaDe(a, def)
    if (f === 'gap') {
      if (!/\[\[[^\]]+\]\]/.test(a.texto ?? '')) return `Item ${i + 1} needs a gap: write the answer between [[ ]]`
    } else if (!texto(a.enunciado)) return `Item ${i + 1} is empty`
    else if (f === 'choice') {
      if (a.opciones.filter((o) => texto(o)).length < 2) return `Item ${i + 1} needs at least 2 options`
      if (!texto(a.opciones[a.correcta])) return `Mark an option that has text as correct in item ${i + 1}`
    }
  }
  return ''
}

export function validar(tipo, d) {
  const lista = claveLista(tipo)
  if (lista && (!Array.isArray(d[lista]) || d[lista].length === 0)) return 'Add at least one item'
  switch (tipo) {
    case 'listening':
      if (!audioDriveEmbed(d.audio_url)) return 'Paste a Google Drive link pointing to the audio (shared with anyone who has the link)'
      return validarMixtos(d.preguntas, 'choice')
    case 'multiple_choice': {
      for (const [i, p] of d.preguntas.entries()) {
        if (!texto(p.enunciado)) return `Question ${i + 1} has no text`
        const llenas = p.opciones.filter((o) => texto(o))
        if (llenas.length < 2) return `Question ${i + 1} needs at least 2 options`
        if (!texto(p.opciones[p.correcta])) return `Mark an option that has text as correct in question ${i + 1}`
      }
      return ''
    }
    case 'fill_gap':
      for (const [i, o] of d.oraciones.entries()) if (!/\[\[[^\]]+\]\]/.test(o.texto ?? '')) return `Sentence ${i + 1} needs a gap: write the answer between [[ ]]`
      return ''
    case 'matching':
      if (d.pares.length < 2) return 'A matching exercise needs at least 2 pairs'
      for (const [i, p] of d.pares.entries()) if (!texto(p.izq) || !texto(p.der)) return `Fill in both sides of pair ${i + 1}`
      return ''
    case 'order_sentences':
      for (const [i, o] of d.oraciones.entries()) if (texto(o).split(/\s+/).filter(Boolean).length < 3) return `Sentence ${i + 1} must have at least 3 words`
      return ''
    case 'reading':
      if (!texto(d.texto)) return 'The reading text is missing'
      return validarMixtos(d.afirmaciones, 'tf')
    case 'writing':
      if (esExamen(d)) {
        const m = Number(d.minutos)
        if (!Number.isFinite(m) || m < 5 || m > 240) return 'The time limit must be between 5 and 240 minutes'
        for (const [i, t] of (d.tareas ?? []).entries()) if (!texto(t.consigna)) return `Write the prompt for Task ${i + 1}`
        return (d.tareas ?? []).length === 2 ? '' : 'A Writing Assessment has exactly two tasks'
      }
      return texto(d.consigna) ? '' : 'Escribe la consigna para el estudiante'
    case 'speaking':
      return texto(d.consigna) ? '' : 'Escribe la consigna para el estudiante'
    default:
      return 'Invalid exercise type'
  }
}

// ------------------------------------------------------------
// Compilar: datos de autoría → { contenido (sin respuestas), clave }
// ------------------------------------------------------------
function semilla(s) {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)), ((h ^= h >>> 16) >>> 0) / 4294967296)
}
// Mezcla estable (misma entrada → mismo orden) que garantiza no devolver el orden original.
function mezclar(lista, clave) {
  if (lista.length < 2) return [...lista]
  const rnd = semilla(clave)
  for (let intento = 0; intento < 8; intento++) {
    const a = [...lista]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    if (a.some((x, i) => x !== lista[i])) return a
  }
  return [...lista.slice(1), lista[0]]
}

// Ítems mixtos (true/false, pregunta con opciones, completar) → contenido sin respuestas + clave plana (un elemento por respuesta).
function compilarMixtos(lista, def) {
  const items = []
  const contenido = lista.map((a) => {
    const f = formaDe(a, def)
    if (f === 'gap') {
      const g = compilar('fill_gap', { instrucciones: '', oraciones: [{ texto: a.texto }] })
      items.push(...g.clave.items)
      return { forma: 'gap', partes: g.contenido.oraciones[0].partes }
    }
    if (f === 'choice') {
      const c = compilar('multiple_choice', { instrucciones: '', preguntas: [a] })
      items.push(...c.clave.items)
      return { forma: 'choice', ...c.contenido.preguntas[0] }
    }
    items.push([a.verdadero ? 'true' : 'false'])
    return { forma: 'tf', enunciado: texto(a.enunciado) }
  })
  return { contenido, items }
}

export function compilar(tipo, d) {
  const instrucciones = texto(d.instrucciones)
  switch (tipo) {
    case 'listening': {
      const m = compilarMixtos(d.preguntas, 'choice')
      return { contenido: { instrucciones, preguntas: m.contenido, audio_url: texto(d.audio_url) }, clave: { items: m.items } }
    }
    case 'multiple_choice': {
      const ps = d.preguntas.map((p) => {
        const opciones = p.opciones.map((o, i) => ({ o: texto(o), i })).filter((x) => x.o)
        return { enunciado: texto(p.enunciado), opciones: opciones.map((x) => x.o), correcta: opciones.findIndex((x) => x.i === p.correcta) }
      })
      const base = { instrucciones, preguntas: ps.map((p) => ({ enunciado: p.enunciado, opciones: p.opciones })) }
      return {
        contenido: base,
        clave: { items: ps.map((p) => [String(p.correcta)]) },
      }
    }
    case 'fill_gap': {
      const items = []
      const oraciones = d.oraciones.map((o) => {
        const partes = []
        let resto = o.texto
        for (const m of o.texto.matchAll(/\[\[([^\]]+)\]\]/g)) {
          const i = resto.indexOf(m[0])
          partes.push(resto.slice(0, i))
          resto = resto.slice(i + m[0].length)
          items.push(m[1].split('|').map(texto).filter(Boolean))
        }
        partes.push(resto)
        return { partes }
      })
      return { contenido: { instrucciones, oraciones }, clave: { items } }
    }
    case 'matching': {
      const pares = d.pares.map((p) => ({ izq: texto(p.izq), der: texto(p.der) }))
      return {
        contenido: { instrucciones, izquierda: pares.map((p) => p.izq), opciones: mezclar([...new Set(pares.map((p) => p.der))], pares.map((p) => p.izq + p.der).join('|')) },
        clave: { items: pares.map((p) => [p.der]) },
      }
    }
    case 'order_sentences': {
      const frases = d.oraciones.map(texto).filter(Boolean)
      return {
        contenido: { instrucciones, oraciones: frases.map((f) => ({ palabras: mezclar(f.split(/\s+/), f) })) },
        clave: { items: frases.map((f) => [f]) },
      }
    }
    case 'reading': {
      const m = compilarMixtos(d.afirmaciones, 'tf')
      return { contenido: { instrucciones, texto: String(d.texto ?? '').replace(/\r/g, '').trim(), afirmaciones: m.contenido }, clave: { items: m.items } }
    }
    case 'writing':
      if (esExamen(d)) {
        return {
          contenido: {
            modo: 'assessment',
            instrucciones,
            minutos: Number(d.minutos) || 60,
            tareas: d.tareas.map((t) => ({ genero: texto(t.genero), consigna: texto(t.consigna), min_palabras: Number(t.min_palabras) || 0 })),
          },
          clave: null,
        }
      }
      return { contenido: { instrucciones, consigna: texto(d.consigna), min_palabras: Number(d.min_palabras) || 0 }, clave: null }
    case 'speaking':
      return { contenido: { instrucciones, consigna: texto(d.consigna), segundos_max: Number(d.segundos_max) || 90 }, clave: null }
    default:
      throw new Error('Invalid exercise type')
  }
}

// Cuántas preguntas / espacios / piezas tiene un ejercicio (para las tarjetas).
export function cantidadItems(tipo, d) {
  const l = claveLista(tipo)
  if (!l) return null
  if (tipo === 'fill_gap') return d.oraciones.reduce((n, o) => n + (String(o.texto).match(/\[\[/g)?.length ?? 0), 0)
  if (tipo === 'reading' || tipo === 'listening') return d[l].reduce((n, a) => n + (formaDe(a, formaPorDefecto(tipo)) === 'gap' ? String(a.texto ?? '').match(/\[\[/g)?.length ?? 0 : 1), 0)
  return d[l]?.length ?? 0
}

// ------------------------------------------------------------
// Prompt to use with an AI (ChatGPT, Claude, Gemini…)
// ------------------------------------------------------------
const ESQUEMAS = {
  multiple_choice: `{
  "titulo": "…",
  "instrucciones": "…",
  "preguntas": [
    { "enunciado": "…", "opciones": ["…", "…", "…", "…"], "correcta": 0 }
  ]
}`,
  listening: `{
  "titulo": "…",
  "instrucciones": "…",
  "preguntas": [
    { "forma": "choice", "enunciado": "…?", "opciones": ["…", "…", "…", "…"], "correcta": 0 },
    { "forma": "tf", "enunciado": "…", "verdadero": true },
    { "forma": "gap", "texto": "The speaker [[travelled]] to Spain last summer." }
  ]
}`,
  fill_gap: `{
  "titulo": "…",
  "instrucciones": "…",
  "oraciones": [
    { "texto": "She [[goes]] to school every day." },
    { "texto": "They [[are|'re]] playing football right now." }
  ]
}`,
  matching: `{
  "titulo": "…",
  "instrucciones": "…",
  "pares": [
    { "izq": "…", "der": "…" }
  ]
}`,
  order_sentences: `{
  "titulo": "…",
  "instrucciones": "…",
  "oraciones": ["She goes to school every day.", "…"]
}`,
  reading: `{
  "titulo": "…",
  "instrucciones": "…",
  "texto": "Title of the text\n\nFirst paragraph…\n\nSecond paragraph…\n\nThird paragraph…",
  "afirmaciones": [
    { "forma": "tf", "enunciado": "…", "verdadero": true },
    { "forma": "choice", "enunciado": "…?", "opciones": ["…", "…", "…", "…"], "correcta": 0 },
    { "forma": "gap", "texto": "The writer [[travelled]] to Spain last summer." }
  ]
}`,
  writing: `{
  "titulo": "…",
  "instrucciones": "…",
  "consigna": "…",
  "min_palabras": 80
}`,
  speaking: `{
  "titulo": "…",
  "instrucciones": "…",
  "consigna": "…",
  "segundos_max": 90
}`,
}

// «exactly 5» o, si no se indicó cantidad (captura de referencia), «as many as the screenshot shows».
const cuantas = (p, cosa) => (p.cantidad ? `exactly ${p.cantidad} ${cosa}` : `the same number of ${cosa} as the screenshot shows`)

const FORMA_PROMPT = {
  tf: '"tf" (a statement to mark true or false; "verdadero" is true or false)',
  choice: '"choice" (a comprehension question with 4 options and ONE correct one; "correcta" is the index starting at 0)',
  gap: '"gap" (a sentence that summarises the text with the missing word or phrase between double square brackets: [[answer]]; separate valid alternatives with |)',
}
const formasLectura = (p) => {
  if (p.imagen && p.formasAuto !== false) {
    return `Follow the screenshot: for each item use the form that matches what the exercise in the screenshot shows (${Object.values(FORMA_PROMPT).join('; ')}). If the screenshot has several kinds of tasks, include each one; if it has only one kind, use only that kind. Set "forma" in each item.`
  }
  const f = (p.formas?.length ? p.formas : ['tf', 'choice', 'gap']).filter((x) => FORMA_PROMPT[x])
  return f.length === 1 ? `Use ONLY the form ${FORMA_PROMPT[f[0]]}; set "forma" to "${f[0]}" in every item.` : `Use ONLY these forms, in similar amounts: ${f.map((x) => FORMA_PROMPT[x]).join(', ')}. Set "forma" in each item.`
}

// Plantillas por tipo de ejercicio: el docente elige el formato y la IA lo rellena con el tema (o con la captura del libro).
// `estructura` va al prompt; `palabras` (solo Writing) es el mínimo sugerido.
export const PLANTILLAS = {
  writing: [
    { id: 'email', label: 'Email / letter', desc: 'Informal or formal message to someone', palabras: 80, estructura: 'The student writes an email or letter: greeting, opening line saying why they write, 2 or 3 points to cover (one per paragraph), closing line and sign-off.' },
    { id: 'message', label: 'Short message', desc: 'Text, note, invitation or post', palabras: 40, estructura: 'The student writes a short message (text, note, invitation or social media post) of 3 to 5 lines with a clear purpose and 2 or 3 things to mention.' },
    { id: 'paragraph', label: 'Paragraph', desc: 'One organised paragraph on a topic', palabras: 70, estructura: 'The student writes a single organised paragraph: topic sentence, 2 or 3 supporting details with examples, and a closing sentence.' },
    { id: 'opinion', label: 'Opinion essay', desc: 'Give an opinion with reasons', palabras: 120, estructura: 'The student writes an opinion text: introduction stating the opinion, 2 reasons with examples (one paragraph each), and a conclusion.' },
    { id: 'description', label: 'Description', desc: 'Describe a person, place or object', palabras: 80, estructura: 'The student describes a person, place or object: general presentation, 3 or 4 details (appearance, features, feelings) and a personal comment.' },
    { id: 'story', label: 'Story / narrative', desc: 'Tell what happened', palabras: 100, estructura: 'The student writes a narrative: setting (when, where, who), the events in order with linking words, and how it ended.' },
    { id: 'compare', label: 'Compare and contrast', desc: 'Similarities and differences', palabras: 100, estructura: 'The student compares two things: introduce both, 2 or 3 similarities and differences, and a conclusion saying which they prefer and why.' },
    { id: 'review', label: 'Review', desc: 'Recommend a film, place, book…', palabras: 100, estructura: 'The student writes a review: what it is, what they liked, what they did not like, and a recommendation with a rating.' },
    { id: 'profile', label: 'About me / profile', desc: 'Introduce yourself or someone', palabras: 60, estructura: 'The student writes a short profile: name and where from, family or work/studies, routines and free time, and plans or dreams.' },
  ],
  speaking: [
    { id: 'about', label: 'Talk about yourself', desc: 'Routines, family, likes', estructura: 'The student talks about themselves or their life on a given topic, mentioning 3 or 4 points.' },
    { id: 'describe', label: 'Describe a person or place', desc: 'Say what it is like', estructura: 'The student describes a person, place or object in detail: what it looks like, where it is, and what they think about it.' },
    { id: 'roleplay', label: 'Role-play', desc: 'A real-life situation', estructura: 'The student plays a role in a real-life situation (shop, restaurant, hotel, phone call…) and says what they would say, including questions and polite expressions.' },
    { id: 'opinion', label: 'Give an opinion', desc: 'Say what you think and why', estructura: 'The student gives and justifies an opinion: states it, gives 2 reasons with examples, and finishes with a conclusion.' },
    { id: 'story', label: 'Tell a story', desc: 'Something that happened', estructura: 'The student tells something that happened to them: when and where, the events in order, and how they felt.' },
  ],
  reading: [
    { id: 'article', label: 'Magazine article', desc: 'Informative text with a title', estructura: 'The text is an informative magazine article with a catchy title and 3 or 4 short paragraphs.' },
    { id: 'email', label: 'Email or message', desc: 'Personal or work message', estructura: 'The text is an email or message from one person to another, with greeting, news or request, and sign-off.' },
    { id: 'story', label: 'Short story', desc: 'Narrative with characters', estructura: 'The text is a short story with characters, a place, a problem and an ending, mostly in the past.' },
    { id: 'notice', label: 'Notice / ad / schedule', desc: 'Everyday practical text', estructura: 'The text is an everyday practical document (advertisement, notice, event programme or timetable) with specific data such as times, prices and places.' },
    { id: 'interview', label: 'Interview / dialogue', desc: 'Questions and answers', estructura: 'The text is an interview or dialogue between two people, written as questions and answers.' },
  ],
  listening: [
    { id: 'conversation', label: 'Conversation', desc: 'Two people talking', estructura: 'The audio is a conversation between two people about an everyday situation.' },
    { id: 'announcement', label: 'Announcement', desc: 'Airport, shop, radio…', estructura: 'The audio is a short public announcement or radio message with specific data (times, places, numbers).' },
    { id: 'interview', label: 'Interview', desc: 'Someone answers questions', estructura: 'The audio is an interview where a person answers questions about their life, work or opinions.' },
    { id: 'voicemail', label: 'Voicemail / message', desc: 'Someone leaves a message', estructura: 'The audio is a voicemail or phone message with who it is from, what they want, and details to remember.' },
  ],
  multiple_choice: [
    { id: 'grammar', label: 'Grammar in context', desc: 'Choose the right form', estructura: 'Each question is a sentence with one gap where the student chooses the correct grammatical form (tense, article, pronoun, auxiliary…). Distractors are common mistakes.' },
    { id: 'vocabulary', label: 'Vocabulary', desc: 'Word that fits the meaning', estructura: 'Each question tests vocabulary: a sentence with a gap or a definition, and the student chooses the word that fits.' },
    { id: 'dialogue', label: 'Dialogue responses', desc: 'What would you say?', estructura: 'Each question gives a line of a short dialogue and the student chooses the most natural reply.' },
    { id: 'error', label: 'Find the correct sentence', desc: 'Spot the mistake', estructura: 'Each question offers 4 versions of a sentence and the student chooses the one that has no mistake.' },
  ],
  fill_gap: [
    { id: 'verbs', label: 'Verb in brackets', desc: 'Write the correct tense', estructura: 'Each sentence has the base verb in brackets after the gap, e.g. "She [[goes]] (go) to school every day." The student writes the correct form.' },
    { id: 'prepositions', label: 'Prepositions / articles', desc: 'Small words', estructura: 'Each sentence has a gap for a preposition, article or small grammar word.' },
    { id: 'wordbank', label: 'Word bank', desc: 'Choose from a box of words', estructura: 'Put a box of the words to be used in the "instrucciones" (e.g. "Use: …"), and make each sentence fit exactly one of those words.' },
    { id: 'dialogue', label: 'Complete the dialogue', desc: 'Gaps in a conversation', estructura: 'The sentences form a short dialogue (use "A:" and "B:") and the gaps are key words in it.' },
  ],
  matching: [
    { id: 'definitions', label: 'Word ↔ definition', desc: 'Vocabulary', estructura: 'Left: a word. Right: its short definition or meaning.' },
    { id: 'qa', label: 'Question ↔ answer', desc: 'Short exchanges', estructura: 'Left: a question. Right: the answer that fits it.' },
    { id: 'halves', label: 'Sentence halves', desc: 'Join the two parts', estructura: 'Left: the first half of a sentence. Right: the second half that completes it.' },
    { id: 'synonyms', label: 'Synonyms / opposites', desc: 'Related words', estructura: 'Left: a word. Right: its synonym or opposite (keep the same relation in all pairs).' },
    { id: 'functions', label: 'Situation ↔ expression', desc: 'Useful language', estructura: 'Left: a situation (e.g. asking for help). Right: the expression you would use.' },
  ],
  order_sentences: [
    { id: 'statements', label: 'Statements', desc: 'Affirmative sentences', estructura: 'All sentences are affirmative statements with a clear subject–verb–complement order.' },
    { id: 'questions', label: 'Questions', desc: 'Word order in questions', estructura: 'All sentences are questions (wh- questions and yes/no questions) so the student practises auxiliary and word order.' },
    { id: 'negatives', label: 'Negatives / past', desc: 'Auxiliaries and tenses', estructura: "Sentences are negatives or past tense so the student practises auxiliaries (don't, didn't, wasn't…)." },
    { id: 'time', label: 'Time and frequency', desc: 'Adverbs and place of words', estructura: 'Each sentence includes a time or frequency expression (always, every day, last week…) in its natural position.' },
  ],
}
export const plantillasDe = (tipo) => PLANTILLAS[tipo] ?? []
export const plantillaDe = (tipo, id) => plantillasDe(tipo).find((x) => x.id === id) ?? null

const FORMATO_CONSIGNA = `- Format the "consigna" with line breaks (use \n inside the JSON string), never as one block: a short opening line (end it with a colon if a list follows), then the tasks as a numbered list ("1. …", one per line) or bullets ("- …", one per line), then, if useful, a line starting with "Example: " and a line such as "Useful expressions:" followed by bullets. Put every list item on its own line.`

const REGLAS = {
  multiple_choice: (p) => `- Create ${cuantas(p, 'multiple-choice questions')} with 4 options each and ONLY ONE correct answer.\n- "correcta" is the index of the correct option starting at 0 (0 = first option).\n- Vary the position of the correct answer and avoid "all of the above".`,
  listening: (p) =>
    `- The student will listen to an audio (you cannot hear it). Base the answers ONLY on this transcript${p.imagen && !p.transcripcion ? ' (if the screenshot shows the audioscript or the answer key, use that)' : ''}:\n"""\n${p.transcripcion || (p.imagen ? '[NO TRANSCRIPT PROVIDED: use the audioscript or answer key in the screenshot if there is one]' : '[PASTE THE AUDIO TRANSCRIPT HERE]')}\n"""\n- Create ${cuantas(p, 'items')} about the audio. ${formasLectura(p)} Gap answers must be words that are said in the transcript.`,
  fill_gap: (p) => `- Create ${cuantas(p, 'sentences')}. In each one, mark the word or phrase the student must fill in between double square brackets: [[answer]].\n- If more than one answer is valid, separate them with | inside the brackets: [[are|'re]].\n- Each sentence can have 1 or 2 gaps. The answer must be unambiguous from the context.`,
  matching: (p) => `- Create ${cuantas(p, 'pairs')}. Each "izq" item matches ONE "der" item (for example word ↔ definition, or question ↔ answer).\n- All "der" items must be different from each other and unambiguous.`,
  order_sentences: (p) => `- Create ${cuantas(p, 'complete, correct sentences')} (6 to 12 words each unless the screenshot shows otherwise). The student will receive the words shuffled and must put them in order.\n- Each sentence must have only one natural word order.`,
  reading: (p) =>
    `- ${p.texto ? `Use this text as the reading (do not modify it):\n"""\n${p.texto}\n"""` : p.imagen ? 'Use the reading text that appears in the screenshot.' : 'Write an original reading text of 120 to 200 words.'}\n- Format the text as a short title on its own line followed by 3 to 5 paragraphs separated by a blank line (use \n\n inside the JSON string).\n- Create ${cuantas(p, 'items')} about the text. ${formasLectura(p)} Gap answers must be words that appear in the text. No item may depend on outside knowledge.`,
  writing: (p) => {
    const pl = plantillaDe('writing', p.plantilla)
    return `- Write a clear writing prompt (what to write, for whom and with which elements). Set a "min_palabras" ${pl ? `of about ${pl.palabras}` : 'appropriate for the level'}.\n${FORMATO_CONSIGNA}`
  },
  speaking: () => `- Write a clear prompt for the student to speak by recording their voice (topic, what to mention). "segundos_max" between 30 and 120 depending on the level.\n- Format the "consigna" with line breaks (use \n inside the JSON string), never as one block: a short opening line (end it with a colon if a list follows), then the tasks as a numbered list ("1. …", one per line) or bullets ("- …", one per line), then, if useful, a line starting with "Example: " and a line such as "Useful expressions:" followed by bullets. Put every list item on its own line.`,
}

// Posición en el curso y libro del nivel, para que la IA ajuste la dificultad y el estilo (nivel, ciclo, módulo, unidad).
const contexto = (p) => {
  if (!hay(p.ciclo) && !p.unidad) return ''
  const x = [p.nivelNombre ? `${p.nivelNombre} level` : '', hay(p.ciclo) ? `Cycle ${p.ciclo}` : '', p.modulo ? `Module ${p.modulo}` : '', p.unidad ? `Unit ${p.unidad}` : ''].filter(Boolean)
  const libro = p.libro ? ` The class uses the coursebook "${p.libro}"${p.imagen ? ', and the screenshot comes from it' : ''}: match its style, vocabulary and grammar for that unit.` : ''
  return `- Position in the course: ${x.join(', ')}.${libro} Keep the content appropriate for that point.`
}

// Con `p.imagen` el prompt se escribe para adjuntar una captura del libro: modo 'adaptar' (ejercicio nuevo con el mismo formato) o 'fiel' (copia).
export function construirPrompt(tipo, p) {
  const t = tipoDe(tipo)
  const lineas = ['You are an expert teacher of English as a foreign language and you design exercises for Spanish-speaking students.', '']
  if (p.imagen) {
    lineas.push(
      `I am attaching a screenshot of an exercise from an English textbook. Use it as your reference to create an exercise of type "${t.label}".`,
      p.modo === 'fiel'
        ? '- Recreate the exercise as faithfully as possible: same instructions, same items and options, same order. Transcribe the text exactly.'
        : '- Use the screenshot as a model: keep the same format, difficulty and grammar/vocabulary focus, but write NEW content (new sentences, texts and options). Do not copy the original wording.',
      '- If the screenshot shows the answers (answer key, circled or filled-in answers), use them. If not, solve the exercise carefully yourself.',
      '- Ignore page numbers, logos, decorations and pictures that cannot be turned into text. If part of the screenshot is unreadable, do not invent it: leave it out.',
      `- Student level (CEFR): ${p.nivel || 'A2'}`,
      `- Topic: ${p.tema?.trim() || 'the one in the screenshot'}`,
    )
    if (contexto(p)) lineas.push(contexto(p))
  } else {
    lineas.push(`Create an exercise of type "${t.label}" with these characteristics:`, `- Student level (CEFR): ${p.nivel || 'A2'}`, `- Topic: ${p.tema?.trim() || 'your choice, appropriate for the level'}`)
    if (contexto(p)) lineas.push(contexto(p))
  }
  const pl = plantillaDe(tipo, p.plantilla)
  if (pl) {
    lineas.push(
      `- Use this TEMPLATE ("${pl.label}"): ${pl.estructura} ${p.imagen ? 'Take the topic, vocabulary and situation from the screenshot and fit them into this template (if the screenshot shows a different format, the template wins).' : 'Fit the topic into this template.'}`,
    )
  }
  lineas.push('- All the exercise content (instructions, texts, questions, options) must be in English.', REGLAS[tipo](p))
  if (p.extra?.trim()) lineas.push(`- Additional instructions: ${p.extra.trim()}`)
  lineas.push(
    '',
    'Reply ONLY with a valid JSON object (no text before or after, no comments and no markdown code blocks) with exactly this structure:',
    ESQUEMAS[tipo],
  )
  return lineas.join('\n')
}

// ------------------------------------------------------------
// Leer la respuesta de la IA
// ------------------------------------------------------------
function indiceCorrecta(c, opciones) {
  if (typeof c === 'number') return Math.max(0, Math.min(c, opciones.length - 1))
  const s = texto(c)
  if (/^\d+$/.test(s)) return Math.max(0, Math.min(Number(s), opciones.length - 1))
  const letra = LETRAS.indexOf(s.charAt(0).toUpperCase())
  if (s.length <= 2 && letra >= 0) return Math.min(letra, opciones.length - 1)
  const porTexto = opciones.findIndex((o) => texto(o).toLowerCase() === s.toLowerCase())
  return porTexto >= 0 ? porTexto : 0
}

function pregunta(p) {
  const opciones = (Array.isArray(p.opciones) ? p.opciones : []).map(texto)
  while (opciones.length < 4) opciones.push('')
  return { enunciado: texto(p.enunciado), opciones: opciones.slice(0, 6), correcta: indiceCorrecta(p.correcta, opciones) }
}

function leerMixto(x, def) {
  const f = x.forma === 'choice' || x.forma === 'gap' || x.forma === 'tf' ? x.forma : Array.isArray(x.opciones) ? 'choice' : /\[\[/.test(x.texto ?? '') ? 'gap' : def
  if (f === 'gap') return { forma: 'gap', texto: texto(x.texto) }
  if (f === 'choice') return { forma: 'choice', ...pregunta(x) }
  return { forma: 'tf', enunciado: texto(x.enunciado), verdadero: x.verdadero === true || texto(x.verdadero).toLowerCase() === 'true' }
}

// Devuelve { titulo, datos } o lanza un Error con un mensaje claro para el usuario.
export function leerRespuestaIA(tipo, bruto) {
  let s = String(bruto ?? '').trim()
  if (!s) throw new Error('Paste the answer the AI gave you here')
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  if (a < 0 || b <= a) throw new Error('I cannot find JSON in what you pasted. Copy the AI\'s complete answer, from the first { to the last }')
  let j
  try {
    j = JSON.parse(s.slice(a, b + 1))
  } catch {
    throw new Error('The AI\'s JSON has a formatting error. Ask the AI: “return it again as valid JSON, with no extra text”')
  }
  const base = { instrucciones: texto(j.instrucciones) }
  let datos
  switch (tipo) {
    case 'multiple_choice':
      datos = { ...base, preguntas: (j.preguntas ?? []).map(pregunta) }
      break
    case 'listening':
      datos = { ...base, audio_url: '', preguntas: (j.preguntas ?? []).map((x) => leerMixto(x, 'choice')) }
      break
    case 'fill_gap':
      datos = { ...base, oraciones: (j.oraciones ?? []).map((o) => ({ texto: texto(typeof o === 'string' ? o : o.texto) })) }
      break
    case 'matching':
      datos = { ...base, pares: (j.pares ?? []).map((p) => ({ izq: texto(p.izq), der: texto(p.der) })) }
      break
    case 'order_sentences':
      datos = { ...base, oraciones: (j.oraciones ?? []).map((o) => texto(typeof o === 'string' ? o : o.texto)) }
      break
    case 'reading':
      datos = {
        ...base,
        texto: String(j.texto ?? '').replace(/\r/g, '').trim(),
        afirmaciones: (j.afirmaciones ?? []).map((x) => leerMixto(x, 'tf')),
      }
      break
    case 'writing':
      datos = { ...base, consigna: texto(j.consigna), min_palabras: Number(j.min_palabras) || 80 }
      break
    case 'speaking':
      datos = { ...base, consigna: texto(j.consigna), segundos_max: Number(j.segundos_max) || 90 }
      break
    default:
      throw new Error('Invalid exercise type')
  }
  return { titulo: texto(j.titulo), datos }
}

// ------------------------------------------------------------
// Estudiante: puntaje a texto
// ------------------------------------------------------------
export const fmtPuntaje = (n) => (n == null ? '—' : Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(1))
export const palabras = (t) => String(t ?? '').trim().split(/\s+/).filter(Boolean).length
