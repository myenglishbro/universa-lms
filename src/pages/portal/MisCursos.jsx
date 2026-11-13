import { useCallback, useMemo, useState } from 'react'
import CalendarioClases, { FilaClase } from '../../components/portal/CalendarioClases'
import TarjetaCursoEstudiante from '../../components/portal/TarjetaCursoEstudiante'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import useCarga from '../../hooks/useCarga'
import { hoyISO } from '../../lib/calendario'
import * as servicioReal from '../../services/portal'
import CursoEstudiante from './CursoEstudiante'

const saludo = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening'
}

function Dato({ icono, valor, etiqueta }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
      <Icon name={icono} className="h-5 w-5 text-peach-200" />
      <div>
        <p className="text-xl font-bold leading-none">{valor}</p>
        <p className="mt-1 text-xs text-white/80">{etiqueta}</p>
      </div>
    </div>
  )
}

// Portal del estudiante: bienvenida, mis cursos (con avance), y calendario de próximas clases → curso con pestañas.
export default function MisCursos({ servicio = servicioReal, cursoInicialId = null }) {
  const cargarCursos = useCallback(() => servicio.misCursos(), [servicio])
  const cargarClases = useCallback(() => servicio.proximasClases().then((c) => c.filter((x) => x.rol === 'estudiante')), [servicio])
  const cursos = useCarga(cargarCursos, [])
  const clases = useCarga(cargarClases, [])
  const [abierto, setAbierto] = useState(cursoInicialId)
  const curso = cursos.datos.find((c) => c.salon_id === abierto)

  const hoy = hoyISO()
  const futuras = useMemo(
    () => clases.datos.filter((c) => c.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora_inicio.localeCompare(b.hora_inicio)),
    [clases.datos, hoy],
  )
  const proximaDe = (id) => futuras.find((c) => c.salon_id === id)

  if (curso) return <CursoEstudiante curso={curso} proximas={clases.datos} onVolver={() => setAbierto(null)} servicio={servicio} />

  const activos = cursos.datos.filter((c) => c.estado !== 'finalizado').length
  const deHoy = futuras.filter((c) => c.fecha === hoy).length

  return (
    <>
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-6 text-white shadow-md sm:p-8">
        <span className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-peach-500/20" />
        <span className="pointer-events-none absolute -bottom-20 right-40 h-48 w-48 rounded-full bg-white/10" />
        <div className="relative">
          <p className="text-sm text-brand-100">{saludo()} 👋</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Your learning space</h1>
          <p className="mt-1 text-sm text-brand-100">Your courses, classes and materials in one place.</p>
          {!cursos.cargando && cursos.datos.length > 0 && (
            <div className="mt-6 grid max-w-xl grid-cols-3 gap-3">
              <Dato icono="building" valor={activos} etiqueta={activos === 1 ? 'Active course' : 'Active courses'} />
              <Dato icono="calendar" valor={deHoy} etiqueta={deHoy === 1 ? 'Class today' : 'Classes today'} />
              <Dato icono="clock" valor={futuras.length} etiqueta="Upcoming classes" />
            </div>
          )}
        </div>
      </div>

      {cursos.error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load your courses: {cursos.error}
          <Button variant="secondary" className="ml-3" onClick={cursos.recargar}>
            Retry
          </Button>
        </div>
      )}

      {cursos.cargando ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading your courses…</p>
      ) : cursos.datos.length === 0 ? (
        !cursos.error && (
          <p className="rounded-2xl border border-dashed border-brand-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
            You are not enrolled in any classroom yet. When Administration enrolls you, your course will appear here.
          </p>
        )
      ) : (
        <>
          {deHoy > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Your classes today</h2>
              <ul className="grid gap-2 md:grid-cols-2">
                {futuras
                  .filter((c) => c.fecha === hoy)
                  .map((c) => (
                    <FilaClase key={`${c.origen}:${c.id}`} c={c} hoy={hoy} />
                  ))}
              </ul>
            </section>
          )}

          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">My courses</h2>
            <div className="grid gap-6 pt-6 sm:grid-cols-2 xl:grid-cols-3">
              {cursos.datos.map((c) => (
                <TarjetaCursoEstudiante key={c.salon_id} curso={c} proxima={proximaDe(c.salon_id)} onAbrir={() => setAbierto(c.salon_id)} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">My calendar</h2>
            <CalendarioClases clases={clases.datos} />
          </section>
        </>
      )}
    </>
  )
}
