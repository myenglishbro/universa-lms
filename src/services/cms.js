import { landingFallback } from '../data/landingFallback'

// Contenido de la landing desde Strapi (proyecto universa-strapi-project). Solo lectura pública: sin claves.
// Si VITE_STRAPI_URL no está configurada o el CMS falla, se usa el contenido incluido en la app.
const base = () => (import.meta.env.VITE_STRAPI_URL ?? '').replace(/\/+$/, '')

// Texto enriquecido de Strapi: texto plano, o bloques JSON (a veces como cadena) → lista de párrafos.
export function parrafos(valor) {
  let v = valor
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v)
    } catch {
      return v.trim() ? [v.trim()] : []
    }
  }
  if (!Array.isArray(v)) return []
  const texto = (n) => (typeof n?.text === 'string' ? n.text : Array.isArray(n?.children) ? n.children.map(texto).join('') : '')
  return v.map((b) => texto(b).trim()).filter(Boolean)
}

const media = (m, url) => {
  const u = m?.url ?? m?.data?.attributes?.url
  if (!u) return null
  return /^https?:\/\//.test(u) ? u : `${url}${u}`
}

// Los enlaces internos del CMS (/programas, /nosotros…) se llevan a la ruta equivalente de esta app; lo desconocido, al contacto.
const RUTAS = ['nosotros', 'metodologia', 'programas', 'servicios', 'programa-continuo-grupal', 'programa-continuo-privado', 'programa-dynamic', 'programa-flex-privado', 'sesiones-on-demand', 'conversation-clubs', 'professional-mastery-lab', 'virtual-coffee', 'comunidad-universa', 'impacto-universa', 'faqs', 'trabaja-con-nosotros', 'contacto', 'privacidad', 'terminos']
const ALIAS = { 'flex-signature': 'programa-flex-privado', 'Professional-Mastery-Lab': 'professional-mastery-lab', talleres: 'professional-mastery-lab' }
const enlace = (u) => {
  if (!u) return '#/contacto'
  if (/^(https?:|mailto:|tel:)/.test(u)) return u
  if (u.startsWith('#')) return u.startsWith('#/') ? u : '#/contacto'
  const slug = u.replace(/^\/+/, '').split(/[/?#]/)[0]
  const ruta = ALIAS[slug] ?? slug
  return RUTAS.includes(ruta) ? `#/${ruta}` : '#/contacto'
}
const cta = (c) => (c?.label ? { label: c.label.replace(/\s*→\s*$/, ''), href: enlace(c.url) } : null)

const cabecera = (b) => ({ eyebrow: b.eyebrow ?? '', titulo: b.title ?? '', subtitulo: b.subtitle ?? '' })

// Un bloque de Strapi → una sección de la landing. Los bloques que no se conocen se omiten.
export function seccion(b, url = '') {
  switch (b?.__component) {
    case 'blocks.hero-carousel': {
      const slides = (b.slides ?? []).filter((x) => x?.desktopImage || x?.mobileImage)
      if (slides.length)
        return {
          tipo: 'carrusel',
          titulo: b.slides?.[0]?.title ?? '',
          slides: slides.map((x) => {
            const d = media(x.desktopImage, url)
            const m = media(x.mobileImage, url)
            return { desktop: d ?? m, mobile: m ?? d, alt: x.title ?? '', href: enlace(x.url) }
          }),
        }
      const s = b.slides?.[0]
      if (!s) return null
      return { tipo: 'hero', titulo: s.title ?? '', subtitulo: s.subtitle ?? '', cta: cta(s.primaryCta), cta2: cta(s.secondaryCta ?? s.pillCta), imagen: media(s.image ?? s.backgroundImage, url) }
    }
    case 'blocks.hero':
      return { tipo: 'hero', titulo: b.title ?? '', subtitulo: b.subtitle ?? '', cta: cta(b.primaryCta), cta2: cta(b.secondaryCta), imagen: media(b.image, url) }
    case 'blocks.text-image':
      return { tipo: 'textoImagen', ...cabecera(b), parrafos: parrafos(b.body), cta: cta(b.cta), imagen: media(b.image, url), izquierda: b.imagePosition === 'left' }
    case 'blocks.rich-text':
      return { tipo: 'textoImagen', ...cabecera(b), parrafos: parrafos(b.content) }
    case 'blocks.card-grid':
      return { tipo: 'caracteristicas', ...cabecera(b), items: (b.items ?? []).map((i) => ({ titulo: i.title, descripcion: i.description })) }
    case 'blocks.feature-list':
      return { tipo: 'caracteristicas', ...cabecera(b), items: (b.items ?? []).map((i) => ({ titulo: i.title, descripcion: i.description })) }
    case 'blocks.program-highlights':
      return {
        tipo: 'programas',
        ...cabecera(b),
        items: (b.programs ?? []).map((p) => ({
          titulo: p.title,
          descripcion: p.shortDescription,
          detalle: [p.modality && { online: 'Online', hibrido: 'Online, presencial o híbrido', presencial: 'Presencial' }[p.modality], p.scheduleText, p.classSizeText].filter(Boolean).join(' · '),
          cta: 'Ver programa',
          href: enlace(p.ctaUrl),
        })),
      }
    case 'blocks.ecosystem':
      return { tipo: 'ecosistema', ...cabecera(b), items: (b.items ?? []).map((i) => ({ fase: i.phase, titulo: i.title, descripcion: i.description })) }
    case 'blocks.step-list':
      return { tipo: 'pasos', ...cabecera(b), items: (b.steps ?? []).map((s) => ({ numero: s.stepNumber, titulo: s.title, descripcion: s.description })) }
    case 'blocks.testimonials':
      return { tipo: 'testimonios', ...cabecera(b), items: (b.testimonials ?? []).map((t) => ({ cita: t.quote, nombre: t.name, rol: t.role })) }
    case 'blocks.faq':
      return { tipo: 'faq', ...cabecera(b), items: (b.faqItems ?? []).map((f) => ({ pregunta: f.question, respuesta: parrafos(f.answer).join(' ') })) }
    case 'blocks.contact-form':
    case 'blocks.contact':
      return { tipo: 'contacto', ...cabecera(b) }
    case 'blocks.cta-banner':
      return { tipo: 'cta', ...cabecera(b), cta: cta(b.primaryCta) }
    default:
      return null
  }
}

// Une las secciones del CMS con los datos del sitio. Devuelve null si no hay nada utilizable (se usa el respaldo).
export function normalizar(home, sitio, url = '') {
  const secciones = (home?.sections ?? []).map((b) => seccion(b, url)).filter(Boolean)
  if (!secciones.some((s) => s.tipo === 'hero' || s.tipo === 'carrusel')) return null
  if (!secciones.some((x) => x.tipo === 'contacto')) secciones.push({ tipo: 'contacto', eyebrow: 'Contacto', titulo: 'Hablemos', subtitulo: '' })
  const f = landingFallback.sitio
  const w = (sitio?.whatsappNumber ?? '').replace(/\D/g, '')
  return {
    sitio: {
      nombre: sitio?.siteName ?? f.nombre,
      lema: sitio?.siteTagline ?? f.lema,
      descripcion: sitio?.siteDescription ?? f.descripcion,
      correo: sitio?.contactEmail ?? f.correo,
      whatsapp: w || f.whatsapp,
      telefono: sitio?.contactPhone ?? f.telefono,
      direccion: sitio?.address ?? f.direccion,
    },
    secciones,
  }
}

async function leer(ruta, url, f) {
  const r = await f(`${url}/api/${ruta}`)
  if (!r.ok) throw new Error(`CMS ${r.status}`)
  return (await r.json()).data
}

// Carga el contenido: CMS si está configurado; si algo falla, el contenido incluido. Nunca lanza.
export async function cargarLanding({ url: u = base(), f = globalThis.fetch } = {}) {
  const url = u.replace(/\/+$/, '')
  if (!url) return { ...landingFallback, origen: 'respaldo' }
  try {
    const [home, sitio] = await Promise.all([
      leer('homepage?populate[sections][populate]=*', url, f),
      leer('site-setting', url, f).catch(() => null),
    ])
    const contenido = normalizar(home, sitio, url)
    if (!contenido) throw new Error('sin contenido')
    return { ...contenido, origen: 'cms' }
  } catch {
    return { ...landingFallback, origen: 'respaldo' }
  }
}
