import { useState } from 'react'
import Modal from '../ui/Modal'
import Field from '../ui/Field'
import Button from '../ui/Button'
import { ciclosDelInforme, datosAuto } from '../../lib/informeNotas'

// Datos que completa quien emite el informe antes de imprimirlo (nada se inventa: lo vacío se imprime en blanco).
export default function InformeDialogo({ datos, onClose, onGenerar }) {
  const [v, setV] = useState(() => ({ idEstudiante: '', ranking: '', desempeno: '', estado: '', comentario: '', ...datosAuto(datos) }))
  const set = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.value }))
  const ciclos = ciclosDelInforme(datos).filter((c) => c.ciclo != null)
  return (
    <Modal title={`Report for ${datos.estudiante}`} onClose={onClose} wide>
      <p className="mb-4 text-sm text-slate-600">
        Horario, periodo, nivel y asistencia ya vienen del salón; puedes corregirlos aquí. El resto es opcional. El informe es de un solo ciclo (2 módulos). El nivel de desempeño y el resultado se calculan sobre 100 (aprueba con 70) cuando el ciclo está completo.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {ciclos.length > 1 && (
          <Field label="Report cycle" options={ciclos.map((c) => ({ value: String(c.ciclo), label: `Cycle ${c.ciclo}` }))} value={String(v.ciclo)} onChange={set('ciclo')} />
        )}
        <Field label="Student ID" value={v.idEstudiante} onChange={set('idEstudiante')} />
        <Field label="Nivel / CEFR" value={v.nivelCefr} onChange={set('nivelCefr')} placeholder="Ej. BASIC · A1.2 – A2.1" />
        <Field label="Schedule" value={v.horario} onChange={set('horario')} placeholder="E.g. Monday, Wednesday and Friday 7 PM" />
        <Field label="Cycle period" value={v.periodo} onChange={set('periodo')} placeholder="E.g. 02/11/2026 to 17/02/2027" />
      </div>
      <p className="mb-1 mt-4 text-sm font-medium text-slate-700">Attendance (number of classes)</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field label="Programadas" inputMode="numeric" value={v.programadas} onChange={set('programadas')} />
        <Field label="Presente" inputMode="numeric" value={v.presentes} onChange={set('presentes')} />
        <Field label="Tardanza" inputMode="numeric" value={v.tardanzas} onChange={set('tardanzas')} />
        <Field label="Falta injustificada" inputMode="numeric" value={v.ausencias} onChange={set('ausencias')} />
        <Field label="Falta justificada" inputMode="numeric" value={v.justificadas} onChange={set('justificadas')} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Class rank" value={v.ranking} onChange={set('ranking')} />
        <Field label="Performance level (optional)" value={v.desempeno} onChange={set('desempeno')} hint="Empty = per the scale" />
        <Field label="Result (optional)" value={v.estado} onChange={set('estado')} hint="Empty = per the grade" />
      </div>
      <Field className="mt-3" as="textarea" rows={3} label="Teacher comments and recommendations" value={v.comentario} onChange={set('comentario')} />
      <Field className="mt-3" label="Next step" value={v.siguiente} onChange={set('siguiente')} />
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => onGenerar(v)}>Generate report (PDF)</Button>
      </div>
    </Modal>
  )
}
