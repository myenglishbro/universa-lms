import { useCallback, useRef, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Field, { inputClass } from '../ui/Field'
import useCarga from '../../hooks/useCarga'
import { fmtNota } from '../../lib/evaluaciones'
import * as servicioReal from '../../services/evaluaciones'

const estadoColor = { registrado: 'peach', aplicado: 'brand', anulado: 'slate' }

// Examen remedial: el docente (o administración) registra la nota; SOLO administración la aplica, y solo con confirmación explícita.
// Aplicar reemplaza el resultado del módulo o del ciclo elegido, conserva el original y se puede anular.
export default function RemedialesSalon({ salonId, servicio = servicioReal, puedeAplicar = false }) {
  const cargar = useCallback(async () => {
    const [lista, matriz] = await Promise.all([servicio.remedialesSalon(salonId), servicio.matrizSalon(salonId)])
    return { lista, matriz }
  }, [servicio, salonId])
  const { datos, cargando, error, recargar } = useCarga(cargar, null)
  const [f, setF] = useState({ alumnoId: '', ambito: 'modulo', moduloId: '', ciclo: '', nota: '', comentario: '' })
  const [confirmando, setConfirmando] = useState(null) // id del remedial que se está por aplicar
  const [anulando, setAnulando] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [aviso, setAviso] = useState('')
  const [fallo, setFallo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const enCurso = useRef(false)

  const ejecutar = async (fn, ok) => {
    if (enCurso.current) return
    enCurso.current = true
    setOcupado(true)
    setAviso('')
    setFallo('')
    try {
      await fn()
      setAviso(ok)
      await recargar()
    } catch (e) {
      setFallo(e.message)
    } finally {
      enCurso.current = false
      setOcupado(false)
    }
  }

  if (error) return <p className="text-sm text-red-600">Could not load the remedials: {error}</p>
  if (cargando || !datos) return <p className="py-4 text-sm text-slate-400">Loading…</p>
  const { lista, matriz } = datos
  const ciclos = [...new Set(matriz.modulos.map((m) => m.ciclo).filter((c) => c != null))].sort((a, b) => a - b)
  const listo = f.alumnoId && f.nota !== '' && (f.ambito === 'modulo' ? f.moduloId : f.ciclo)

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        The remedial exam is recorded first and <strong>does not change any result until administration applies it</strong>. Applying it replaces the chosen module (or cycle) result; the original grade is kept and the replacement can be voided. The minimum grade, number of attempts and conditions are pending Coordination confirmation: the system does not validate them.
      </p>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-slate-900">Record remedial</h3>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            ejecutar(async () => {
              await servicio.registrarRemedial(salonId, f)
              setF({ alumnoId: '', ambito: 'modulo', moduloId: '', ciclo: '', nota: '', comentario: '' })
            }, 'Remedial recorded. It does not replace any result yet: administration still needs to apply it.')
          }}
        >
          <Field label="Student" options={[{ value: '', label: 'Choose…' }, ...matriz.alumnos.map((a) => ({ value: a.alumno_id, label: a.nombre }))]} value={f.alumnoId} onChange={(e) => setF({ ...f, alumnoId: e.target.value })} aria-label="Remedial student" />
          <Field label="Replaces" options={[{ value: 'modulo', label: 'A module result' }, { value: 'ciclo', label: 'A cycle result' }]} value={f.ambito} onChange={(e) => setF({ ...f, ambito: e.target.value })} aria-label="Remedial scope" />
          {f.ambito === 'modulo' ? (
            <Field label="Module" options={[{ value: '', label: 'Choose…' }, ...matriz.modulos.filter((m) => m.version_id).map((m) => ({ value: m.id, label: m.nombre }))]} value={f.moduloId} onChange={(e) => setF({ ...f, moduloId: e.target.value })} aria-label="Remedial module" />
          ) : (
            <Field label="Cycle" options={[{ value: '', label: ciclos.length ? 'Elegir…' : 'The modules have no cycle' }, ...ciclos.map((c) => ({ value: String(c), label: `Cycle ${c}` }))]} value={f.ciclo} onChange={(e) => setF({ ...f, ciclo: e.target.value })} aria-label="Remedial cycle" />
          )}
          <Field label="Remedial grade (0–100)" type="number" min="0" max="100" step="0.01" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} aria-label="Remedial grade" />
          <div className="sm:col-span-2">
            <Field label="Comment (optional)" value={f.comentario} onChange={(e) => setF({ ...f, comentario: e.target.value })} aria-label="Remedial comment" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={ocupado || !listo}>
              Record remedial
            </Button>
          </div>
        </form>
      </Card>

      {aviso && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{aviso}</p>}
      {fallo && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fallo}</p>}

      {lista.length === 0 ? (
        <p className="text-sm text-slate-400">There are no remedials recorded in this classroom.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {lista.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">
                  {r.alumno} · {r.ambito === 'modulo' ? r.modulo : `Cycle ${r.ciclo}`} · remedial grade {fmtNota(r.nota)} <Badge color={estadoColor[r.estado]}>{r.estado}</Badge>
                </p>
                {puedeAplicar && r.estado === 'registrado' && confirmando !== r.id && (
                  <Button className="px-3 py-1" disabled={ocupado} onClick={() => setConfirmando(r.id)}>
                    Aplicar
                  </Button>
                )}
                {puedeAplicar && r.estado !== 'anulado' && anulando !== r.id && (
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setAnulando(r.id)}>
                    Anular
                  </Button>
                )}
              </div>
              {r.comentario && <p className="text-xs text-slate-500">{r.comentario}</p>}
              {r.original && (
                <p className="text-xs text-slate-500">
                  Replaced result (original kept): {fmtNota(r.original.puntos)} points
                  {r.original.nota != null && ` · grade ${fmtNota(r.original.nota)}`}
                </p>
              )}
              {r.motivo_anulacion && <p className="text-xs text-slate-500">Anulado: {r.motivo_anulacion}</p>}
              {confirmando === r.id && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-peach-50 p-2 text-sm">
                  <span>
                    Do you confirm that the grade of {fmtNota(r.nota)} replaces the result {r.ambito === 'modulo' ? `of ${r.modulo}` : `of cycle ${r.ciclo}`} for {r.alumno}?
                  </span>
                  <Button className="px-3 py-1" disabled={ocupado} onClick={() => ejecutar(async () => { await servicio.aplicarRemedial(r.id); setConfirmando(null) }, 'Remedial applied. The original result is kept.')}>
                    Yes, apply
                  </Button>
                  <Button variant="ghost" className="px-2 py-1" onClick={() => setConfirmando(null)}>
                    Cancel
                  </Button>
                </div>
              )}
              {anulando === r.id && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
                  <input className={`${inputClass} min-w-48 flex-1`} aria-label="Reason for voiding" placeholder="Reason for voiding (required)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  <Button className="px-3 py-1" disabled={ocupado} onClick={() => ejecutar(async () => { if (motivo.trim().length < 3) throw new Error('Enter the reason for voiding'); await servicio.anularRemedial(r.id, motivo); setAnulando(null); setMotivo('') }, 'Remedial voided: the original result is back.')}>
                    Confirm voiding
                  </Button>
                  <Button variant="ghost" className="px-2 py-1" onClick={() => setAnulando(null)}>
                    Cancel
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
