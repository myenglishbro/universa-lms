import { useCallback, useRef, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Field, { inputClass } from '../ui/Field'
import Modal from '../ui/Modal'
import useCarga from '../../hooks/useCarga'
import { TIPOS_COMPONENTE, fmtNota, sumaPesos } from '../../lib/evaluaciones'
import * as servicioReal from '../../services/evaluaciones'

const estadoColor = { borrador: 'peach', vigente: 'brand', archivada: 'slate' }

function PlantillaForm({ niveles, onClose, onSave }) {
  const [v, setV] = useState({ nombre: '', descripcion: '', nivelId: '' })
  const [error, setError] = useState('')
  return (
    <Modal title="New template" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await onSave(v)
          } catch (err) {
            setError(err.message)
          }
        }}
      >
        <Field label="Name" value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} required />
        <Field label="Description (optional)" value={v.descripcion} onChange={(e) => setV({ ...v, descripcion: e.target.value })} />
        <Field label="Reference level (optional)" options={[{ value: '', label: 'None' }, ...niveles.map((n) => ({ value: n.id, label: n.nombre }))]} value={v.nivelId} onChange={(e) => setV({ ...v, nivelId: e.target.value })} hint="Only identifies the template; it is not applied to any classroom automatically." />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </Modal>
  )
}

function VersionForm({ plantilla, version, rubricas, onClose, onSave }) {
  const [escala, setEscala] = useState(String(version.escala_puntos))
  const [notas, setNotas] = useState(version.notas ?? '')
  const [comps, setComps] = useState(version.componentes.map((c) => ({ nombre: c.nombre, tipo: c.tipo, peso: String(c.peso), rubrica_id: c.rubrica_id ?? '', peso_final: c.peso_final != null ? String(c.peso_final) : '', nombre_final: c.nombre_final ?? '', peso_participacion: c.peso_participacion != null ? String(c.peso_participacion) : '20' })))
  const [conFinal, setConFinal] = useState(version.componentes.some((c) => c.peso_final != null))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const suma = sumaPesos(comps)
  const ok = suma === Number(escala)
  const sumaFinal = Math.round(comps.reduce((s, c) => s + (Number(c.peso_final) || 0), 0) * 100) / 100
  const okFinal = !conFinal || sumaFinal === Number(escala)
  const set = (i, parche) => setComps((l) => l.map((c, j) => (j === i ? { ...c, ...parche } : c)))
  return (
    <Modal title={`${plantilla.nombre} · version ${version.version}`} onClose={onClose} wide>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setGuardando(true)
          setError('')
          try {
            await onSave({
              escala_puntos: Number(escala),
              notas,
              componentes: comps.map((c) => ({ nombre: c.nombre, tipo: c.tipo, peso: Number(c.peso), rubrica_id: c.rubrica_id || null, peso_final: conFinal ? Number(c.peso_final) : null, nombre_final: conFinal ? c.nombre_final || null : null, peso_participacion: c.tipo === 'formative' ? Number(c.peso_participacion === '' ? 20 : c.peso_participacion) : null })),
            })
          } catch (err) {
            setError(err.message)
            setGuardando(false)
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Module point scale" type="number" min="1" step="0.01" value={escala} onChange={(e) => setEscala(e.target.value)} hint="Weights must add up to this figure (e.g. 100, or 25 if each module contributes 25 points)." required />
          <Field label="Notes (optional)" value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
        <ul className="space-y-2">
          {comps.map((c, i) => (
            <li key={i} className={`grid grid-cols-[1fr_6rem] gap-2 ${conFinal ? 'sm:grid-cols-[1fr_9rem_6rem_6rem_9rem_10rem_auto]' : 'sm:grid-cols-[1fr_9rem_6rem_10rem_auto]'}`}>
              <input aria-label={`Name of component ${i + 1}`} className={inputClass} placeholder="Component" value={c.nombre} onChange={(e) => set(i, { nombre: e.target.value })} required />
              <input aria-label={`Weight of component ${i + 1}`} type="number" min="0" step="0.01" className={`${inputClass} text-right sm:order-3`} placeholder="Weight" value={c.peso} onChange={(e) => set(i, { peso: e.target.value })} required />
              <select aria-label={`Type of component ${i + 1}`} className={`${inputClass} sm:order-2`} value={c.tipo} onChange={(e) => set(i, { tipo: e.target.value })}>
                {TIPOS_COMPONENTE.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {conFinal && (
                <>
                  <input aria-label={`Weight in the final module of component ${i + 1}`} type="number" min="0" step="0.01" className={`${inputClass} text-right sm:order-4`} placeholder="Final weight" value={c.peso_final} onChange={(e) => set(i, { peso_final: e.target.value })} />
                  <input aria-label={`Name in the final module of component ${i + 1}`} className={`${inputClass} sm:order-5`} placeholder={c.nombre || 'Name in the final'} value={c.nombre_final} onChange={(e) => set(i, { nombre_final: e.target.value })} />
                </>
              )}
              <select aria-label={`Rubric of component ${i + 1}`} className={`${inputClass} sm:order-6`} value={c.rubrica_id} onChange={(e) => set(i, { rubrica_id: e.target.value })}>
                <option value="">No rubric</option>
                {rubricas.filter((r) => r.activa).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
              <Button type="button" variant="ghost" className="px-2 py-1 text-xs sm:order-7" onClick={() => setComps((l) => l.filter((_, j) => j !== i))}>
                Remove
              </Button>
              {c.tipo === 'formative' && (
                <label className="col-span-full flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900 sm:order-8">
                  Participation per class within the Formative:
                  <input aria-label={`Participation percentage of component ${i + 1}`} type="number" min="0" max="100" step="1" className={`${inputClass} w-20 text-right`} value={c.peso_participacion} onChange={(e) => set(i, { peso_participacion: e.target.value })} />
                  % · el {100 - (Number(c.peso_participacion) || 0)} % restante es el promedio de las 3 unidades (5 criterios cada una). Usa la rúbrica «Formative Assessment».
                </label>
              )}
            </li>
          ))}
        </ul>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={conFinal} onChange={(e) => setConFinal(e.target.checked)} />
          El módulo final (último módulo del nivel) usa pesos y nombres distintos
        </label>
        <Button type="button" variant="secondary" onClick={() => setComps((l) => [...l, { nombre: '', tipo: 'otro', peso: '', rubrica_id: '', peso_final: '', nombre_final: '', peso_participacion: '20' }])}>
          Add component
        </Button>
        <p className={`text-sm ${ok ? 'text-brand-700' : 'text-peach-700'}`} role="status">
          Modules 1 to 3: weights add up to {fmtNota(suma)} of {fmtNota(escala)} {ok ? '· ready' : '· must add up to the scale'}
        </p>
        {conFinal && (
          <p className={`text-sm ${okFinal ? 'text-brand-700' : 'text-peach-700'}`} role="status">
            Final module: weights add up to {fmtNota(sumaFinal)} of {fmtNota(escala)} {okFinal ? '· ready' : '· must add up to the scale'}
          </p>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={guardando}>
            Save draft
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function VersionVista({ plantilla, version, rubricas, onClose }) {
  const conFinal = version.componentes.some((c) => c.peso_final != null)
  const tipo = (v) => TIPOS_COMPONENTE.find((t) => t.value === v)?.label ?? v
  const rubrica = (id) => rubricas.find((x) => x.id === id)?.nombre ?? '—'
  return (
    <Modal title={`${plantilla.nombre} · version ${version.version}`} onClose={onClose} wide>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          <Badge color={estadoColor[version.estado]}>{version.estado}</Badge> Scale {fmtNota(version.escala_puntos)} points per module. Read-only.
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2">Componente</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Modules 1 to 3</th>
                {conFinal && <th className="px-3 py-2 text-right">Final module</th>}
                <th className="px-3 py-2">Rubric</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {version.componentes.map((c) => (
                <tr key={c.nombre}>
                  <td className="px-3 py-2 font-medium text-slate-900">{c.nombre}</td>
                  <td className="px-3 py-2 text-slate-600">{tipo(c.tipo)}</td>
                  <td className="px-3 py-2 text-right">{fmtNota(c.peso)}</td>
                  {conFinal && (
                    <td className="px-3 py-2 text-right">
                      {fmtNota(c.peso_final)}
                      {c.nombre_final && c.nombre_final !== c.nombre && <span className="ml-1 text-xs text-slate-400">({c.nombre_final})</span>}
                    </td>
                  )}
                  <td className="px-3 py-2 text-slate-600">{c.rubrica_id ? rubrica(c.rubrica_id) : c.tipo === 'participacion' ? 'Participation per class' : '—'}
                    {c.tipo === 'formative' && <span className="block text-xs text-slate-400">3 units + {fmtNota(c.peso_participacion ?? 0)} % participation</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 text-sm font-semibold text-slate-900">
              <tr>
                <td className="px-3 py-2" colSpan={2}>Suma</td>
                <td className="px-3 py-2 text-right">{fmtNota(sumaPesos(version.componentes))}</td>
                {conFinal && <td className="px-3 py-2 text-right">{fmtNota(version.componentes.reduce((t, c) => t + Number(c.peso_final || 0), 0))}</td>}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {version.notas && <p className="text-xs text-slate-500">{version.notas}</p>}
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// Administración: plantillas con versiones. Una versión vigente no se edita: se crea una nueva para cambiar pesos.
export default function PlantillasAdmin({ niveles = [], servicio = servicioReal }) {
  const cargar = useCallback(async () => {
    const [plantillas, rubricas] = await Promise.all([servicio.listarPlantillas(), servicio.listarRubricas()])
    return { plantillas, rubricas }
  }, [servicio])
  const { datos, cargando, error, recargar } = useCarga(cargar, null)
  const [modal, setModal] = useState(null)
  const [verAntiguas, setVerAntiguas] = useState({}) // plantillaId → true
  const [aviso, setAviso] = useState('')
  const [fallo, setFallo] = useState('')
  const enCurso = useRef(false)

  const ejecutar = async (fn, ok) => {
    if (enCurso.current) return
    enCurso.current = true
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
    }
  }

  if (error) return <p className="text-sm text-red-600">Could not load the templates: {error}</p>
  if (cargando || !datos) return <p className="py-6 text-center text-sm text-slate-500">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-slate-500">
          A template defines a module's components and their weights. The Universa Grade Chart is assigned automatically when a group is created: the last module of the last cycle uses the final-module weights and the others use those of modules 1 to 3. To change weights, create a new version: modules that already exist keep the previous one.
        </p>
        <Button onClick={() => setModal({ tipo: 'plantilla' })}>New template</Button>
      </div>
      {aviso && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{aviso}</p>}
      {fallo && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fallo}</p>}
      {datos.plantillas.map((p) => (
        <Card key={p.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{p.nombre}</h2>
              {p.descripcion && <p className="text-xs text-slate-500">{p.descripcion}</p>}
            </div>
            {!p.versiones.some((v) => v.estado === 'borrador') && (
              <Button variant="secondary" className="px-3 py-1.5" onClick={() => ejecutar(() => servicio.nuevaVersion(p.id), 'New version created as a draft.')}>
                New version
              </Button>
            )}
          </div>
          <ul className="mt-3 space-y-3">
            {p.versiones.filter((v) => v.estado !== 'archivada' || verAntiguas[p.id]).map((v) => (
              <li key={v.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">
                    Version {v.version} <Badge color={estadoColor[v.estado]}>{{ vigente: 'current · used by new groups', borrador: 'new · draft', archivada: 'previous' }[v.estado] ?? v.estado}</Badge> <span className="text-xs font-normal text-slate-500">scale {fmtNota(v.escala_puntos)}</span>
                  </p>
                  <Button variant="ghost" className="px-3 py-1" aria-label={`View version ${v.version} of ${p.nombre}`} onClick={() => setModal({ tipo: 'ver', plantilla: p, version: v })}>
                    View
                  </Button>
                  {v.estado === 'borrador' && (
                    <span className="flex gap-1">
                      <Button variant="secondary" className="px-3 py-1" onClick={() => setModal({ tipo: 'version', plantilla: p, version: v })}>
                        Edit
                      </Button>
                      <Button className="px-3 py-1" onClick={() => ejecutar(() => servicio.activarVersion(v.id), 'Version activated: it can now be assigned to modules.')}>
                        Activate
                      </Button>
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {v.componentes.length === 0 ? 'No components.' : v.componentes.map((c) => `${c.nombre} ${fmtNota(c.peso)}`).join(' · ')}
                  {v.componentes.length > 0 && ` · suma ${fmtNota(sumaPesos(v.componentes))}`}
                </p>
                <p className="text-xs text-slate-600">
                  {v.componentes.some((c) => c.peso_final != null) && `Final module: ${v.componentes.map((c) => `${c.nombre_final || c.nombre} ${fmtNota(c.peso_final)}`).join(' · ')} · total ${fmtNota(v.componentes.reduce((s, c) => s + Number(c.peso_final || 0), 0))}`}
                </p>
                {v.notas && <p className="mt-0.5 text-xs text-slate-400">{v.notas}</p>}
              </li>
            ))}
          </ul>
          {p.versiones.some((v) => v.estado === 'archivada') && (
            <button type="button" className="mt-2 text-xs text-brand-700 underline" aria-expanded={!!verAntiguas[p.id]} onClick={() => setVerAntiguas((x) => ({ ...x, [p.id]: !x[p.id] }))}>
              {verAntiguas[p.id] ? 'Hide previous versions' : `View previous versions (${p.versiones.filter((v) => v.estado === 'archivada').length})`}
            </button>
          )}
        </Card>
      ))}

      {modal?.tipo === 'plantilla' && (
        <PlantillaForm
          niveles={niveles}
          onClose={() => setModal(null)}
          onSave={async (v) => {
            await servicio.guardarPlantilla(null, v)
            setModal(null)
            await recargar()
          }}
        />
      )}
      {modal?.tipo === 'ver' && <VersionVista plantilla={modal.plantilla} version={modal.version} rubricas={datos.rubricas} onClose={() => setModal(null)} />}
      {modal?.tipo === 'version' && (
        <VersionForm
          plantilla={modal.plantilla}
          version={modal.version}
          rubricas={datos.rubricas}
          onClose={() => setModal(null)}
          onSave={async (v) => {
            await servicio.guardarVersion(modal.version.id, v)
            setModal(null)
            setAviso('Draft saved.')
            await recargar()
          }}
        />
      )}
    </div>
  )
}
