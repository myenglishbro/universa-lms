import { useState } from 'react'
import FrecuenciaForm from '../components/frecuencias/FrecuenciaForm'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { inputClass } from '../components/ui/Field'
import Icon from '../components/ui/Icon'
import PageHeader from '../components/ui/PageHeader'
import { estadoFrecuencia, estructuraTexto, formatoLabel, formatos, horasSemanaTexto, textoDuracion } from '../lib/frecuencias'
import { activarFrecuencia, guardarFrecuencia } from '../services/frecuencias'

const estadoBadge = { activa: ['brand', 'Activa'], inactiva: ['slate', 'Inactiva'], pendiente: ['peach', 'Pendiente'] }

// Administración de frecuencias de clase (solo administradores): listar, agregar, editar, activar y desactivar.
// Usa el catálogo ya cargado por la aplicación; tras cada cambio lo recarga para que «Nuevo salón» lo vea.
export default function Frecuencias({ catalogo, salones, onCambio }) {
  const { frecuencias, modalidades, errorFrecuencias, cargando } = catalogo
  const [formato, setFormato] = useState('')
  const [estado, setEstado] = useState('')
  const [form, setForm] = useState(null) // null = cerrado, { frecuencia } = abierto (frecuencia null = crear)
  const [error, setError] = useState('')
  const [ocupada, setOcupada] = useState(null)

  const usos = salones.reduce((m, s) => (s.frecuenciaId ? { ...m, [s.frecuenciaId]: (m[s.frecuenciaId] ?? 0) + 1 } : m), {})
  const visibles = frecuencias.filter((f) => (!formato || f.formato === formato) && (!estado || estadoFrecuencia(f) === estado))
  const intensidades = [...new Set(frecuencias.map((f) => f.intensidad).filter(Boolean))]

  const guardar = async (id, valores) => {
    await guardarFrecuencia(id, valores)
    await onCambio()
    setForm(null)
  }

  const alternar = async (f) => {
    setOcupada(f.id)
    setError('')
    try {
      await activarFrecuencia(f.id, !f.activa)
      await onCambio()
    } catch (e) {
      setError(e.message)
    } finally {
      setOcupada(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Frecuencias"
        description="Clases por semana y duración de cada clase, según Coordinación Académica"
        action={
          <Button onClick={() => setForm({ frecuencia: null })} disabled={cargando || Boolean(errorFrecuencias)}>
            <Icon name="plus" className="h-4 w-4" /> Nueva frecuencia
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <select value={formato} onChange={(e) => setFormato(e.target.value)} className={`${inputClass} w-auto`} aria-label="Filtrar por formato">
            <option value="">Todos los formatos</option>
            {formatos.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className={`${inputClass} w-auto`} aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            <option value="activa">Activas</option>
            <option value="inactiva">Inactivas</option>
            <option value="pendiente">Pendientes</option>
          </select>
          <p className="text-xs text-slate-500">
            Los salones usan frecuencias grupales activas. La duración teórica (horas del nivel ÷ horas por semana) no es una fecha de finalización.
          </p>
        </div>
        {error && <p className="px-4 pt-3 text-sm text-red-600">{error}</p>}

        {cargando ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Cargando frecuencias…</p>
        ) : errorFrecuencias ? (
          <p className="px-4 py-10 text-center text-sm text-red-600">No se pudieron cargar las frecuencias: {errorFrecuencias}</p>
        ) : visibles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Ninguna frecuencia coincide con los filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Frecuencia</th>
                  <th className="px-4 py-2.5 font-medium">Formato</th>
                  <th className="px-4 py-2.5 font-medium">Clases</th>
                  <th className="px-4 py-2.5 font-medium">Duración teórica</th>
                  <th className="px-4 py-2.5 font-medium">Salones</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibles.map((f) => {
                  const est = estadoFrecuencia(f)
                  return (
                    <tr key={f.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-900">{f.nombre}</div>
                        <div className="text-xs text-slate-500">{f.intensidad || '—'}</div>
                      </td>
                      <td className="px-4 py-2.5">{formatoLabel(f.formato)}</td>
                      <td className="px-4 py-2.5">
                        <div>{estructuraTexto(f.minutos)}</div>
                        <div className="text-xs text-slate-500">{horasSemanaTexto(f)}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">
                        {f.duraciones.length === 0 ? <span className="text-slate-400">—</span> : f.duraciones.map((d) => <div key={d.modalidadId}>{textoDuracion(d)}</div>)}
                      </td>
                      <td className="px-4 py-2.5">{usos[f.id] ?? 0}</td>
                      <td className="px-4 py-2.5">
                        <Badge color={estadoBadge[est][0]}>{estadoBadge[est][1]}</Badge>
                        {f.notas && est === 'pendiente' && <div className="mt-1 max-w-56 text-xs text-slate-500">{f.notas}</div>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <Button variant="ghost" className="px-2 py-1" onClick={() => setForm({ frecuencia: f })}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-2 py-1"
                          disabled={ocupada === f.id || (est === 'pendiente')}
                          title={est === 'pendiente' ? 'Edítala y márcala como confirmada para poder activarla' : undefined}
                          onClick={() => alternar(f)}
                        >
                          {f.activa ? 'Desactivar' : 'Activar'}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {form && (
        <FrecuenciaForm
          key={form.frecuencia?.id ?? 'nueva'}
          frecuencia={form.frecuencia}
          modalidades={modalidades}
          intensidades={intensidades}
          onSave={guardar}
          onClose={() => setForm(null)}
        />
      )}
    </>
  )
}
