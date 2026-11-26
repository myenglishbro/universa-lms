import { useCallback, useState } from 'react'
import ProximasClases from '../../components/portal/ProximasClases'
import TarjetaCurso from '../../components/portal/TarjetaCurso'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import PageHeader from '../../components/ui/PageHeader'
import useCarga from '../../hooks/useCarga'
import * as servicioReal from '../../services/portal'
import SalonDocente from './SalonDocente'

function Dato({ icono, valor, texto, className = '' }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-brand-100 bg-white p-4 shadow-sm ${className}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon name={icono} className="h-5 w-5" />
      </span>
      <div>
        <p className="text-2xl font-extrabold leading-none text-slate-900">{valor}</p>
        <p className="mt-1 text-xs font-medium text-slate-500">{texto}</p>
      </div>
    </div>
  )
}

// Portal del docente: «Mis salones» (solo los asignados a su cuenta) → recursos y estudiantes.
export default function MisSalones({ servicio = servicioReal }) {
  const cargarSalones = useCallback(() => servicio.misSalones(), [servicio])
  const cargarClases = useCallback(() => servicio.proximasClases().then((c) => c.filter((x) => x.rol === 'docente')), [servicio])
  const salones = useCarga(cargarSalones, [])
  const clases = useCarga(cargarClases, [])
  const [abierto, setAbierto] = useState(null)
  const totalEstudiantes = salones.datos.reduce((n, s) => n + (Number(s.estudiantes) || 0), 0)
  const salon = salones.datos.find((s) => s.salon_id === abierto)

  if (salon) return <SalonDocente salon={salon} onVolver={() => setAbierto(null)} servicio={servicio} />

  return (
    <>
      <PageHeader title="My classrooms" description="Your groups, students and materials" />
      {salones.error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load your classrooms: {salones.error}
          <Button variant="secondary" className="ml-3" onClick={salones.recargar}>
            Retry
          </Button>
        </div>
      )}
      {salones.cargando ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading your classrooms…</p>
      ) : salones.datos.length === 0 ? (
        !salones.error && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500">
            You have no classrooms assigned yet. Administration can assign you one from classroom management.
          </p>
        )
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Dato icono="building" valor={salones.datos.length} texto={salones.datos.length === 1 ? 'Classroom' : 'Classrooms'} />
            <Dato icono="users" valor={totalEstudiantes} texto={totalEstudiantes === 1 ? 'Student' : 'Students'} />
            <Dato icono="calendar" valor={clases.datos.length} texto="Upcoming classes" className="col-span-2 sm:col-span-1" />
          </div>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid gap-5 sm:grid-cols-2">
              {salones.datos.map((s) => (
                <TarjetaCurso
                  key={s.salon_id}
                  curso={s}
                  onAbrir={() => setAbierto(s.salon_id)}
                  pie={`${s.estudiantes} ${s.estudiantes === 1 ? 'student' : 'students'} · ${s.lecciones} ${s.lecciones === 1 ? 'lesson' : 'lessons'}`}
                />
              ))}
            </div>
            <aside className="xl:sticky xl:top-4">
              <ProximasClases clases={clases.datos} />
            </aside>
          </div>
        </>
      )}
    </>
  )
}
