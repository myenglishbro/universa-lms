import { useState } from 'react'
import PendientesAdmin from '../components/evaluaciones/PendientesAdmin'
import PlantillasAdmin from '../components/evaluaciones/PlantillasAdmin'
import RubricasAdmin from '../components/evaluaciones/RubricasAdmin'
import PageHeader from '../components/ui/PageHeader'

// Administración: plantillas de evaluación (versionadas) y rúbricas. Los módulos y resultados de cada salón están en el detalle del salón.
export default function Evaluaciones({ niveles = [], onVerSalon }) {
  const [pestana, setPestana] = useState('plantillas')
  return (
    <>
      <PageHeader title="Assessments" description="Grade Chart with its weightings and rubrics. Each group receives it automatically when created." />
      <div className="mb-4 flex gap-1 border-b border-slate-200" role="tablist">
        {[['plantillas', 'Templates'], ['rubricas', 'Rubrics'], ['pendientes', 'Teacher pending items']].map(([id, texto]) => (
          <button key={id} role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${pestana === id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {texto}
          </button>
        ))}
      </div>
      {pestana === 'plantillas' ? <PlantillasAdmin niveles={niveles} /> : pestana === 'rubricas' ? <RubricasAdmin /> : <PendientesAdmin onVerSalon={onVerSalon} />}
    </>
  )
}
