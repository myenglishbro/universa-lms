import { useState } from 'react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { descargarRespaldo } from '../../services/respaldo'

// Respaldo en Excel de todos los salones. Sin notas usa lo que el panel ya tiene cargado (cero consultas nuevas); con notas pide la matriz de cada salón vigente.
export default function RespaldoSalonesModal({ salones, estudiantes, matriculas, onClose }) {
  const [conNotas, setConNotas] = useState(true)
  const [estado, setEstado] = useState('inicio') // inicio | generando | listo
  const [avance, setAvance] = useState(null)
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const vigentes = salones.filter((s) => !s.archivadoAt).length

  const generar = async () => {
    setError('')
    setAviso('')
    setEstado('generando')
    try {
      const r = await descargarRespaldo({ salones, estudiantes, matriculas }, { conNotas, alAvanzar: (h, t) => setAvance({ h, t }) })
      setAviso(r.fallidos > 0 ? `${r.nombre} downloaded. Grades of ${r.fallidos} classroom${r.fallidos === 1 ? '' : 's'} could not be read and are missing from the file.` : `${r.nombre} downloaded.`)
      setEstado('listo')
    } catch (e) {
      setError(e.message)
      setEstado('inicio')
    }
  }

  return (
    <Modal title="Back up classrooms (Excel)" onClose={onClose}>
      <p className="text-sm text-slate-600">
        One Excel file with the {salones.length} classrooms ({vigentes} active, {salones.length - vigentes} archived): classroom details, enrolled students, schedules and, if you choose, module grades.
      </p>
      <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" className="mt-1" checked={conNotas} disabled={estado === 'generando'} onChange={(e) => setConNotas(e.target.checked)} />
        <span>
          Include grades of active classrooms
          <span className="block text-xs text-slate-500">Reads each classroom once ({vigentes} queries, 3 at a time). Without grades, nothing new is requested from the server.</span>
        </span>
      </label>
      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">The file contains students&apos; names, emails and phones. Keep it somewhere secure. For one classroom&apos;s full assessment file (rubrics, attendance, charts) use its own “Download Excel”.</p>
      {estado === 'generando' && avance && <p className="mt-3 text-sm text-slate-600" role="status">Reading grades… {avance.h} of {avance.t} classrooms</p>}
      {aviso && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{aviso}</p>}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Could not generate the file: {error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {estado === 'listo' ? 'Close' : 'Cancel'}
        </Button>
        <Button onClick={generar} disabled={estado === 'generando'}>
          {estado === 'generando' ? 'Preparing…' : 'Download Excel'}
        </Button>
      </div>
    </Modal>
  )
}
