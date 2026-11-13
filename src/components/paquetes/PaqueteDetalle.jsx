import { useCallback, useEffect, useRef, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Icon from '../ui/Icon'
import { formatFecha } from '../../lib/salones'
import { advertenciaSaldo, dinero, estadoClase, estadoPaquete, minutosTexto, tipoMovimiento } from '../../lib/paquetes'
import AjusteForm from './AjusteForm'
import CancelarClaseModal from './CancelarClaseModal'
import ClaseForm from './ClaseForm'
import DocentePaqueteModal from './DocentePaqueteModal'
import MotivoModal from './MotivoModal'
import PagoForm from './PagoForm'

const hora = (t) => t.slice(0, 5)

function Cifra({ etiqueta, valor, destacada = false, nota }) {
  return (
    <div className={`rounded-xl border p-4 ${destacada ? 'border-brand-200 bg-brand-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-slate-500">{nota}</p>}
    </div>
  )
}

// Detalle de un paquete: saldo (comprado, consumido, disponible, programado), pagos, clases y movimientos.
// El saldo viene de Supabase; esta pantalla solo dispara las acciones y vuelve a leer el resultado.
export default function PaqueteDetalle({ paquete: p, servicio, docentes, puedeEditar, onVolver, onCambio, onRenovar, onVerAlumno }) {
  const [detalle, setDetalle] = useState({ clases: [], pagos: [], movimientos: [] })
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(null)
  const [modal, setModal] = useState(null) // { tipo, clase?, pago? }
  const enCurso = useRef(false) // evita enviar dos veces la misma acción (doble clic) antes de que se pinte el estado

  const cargar = useCallback(
    () =>
      servicio
        .detallePaquete(p.id)
        .then(setDetalle)
        .catch((e) => setError(e.message)),
    [servicio, p.id],
  )
  useEffect(() => {
    cargar()
  }, [cargar])

  // Ejecuta una acción, luego vuelve a leer detalle y lista. `clave` bloquea el botón mientras se procesa (evita doble clic).
  const ejecutar = async (clave, fn) => {
    if (enCurso.current) return
    enCurso.current = true
    setOcupado(clave)
    setError('')
    try {
      await fn()
      await Promise.all([cargar(), onCambio()])
    } catch (e) {
      setError(e.message)
    } finally {
      enCurso.current = false
      setOcupado(null)
    }
  }
  const enModal = async (fn) => {
    await fn()
    await Promise.all([cargar(), onCambio()])
    setModal(null)
  }

  const estado = estadoPaquete[p.estado]
  const aviso = advertenciaSaldo(p)
  const cerrado = p.estado === 'anulado'
  const puede = puedeEditar && !cerrado
  const docente = (id) => docentes.find((d) => d.id === id)?.nombre

  return (
    <>
      <button onClick={onVolver} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
        <Icon name="back" className="h-4 w-4" /> Packages
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold text-slate-900">
            {onVerAlumno ? (
              <button type="button" className="hover:text-brand-700" onClick={() => onVerAlumno(p.alumno_id)}>
                {p.alumno}
              </button>
            ) : (
              p.alumno
            )}{' '}
            <Badge color={estado.color}>{estado.label}</Badge>
          </h1>
          <p className="text-sm text-slate-500">
            {minutosTexto(p.minutos_contratados)} contracted on {formatFecha(p.fecha_compra)}
            {p.docente && ` · ${p.docente}`}
            {p.nivel && ` · ${p.nivel}`}
            {p.vigencia_hasta && ` · expires on ${formatFecha(p.vigencia_hasta)}`}
          </p>
        </div>
        {puede && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setModal({ tipo: 'docente' })}>
              Teacher
            </Button>
            <Button variant="secondary" onClick={() => setModal({ tipo: 'ajuste' })}>
              Extend or adjust
            </Button>
            <Button onClick={() => onRenovar(p)}>Renew / buy more</Button>
          </div>
        )}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {aviso && <p className="mb-4 rounded-lg bg-peach-100 px-3 py-2 text-sm text-peach-700">{aviso}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cifra etiqueta="Purchased" valor={minutosTexto(p.compradas)} nota={p.ajustes ? `Adjustments: ${minutosTexto(p.ajustes)}` : undefined} />
        <Cifra etiqueta="Used" valor={minutosTexto(p.consumidas)} />
        <Cifra etiqueta="Available" valor={minutosTexto(p.disponibles)} destacada />
        <Cifra
          etiqueta="Scheduled"
          valor={minutosTexto(p.programadas)}
          nota={`${p.clases_programadas} ${p.clases_programadas === 1 ? 'class' : 'classes'} to teach`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Classes</h2>
            {puede && (
              <Button variant="ghost" className="px-2 py-1" onClick={() => setModal({ tipo: 'clase' })}>
                <Icon name="plus" className="h-4 w-4" /> Schedule class
              </Button>
            )}
          </div>
          {detalle.clases.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No classes scheduled yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {detalle.clases.map((c) => {
                const ec = estadoClase[c.estado]
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {formatFecha(c.fecha)} · {hora(c.hora_inicio)}–{hora(c.hora_fin)}{' '}
                        <span className="font-normal text-slate-500">({minutosTexto(c.minutos)})</span>
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge color={ec.color}>{ec.label}</Badge>
                        {c.cancelacion === 'tardia' && <span>Late cancellation with deduction</span>}
                        {c.docente_id && docente(c.docente_id) && <span>{docente(c.docente_id)}</span>}
                        {c.nota && <span>{c.nota}</span>}
                      </p>
                    </div>
                    {puede && (
                      <div className="flex flex-wrap gap-1">
                        {c.estado === 'programada' && (
                          <>
                            <Button className="px-3 py-1" disabled={Boolean(ocupado)} onClick={() => ejecutar(c.id, () => servicio.marcarDictada(c.id))}>
                              {ocupado === c.id ? 'Confirming…' : 'Confirm taught'}
                            </Button>
                            <Button variant="ghost" className="px-2 py-1" onClick={() => setModal({ tipo: 'clase', clase: c })}>
                              Reschedule
                            </Button>
                            <Button variant="ghost" className="px-2 py-1" onClick={() => setModal({ tipo: 'cancelar', clase: c })}>
                              Cancel
                            </Button>
                          </>
                        )}
                        {c.estado === 'dictada' && (
                          <Button variant="ghost" className="px-2 py-1" onClick={() => setModal({ tipo: 'corregir', clase: c })}>
                            Correct
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Payments</h2>
            {puede && Number(p.pendiente) > 0 && (
              <Button variant="ghost" className="px-2 py-1" onClick={() => setModal({ tipo: 'pago' })}>
                <Icon name="plus" className="h-4 w-4" /> Record payment
              </Button>
            )}
          </div>
          <dl className="divide-y divide-slate-100 text-sm">
            <div className="flex justify-between px-4 py-2">
              <dt className="text-slate-500">Price</dt>
              <dd className="font-medium">{dinero(p.precio, p.moneda)}</dd>
            </div>
            <div className="flex justify-between px-4 py-2">
              <dt className="text-slate-500">Paid</dt>
              <dd className="font-medium">{dinero(p.pagado, p.moneda)}</dd>
            </div>
            <div className="flex justify-between px-4 py-2">
              <dt className="text-slate-500">Pending</dt>
              <dd className={`font-semibold ${Number(p.pendiente) > 0 ? 'text-peach-700' : 'text-brand-700'}`}>
                {Number(p.pendiente) > 0 ? dinero(p.pendiente, p.moneda) : 'Paid in full'}
              </dd>
            </div>
          </dl>
          {detalle.pagos.length > 0 && (
            <ul className="divide-y divide-slate-100 border-t border-slate-200">
              {detalle.pagos.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                  <div className={g.anulado ? 'text-slate-400 line-through' : ''}>
                    <p className="font-medium">{dinero(g.monto, p.moneda)}</p>
                    <p className="text-xs text-slate-500">
                      {formatFecha(g.fecha)}
                      {g.metodo && ` · ${g.metodo}`}
                    </p>
                  </div>
                  {g.anulado ? (
                    <Badge color="rose">Voided</Badge>
                  ) : (
                    puede && (
                      <Button variant="ghost" className="px-2 py-1" onClick={() => setModal({ tipo: 'anular-pago', pago: g })}>
                        Void
                      </Button>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <details>
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">Movement history ({detalle.movimientos.length})</summary>
          <ul className="divide-y divide-slate-100 border-t border-slate-200">
            {detalle.movimientos.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{tipoMovimiento[m.tipo]}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(m.created_at).toLocaleString('en-US')}
                    {m.motivo && ` · ${m.motivo}`}
                  </p>
                </div>
                <span className={`font-semibold ${m.minutos < 0 ? 'text-peach-700' : 'text-brand-700'}`}>
                  {m.minutos > 0 ? '+' : ''}
                  {minutosTexto(m.minutos)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </Card>

      {puede && !cerrado && (
        <p className="mt-4 text-right">
          <button onClick={() => setModal({ tipo: 'anular' })} className="text-xs text-slate-400 hover:text-red-600">
            Void this package
          </button>
        </p>
      )}

      {modal?.tipo === 'pago' && (
        <PagoForm paquete={p} onClose={() => setModal(null)} onSave={(v) => enModal(() => servicio.registrarPago(p.id, v))} />
      )}
      {modal?.tipo === 'clase' && (
        <ClaseForm
          paquete={p}
          clase={modal.clase}
          docentes={docentes}
          onClose={() => setModal(null)}
          onSave={(v) => enModal(() => (modal.clase ? servicio.reprogramarClase(modal.clase.id, v) : servicio.programarClase(p.id, v)))}
        />
      )}
      {modal?.tipo === 'docente' && (
        <DocentePaqueteModal
          actualId={p.docente_id}
          docentes={docentes}
          onClose={() => setModal(null)}
          onSave={(id) => enModal(() => servicio.asignarDocentePaquete(p.id, id))}
        />
      )}
      {modal?.tipo === 'cancelar' && (
        <CancelarClaseModal clase={modal.clase} onClose={() => setModal(null)} onConfirm={(v) => enModal(() => servicio.cancelarClase(modal.clase.id, v))} />
      )}
      {modal?.tipo === 'ajuste' && <AjusteForm onClose={() => setModal(null)} onSave={(v) => enModal(() => servicio.ajustarPaquete(p.id, v))} />}
      {modal?.tipo === 'corregir' && (
        <MotivoModal
          titulo="Correct a taught class"
          texto={`${minutosTexto(modal.clase.minutos)} will be returned to the package and the class will go back to scheduled. The original movement is kept in the history.`}
          confirmar="Correct"
          onClose={() => setModal(null)}
          onConfirm={(motivo) => enModal(() => servicio.corregirClase(modal.clase.id, motivo))}
        />
      )}
      {modal?.tipo === 'anular-pago' && (
        <MotivoModal
          titulo="Void payment"
          texto={`The payment of ${dinero(modal.pago.monto, p.moneda)} will be voided. It will be recorded as voided.`}
          confirmar="Void payment"
          onClose={() => setModal(null)}
          onConfirm={(motivo) => enModal(() => servicio.anularPago(modal.pago.id, motivo))}
        />
      )}
      {modal?.tipo === 'anular' && (
        <MotivoModal
          titulo="Void package"
          texto="The package will be voided, with no new classes or payments. Its history is kept."
          confirmar="Void package"
          onClose={() => setModal(null)}
          onConfirm={(motivo) => enModal(() => servicio.anularPaquete(p.id, motivo))}
        />
      )}
    </>
  )
}
