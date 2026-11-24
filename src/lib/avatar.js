import { genConfig } from 'react-nice-avatar'

// Personajes del Task Board: react-nice-avatar. Cada persona elige su aspecto; el gesto cambia solo según su carga de trabajo.
// En la base se guarda solo la parte elegida (ASPECTO); el gesto y el fondo transparente se añaden al dibujar.

export const PIELES = ['#F9C9B6', '#E8B98C', '#AC6651', '#7A4A33']
export const CABELLOS = ['#1b0042', '#3b2417', '#77311D', '#C98A4B', '#E2C275', '#FC909F', '#475569']
export const ROPAS = ['#6a2cc8', '#33007a', '#f59e5b', '#a78bdb', '#475569', '#E11D48', '#0F766E']

export const SEXOS = [
  { id: 'man', label: 'Boy' },
  { id: 'woman', label: 'Girl' },
]
export const PEINADOS = {
  man: [
    { id: 'normal', label: 'Classic' },
    { id: 'thick', label: 'Thick' },
    { id: 'mohawk', label: 'Mohawk' },
  ],
  woman: [
    { id: 'womanLong', label: 'Long' },
    { id: 'womanShort', label: 'Short' },
    { id: 'normal', label: 'Classic' },
  ],
}
export const GAFAS = [
  { id: 'none', label: 'None' },
  { id: 'round', label: 'Round' },
  { id: 'square', label: 'Square' },
]
export const GORROS = [
  { id: 'none', label: 'None' },
  { id: 'beanie', label: 'Beanie' },
  { id: 'turban', label: 'Turban' },
]
export const CAMISAS = [
  { id: 'short', label: 'T-shirt' },
  { id: 'polo', label: 'Polo' },
  { id: 'hoody', label: 'Hoodie' },
]

const color = (v, lista, defecto) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : defecto ?? lista[0])
const ids = (lista) => lista.map((x) => x.id)
const uno = (v, lista, defecto) => (lista.includes(v) ? v : defecto ?? lista[0])

// Deja solo valores permitidos (lo que viene de la base nunca llega tal cual al dibujo).
export function sanear(a = {}) {
  const sexo = uno(a.sex, ['man', 'woman'])
  return {
    sex: sexo,
    faceColor: color(a.faceColor, PIELES),
    hairStyle: uno(a.hairStyle, ids(PEINADOS[sexo]), PEINADOS[sexo][0].id),
    hairColor: color(a.hairColor, CABELLOS),
    glassesStyle: uno(a.glassesStyle, ids(GAFAS), 'none'),
    hatStyle: uno(a.hatStyle, ids(GORROS), 'none'),
    shirtStyle: uno(a.shirtStyle, ids(CAMISAS)),
    shirtColor: color(a.shirtColor, ROPAS),
  }
}

// Quien aún no eligió recibe un aspecto automático (según su correo) para que no falte ninguno.
export function aspectoAutomatico(texto = '') {
  const g = genConfig(texto || 'universa')
  const n = [...texto].reduce((a, c) => a + c.charCodeAt(0), 0)
  return sanear({
    sex: g.sex,
    faceColor: PIELES[n % PIELES.length],
    hairStyle: g.hairStyle,
    hairColor: CABELLOS[n % CABELLOS.length],
    glassesStyle: 'none',
    hatStyle: 'none',
    shirtStyle: g.shirtStyle,
    shirtColor: ROPAS[n % ROPAS.length],
  })
}

// Gestos según la carga: libre, tranquilo, cargado, agobiado.
const GESTO = {
  libre: { eyeStyle: 'smile', mouthStyle: 'laugh' },
  tranquilo: { eyeStyle: 'circle', mouthStyle: 'smile' },
  cargado: { eyeStyle: 'oval', mouthStyle: 'peace' },
  agobiado: { eyeStyle: 'oval', mouthStyle: 'peace' },
}

// Configuración completa para <NiceAvatar>.
export function configAvatar(aspecto, animo = 'tranquilo') {
  return { ...sanear(aspecto), ...(GESTO[animo] ?? GESTO.tranquilo), earSize: 'small', noseStyle: 'short', hatColor: '#6a2cc8', bgColor: 'transparent', isGradient: false }
}
