// Banco de ejercicios: tipos, compilación (autoría → lo que ve el estudiante + clave), prompts para IA y lectura de su respuesta.
// La calificación real la hace Supabase (entregar_ejercicio); aquí solo se prepara el material.

export const TIPOS = [
  { id: 'multiple_choice', label: 'Multiple choice', desc: 'Questions with 4 options and one correct answer', icono: 'list', tono: 'brand', auto: true },
  { id: 'fill_gap', label: 'Fill in the gap', desc: 'Sentences with gaps to fill in', icono: 'pen', tono: 'peach', auto: true },
  { id: 'matching', label: 'Matching', desc: 'Match each item with its pair', icono: 'link', tono: 'brand', auto: true },
  { id: 'order_sentences', label: 'Order sentences', desc: 'Put the words in order to form the sentence', icono: 'switch', tono: 'peach', auto: true },
  { id: 'reading', label: 'Reading', desc: 'A text with true / false statements', icono: 'book', tono: 'brand', auto: true },
  { id: 'listening', label: 'Listening', desc: 'A Drive audio with multiple-choice questions', icono: 'headphones', tono: 'peach', auto: true },
  { id: 'writing', label: 'Writing', desc: 'Free written answer, reviewed by the teacher', icono: 'pencil', tono: 'brand', auto: false },
  { id: 'speaking', label: 'Speaking', desc: 'The student records their voice, reviewed by the teacher', icono: 'mic', tono: 'peach', auto: false },
]
export const tipoDe = (id) => TIPOS.find((t) => t.id === id)
export const esManual = (tipo) => tipo === 'writing' || tipo === 'speaking'
export const NIVELES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export const TONOS = {
  brand: 'bg-brand-100 text-brand-700',
  peach: 'bg-peach-100 text-peach-700',
}

const LETRAS = 'ABCDEFGH'
const texto = (v) => String(v ?? '').trim()

// ------------------------------------------------------------
// Datos de partida para el editor
// ------------------------------------------------------------
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
      return { instrucciones: 'Read the text and mark each statement as true or false.', texto: '', afirmaciones: [{ enunciado: '', verdadero: true }] }
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
    reading: { enunciado: '', verdadero: true },
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
export function validar(tipo, d) {
  const lista = claveLista(tipo)
  if (lista && (!Array.isArray(d[lista]) || d[lista].length === 0)) return 'Add at least one item'
  switch (tipo) {
    case 'multiple_choice':
    case 'listening': {
      if (tipo === 'listening' && !audioDriveEmbed(d.audio_url)) return 'Paste a Google Drive link pointing to the audio (shared with anyone who has the link)'
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
      for (const [i, a] of d.afirmaciones.entries()) if (!texto(a.enunciado)) return `Statement ${i + 1} is empty`
      return ''
    case 'writing':
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

export function compilar(tipo, d) {
  const instrucciones = texto(d.instrucciones)
  switch (tipo) {
    case 'multiple_choice':
    case 'listening': {
      const ps = d.preguntas.map((p) => {
        const opciones = p.opciones.map((o, i) => ({ o: texto(o), i })).filter((x) => x.o)
        return { enunciado: texto(p.enunciado), opciones: opciones.map((x) => x.o), correcta: opciones.findIndex((x) => x.i === p.correcta) }
      })
      const base = { instrucciones, preguntas: ps.map((p) => ({ enunciado: p.enunciado, opciones: p.opciones })) }
      return {
        contenido: tipo === 'listening' ? { ...base, audio_url: texto(d.audio_url) } : base,
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
    case 'reading':
      return {
        contenido: { instrucciones, texto: texto(d.texto), afirmaciones: d.afirmaciones.map((a) => ({ enunciado: texto(a.enunciado) })) },
        clave: { items: d.afirmaciones.map((a) => [a.verdadero ? 'true' : 'false']) },
      }
    case 'writing':
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
    { "enunciado": "…", "opciones": ["…", "…", "…", "…"], "correcta": 0 }
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
  "texto": "…",
  "afirmaciones": [
    { "enunciado": "…", "verdadero": true }
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

const REGLAS = {
  multiple_choice: (p) => `- Create exactly ${p.cantidad} multiple-choice questions with 4 options each and ONLY ONE correct answer.\n- "correcta" is the index of the correct option starting at 0 (0 = first option).\n- Vary the position of the correct answer and avoid "all of the above".`,
  listening: (p) =>
    `- The student will listen to an audio (you cannot hear it). Base the questions ONLY on this transcript:\n"""\n${p.transcripcion || '[PASTE THE AUDIO TRANSCRIPT HERE]'}\n"""\n- Create exactly ${p.cantidad} multiple-choice questions with 4 options and ONLY ONE correct answer.\n- "correcta" is the index of the correct option starting at 0.`,
  fill_gap: (p) => `- Create exactly ${p.cantidad} sentences. In each one, mark the word or phrase the student must fill in between double square brackets: [[answer]].\n- If more than one answer is valid, separate them with | inside the brackets: [[are|'re]].\n- Each sentence can have 1 or 2 gaps. The answer must be unambiguous from the context.`,
  matching: (p) => `- Create exactly ${p.cantidad} pairs. Each "izq" item matches ONE "der" item (for example word ↔ definition, or question ↔ answer).\n- All "der" items must be different from each other and unambiguous.`,
  order_sentences: (p) => `- Create exactly ${p.cantidad} complete, correct sentences of 6 to 12 words. The student will receive the words shuffled and must put them in order.\n- Each sentence must have only one natural word order.`,
  reading: (p) =>
    `- ${p.texto ? `Use this text as the reading (do not modify it):\n"""\n${p.texto}\n"""` : 'Write an original reading text of 120 to 200 words.'}\n- Create exactly ${p.cantidad} statements about the text to mark as true or false. "verdadero" is true or false.\n- Mix true and false statements; none may depend on outside knowledge.`,
  writing: () => `- Write a clear writing prompt (what to write, for whom and with which elements). Set a "min_palabras" appropriate for the level.`,
  speaking: () => `- Write a clear prompt for the student to speak by recording their voice (topic, what to mention). "segundos_max" between 30 and 120 depending on the level.`,
}

export function construirPrompt(tipo, p) {
  const t = tipoDe(tipo)
  const lineas = [
    'You are an expert teacher of English as a foreign language and you design exercises for Spanish-speaking students.',
    '',
    `Create an exercise of type "${t.label}" with these characteristics:`,
    `- Student level (CEFR): ${p.nivel || 'A2'}`,
    `- Topic: ${p.tema?.trim() || 'your choice, appropriate for the level'}`,
    '- All the exercise content (instructions, texts, questions, options) must be in English.',
    REGLAS[tipo](p),
  ]
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
      datos = { ...base, audio_url: '', preguntas: (j.preguntas ?? []).map(pregunta) }
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
      datos = { ...base, texto: texto(j.texto), afirmaciones: (j.afirmaciones ?? []).map((x) => ({ enunciado: texto(x.enunciado), verdadero: x.verdadero === true || texto(x.verdadero).toLowerCase() === 'true' })) }
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
