import { useState } from 'react'
import Button from '../ui/Button'
import Field, { inputClass } from '../ui/Field'
import Modal from '../ui/Modal'
import { formatos, horasSemanaTexto } from '../../lib/frecuencias'
import { diasSemana } from '../../lib/salones'

const vacia = { nombre: '', formato: 'grupal', intensidad: '', clases: 3, minutos: [60, 60, 60], dias: [], modalidadIds: [], estado: 'confirmado', activa: true, notas: '' }

// Alta y edición de una frecuencia. `frecuencia` null = crear. La base de datos vuelve a validar todo al guardar.
export default function FrecuenciaForm({ frecuencia, modalidades, intensidades, onSave, onClose }) {
  const [v, setV] = useState(
    frecuencia
      ? { ...frecuencia, clases: frecuencia.clases ?? '', minutos: frecuencia.minutos ?? [], dias: frecuencia.dias ?? [] }
      : { ...vacia, modalidadIds: modalidades.filter((m) => m.codigo === 'estandar').map((m) => m.id) },
  )
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cambiar = (e) => setV({ ...v, [e.target.name]: e.target.value })
  const alternar = (campo, valor) =>
    setV((a) => ({ ...a, [campo]: a[campo].includes(valor) ? a[campo].filter((x) => x !== valor) : [...a[campo], valor] }))

  // Al cambiar la cantidad de clases se ajusta la lista de duraciones (las nuevas copian la última).
  const cambiarClases = (e) => {
    const n = e.target.value === '' ? '' : Math.max(1, Math.min(7, Number(e.target.value)))
    setV((a) => {
      const base = a.minutos.length ? a.minutos : [60]
      const minutos = n === '' ? a.minutos : Array.from({ length: n }, (_, i) => base[i] ?? base[base.length - 1])
      return { ...a, clases: n, minutos }
    })
  }
  const cambiarMinutos = (i, valor) => setV((a) => ({ ...a, minutos: a.minutos.map((m, j) => (j === i ? valor : m)) }))

  const minutosNum = v.minutos.map(Number)
  const completa = v.clases !== '' && minutosNum.length === Number(v.clases) && minutosNum.every((m) => m > 0)
  const horas = completa ? minutosNum.reduce((t, m) => t + m, 0) / 60 : null
  const confirmada = v.estado === 'confirmado'

  const guardar = async (ev) => {
    ev.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await onSave(frecuencia?.id ?? null, {
        ...v,
        clases: v.clases === '' ? null : Number(v.clases),
        minutos: completa ? minutosNum : [],
        activa: v.activa && confirmada,
      })
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal wide title={frecuencia ? 'Editar frecuencia' : 'Nueva frecuencia'} onClose={onClose}>
      <form onSubmit={guardar} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" name="nombre" value={v.nombre} onChange={cambiar} required hint="Ej.: Diario 3, Interdiario 6" />
          <Field label="Formato" name="formato" value={v.formato} onChange={cambiar} options={formatos} />
          <div>
            <Field label="Intensidad" name="intensidad" value={v.intensidad} onChange={cambiar} list="intensidades" />
            <datalist id="intensidades">
              {intensidades.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </div>
          <Field label="Clases por semana" name="clases" type="number" min="1" max="7" step="1" value={v.clases} onChange={cambiarClases} />
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Duración de cada clase (minutos)</p>
          {v.minutos.length === 0 ? (
            <p className="text-xs text-slate-500">Indica las clases por semana para definir la duración de cada una.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {v.minutos.map((m, i) => (
                <label key={i} className="text-xs text-slate-500">
                  Clase {i + 1}
                  <input type="number" min="1" step="5" value={m} onChange={(e) => cambiarMinutos(i, e.target.value)} className={`${inputClass} mt-0.5 w-24`} required />
                </label>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">
            {completa ? `Total: ${horasSemanaTexto({ horasSemana: horas })}. ` : ''}Las clases pueden tener distinta duración (p. ej. 120, 120 y 60).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-700">
              Días <span className="font-normal text-slate-400">(opcional)</span>
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {diasSemana.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => alternar('dias', d.value)}
                  aria-pressed={v.dias.includes(d.value)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    v.dias.includes(d.value) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {d.corto}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">Márcalos solo si Coordinación los define. Si no, el salón puede usar cualquier día. Un horario distinto solo genera un aviso.</p>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-700">Modalidades compatibles</legend>
            <div className="space-y-1">
              {modalidades.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={v.modalidadIds.includes(m.id)} onChange={() => alternar('modalidadIds', m.id)} />
                  {m.nombre} <span className="text-xs text-slate-500">({m.horas_referencia_nivel} h por nivel)</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">Define con qué modalidad se ofrece y para cuál se calcula la duración teórica.</p>
          </fieldset>
        </div>

        <div className="space-y-2 rounded-lg bg-slate-50 px-3 py-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={confirmada} onChange={(e) => setV({ ...v, estado: e.target.checked ? 'confirmado' : 'pendiente', activa: e.target.checked ? v.activa : false })} />
            Confirmada por Coordinación
          </label>
          <label className={`flex items-center gap-2 text-sm ${confirmada ? 'text-slate-700' : 'text-slate-400'}`}>
            <input type="checkbox" checked={v.activa && confirmada} disabled={!confirmada} onChange={(e) => setV({ ...v, activa: e.target.checked })} />
            Activa (disponible al crear salones)
          </label>
          {!confirmada && <p className="text-xs text-slate-500">Una frecuencia pendiente no puede estar activa.</p>}
        </div>

        <Field label="Notas" name="notas" as="textarea" rows="2" value={v.notas} onChange={cambiar} />

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : frecuencia ? 'Guardar cambios' : 'Crear frecuencia'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
