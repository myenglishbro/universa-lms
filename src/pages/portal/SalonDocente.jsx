import { useCallback, useState } from 'react'
import GestionContenido from '../../components/portal/GestionContenido'
import Card from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import EvaluacionesPanel from '../../components/evaluaciones/EvaluacionesPanel'
import EjerciciosSalon from '../../components/ejercicios/EjerciciosSalon'
import SeguimientoSalon from '../../components/seguimiento/SeguimientoSalon'
import useCarga from '../../hooks/useCarga'
import { horariosTexto, portadaDe } from '../../lib/recursos'
import { formatFecha } from '../../lib/salones'
import * as asistenciaReal from '../../services/asistencia'
import * as evaluacionesReal from '../../services/evaluaciones'
import * as servicioReal from '../../services/portal'

// Salón del docente: gestión de secciones y lecciones (crear, editar, reordenar, ocultar) y lista de estudiantes matriculados.
export default function SalonDocente({ salon, onVolver, servicio = servicioReal, asistencia = asistenciaReal, evaluaciones = evaluacionesReal }) {
  const [pestana, setPestana] = useState('clases')
  const cargarEstudiantes = useCallback(() => servicio.estudiantesDelSalon(salon.salon_id), [servicio, salon.salon_id])
  const estudiantes = useCarga(cargarEstudiantes, [])

  return (
    <>
      <button onClick={onVolver} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <Icon name="back" className="h-4 w-4" /> My classrooms
      </button>
      <div className={`mb-6 rounded-2xl bg-gradient-to-br p-6 text-white shadow-sm ${portadaDe(salon.nombre)}`}>
        <p className="text-sm text-white/80">{salon.nivel || 'No level assigned'}</p>
        <h1 className="mt-1 text-2xl font-semibold">{salon.nombre}</h1>
        <p className="mt-2 text-sm text-white/90">
          {horariosTexto(salon.horarios)} · {salon.estudiantes} of {salon.capacidad} students
        </p>
      </div>

      <div className="mb-4 flex gap-1 border-b border-slate-200" role="tablist">
        {[
          ['clases', 'Classes and attendance'],
          ['evaluaciones', 'Assessments'],
          ['ejercicios', 'Exercises'],
          ['recursos', 'Course resources'],
          ['estudiantes', `Students (${salon.estudiantes})`],
        ].map(([id, texto]) => (
          <button
            key={id}
            role="tab"
            aria-selected={pestana === id}
            onClick={() => setPestana(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${pestana === id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {texto}
          </button>
        ))}
      </div>

      {pestana === 'clases' ? (
        <SeguimientoSalon salonId={salon.salon_id} servicio={asistencia} portal={servicio} />
      ) : pestana === 'ejercicios' ? (
        <EjerciciosSalon salonId={salon.salon_id} />
      ) : pestana === 'evaluaciones' ? (
        <EvaluacionesPanel salonId={salon.salon_id} servicio={evaluaciones} />
      ) : pestana === 'estudiantes' ? (
        <Card>
          {estudiantes.error ? (
            <p className="px-4 py-6 text-sm text-red-600">Could not load the list: {estudiantes.error}</p>
          ) : estudiantes.cargando ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Loading…</p>
          ) : estudiantes.datos.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">This classroom has no students enrolled yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {estudiantes.datos.map((e) => (
                <li key={e.alumno_id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium text-slate-900">{e.nombre}</span>
                  <span className="text-xs text-slate-500">Since {formatFecha(e.desde)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <GestionContenido salonId={salon.salon_id} servicio={servicio} />
      )}
    </>
  )
}
