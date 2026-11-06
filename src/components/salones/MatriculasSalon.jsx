import { useRef, useState } from 'react'
import CambiarSalonModal from '../estudiantes/CambiarSalonModal'
import EstudianteForm from '../estudiantes/EstudianteForm'
import MotivoModal from '../paquetes/MotivoModal'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { inputClass } from '../ui/Field'
import Icon from '../ui/Icon'
import { candidatosParaSalon, cuposSalon, matriculasActivas, resumenCandidatos } from '../../lib/matriculas'
import { formatFecha } from '../../lib/salones'
import * as servicioReal from '../../services/personas'

const MAX_LISTA = 8

// Sección «Estudiantes matriculados» del detalle de un salón: cupos, lista, y alta de estudiantes sin salir de la pantalla.
export default function MatriculasSalon({ salon, salones, data, puedeEditar, onCambio, onVerEstudiante, servicio = servicioReal }) {
  const { estudiantes, matriculas, cargando, error: errorCarga } = data
  const cupos = cuposSalon(salon, matriculas)
  const activas = matriculasActivas(matriculas, salon.id)
  const historial = matriculas.filter((m) => m.salon_id === salon.id && m.estado === 'retirada')
  const nombre = (id) => estudiantes.find((e) => e.id === id)?.nombre ?? 'Estudiante'

  const [busqueda, setBusqueda] = useState('')
  const [marcados, setMarcados] = useState([])
  const [modal, setModal] = useState(null) // { tipo: 'retirar' | 'cambiar', m } | { tipo: 'nuevo' }
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const enCurso = useRef(false)

  const finalizado = salon.estado === 'finalizado'
  const candidatos = candidatosParaSalon(estudiantes, matriculas, salon.id, busqueda)
  const hayBusqueda = busqueda.trim().length > 0
  const visibles = candidatos.slice(0, MAX_LISTA)
  const sobran = marcados.length > cupos.disponibles

  const alternar = (id) => setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))

  const matricular = async () => {
    if (enCurso.current || marcados.length === 0) return
    enCurso.current = true
    setGuardando(true)
    setError('')
    try {
      await servicio.matricularAlumnos(salon.id, marcados)
      setMarcados([])
      setBusqueda('')
      await onCambio()
    } catch (e) {
      setError(e.message)
    } finally {
      enCurso.current = false
      setGuardando(false)
    }
  }
  const enModal = async (fn) => {
    await fn()
    await onCambio()
    setModal(null)
  }

  return (
    <Card className="mt-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">Estudiantes matriculados</h2>
        <span className="flex items-center gap-2 text-sm">
          <span className="text-slate-600">
            {cupos.ocupados} de {cupos.capacidad}
          </span>
          <Badge color={cupos.lleno ? 'peach' : 'brand'}>
            {cupos.lleno ? 'Salón lleno' : `${cupos.disponibles} ${cupos.disponibles === 1 ? 'cupo disponible' : 'cupos disponibles'}`}
          </Badge>
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className={`h-full ${cupos.lleno ? 'bg-peach-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(100, (cupos.ocupados / Math.max(cupos.capacidad, 1)) * 100)}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">Matricular no es un pago ni un paquete de horas: solo asigna al estudiante a este salón.</p>

      {errorCarga && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudieron cargar los estudiantes o las matrículas ({errorCarga}). Revisa que la migración de matrículas esté ejecutada y vuelve a cargar la página.
        </p>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {cargando ? (
        <p className="py-6 text-center text-sm text-slate-500">Cargando…</p>
      ) : activas.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Aún no hay estudiantes matriculados.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {activas.map((m) => {
            const e = estudiantes.find((x) => x.id === m.alumno_id)
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <button type="button" className="text-sm font-medium text-slate-900 hover:text-brand-700" onClick={() => onVerEstudiante?.(m.alumno_id)}>
                    {nombre(m.alumno_id)}
                  </button>
                  <p className="text-xs text-slate-500">
                    Desde {formatFecha(m.fecha_inicio)}
                    {e?.telefono && ` · ${e.telefono}`}
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

      {puedeEditar && !cargando && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <h3 className="mb-2 text-sm font-medium text-slate-700">Agregar estudiantes</h3>
          {finalizado ? (
            <p className="text-sm text-slate-500">El salón está finalizado: no admite nuevas matrículas.</p>
          ) : cupos.lleno ? (
            <p className="text-sm text-peach-700">No quedan cupos. Retira a alguien o aumenta la capacidad del salón (Editar).</p>
          ) : (
            <>
              <div className="relative sm:max-w-sm">
                <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar estudiante por nombre, correo o teléfono"
                  className={`${inputClass} pl-9`}
                  aria-label="Buscar estudiante para matricular"
                />
              </div>
              {visibles.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  {hayBusqueda ? 'Ningún estudiante activo coincide.' : 'No hay más estudiantes activos para matricular.'} ({resumenCandidatos(estudiantes, matriculas, salon.id)})
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {visibles.map((e) => (
                    <li key={e.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                        <input type="checkbox" checked={marcados.includes(e.id)} onChange={() => alternar(e.id)} className="h-4 w-4 accent-brand-600" />
                        <span className="text-slate-900">{e.nombre}</span>
                        {(e.correo || e.telefono) && <span className="text-xs text-slate-500">{e.correo || e.telefono}</span>}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {candidatos.length > MAX_LISTA && <p className="mt-1 text-xs text-slate-500">Mostrando {MAX_LISTA} de {candidatos.length}; escribe para acotar.</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button onClick={matricular} disabled={guardando || marcados.length === 0 || sobran}>
                  {guardando ? 'Matriculando…' : `Matricular estudiantes${marcados.length ? ` (${marcados.length})` : ''}`}
                </Button>
                {sobran && <span className="text-xs text-peach-700">Solo quedan {cupos.disponibles} cupos.</span>}
                <button type="button" className="text-sm text-brand-700 hover:underline" onClick={() => setModal({ tipo: 'nuevo' })}>
                  ¿No está? Registrar estudiante nuevo
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {historial.length > 0 && (
        <details className="mt-4 border-t border-slate-100 pt-3">
          <summary className="cursor-pointer text-sm text-slate-600">Historial de retiros ({historial.length})</summary>
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            {historial.map((m) => (
              <li key={m.id}>
                {nombre(m.alumno_id)} · {formatFecha(m.fecha_inicio)} → {formatFecha(m.fecha_fin)}
                {m.motivo_retiro && ` · ${m.motivo_retiro}`}
              </li>
            ))}
          </ul>
        </details>
      )}

      {modal?.tipo === 'retirar' && (
        <MotivoModal
          titulo="Retirar del salón"
          texto={`${nombre(modal.m.alumno_id)} dejará de ocupar un cupo. La matrícula queda en el historial.`}
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
      {modal?.tipo === 'nuevo' && (
        <EstudianteForm
          onClose={() => setModal(null)}
          onSave={async (v) => {
            const id = await servicio.guardarEstudiante(null, v)
            await onCambio()
            setMarcados((m) => [...m, id])
            setModal(null)
          }}
        />
      )}
    </Card>
  )
}
