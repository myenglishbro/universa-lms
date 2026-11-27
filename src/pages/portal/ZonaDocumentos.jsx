import { useCallback, useMemo } from 'react'
import CursoZona from '../../components/portal/CursoZona'
import Icon from '../../components/ui/Icon'
import useCarga from '../../hooks/useCarga'
import { separarZona } from '../../lib/zonaCurso'
import * as servicioReal from '../../services/zonas'

const ZONAS = {
  docentes: {
    titulo: 'Teacher Zone',
    icono: 'teacher',
    intro: 'Onboarding videos, regulations, guidelines and materials for the teaching team.',
    vacio: 'Administration has not published any content yet. Check back soon.',
    curso: 'Teacher onboarding',
    cursoIntro: 'Follow the modules in order to learn how to use the platform. Videos and documents, at your own pace.',
  },
  estudiantes: {
    titulo: 'Student Zone',
    icono: 'users',
    intro: 'Video tutorials, guides and important documents for your learning.',
    vacio: 'Administration has not published any content yet. Check back soon.',
    curso: 'Student guide',
    cursoIntro: 'Short lessons and documents to get the most out of the platform.',
  },
}

function Dato({ valor, texto }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-2 text-center backdrop-blur">
      <p className="text-2xl font-bold leading-none">{valor}</p>
      <p className="mt-1 text-xs text-brand-100">{texto}</p>
    </div>
  )
}

// Zona del portal (Teacher Zone o Student Zone): un curso con módulos, lecciones (videos y documentos) y recursos de consulta, todo en un mismo visor.
export default function ZonaDocumentos({ zona, servicio = servicioReal }) {
  const info = ZONAS[zona]
  const cargar = useCallback(() => servicio.listarZona(zona), [servicio, zona])
  const { datos, cargando, error, recargar } = useCarga(cargar, [])
  const { modulos, lecciones, gruposRecursos, recursos } = useMemo(() => separarZona(datos), [datos])

  return (
    <>
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-6 text-white shadow-md sm:p-8">
        <span aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-peach-500/20" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-20 right-40 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <Icon name={info.icono} className="h-7 w-7 text-peach-200" />
            </span>
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{info.titulo}</h1>
              <p className="mt-1 max-w-xl text-sm text-brand-100">{info.intro}</p>
            </div>
          </div>
          {!cargando && datos.length > 0 && (
            <div className="flex gap-3">
              {lecciones.length > 0 && <Dato valor={lecciones.length} texto={lecciones.length === 1 ? 'lesson' : 'lessons'} />}
              {recursos.length > 0 && <Dato valor={recursos.length} texto={recursos.length === 1 ? 'resource' : 'resources'} />}
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Could not load the content: {error}{' '}
          <button className="font-medium underline" onClick={recargar}>
            Retry
          </button>
        </p>
      )}

      {cargando ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
      ) : datos.length === 0 ? (
        !error && (
          <div className="rounded-2xl border border-dashed border-brand-200 bg-white px-4 py-14 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <Icon name="doc" className="h-7 w-7" />
            </span>
            <p className="mx-auto mt-4 max-w-sm text-sm text-slate-500">{info.vacio}</p>
          </div>
        )
      ) : (
        <CursoZona key={zona} modulos={modulos} gruposRecursos={gruposRecursos} zona={zona} titulo={info.curso} subtitulo={info.cursoIntro} />
      )}
    </>
  )
}
