import { useCallback, useState } from 'react'
import ProximasClases from '../../components/portal/ProximasClases'
import TarjetaCurso from '../../components/portal/TarjetaCurso'
import Button from '../../components/ui/Button'
import PageHeader from '../../components/ui/PageHeader'
import useCarga from '../../hooks/useCarga'
import * as servicioReal from '../../services/portal'
import SalonDocente from './SalonDocente'

// Portal del docente: «Mis salones» (solo los asignados a su cuenta) → recursos y estudiantes.
export default function MisSalones({ servicio = servicioReal }) {
  const cargarSalones = useCallback(() => servicio.misSalones(), [servicio])
  const cargarClases = useCallback(() => servicio.proximasClases().then((c) => c.filter((x) => x.rol === 'docente')), [servicio])
  const salones = useCarga(cargarSalones, [])
  const clases = useCarga(cargarClases, [])
  const [abierto, setAbierto] = useState(null)
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
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {salones.datos.map((s) => (
            <TarjetaCurso
              key={s.salon_id}
              curso={s}
              onAbrir={() => setAbierto(s.salon_id)}
              pie={`${s.estudiantes} ${s.estudiantes === 1 ? 'student' : 'students'} · ${s.lecciones} ${s.lecciones === 1 ? 'lesson' : 'lessons'}`}
            />
          ))}
        </div>
      )}
      {!salones.cargando && salones.datos.length > 0 && (
        <div className="mt-8 max-w-xl">
          <ProximasClases clases={clases.datos} />
        </div>
      )}
    </>
  )
}
