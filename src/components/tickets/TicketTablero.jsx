import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { useState } from 'react'
import Icon from '../ui/Icon'
import { ESTADOS, ESTILO_ESTADO, colorAvatar, diasSinMovimiento, estancado, etiquetaPrioridad, etiquetaTipo, hoyLima, nombreCorto, ordenarTickets, progresoChecklist, responsablesDe, vencido } from '../../lib/tickets'

const formatoFecha = (f) => new Date(`${f}T00:00:00`).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })

// Responsable: círculo con su inicial (color propio) y nombre. Sin responsable se ve como un hueco punteado, para notarlo.
function Responsable({ id, nombre }) {
  if (!id)
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-peach-700">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-peach-500 bg-peach-50">
          <Icon name="user" className="h-3.5 w-3.5" />
        </span>
        Unassigned
      </span>
    )
  const n = nombreCorto(nombre(id))
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-700" title={nombre(id)}>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold uppercase ${colorAvatar(n)}`}>{n.charAt(0)}</span>
      <span className="truncate">{n}</span>
    </span>
  )
}

// Varios responsables: avatares superpuestos (hasta 3) y «+N»; con uno solo se ve igual que siempre.
function Responsables({ ids, nombre }) {
  if (ids.length <= 1) return <Responsable id={ids[0]} nombre={nombre} />
  const todos = ids.map((id) => nombre(id) ?? '').join(', ')
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-700" title={todos}>
      <span className="flex -space-x-1.5">
        {ids.slice(0, 3).map((id) => {
          const n = nombreCorto(nombre(id))
          return (
            <span key={id} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold uppercase ring-2 ring-white ${colorAvatar(n)}`}>
              {n.charAt(0)}
            </span>
          )
        })}
      </span>
      <span className="truncate">{ids.length > 3 ? `${ids.length} people` : ids.map((id) => nombreCorto(nombre(id))).join(', ')}</span>
    </span>
  )
}

// Punto de color por prioridad: la tarjeta es blanca y sobria; el color solo aparece donde informa.
const PUNTO_PRIORIDAD = { urgente: 'bg-rose-500', alta: 'bg-peach-500', media: 'bg-brand-200', baja: 'bg-slate-300' }

function Tarjeta({ ticket, nombre, flotante = false, posicion = 0 }) {
  const atrasado = vencido(ticket)
  const hoyEs = ticket.fecha_limite === hoyLima() && ticket.estado !== 'realizado'
  const hecho = ticket.estado === 'realizado'
  const lista = progresoChecklist(ticket)
  const parado = estancado(ticket)
  return (
    <div
      className={`w-full rounded-xl border bg-white p-3 text-left transition ${
        flotante ? 'rotate-1 scale-105 border-brand-300 shadow-xl' : 'border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:shadow-md'
      } ${hecho ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="min-w-0 truncate font-medium text-slate-400">
          {posicion > 0 && <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-600" title="Position in the queue: 1 is the next one to attend">#{posicion}</span>}
          {ticket.codigo} · {etiquetaTipo(ticket.tipo)}
        </span>
        {ticket.prioridad === 'urgente' ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 font-semibold text-white">
            <Icon name="alert" className="h-3 w-3" /> Urgent
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-slate-500" title={`${etiquetaPrioridad(ticket.prioridad)} priority`}>
            <span aria-hidden className={`h-2 w-2 rounded-full ${PUNTO_PRIORIDAD[ticket.prioridad] ?? PUNTO_PRIORIDAD.media}`} />
            <span className={ticket.prioridad === 'alta' ? 'font-semibold text-peach-700' : ''}>{etiquetaPrioridad(ticket.prioridad)}</span>
          </span>
        )}
      </div>
      <p className={`mt-1.5 line-clamp-3 text-[14px] font-medium leading-snug text-slate-900 ${hecho ? 'line-through decoration-slate-300' : ''}`}>{ticket.titulo}</p>
      {parado && (
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-peach-700" title="No activity on this ticket">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-peach-500" /> Stalled · {diasSinMovimiento(ticket)}d
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <Responsables ids={responsablesDe(ticket)} nombre={nombre} />
        <span className="flex shrink-0 items-center gap-2.5 text-[11px] text-slate-500">
          {lista.total > 0 && (
            <span className={`inline-flex items-center gap-0.5 ${lista.completo ? 'font-semibold text-brand-700' : ''}`} title={`Checklist: ${lista.hechos} of ${lista.total} steps done`}>
              <Icon name="check" className="h-3.5 w-3.5" /> {lista.hechos}/{lista.total}
            </span>
          )}
          {ticket.n_comentarios > 0 && (
            <span className="inline-flex items-center gap-0.5" title={`${ticket.n_comentarios} comments`}>
              <Icon name="doc" className="h-3.5 w-3.5" /> {ticket.n_comentarios}
            </span>
          )}
          {ticket.fecha_limite && (
            <span className={`inline-flex items-center gap-1 ${atrasado ? 'rounded-md bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-700' : hoyEs ? 'rounded-md bg-peach-50 px-1.5 py-0.5 font-semibold text-peach-700' : ''}`}>
              <Icon name={atrasado ? 'alert' : 'calendar'} className="h-3 w-3" /> {formatoFecha(ticket.fecha_limite)}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}

function TarjetaArrastrable({ ticket, nombre, onAbrir, posicion }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ticket.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-label={`${ticket.codigo} ${ticket.titulo}`}
      onClick={() => onAbrir(ticket.id)}
      onKeyDown={(e) => e.key === 'Enter' && onAbrir(ticket.id)}
      className={`cursor-grab touch-manipulation rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
    >
      <Tarjeta ticket={ticket} nombre={nombre} posicion={posicion} />
    </div>
  )
}

// Tarjetas que se muestran de entrada por columna; el resto se despliega con «Show more» para que la columna nunca se haga interminable.
const INICIAL = { realizado: 5 }
const LOTE = 10
const INICIAL_POR_DEFECTO = 8

function Columna({ estado, tickets, nombre, onAbrir, arrastrando, visibleEnMovil }) {
  const { setNodeRef, isOver } = useDroppable({ id: estado.value })
  const e = ESTILO_ESTADO[estado.value]
  const [limite, setLimite] = useState(INICIAL[estado.value] ?? INICIAL_POR_DEFECTO)
  const mostrados = tickets.slice(0, limite)
  const restantes = tickets.length - mostrados.length
  const atrasados = tickets.filter((t) => vencido(t)).length
  return (
    <section aria-label={estado.label} className={`${visibleEnMovil ? 'flex' : 'hidden'} min-w-0 flex-col rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200/70 lg:flex lg:flex-1`}>
      <h2 className="flex items-center gap-2 px-2 pb-2 pt-1.5 text-[13px] font-semibold text-slate-700">
        <span className={`h-2 w-2 rounded-full ${e.punto}`} />
        {estado.label}
        <span className="text-xs font-medium text-slate-400">{tickets.length}</span>
        {atrasados > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600" title={`${atrasados} overdue`}>
            <Icon name="alert" className="h-3 w-3" /> {atrasados} overdue
          </span>
        )}
      </h2>
      <div
        ref={setNodeRef}
        className={`max-h-[70vh] min-h-28 flex-1 space-y-2.5 overflow-y-auto overscroll-contain rounded-xl p-1 [scrollbar-width:thin] transition-colors ${
          isOver ? `${e.soltar} ring-2 ring-inset` : arrastrando ? 'bg-white/50 ring-1 ring-dashed ring-inset ring-slate-300' : ''
        }`}
      >
        {mostrados.map((t, i) => (
          <TarjetaArrastrable key={t.id} ticket={t} nombre={nombre} onAbrir={onAbrir} posicion={estado.value === 'realizado' ? 0 : i + 1} />
        ))}
        {tickets.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 px-2 py-8 text-center text-xs text-slate-400">{arrastrando ? `Drop here to move to “${estado.label}”` : 'No tickets'}</p>
        )}
        {restantes > 0 && (
          <button type="button" onClick={() => setLimite((l) => l + LOTE)} className="w-full rounded-xl border border-dashed border-slate-300 bg-white/70 py-2 text-xs font-semibold text-brand-700 hover:bg-white">
            Show {Math.min(LOTE, restantes)} more · {restantes} hidden
          </button>
        )}
      </div>
    </section>
  )
}

const masRecientePrimero = (a, b) => b.updated_at.localeCompare(a.updated_at)

// Tablero Kanban. Arrastrar una tarjeta a otra columna cambia su estado (`onMover(id, estado)`); un clic abre el detalle.
export default function TicketTablero({ tickets, nombre, onAbrir, onMover }) {
  const [activo, setActivo] = useState(null)
  const [movil, setMovil] = useState('pendiente') // en celular se ve una columna a la vez
  // Ratón: arrastra tras mover 6 px (un clic abre el detalle). Táctil: mantener pulsado un instante, para poder desplazar la pantalla.
  const sensores = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }))
  const ticketActivo = tickets.find((t) => t.id === activo)

  const alSoltar = ({ active, over }) => {
    setActivo(null)
    const t = tickets.find((x) => x.id === active.id)
    if (t && over && over.id !== t.estado) onMover(t.id, over.id)
  }

  return (
    <DndContext sensors={sensores} onDragStart={({ active }) => setActivo(active.id)} onDragEnd={alSoltar} onDragCancel={() => setActivo(null)}>
      {/* Celular: selector de estado (una columna a la vez, sin deslizar de lado). */}
      <div role="tablist" aria-label="Status" className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 lg:hidden">
        {ESTADOS.map((e) => {
          const on = movil === e.value
          const n = tickets.filter((t) => t.estado === e.value).length
          return (
            <button key={e.value} type="button" role="tab" aria-selected={on} onClick={() => setMovil(e.value)} className={`flex flex-col items-center rounded-lg px-1 py-1.5 text-[11px] font-semibold leading-tight ${on ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
              <span className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${ESTILO_ESTADO[e.value].punto}`} /> {n}
              </span>
              <span className="truncate">{e.label}</span>
            </button>
          )
        })}
      </div>
      <div className="lg:flex lg:items-start lg:gap-4">
        {ESTADOS.map((e) => (
          <Columna
            key={e.value}
            estado={e}
            tickets={tickets.filter((t) => t.estado === e.value).sort(e.value === 'realizado' ? masRecientePrimero : ordenarTickets)}
            nombre={nombre}
            onAbrir={onAbrir}
            arrastrando={Boolean(activo)}
            visibleEnMovil={movil === e.value}
          />
        ))}
      </div>
      <DragOverlay>{ticketActivo ? <Tarjeta ticket={ticketActivo} nombre={nombre} flotante /> : null}</DragOverlay>
    </DndContext>
  )
}
