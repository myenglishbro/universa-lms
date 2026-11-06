import { useState } from 'react'
import * as servicioReal from '../../services/evaluaciones'
import CapturaRapida from './CapturaRapida'
import EvaluacionesSalon from './EvaluacionesSalon'
import MatrizNotas from './MatrizNotas'
import RemedialesSalon from './RemedialesSalon'

const PESTANAS = [
  ['matriz', 'Matriz de notas'],
  ['captura', 'Captura rápida'],
  ['evaluacion', 'Por evaluación'],
  ['remediales', 'Remediales'],
]

// Evaluaciones de un salón: la matriz (vista principal), el registro por evaluación (lista de estudiantes) y los remediales.
export default function EvaluacionesPanel({ salonId, servicio = servicioReal, esAdmin = false }) {
  const [pestana, setPestana] = useState('matriz')
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200" role="tablist" aria-label="Evaluaciones del salón">
        {PESTANAS.map(([id, texto]) => (
          <button key={id} role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${pestana === id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {texto}
          </button>
        ))}
      </div>
      {pestana === 'matriz' && <MatrizNotas salonId={salonId} servicio={servicio} />}
      {pestana === 'captura' && <CapturaRapida salonId={salonId} servicio={servicio} />}
      {pestana === 'evaluacion' && <EvaluacionesSalon salonId={salonId} servicio={servicio} />}
      {pestana === 'remediales' && <RemedialesSalon salonId={salonId} servicio={servicio} puedeAplicar={esAdmin} />}
    </div>
  )
}
