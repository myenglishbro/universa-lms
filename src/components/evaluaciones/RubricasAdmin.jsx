import { useCallback, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Field, { inputClass } from '../ui/Field'
import Modal from '../ui/Modal'
import useCarga from '../../hooks/useCarga'
import { TIPOS_RUBRICA, fmtNota, sumaPesos } from '../../lib/evaluaciones'
import * as servicioReal from '../../services/evaluaciones'

const vacia = { nombre: '', tipo: 'otra', descripcion: '', activa: true, criterios: [{ nombre: '', max_puntaje: '10', bandas: [] }] }

function RubricaForm({ rubrica, onClose, onSave }) {
  const [v, setV] = useState(() =>
    rubrica
      ? { nombre: rubrica.nombre, tipo: rubrica.tipo, descripcion: rubrica.descripcion ?? '', activa: rubrica.activa, criterios: rubrica.criterios.map((c) => ({ nombre: c.nombre, descripcion: c.descripcion ?? '', max_puntaje: String(c.max_puntaje), bandas: c.bandas ?? [] })) }
      : vacia,
  )
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const total = sumaPesos(v.criterios.map((c) => ({ peso: c.max_puntaje })))
  const setC = (i, parche) => setV((p) => ({ ...p, criterios: p.criterios.map((c, j) => (j === i ? { ...c, ...parche } : c)) }))
  return (
    <Modal title={rubrica ? `Edit rubric · ${rubrica.nombre}` : 'New rubric'} onClose={onClose} wide>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setGuardando(true)
          setError('')
          try {
            await onSave({ ...v, criterios: v.criterios.map((c) => ({ ...c, max_puntaje: Number(c.max_puntaje) })) })
          } catch (err) {
            setError(err.message)
            setGuardando(false)
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} required />
          <Field label="Type" options={TIPOS_RUBRICA} value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })} />
        </div>
        <Field label="Description (optional)" value={v.descripcion} onChange={(e) => setV({ ...v, descripcion: e.target.value })} />
        <ul className="space-y-2">
          {v.criterios.map((c, i) => (
            <li key={i} className="grid grid-cols-[1fr_6rem_auto] gap-2">
              <input aria-label={`Criterion ${i + 1}`} className={inputClass} placeholder="Criterion" value={c.nombre} onChange={(e) => setC(i, { nombre: e.target.value })} required />
              <input aria-label={`Maximum of criterion ${i + 1}`} type="number" min="0.5" step="0.5" className={`${inputClass} text-right`} placeholder="Max." value={c.max_puntaje} onChange={(e) => setC(i, { max_puntaje: e.target.value })} required />
              <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => setV((p) => ({ ...p, criterios: p.criterios.filter((_, j) => j !== i) }))}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="secondary" onClick={() => setV((p) => ({ ...p, criterios: [...p.criterios, { nombre: '', max_puntaje: '10', bandas: [] }] }))}>
          Add criterion
        </Button>
        <p className="text-sm text-slate-600" role="status">
          Maximum rubric score: <strong>{fmtNota(total)}</strong>. The grade (0–100) is calculated as score obtained ÷ maximum × 100.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={v.activa} onChange={(e) => setV({ ...v, activa: e.target.checked })} /> Active rubric
        </label>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={guardando}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// Administración: rúbricas editables. Las notas ya puestas guardan su propia copia de los criterios, así que editar no las altera.
export default function RubricasAdmin({ servicio = servicioReal }) {
  const cargar = useCallback(() => servicio.listarRubricas(), [servicio])
  const { datos, cargando, error, recargar } = useCarga(cargar, null)
  const [modal, setModal] = useState(null)
  if (error) return <p className="text-sm text-red-600">Could not load the rubrics: {error}</p>
  if (cargando || !datos) return <p className="py-6 text-center text-sm text-slate-500">Loading…</p>
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-slate-500">Maximums are validated on save and the total is calculated from the criteria, so no criterion can be left out of the sum.</p>
        <Button onClick={() => setModal({ rubrica: null })}>New rubric</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {datos.map((r) => (
          <Card key={r.id} className={`p-5 ${r.activa ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {r.nombre} {!r.activa && <Badge color="slate">Inactive</Badge>}
                </h2>
                <p className="text-xs text-slate-500">
                  {r.criterios.length} criteria · maximum {fmtNota(sumaPesos(r.criterios.map((c) => ({ peso: c.max_puntaje }))))}
                </p>
              </div>
              <Button variant="secondary" className="px-3 py-1" onClick={() => setModal({ rubrica: r })}>
                Edit
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate-600">{r.criterios.map((c) => `${c.nombre} (${fmtNota(c.max_puntaje)})`).join(' · ')}</p>
          </Card>
        ))}
      </div>
      {modal && (
        <RubricaForm
          rubrica={modal.rubrica}
          onClose={() => setModal(null)}
          onSave={async (v) => {
            await servicio.guardarRubrica(modal.rubrica?.id ?? null, v)
            setModal(null)
            await recargar()
          }}
        />
      )}
    </div>
  )
}
