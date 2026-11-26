import { useEffect, useMemo, useRef, useState } from 'react'
import TicketDetalle from '../components/tickets/TicketDetalle'
import TicketCalendario from '../components/tickets/TicketCalendario'
import TicketNuevo from '../components/tickets/TicketNuevo'
import TicketTablero from '../components/tickets/TicketTablero'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Field, { inputClass } from '../components/ui/Field'
import Icon from '../components/ui/Icon'
import PageHeader from '../components/ui/PageHeader'
import useCarga from '../hooks/useCarga'
import { AREAS, ESTADOS, PRIORIDADES, TIPOS, etiquetaArea, filtrarTickets, nombreCorto } from '../lib/tickets'
import { actualizarTicket, listarTickets, personalTickets, suscribirTickets } from '../services/tickets'

const VISTAS = [
  { id: 'todos', label: 'All' },
  { id: 'mios', label: 'My tickets' },
  { id: 'creados', label: 'Created by me' },
  { id: 'urgentes', label: 'Urgent' },
  { id: 'vencidos', label: 'Overdue' },
  { id: 'estancados', label: 'Stalled' },
  { id: 'archivados', label: 'Archived' },
]
const SIN_FILTROS = { estado: '', prioridad: '', tipo: '', area: '', responsable: '', texto: '' }

// Task Board: tablero Kanban compartido por el personal administrativo. `notif` viene del panel (contador del menú).
export default function TaskBoard({ miId, notif }) {
  // El personal casi no cambia: se lee una sola vez. Los tickets se vuelven a leer con cada cambio en vivo (sin repetir la consulta del personal).
  const { datos: listaPersonal, cargando: cargandoPersonal, error: errorPersonal } = useCarga(personalTickets, null)
  const { datos: listaTickets, cargando: cargandoTickets, error: errorTickets, recargar } = useCarga(listarTickets, null)
  const datos = listaTickets && listaPersonal ? { tickets: listaTickets, personal: listaPersonal } : null
  const cargando = cargandoPersonal || cargandoTickets
  const error = errorTickets || errorPersonal
  const [tickets, setTickets] = useState([])
  const [vista, setVista] = useState('todos')
  const [modo, setModo] = useState('tablero') // tablero | calendario
  const [verFiltros, setVerFiltros] = useState(false)
  const [filtros, setFiltros] = useState(SIN_FILTROS)
  const [abierto, setAbierto] = useState(null)
  const [nuevo, setNuevo] = useState(false)
  const [campana, setCampana] = useState(false)
  const [aviso, setAviso] = useState('')
  const moviendo = useRef(0) // arrastres en curso: mientras haya uno, un refresco no pisa el movimiento optimista

  useEffect(() => {
    if (listaTickets && moviendo.current === 0) setTickets(listaTickets)
  }, [listaTickets])

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

  const personal = useMemo(() => listaPersonal ?? [], [listaPersonal])
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
  const nFiltros = Object.values(filtros).filter(Boolean).length
  const etiquetaFiltro = {
    estado: (v) => ESTADOS.find((o) => o.value === v)?.label,
    prioridad: (v) => `${PRIORIDADES.find((o) => o.value === v)?.label} priority`,
    tipo: (v) => TIPOS.find((o) => o.value === v)?.label,
    area: (v) => (v === 'sin' ? 'No area' : etiquetaArea(v)),
    responsable: (v) => (v === 'sin' ? 'Unassigned' : nombreCorto(nombre(v), 'Someone')),
    texto: (v) => `“${v}”`,
  }
  const chipsFiltros = Object.entries(filtros).filter(([, v]) => v).map(([k, v]) => [k, etiquetaFiltro[k](v)])

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

      {/* Fila 1: modo, búsqueda y filtros. Fila 2: vistas. Los filtros se abren solo cuando se necesitan. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-slate-100 p-0.5" role="tablist" aria-label="Layout">
          {[['tablero', 'Board'], ['calendario', 'Calendar']].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={modo === id} onClick={() => setModo(id)} className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${modo === id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="search" aria-label="Search by title or code" placeholder="Search tickets…" className={inputClass} style={{ paddingLeft: '2.25rem' }} value={filtros.texto} onChange={setF('texto')} />
        </div>
        <button type="button" onClick={() => setVerFiltros((v) => !v)} aria-expanded={verFiltros} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium ${verFiltros || nFiltros > 0 ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>
          <Icon name="filter" className="h-4 w-4" /> Filters
          {nFiltros > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">{nFiltros}</span>}
        </button>
      </div>
      {verFiltros && (
        <div className="mb-3 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Status" options={[{ value: '', label: 'All statuses' }, ...ESTADOS]} value={filtros.estado} onChange={setF('estado')} />
          <Field label="Priority" options={[{ value: '', label: 'Any priority' }, ...PRIORIDADES]} value={filtros.prioridad} onChange={setF('prioridad')} />
          <Field label="Type" options={[{ value: '', label: 'All types' }, ...TIPOS]} value={filtros.tipo} onChange={setF('tipo')} />
          <Field label="Area" options={[{ value: '', label: 'All areas' }, ...AREAS.map((a) => ({ value: a.value, label: a.label })), { value: 'sin', label: 'No area' }]} value={filtros.area} onChange={setF('area')} />
          <Field
            label="Assignee"
            options={[{ value: '', label: 'All assignees' }, { value: 'sin', label: 'Unassigned' }, ...personal.map((p) => ({ value: p.user_id, label: `${nombreCorto(p.correo)}${p.activo ? '' : ' (inactive)'}` }))]}
            value={filtros.responsable}
            onChange={setF('responsable')}
          />
        </div>
      )}
      {nFiltros > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
          {chipsFiltros.map(([clave, texto]) => (
            <span key={clave} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2.5 pr-1.5 font-medium text-brand-800">
              {texto}
              <button type="button" aria-label={`Remove filter: ${texto}`} onClick={() => setFiltros((p) => ({ ...p, [clave]: '' }))} className="rounded-full px-1 text-brand-500 hover:text-brand-900">
                ×
              </button>
            </span>
          ))}
          <span className="text-slate-500">{visibles.length} result(s)</span>
          <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => setFiltros(SIN_FILTROS)}>
            Clear all
          </button>
        </div>
      )}

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Vistas">
        {VISTAS.map((v) => (
          <button key={v.id} type="button" role="tab" aria-selected={vista === v.id} onClick={() => setVista(v.id)} className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${vista === v.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {v.label}
            <span className={`rounded-full px-1.5 text-[11px] ${vista === v.id ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>{conteo(v.id)}</span>
          </button>
        ))}
      </div>
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
      ) : modo === 'calendario' ? (
        <TicketCalendario tickets={visibles} onAbrir={setAbierto} />
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
