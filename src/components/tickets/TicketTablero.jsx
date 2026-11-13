import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { useState } from 'react'
import Icon from '../ui/Icon'
import { ESTADOS, ESTILO_ESTADO, ESTILO_PRIORIDAD, colorAvatar, etiquetaPrioridad, etiquetaTipo, nombreCorto, ordenarTickets, vencido } from '../../lib/tickets'

const formatoFecha = (f) => new Date(`${f}T00:00:00`).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })

// Responsable: círculo con su inicial (color propio) y nombre. Sin responsable se ve como un hueco punteado, para notarlo.
function Responsable({ id, nombre }) {
  if (!id)
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-amber-700">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-amber-400 bg-amber-50">
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

function Tarjeta({ ticket, nombre, flotante = false }) {
  const atrasado = vencido(ticket)
  const p = ESTILO_PRIORIDAD[ticket.prioridad] ?? ESTILO_PRIORIDAD.media
  const hecho = ticket.estado === 'realizado'
  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border text-left shadow-sm transition ${p.fondo} ${
        flotante ? 'rotate-2 scale-105 border-brand-400 shadow-xl' : 'border-slate-200 hover:border-brand-300 hover:shadow-md'
      } ${hecho ? 'opacity-70' : ''}`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${p.franja}`} />
      <div className="py-2.5 pl-4 pr-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
            <Icon name="list" className="h-3.5 w-3.5 text-slate-300" /> {ticket.codigo}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${p.chip}`}>
            <Icon name={p.icono} className="h-3 w-3" /> {etiquetaPrioridad(ticket.prioridad)}
          </span>
        </div>
        <p className={`mt-1.5 text-sm font-semibold leading-snug text-slate-900 ${hecho ? 'line-through decoration-slate-300' : ''}`}>{ticket.titulo}</p>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <Responsable id={ticket.responsable_id} nombre={nombre} />
          <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
            {ticket.n_comentarios > 0 && (
              <span className="inline-flex items-center gap-0.5" title={`${ticket.n_comentarios} comments`}>
                <Icon name="doc" className="h-3.5 w-3.5" /> {ticket.n_comentarios}
              </span>
            )}
            {ticket.fecha_limite && (
              <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ${atrasado ? 'bg-rose-100 font-semibold text-rose-700' : 'bg-slate-100'}`}>
                <Icon name={atrasado ? 'alert' : 'calendar'} className="h-3 w-3" /> {formatoFecha(ticket.fecha_limite)}
              </span>
            )}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">{etiquetaTipo(ticket.tipo)}</p>
      </div>
    </div>
  )
}

function TarjetaArrastrable({ ticket, nombre, onAbrir }) {
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
      <Tarjeta ticket={ticket} nombre={nombre} />
    </div>
  )
}

function Columna({ estado, tickets, nombre, onAbrir, arrastrando }) {
  const { setNodeRef, isOver } = useDroppable({ id: estado.value })
  const e = ESTILO_ESTADO[estado.value]
  return (
    <section aria-label={estado.label} className="flex w-[17.5rem] shrink-0 snap-start flex-col rounded-2xl bg-slate-100/80 p-2.5 lg:w-auto lg:min-w-0 lg:flex-1">
      <h2 className={`flex items-center gap-2 px-1.5 pb-2.5 pt-1 text-sm font-bold ${e.cab}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${e.punto}`} />
        {estado.label}
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 shadow-sm">{tickets.length}</span>
      </h2>
      <div
        ref={setNodeRef}
        className={`min-h-28 flex-1 space-y-2 rounded-xl p-1 transition-colors ${
          isOver ? `${e.soltar} ring-2 ring-inset` : arrastrando ? 'bg-white/50 ring-1 ring-dashed ring-inset ring-slate-300' : ''
        }`}
      >
        {tickets.map((t) => (
          <TarjetaArrastrable key={t.id} ticket={t} nombre={nombre} onAbrir={onAbrir} />
        ))}
        {tickets.length === 0 && (
          <p className="px-2 py-8 text-center text-xs text-slate-400">{arrastrando ? `Drop here to move to “${estado.label}”` : 'No tickets'}</p>
        )}
      </div>
    </section>
  )
}

// Tablero Kanban. Arrastrar una tarjeta a otra columna cambia su estado (`onMover(id, estado)`); un clic abre el detalle.
export default function TicketTablero({ tickets, nombre, onAbrir, onMover }) {
  const [activo, setActivo] = useState(null)
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
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0">
        {ESTADOS.map((e) => (
          <Columna key={e.value} estado={e} tickets={tickets.filter((t) => t.estado === e.value).sort(ordenarTickets)} nombre={nombre} onAbrir={onAbrir} arrastrando={Boolean(activo)} />
        ))}
      </div>
      <DragOverlay>{ticketActivo ? <Tarjeta ticket={ticketActivo} nombre={nombre} flotante /> : null}</DragOverlay>
    </DndContext>
  )
}
