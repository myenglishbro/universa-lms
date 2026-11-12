// Enlaces de recursos del curso (YouTube y Google Drive). Solo se guardan enlaces: nada se descarga ni se copia.
// La validación definitiva la hace Supabase (curso_proveedor); aquí se da respuesta inmediata y se calcula el reproductor.

export const tiposRecurso = [
  { value: 'grabacion', label: 'Grabación de clase', ayuda: 'YouTube o Google Drive' },
  { value: 'video', label: 'Video', ayuda: 'YouTube o Google Drive' },
  { value: 'documento', label: 'Documento / PDF', ayuda: 'Google Drive, Docs o Slides' },
  { value: 'enlace', label: 'Enlace complementario', ayuda: 'Cualquier enlace https' },
]
export const tipoLabel = (v) => tiposRecurso.find((t) => t.value === v)?.label ?? v

const HOSTS_YOUTUBE = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com']
const HOSTS_DRIVE = ['drive.google.com', 'docs.google.com']
const FORMA = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]+)?([/?#][^\s]*)?$/

export function proveedorDe(url) {
  const t = (url ?? '').trim()
  if (!FORMA.test(t) || t.length > 2000) return null
  const host = t.match(/^https:\/\/([A-Za-z0-9.-]+)/)[1].toLowerCase()
  return HOSTS_YOUTUBE.includes(host) ? 'youtube' : HOSTS_DRIVE.includes(host) ? 'drive' : 'externo'
}

// Mensaje de error o '' si el enlace es aceptable para ese tipo de recurso.
export function validarEnlace(url, tipo) {
  const prov = proveedorDe(url)
  if (!prov) return 'El enlace debe comenzar con https:// y no puede tener espacios'
  if ((tipo === 'grabacion' || tipo === 'video') && prov === 'externo') return 'Los videos y grabaciones deben ser enlaces de YouTube o Google Drive'
  if (tipo === 'documento' && prov !== 'drive') return 'Los documentos deben ser enlaces de Google Drive (Drive, Docs o Slides)'
  return ''
}

function idYoutube(u) {
  const host = u.hostname.toLowerCase()
  if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
  const v = u.searchParams.get('v')
  if (v) return v
  const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]+)/)
  return m ? m[1] : null
}

// Dirección para incrustar el recurso en un <iframe>, o null si solo se puede abrir en otra pestaña.
export function incrustarDe({ url, proveedor }) {
  let u
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  if (proveedor === 'youtube' && HOSTS_YOUTUBE.includes(u.hostname.toLowerCase())) {
    const id = idYoutube(u)
    if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}?rel=0`
    const lista = u.searchParams.get('list')
    return lista && /^[\w-]+$/.test(lista) ? `https://www.youtube-nocookie.com/embed/videoseries?list=${lista}` : null
  }
  if (proveedor === 'drive' && HOSTS_DRIVE.includes(u.hostname.toLowerCase())) {
    const archivo = u.pathname.match(/^\/file\/d\/([\w-]+)/) ?? (u.hostname === 'drive.google.com' && u.pathname === '/open' ? [null, u.searchParams.get('id')] : null)
    if (archivo?.[1] && /^[\w-]+$/.test(archivo[1])) return `https://drive.google.com/file/d/${archivo[1]}/preview`
    const doc = u.hostname === 'docs.google.com' && u.pathname.match(/^\/(document|presentation|spreadsheets)\/d\/([\w-]+)/)
    if (doc) return `https://docs.google.com/${doc[1]}/d/${doc[2]}/preview`
  }
  return null
}

// Filas planas de portal_contenido → secciones con sus lecciones (las secciones sin lecciones se conservan).
export function agruparContenido(filas) {
  const mapa = new Map()
  for (const f of filas) {
    if (!mapa.has(f.seccion_id)) mapa.set(f.seccion_id, { id: f.seccion_id, titulo: f.seccion_titulo, orden: f.seccion_orden, oculta: f.seccion_oculta, lecciones: [] })
    if (f.leccion_id)
      mapa.get(f.seccion_id).lecciones.push({
        id: f.leccion_id,
        titulo: f.leccion_titulo,
        descripcion: f.descripcion ?? '',
        tipo: f.tipo,
        proveedor: f.proveedor,
        url: f.url,
        orden: f.leccion_orden,
        oculta: f.leccion_oculta,
        sesionId: f.sesion_id ?? '',
        sesionFecha: f.sesion_fecha ?? '',
      })
  }
  return [...mapa.values()]
}

// Contenido tal como lo ve un estudiante: sin secciones ocultas y sin lecciones ocultas (la administración recibe todo para poder gestionarlo).
export const soloVisibleParaEstudiante = (filas) =>
  filas
    .filter((f) => !f.seccion_oculta)
    .map((f) => (f.leccion_oculta ? { ...f, leccion_id: null } : f))

export const totalLecciones = (secciones) => secciones.reduce((n, s) => n + s.lecciones.length, 0)

// Mover un elemento una posición (devuelve la lista de ids en el nuevo orden, o null si no se puede).
export function moverId(ids, id, delta) {
  const i = ids.indexOf(id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= ids.length) return null
  const copia = [...ids]
  ;[copia[i], copia[j]] = [copia[j], copia[i]]
  return copia
}

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const horariosTexto = (horarios) =>
  (horarios ?? []).map((h) => `${DIAS[h.dia]} ${h.hora_inicio.slice(0, 5)}–${h.hora_fin.slice(0, 5)}`).join(' · ') || 'Horario por definir'

// Color estable para la portada de cada curso (mismo salón, mismo color).
const PORTADAS = ['from-brand-600 to-brand-800', 'from-brand-500 to-peach-500', 'from-peach-500 to-brand-700', 'from-brand-700 to-slate-800', 'from-teal-600 to-brand-700']
export const portadaDe = (texto) => PORTADAS[[...(texto ?? '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PORTADAS.length]
