import { useCallback, useEffect, useRef, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import useCarga from '../../hooks/useCarga'
import { COLOR_PRIORIDAD, etiquetaPrioridad, ESTADOS, PRIORIDADES, TIPOS, nombreCorto, textoHistorial, vencido } from '../../lib/tickets'
import { actualizarTicket, archivarTicket, comentarTicket, comentariosDe, historialDe, suscribirTickets } from '../../services/tickets'

const fechaHora = (iso) => new Date(iso).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })

// Formulario de edición. Se reinicia solo cuando cambian los valores guardados (key en el padre).
function Formulario({ ticket, personal, miId, deshabilitado, onGuardado }) {
  const inicial = { titulo: ticket.titulo, descripcion: ticket.descripcion ?? '', tipo: ticket.tipo, prioridad: ticket.prioridad, estado: ticket.estado, responsable_id: ticket.responsable_id ?? '', fecha_limite: ticket.fecha_limite ?? '' }
  const [f, setF] = useState(inicial)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cambiar = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const cambios = Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== inicial[k]))
  const hayCambios = Object.keys(cambios).length > 0
  const responsables = [
    { value: '', label: 'Unassigned' },
    ...personal.filter((p) => p.activo || p.user_id === ticket.responsable_id).map((p) => ({ value: p.user_id, label: `${p.correo}${p.user_id === miId ? ' (me)' : ''}${p.activo ? '' : ' (inactive)'}` })),
  ]

  const guardar = async (e) => {
    e.preventDefault()
    if (guardando || !hayCambios) return
    setGuardando(true)
    setError('')
    try {
      await actualizarTicket(ticket.id, cambios)
      await onGuardado()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <fieldset disabled={deshabilitado} className="space-y-3">
        <Field label="Title" value={f.titulo} onChange={cambiar('titulo')} maxLength={200} required />
        <Field as="textarea" rows={4} label="Description" value={f.descripcion} onChange={cambiar('descripcion')} maxLength={5000} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status" options={ESTADOS} value={f.estado} onChange={cambiar('estado')} />
          <Field label="Priority" options={PRIORIDADES} value={f.prioridad} onChange={cambiar('prioridad')} />
          <Field label="Type" options={TIPOS} value={f.tipo} onChange={cambiar('tipo')} />
          <Field label="Assignee" options={responsables} value={f.responsable_id} onChange={cambiar('responsable_id')} />
          <Field type="date" label="Due date" value={f.fecha_limite} onChange={cambiar('fecha_limite')} />
        </div>
      </fieldset>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!deshabilitado && (
        <div className="flex justify-end">
          <Button type="submit" disabled={guardando || !hayCambios || !f.titulo.trim()}>
            {guardando ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      )}
    </form>
  )
}

export default function TicketDetalle({ ticket, personal, nombre, miId, onCerrar, onCambio }) {
  const cargarComentarios = useCallback(() => comentariosDe(ticket.id), [ticket.id])
  const cargarHistorial = useCallback(() => historialDe(ticket.id), [ticket.id])
  const comentarios = useCarga(cargarComentarios, [])
  const historial = useCarga(cargarHistorial, [])
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const fin = useRef(null)

  const { recargar: recargarComentarios } = comentarios
  const { recargar: recargarHistorial } = historial
  // Comentarios e historial de este ticket en vivo (otro usuario comenta o cambia algo).
  useEffect(
    () =>
      suscribirTickets(['ticket_comentarios', 'ticket_historial'], () => {
        recargarComentarios()
        recargarHistorial()
      }),
    [recargarComentarios, recargarHistorial],
  )
  useEffect(() => {
    fin.current?.scrollIntoView?.({ block: 'nearest' })
  }, [comentarios.datos.length])

  const refrescar = async () => {
    await Promise.all([onCambio(), recargarComentarios(), recargarHistorial()])
  }
  const enviar = async (e) => {
    e.preventDefault()
    if (ocupado || !texto.trim()) return
    setOcupado(true)
    setError('')
    try {
      await comentarTicket(ticket.id, texto)
      setTexto('')
      await refrescar()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }
  const archivar = async (archivar) => {
    if (ocupado) return
    setOcupado(true)
    setError('')
    try {
      await archivarTicket(ticket.id, archivar)
      await refrescar()
      if (archivar) onCerrar()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  const clave = [ticket.titulo, ticket.descripcion, ticket.tipo, ticket.prioridad, ticket.estado, ticket.responsable_id, ticket.fecha_limite, ticket.archivado].join('|')

  return (
    <Modal title={`${ticket.codigo} · Details`} wide="xl" onClose={onCerrar}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge color={COLOR_PRIORIDAD[ticket.prioridad]}>{etiquetaPrioridad(ticket.prioridad)}</Badge>
        {ticket.archivado && <Badge color="slate">Archived</Badge>}
        {vencido(ticket) && <Badge color="rose">Overdue</Badge>}
        <span>
          Created by {nombreCorto(nombre(ticket.creado_por), 'someone')} · {fechaHora(ticket.created_at)}
        </span>
      </div>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div>
          <Formulario key={clave} ticket={ticket} personal={personal} miId={miId} deshabilitado={ticket.archivado} onGuardado={refrescar} />
          <div className="mt-4 border-t border-slate-100 pt-3">
            {ticket.archivado ? (
              <Button variant="secondary" disabled={ocupado} onClick={() => archivar(false)}>
                Restore ticket
              </Button>
            ) : (
              <Button variant="ghost" disabled={ocupado} onClick={() => archivar(true)}>
                Archive ticket
              </Button>
            )}
            <span className="ml-2 text-xs text-slate-400">Tickets are never deleted: they are archived and can be restored.</span>
          </div>
        </div>

        <div className="space-y-5">
          <section>
            <h3 className="text-sm font-semibold text-slate-900">Comentarios ({comentarios.datos.length})</h3>
            <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
              {comentarios.datos.map((c) => (
                <li key={c.id} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{nombreCorto(nombre(c.autor_id), 'Someone')}</span> · {fechaHora(c.created_at)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-800">{c.texto}</p>
                </li>
              ))}
              {!comentarios.cargando && comentarios.datos.length === 0 && <li className="text-xs text-slate-400">There are no comments yet.</li>}
              <li ref={fin} />
            </ul>
            {!ticket.archivado && (
              <form onSubmit={enviar} className="mt-2 space-y-2">
                <Field as="textarea" rows={2} aria-label="New comment" placeholder="Write a comment…" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} />
                <div className="flex justify-end">
                  <Button type="submit" variant="secondary" disabled={ocupado || !texto.trim()}>
                    Comentar
                  </Button>
                </div>
              </form>
            )}
            {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">Activity history</h3>
            <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto text-xs text-slate-600">
              {historial.datos.map((h) => (
                <li key={h.id}>
                  {textoHistorial(h, (id, vacio = 'Someone') => nombreCorto(nombre(id), vacio))} <span className="text-slate-400">· {fechaHora(h.created_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </Modal>
  )
}
