import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TicketDetalle from '../components/tickets/TicketDetalle'
import TicketNuevo from '../components/tickets/TicketNuevo'
import TicketTablero from '../components/tickets/TicketTablero'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { inputClass } from '../components/ui/Field'
import Icon from '../components/ui/Icon'
import PageHeader from '../components/ui/PageHeader'
import useCarga from '../hooks/useCarga'
import { ESTADOS, PRIORIDADES, TIPOS, filtrarTickets, nombreCorto } from '../lib/tickets'
import { actualizarTicket, listarTickets, personalTickets, suscribirTickets } from '../services/tickets'

const VISTAS = [
  { id: 'todos', label: 'All' },
  { id: 'mios', label: 'My tickets' },
  { id: 'creados', label: 'Created by me' },
  { id: 'urgentes', label: 'Urgent' },
  { id: 'vencidos', label: 'Overdue' },
  { id: 'archivados', label: 'Archived' },
]
const SIN_FILTROS = { estado: '', prioridad: '', tipo: '', responsable: '', texto: '' }

// Task Board: tablero Kanban compartido por el personal administrativo. `notif` viene del panel (contador del menú).
export default function TaskBoard({ miId, notif }) {
  const cargar = useCallback(async () => {
    const [tickets, personal] = await Promise.all([listarTickets(), personalTickets()])
    return { tickets, personal }
  }, [])
  const { datos, cargando, error, recargar } = useCarga(cargar, null)
  const [tickets, setTickets] = useState([])
  const [vista, setVista] = useState('todos')
  const [filtros, setFiltros] = useState(SIN_FILTROS)
  const [abierto, setAbierto] = useState(null)
  const [nuevo, setNuevo] = useState(false)
  const [campana, setCampana] = useState(false)
  const [aviso, setAviso] = useState('')
  const moviendo = useRef(0) // arrastres en curso: mientras haya uno, un refresco no pisa el movimiento optimista

  useEffect(() => {
    if (datos && moviendo.current === 0) setTickets(datos.tickets)
  }, [datos])

  // Actualización en vivo entre usuarios (con un pequeño retraso para agrupar ráfagas de cambios).
  useEffect(() => {
    let t
    const off = suscribirTickets(['tickets'], () => {
      clearTimeout(t)
      t = setTimeout(recargar, 250)
    })
    return () => {
      clearTimeout(t)
      off()
    }
  }, [recargar])

  const personal = useMemo(() => datos?.personal ?? [], [datos])
  const mapa = useMemo(() => Object.fromEntries(personal.map((p) => [p.user_id, p])), [personal])
  const nombre = (id) => mapa[id]?.correo
  const activos = personal.filter((p) => p.activo)

  const visibles = useMemo(() => filtrarTickets(tickets, { vista, ...filtros }, miId), [tickets, vista, filtros, miId])
  const conteo = (id) => filtrarTickets(tickets, { vista: id }, miId).length

  const mover = async (id, estado) => {
    const antes = tickets
    setTickets((p) => p.map((t) => (t.id === id ? { ...t, estado } : t)))
    moviendo.current++
    setAviso('')
    try {
      await actualizarTicket(id, { estado })
    } catch (e) {
      setTickets(antes)
      setAviso(e.message)
    } finally {
      moviendo.current--
      recargar()
    }
  }

  if (error) return <p className="text-sm text-red-600">Could not load the Task Board: {error}</p>
  if (cargando || !datos) return <p className="py-4 text-sm text-slate-400">Loading…</p>

  const ticketAbierto = tickets.find((t) => t.id === abierto)
  const setF = (k) => (e) => setFiltros((p) => ({ ...p, [k]: e.target.value }))
  const hayFiltros = Object.values(filtros).some(Boolean)

  const abrirDesdeNotificacion = async (n) => {
    setCampana(false)
    if (tickets.some((t) => t.id === n.ticket_id)) setAbierto(n.ticket_id)
    if (!n.leida) await notif.leer([n.id]).catch(() => {})
  }

  return (
    <div>
      <PageHeader
        title="Task Board"
        description="Tasks, requests and incidents of the administrative team."
        action={
          <div className="relative flex items-center gap-2">
            <button type="button" onClick={() => setCampana((v) => !v)} aria-label={`Notifications (${notif.pendientes} unread)`} aria-expanded={campana} className="relative flex h-10 w-10 items-center justify-center rounded-full border border-brand-200 bg-white text-brand-700 hover:bg-brand-50">
              <Icon name="alert" className="h-5 w-5" />
              {notif.pendientes > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-peach-500 px-1.5 text-center text-xs font-semibold text-brand-900">{notif.pendientes}</span>}
            </button>
            <Button onClick={() => setNuevo(true)}>
              <Icon name="plus" className="h-4 w-4" /> New ticket
            </Button>
            {campana && (
              <Card className="absolute right-0 top-12 z-20 w-80 max-w-[85vw] p-3 shadow-lg">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
                  {notif.pendientes > 0 && (
                    <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => notif.leer().catch(() => {})}>
                      Mark all as read
                    </button>
                  )}
                </div>
                <ul className="max-h-72 space-y-1 overflow-y-auto">
                  {notif.items.map((n) => (
                    <li key={n.id}>
                      <button type="button" onClick={() => abrirDesdeNotificacion(n)} className={`w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 ${n.leida ? 'text-slate-500' : 'bg-brand-50 font-medium text-brand-900'}`}>
                        {n.mensaje}
                        <span className="block text-xs font-normal text-slate-400">{new Date(n.created_at).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}</span>
                      </button>
                    </li>
                  ))}
                  {notif.items.length === 0 && <li className="px-3 py-4 text-center text-xs text-slate-400">No notifications.</li>}
                </ul>
              </Card>
            )}
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Vistas">
        {VISTAS.map((v) => (
          <button key={v.id} type="button" role="tab" aria-selected={vista === v.id} onClick={() => setVista(v.id)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${vista === v.id ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-brand-50'}`}>
            {v.label}
            <span className={`text-xs ${vista === v.id ? 'text-brand-100' : 'text-slate-400'}`}>{conteo(v.id)}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <input type="search" aria-label="Search by title or code" placeholder="Search by title or code" className={`${inputClass} lg:col-span-2`} value={filtros.texto} onChange={setF('texto')} />
        <select aria-label="Filter by status" className={inputClass} value={filtros.estado} onChange={setF('estado')}>
          <option value="">All statuses</option>
          {ESTADOS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select aria-label="Filter by priority" className={inputClass} value={filtros.prioridad} onChange={setF('prioridad')}>
          <option value="">Any priority</option>
          {PRIORIDADES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select aria-label="Filter by type" className={inputClass} value={filtros.tipo} onChange={setF('tipo')}>
          <option value="">All types</option>
          {TIPOS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select aria-label="Filter by assignee" className={inputClass} value={filtros.responsable} onChange={setF('responsable')}>
          <option value="">All assignees</option>
          <option value="sin">Unassigned</option>
          {personal.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {nombreCorto(p.correo)}
              {p.activo ? '' : ' (inactivo)'}
            </option>
          ))}
        </select>
      </div>
      {hayFiltros && (
        <p className="mb-3 text-xs text-slate-500">
          {visibles.length} resultado(s).{' '}
          <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => setFiltros(SIN_FILTROS)}>
            Clear filters
          </button>
        </p>
      )}
      {aviso && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{aviso}</p>}

      {vista === 'archivados' ? (
        <Card className="divide-y divide-slate-100">
          {visibles.map((t) => (
            <button key={t.id} type="button" onClick={() => setAbierto(t.id)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50">
              <span className="text-sm text-slate-900">
                <span className="mr-2 text-xs font-semibold text-slate-400">{t.codigo}</span>
                {t.titulo}
              </span>
              <Badge color="slate">{ESTADOS.find((e) => e.value === t.estado)?.label}</Badge>
            </button>
          ))}
          {visibles.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">There are no archived tickets.</p>}
        </Card>
      ) : (
        <TicketTablero tickets={visibles} nombre={nombre} onAbrir={setAbierto} onMover={mover} />
      )}

      {nuevo && (
        <TicketNuevo
          personal={activos}
          miId={miId}
          onCerrar={() => setNuevo(false)}
          onCreado={() => {
            setNuevo(false)
            recargar()
          }}
        />
      )}
      {ticketAbierto && <TicketDetalle ticket={ticketAbierto} personal={personal} nombre={nombre} miId={miId} onCerrar={() => setAbierto(null)} onCambio={recargar} />}
    </div>
  )
}
