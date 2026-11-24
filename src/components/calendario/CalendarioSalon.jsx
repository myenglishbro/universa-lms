import { useState } from 'react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import useCalendario from '../../hooks/useCalendario'
import CancelarSesionModal from './CancelarSesionModal'
import ClaseExtraModal from './ClaseExtraModal'
import EvaluacionModal from './EvaluacionModal'
import ProgresoSalon from './ProgresoSalon'
import SesionModal from './SesionModal'
import SesionesLista from './SesionesLista'

// Sección "Calendario académico" del detalle del salón: progreso + sesiones + acciones (solo admin).
export default function CalendarioSalon({ salon, puedeEditar, onCambio }) {
  const cal = useCalendario(salon.id, onCambio)
  const [modal, setModal] = useState(null) // { tipo, sesion }
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const p = salon.progreso

  const correr = async (operacion) => {
    setError('')
    setOcupado(true)
    try {
      await operacion()
    } catch (e) {
      setError(e.message)
    } finally {
      setOcupado(false)
    }
  }

  const acciones = puedeEditar
    ? {
        realizada: (s) => correr(() => cal.realizada(s.id)),
        cancelar: (sesion) => setModal({ tipo: 'cancelar', sesion }),
        reprogramar: (sesion) => setModal({ tipo: 'reprogramar', sesion }),
        recuperar: (sesion) => setModal({ tipo: 'recuperar', sesion }),
        corregir: (sesion) => setModal({ tipo: 'corregir', sesion }),
        eliminarExtra: (s) => window.confirm('Delete this extra class?') && correr(() => cal.eliminarExtra(s.id)),
        evaluacion: (sesion) => setModal({ tipo: 'evaluacion', sesion }),
      }
    : null

  const guardarModal = (v) => {
    const id = modal.sesion.id
    if (modal.tipo === 'reprogramar') return cal.reprogramar(id, v.fecha, v.horaInicio, v.horaFin, v.texto)
    if (modal.tipo === 'recuperar') return cal.recuperar(id, v.fecha, v.horaInicio, v.horaFin)
    return cal.corregir(id, v.estado, v.texto)
  }

  let contenido
  if (!p) {
    contenido = (
      <Card className="p-5 text-sm text-slate-500">
        This classroom has no calendar. {puedeEditar ? 'Set the “Total sessions” under Edit to enable it.' : ''}
      </Card>
    )
  } else if (p.sesiones === 0) {
    contenido = (
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm text-slate-600">
        <span>
          Calendar not generated: {p.total} sessions starting on {salon.fechaInicio.split('-').reverse().join('/')}.
          {salon.horarios.length === 0 && ' Add at least one weekly time slot to be able to generate it.'}
        </span>
        {puedeEditar && (
          <Button onClick={() => correr(cal.generar)} disabled={ocupado || salon.horarios.length === 0}>
            {ocupado ? 'Generating…' : 'Generate calendar'}
          </Button>
        )}
      </Card>
    )
  } else if (cal.cargando) {
    contenido = <Card className="p-5 text-sm text-slate-500">Loading sessions…</Card>
  } else if (cal.error) {
    contenido = (
      <Card className="p-5 text-sm">
        <p className="text-red-600">Could not load sessions: {cal.error}</p>
        <Button variant="secondary" className="mt-3" onClick={cal.recargar}>
          Retry
        </Button>
      </Card>
    )
  } else {
    contenido = (
      <>
        <ProgresoSalon salon={salon} ocupado={ocupado} onCompletar={puedeEditar ? () => correr(cal.generar) : null} />
        {puedeEditar && (
          <div className="mt-3 flex justify-end">
            <Button variant="secondary" onClick={() => setModal({ tipo: 'extra' })}>
              + Add extra class
            </Button>
          </div>
        )}
        <SesionesLista
          sesiones={cal.sesiones}
          conflictos={cal.conflictos}
          feriados={cal.feriados}
          evaluaciones={cal.evaluaciones}
          sinProgramar={p.sinProgramar}
          acciones={acciones}
          ocupado={ocupado}
        />
      </>
    )
  }

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Academic calendar</h2>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {contenido}

      {modal?.tipo === 'cancelar' && (
        <CancelarSesionModal
          sesion={modal.sesion}
          proponer={cal.proponer}
          onConfirm={(nota, recuperacion) => cal.cancelar(modal.sesion.id, nota, recuperacion)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.tipo === 'evaluacion' && (
        <EvaluacionModal
          sesion={modal.sesion}
          existente={cal.evaluaciones.find((e) => e.fecha === modal.sesion.fecha)}
          onSave={cal.guardarEvaluacion}
          onRemove={cal.eliminarEvaluacion}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.tipo === 'extra' && <ClaseExtraModal proponer={cal.proponerExtra} onSave={cal.agregarExtra} onClose={() => setModal(null)} />}
      {modal && !['cancelar', 'evaluacion', 'extra'].includes(modal.tipo) && (
        <SesionModal modo={modal.tipo} sesion={modal.sesion} proponer={cal.proponer} onSave={guardarModal} onClose={() => setModal(null)} />
      )}
    </section>
  )
}
