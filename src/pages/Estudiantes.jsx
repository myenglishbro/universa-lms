import { useEffect, useState } from 'react'
import EstudianteForm from '../components/estudiantes/EstudianteForm'
import ImportarEstudiantesModal from '../components/estudiantes/ImportarEstudiantesModal'
import CambiarSalonModal from '../components/estudiantes/CambiarSalonModal'
import MotivoModal from '../components/paquetes/MotivoModal'
import CuentaAcceso from '../components/portal/CuentaAcceso'
import AsistenciaAlumno from '../components/seguimiento/AsistenciaAlumno'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { inputClass } from '../components/ui/Field'
import Icon from '../components/ui/Icon'
import PageHeader from '../components/ui/PageHeader'
import { calcularEdad, etiquetaGenero, etiquetaTipoDocumento } from '../lib/estudiantes'
import { SIN_MATRICULA, coincideTexto, matriculasDeAlumno } from '../lib/matriculas'
import { estadoPaquete, minutosTexto } from '../lib/paquetes'
import { formatFecha } from '../lib/salones'
import * as servicioReal from '../services/personas'

// Estudiantes (tabla alumnos): búsqueda, alta/edición y ficha con sus salones y paquetes privados.
export default function Estudiantes({ data, salones, paquetes, puedeEditar, estudianteInicialId = null, onVerSalon, onVerPaquete, onCambio, servicio = servicioReal }) {
  const { estudiantes, matriculas, cargando, error } = data
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('activos')
  const [detalleId, setDetalleId] = useState(estudianteInicialId)
  const [form, setForm] = useState(null) // { estudiante } (null = nuevo)
  const [modal, setModal] = useState(null)
  const [importando, setImportando] = useState(false)

  const salonDe = (id) => salones.find((s) => s.id === id)
  const activasDe = (id) => matriculasDeAlumno(matriculas, id).filter((m) => m.estado === 'activa')

  const visibles = estudiantes.filter(
    (e) =>
      coincideTexto(e, busqueda) &&
      (filtro === 'todos' || (filtro === 'activos' && e.activo) || (filtro === 'inactivos' && !e.activo) || (filtro === SIN_MATRICULA && e.activo && activasDe(e.id).length === 0)),
  )
  const detalle = estudiantes.find((e) => e.id === detalleId)

  // Acceso de MaskPark: solo lo puede leer un administrador; la contraseña no se muestra hasta pedirlo.
  const [plataforma, setPlataforma] = useState(null)
  const [verClave, setVerClave] = useState(false)
  useEffect(() => {
    setPlataforma(null)
    setVerClave(false)
    if (!detalleId || !puedeEditar) return undefined
    let vigente = true
    servicio
      .plataformaEstudiante(detalleId)
      .then((p) => vigente && setPlataforma(p))
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [detalleId, puedeEditar, servicio])

  const guardar = async (v) => {
    const id = await servicio.guardarEstudiante(form.estudiante?.id ?? null, v)
    await onCambio()
    setForm(null)
    if (!form.estudiante) setDetalleId(id)
  }
  const enModal = async (fn) => {
    await fn()
    await onCambio()
    setModal(null)
  }

  const misPaquetes = detalle ? paquetes.filter((p) => p.alumno_id === detalle.id) : []
  const matDetalle = detalle ? matriculasDeAlumno(matriculas, detalle.id) : []
  const activas = matDetalle.filter((m) => m.estado === 'activa')
  const historial = matDetalle.filter((m) => m.estado === 'retirada')

  return (
    <>
      {detalle ? (
        <>
          <button onClick={() => setDetalleId(null)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
            <Icon name="back" className="h-4 w-4" /> Volver a estudiantes
          </button>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold text-slate-900">
              {detalle.nombre} {!detalle.activo && <Badge color="slate">Inactivo</Badge>}
            </h1>
            {puedeEditar && (
              <Button variant="secondary" onClick={() => setForm({ estudiante: detalle })}>
                Editar
              </Button>
            )}
          </div>

          <Card className="p-6">
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase text-slate-500">Documento</dt>
                <dd className="text-sm text-slate-900">{detalle.tipo_documento ? `${etiquetaTipoDocumento(detalle.tipo_documento)} · ${detalle.numero_documento}` : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Fecha de nacimiento</dt>
                <dd className="text-sm text-slate-900">
                  {detalle.fecha_nacimiento ? `${formatFecha(detalle.fecha_nacimiento)} · ${calcularEdad(detalle.fecha_nacimiento)} años` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Nacionalidad · Género</dt>
                <dd className="text-sm text-slate-900">{[detalle.pais_nacionalidad, etiquetaGenero(detalle.genero)].filter(Boolean).join(' · ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Celular</dt>
                <dd className="text-sm text-slate-900">{detalle.telefono || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Correo</dt>
                <dd className="text-sm text-slate-900">{detalle.correo || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Notas</dt>
                <dd className="whitespace-pre-line text-sm text-slate-900">{detalle.notas || '—'}</dd>
              </div>
              {puedeEditar && plataforma && (
                <div className="sm:col-span-3">
                  <dt className="text-xs uppercase text-slate-500">Plataforma MaskPark</dt>
                  <dd className="text-sm text-slate-900">
                    Usuario: <span className="font-medium">{plataforma.usuario}</span>
                    {plataforma.clave && (
                      <>
                        {' · '}Contraseña: <span className="font-mono">{verClave ? plataforma.clave : '••••••••'}</span>{' '}
                        <button type="button" onClick={() => setVerClave((x) => !x)} className="text-xs text-brand-700 hover:underline">
                          {verClave ? 'Ocultar' : 'Mostrar'}
                        </button>
                      </>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <AsistenciaAlumno alumnoId={detalle.id} />

          {puedeEditar && <CuentaAcceso rol="estudiante" persona={detalle.id} correoSugerido={detalle.correo ?? ''} />}

          <Card className="mt-6 p-6">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Salones grupales</h2>
            {activas.length === 0 ? (
              <p className="text-sm text-slate-400">No está matriculado en ningún salón. Matricúlalo desde el detalle de un salón.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activas.map((m) => {
                  const s = salonDe(m.salon_id)
                  return (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div>
                        <button type="button" className="text-sm font-medium text-slate-900 hover:text-brand-700" onClick={() => onVerSalon(m.salon_id)}>
                          {s?.nombre ?? 'Salón'}
                        </button>
                        <p className="text-xs text-slate-500">
                          {s?.nivel || 'Sin nivel asignado'} · {s?.docente || 'Sin docente'} · desde {formatFecha(m.fecha_inicio)}
                        </p>
                      </div>
                      {puedeEditar && (
                        <div className="flex gap-1">
                          <Button variant="ghost" className="px-2 py-1" onClick={() => setModal({ tipo: 'cambiar', m })}>
                            Cambiar de salón
                          </Button>
                          <Button variant="ghost" className="px-2 py-1" onClick={() => setModal({ tipo: 'retirar', m })}>
                            Retirar
                          </Button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {historial.length > 0 && (
              <details className="mt-3 border-t border-slate-100 pt-3">
                <summary className="cursor-pointer text-sm text-slate-600">Historial de salones ({historial.length})</summary>
                <ul className="mt-2 space-y-1 text-xs text-slate-500">
                  {historial.map((m) => (
                    <li key={m.id}>
                      {salonDe(m.salon_id)?.nombre ?? 'Salón'} · {formatFecha(m.fecha_inicio)} → {formatFecha(m.fecha_fin)}
                      {m.motivo_retiro && ` · ${m.motivo_retiro}`}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>

          <Card className="mt-6 p-6">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Paquetes de horas (clases privadas)</h2>
            {misPaquetes.length === 0 ? (
              <p className="text-sm text-slate-400">Sin paquetes privados. Se crean en «Paquetes de horas».</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {misPaquetes.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <button type="button" className="text-sm font-medium text-slate-900 hover:text-brand-700" onClick={() => onVerPaquete(p.id)}>
                        {minutosTexto(p.compradas)} compradas
                      </button>
                      <p className="text-xs text-slate-500">
                        {minutosTexto(p.disponibles)} disponibles · {minutosTexto(p.programadas)} programadas · {p.docente || 'Sin docente'}
                      </p>
                    </div>
                    <Badge color={estadoPaquete[p.estado].color}>{estadoPaquete[p.estado].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : (
        <>
          <PageHeader
            title="Estudiantes"
            description={cargando ? 'Cargando…' : `${estudiantes.filter((e) => e.activo).length} activos · ${estudiantes.length} registrados`}
            action={
              puedeEditar && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setImportando(true)} disabled={cargando || Boolean(error)}>
                    <Icon name="up" className="h-4 w-4" /> Importar JSON
                  </Button>
                  <Button onClick={() => setForm({ estudiante: null })} disabled={cargando || Boolean(error)}>
                    <Icon name="plus" className="h-4 w-4" /> Nuevo estudiante
                  </Button>
                </div>
              )
            }
          />
          <Card>
            <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
              <div className="relative min-w-56 flex-1 sm:max-w-xs">
                <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, documento, correo o celular" className={`${inputClass} pl-9`} />
              </div>
              <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className={`${inputClass} w-auto`} aria-label="Filtrar estudiantes">
                <option value="activos">Activos</option>
                <option value={SIN_MATRICULA}>Sin salón</option>
                <option value="inactivos">Inactivos</option>
                <option value="todos">Todos</option>
              </select>
            </div>
            {cargando ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">Cargando estudiantes…</p>
            ) : error ? (
              <p className="px-4 py-10 text-center text-sm text-red-600">No se pudieron cargar los estudiantes: {error}</p>
            ) : visibles.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                {estudiantes.length === 0 ? 'Aún no hay estudiantes. Registra el primero con «Nuevo estudiante».' : 'Ningún estudiante coincide con la búsqueda.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Estudiante</th>
                      <th className="px-4 py-2.5 font-medium">Contacto</th>
                      <th className="px-4 py-2.5 font-medium">Salones</th>
                      <th className="px-4 py-2.5 font-medium">Paquetes</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibles.map((e) => {
                      const sal = activasDe(e.id).map((m) => salonDe(m.salon_id)?.nombre).filter(Boolean)
                      const nPaq = paquetes.filter((p) => p.alumno_id === e.id && p.estado === 'activo').length
                      return (
                        <tr key={e.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDetalleId(e.id)}>
                          <td className="px-4 py-2.5 font-medium text-slate-900">
                            {e.nombre} {!e.activo && <Badge color="slate">Inactivo</Badge>}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{e.correo || e.telefono || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-600">{sal.length ? sal.join(', ') : <span className="text-slate-400">Sin salón</span>}</td>
                          <td className="px-4 py-2.5 text-slate-600">{nPaq ? `${nPaq} activo${nPaq === 1 ? '' : 's'}` : '—'}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-brand-700">Ver</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {importando && <ImportarEstudiantesModal estudiantes={estudiantes} salones={salones} servicio={servicio} onTerminar={onCambio} onClose={() => setImportando(false)} />}
      {form && <EstudianteForm key={form.estudiante?.id ?? 'nuevo'} estudiante={form.estudiante} onSave={guardar} onClose={() => setForm(null)} />}
      {modal?.tipo === 'retirar' && (
        <MotivoModal
          titulo="Retirar del salón"
          texto="La matrícula queda en el historial y se libera el cupo."
          confirmar="Retirar"
          onClose={() => setModal(null)}
          onConfirm={(motivo) => enModal(() => servicio.retirarMatricula(modal.m.id, motivo))}
        />
      )}
      {modal?.tipo === 'cambiar' && (
        <CambiarSalonModal
          matricula={modal.m}
          salones={salones}
          matriculas={matriculas}
          onClose={() => setModal(null)}
          onConfirm={(salonId, motivo) => enModal(() => servicio.cambiarSalonMatricula(modal.m.id, salonId, motivo))}
        />
      )}
    </>
  )
}
