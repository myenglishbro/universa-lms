// Comentarios estandarizados del reporte del ciclo: se proponen según la nota publicada de cada habilidad (banda de desempeño) y quien emite
// el reporte puede editarlos. Sin nota publicada de una habilidad no se escribe nada (nunca se inventa).
import { hojasPorCiclo } from './informeNotas.js'
import { HABILIDADES_INFORME, bandaDe, notasPorHabilidad } from './progresoHabilidades.js'

export { bandaDe, notasPorHabilidad }

const TEXTOS = {
  es: {
    tema: {
      Speaking: 'la pronunciación, el énfasis de las palabras y la entonación',
      Reading: 'la comprensión de los textos trabajados',
      Listening: 'la comprensión oral del vocabulario y las expresiones trabajadas',
      Writing: 'la producción escrita con las estructuras y el vocabulario de cada unidad',
      Vocabulary: 'el vocabulario de las unidades trabajadas',
      Grammar: 'las estructuras gramaticales de las unidades trabajadas',
    },
    practica: {
      Speaking: 'Practicar en voz alta las expresiones trabajadas en clase, cuidando la pronunciación, el énfasis y la entonación.',
      Reading: 'Releer los textos de clase y repasar a diario el vocabulario y las expresiones de las unidades.',
      Listening: 'Volver a escuchar los audios de clase y repetir palabras y expresiones atendiendo al ritmo y la entonación.',
      Writing: 'Escribir textos breves usando el vocabulario y las estructuras de cada unidad.',
      Vocabulary: 'Repasar a diario el vocabulario visto en clase y usarlo en ejemplos propios.',
      Grammar: 'Hacer ejercicios cortos con las estructuras de cada unidad y usarlas al hablar y al escribir.',
    },
    fortalezas: { outstanding: 'Demuestra un dominio sobresaliente de {t}.', achieved: 'Demuestra un buen manejo de {t}.', developing: 'Ha avanzado en {t} y su base va tomando forma.', beginning: 'Ha comenzado a trabajar {t}.' },
    mejora: {
      outstanding: 'Mantener este nivel y desafiarse con tareas más exigentes.',
      achieved: 'Seguir afianzando {t} para lograr mayor seguridad y naturalidad.',
      developing: 'Necesita reforzar {t} para consolidar lo aprendido.',
      beginning: 'Es necesario reforzar {t} con práctica frecuente y acompañamiento.',
    },
    cola: { outstanding: ' Ampliar con material más desafiante.', beginning: ' Dedicar unos minutos cada día de forma constante.' },
    portada: {
      outstanding: '{n} completó el {c} con un desempeño sobresaliente.',
      achieved: '{n} completó el {c} con buenos resultados y una base sólida para seguir avanzando.',
      developing: '{n} completó el {c} y está consolidando su base; con práctica constante seguirá mejorando.',
      beginning: '{n} necesita reforzar lo trabajado en el {c} antes de avanzar.',
      fuerte: 'Su punto más fuerte es {s}.',
      refuerzo: 'Conviene seguir reforzando {w}.',
    },
    ciclo: (c) => `ciclo ${c}`,
  },
  en: {
    tema: {
      Speaking: 'pronunciation, word stress and intonation',
      Reading: 'comprehension of the texts covered',
      Listening: 'listening comprehension of the vocabulary and expressions covered',
      Writing: 'written production with the structures and vocabulary of each unit',
      Vocabulary: 'the vocabulary of the units covered',
      Grammar: 'the grammar structures of the units covered',
    },
    practica: {
      Speaking: 'Practice aloud the expressions worked on in class, paying attention to pronunciation, word stress and intonation.',
      Reading: 'Reread the class texts and review the vocabulary and expressions of the units every day.',
      Listening: 'Listen again to the class audios and repeat words and expressions, noticing rhythm and intonation.',
      Writing: 'Write short texts using the vocabulary and structures of each unit.',
      Vocabulary: 'Review the vocabulary seen in class every day and use it in your own examples.',
      Grammar: 'Do short exercises with the structures of each unit and use them when speaking and writing.',
    },
    fortalezas: { outstanding: 'Shows outstanding command of {t}.', achieved: 'Shows good command of {t}.', developing: 'Has made progress in {t} and the foundation is taking shape.', beginning: 'Has started working on {t}.' },
    mejora: {
      outstanding: 'Keep this level and take on more demanding tasks.',
      achieved: 'Keep strengthening {t} to gain confidence and naturalness.',
      developing: 'Needs to reinforce {t} to consolidate what has been learned.',
      beginning: 'Needs to reinforce {t} with frequent practice and support.',
    },
    cola: { outstanding: ' Extend with more challenging material.', beginning: ' Set aside a few minutes every day, consistently.' },
    portada: {
      outstanding: '{n} completed {c} with an outstanding performance.',
      achieved: '{n} completed {c} with good results and a solid foundation to keep progressing.',
      developing: '{n} completed {c} and is consolidating the foundation; with steady practice improvement will continue.',
      beginning: '{n} needs to reinforce what was covered in {c} before moving on.',
      fuerte: 'The strongest area is {s}.',
      refuerzo: 'It is worth continuing to reinforce {w}.',
    },
    ciclo: (c) => `cycle ${c}`,
  },
}

const llenar = (txt, vars) => txt.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')

// { Speaking: { fortalezas, mejora, recomendaciones }, … } solo de las habilidades con nota publicada.
export function comentariosHabilidades(notas, idioma = 'es') {
  const T = TEXTOS[idioma] ?? TEXTOS.es
  const out = {}
  for (const s of HABILIDADES_INFORME) {
    const b = bandaDe(notas[s])
    if (!b) continue
    const t = T.tema[s]
    out[s] = { fortalezas: llenar(T.fortalezas[b], { t }), mejora: llenar(T.mejora[b], { t }), recomendaciones: T.practica[s] + (T.cola[b] ?? '') }
  }
  return out
}

// Comentario de la portada según la nota del ciclo y las habilidades más fuerte y más débil. Vacío si el ciclo no tiene nota.
export function comentarioPortada({ estudiante, ciclo, nota100, notas }, idioma = 'en') {
  const T = (TEXTOS[idioma] ?? TEXTOS.en).portada
  const b = bandaDe(nota100)
  if (!b) return ''
  const con = HABILIDADES_INFORME.filter((s) => notas[s] != null).sort((a, c) => notas[c] - notas[a])
  const nombre = String(estudiante ?? '').trim().split(/\s+/)[0] || ''
  const c = ciclo != null ? (TEXTOS[idioma] ?? TEXTOS.en).ciclo(ciclo) : idioma === 'es' ? 'el ciclo' : 'the cycle'
  const partes = [llenar(T[b], { n: nombre, c })]
  if (con.length >= 2) {
    partes.push(llenar(T.fuerte, { s: con[0] }))
    if (notas[con[con.length - 1]] < 85) partes.push(llenar(T.refuerzo, { w: con[con.length - 1] }))
  }
  return partes.join(' ')
}

// Todo lo estandarizado de un ciclo del informe (el mismo que se imprime), listo para rellenar el formulario.
export function propuestaComentarios(d, ciclo, { idiomaPortada = 'en', idiomaHabilidades = 'es' } = {}) {
  const h = hojasPorCiclo(d).find((x) => String(x.ciclo) === String(ciclo)) ?? hojasPorCiclo(d)[0]
  const notas = notasPorHabilidad(h?.mods ?? [])
  const ev = h?.info && Number(h.info.escala_evaluada) > 0
  const completo = ev && !h.info.parcial && !(h.mods ?? []).some((m) => m.parcial || m.sin_plantilla)
  return {
    comentario: comentarioPortada({ estudiante: d.estudiante, ciclo: h?.ciclo, nota100: completo ? Number(h.info.puntos) : null, notas }, idiomaPortada),
    habilidades: comentariosHabilidades(notas, idiomaHabilidades),
    notas,
  }
}
