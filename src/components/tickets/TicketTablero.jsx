import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { useState } from 'react'
import Badge from '../ui/Badge'
import Icon from '../ui/Icon'
import { COLOR_PRIORIDAD, ESTADOS, etiquetaPrioridad, etiquetaTipo, nombreCorto, ordenarTickets, vencido } from '../../lib/tickets'

const formatoFecha = (f) => new Date(`${f}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })

function Tarjeta({ ticket, nombre, onAbrir, flotante = false }) {
  const atrasado = vencido(ticket)
  return (
    <div
      className={`w-full rounded-2xl border bg-white p-3 text-left shadow-sm ${flotante ? 'rotate-1 border-brand-300 shadow-lg' : 'border-slate-200 hover:border-brand-300'} ${atrasado ? 'ring-1 ring-rose-200' : ''}`}
      onClick={flotante ? undefined : () => onAbrir(ticket.id)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-400">{ticket.codigo}</span>
        <Badge color={COLOR_PRIORIDAD[ticket.prioridad]}>{etiquetaPrioridad(ticket.prioridad)}</Badge>
      </div>
      <p className="mt-1.5 text-sm font-medium leading-snug text-slate-900">{ticket.titulo}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>{etiquetaTipo(ticket.tipo)}</span>
        {ticket.fecha_limite && (
          <span className={`inline-flex items-center gap-1 ${atrasado ? 'font-medium text-rose-700' : ''}`}>
            <Icon name="calendar" className="h-3.5 w-3.5" /> {formatoFecha(ticket.fecha_limite)}
            {atrasado && ' · vencido'}
          </span>
        )}
        {ticket.n_comentarios > 0 && (
          <span className="inline-flex items-center gap-1" title={`${ticket.n_comentarios} comentarios`}>
            <Icon name="doc" className="h-3.5 w-3.5" /> {ticket.n_comentarios}
          </span>
        )}
      </div>
      <p className="mt-2 truncate text-xs text-slate-600">
        <Icon name="user" className="mr-1 inline h-3.5 w-3.5 align-text-bottom text-slate-400" />
        {ticket.responsable_id ? nombreCorto(nombre(ticket.responsable_id)) : <span className="text-slate-400">Sin asignar</span>}
      </p>
    </div>
  )
}

function TarjetaArrastrable({ ticket, nombre, onAbrir }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ticket.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} role="button" tabIndex={0} aria-label={`${ticket.codigo} ${ticket.titulo}`} onKeyDown={(e) => e.key === 'Enter' && onAbrir(ticket.id)} className={`cursor-grab touch-manipulation active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}>
      <Tarjeta ticket={ticket} nombre={nombre} onAbrir={onAbrir} />
    </div>
  )
}

function Columna({ estado, tickets, nombre, onAbrir }) {
  const { setNodeRef, isOver } = useDroppable({ id: estado.value })
  return (
    <section aria-label={estado.label} className="flex w-[17.5rem] shrink-0 snap-start flex-col rounded-3xl bg-slate-100/80 p-3 lg:w-auto lg:min-w-0 lg:flex-1">
      <h2 className="flex items-center justify-between px-1 pb-2 text-sm font-semibold text-slate-700">
        {estado.label}
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{tickets.length}</span>
      </h2>
      <div ref={setNodeRef} className={`min-h-24 flex-1 space-y-2 rounded-2xl p-1 transition-colors ${isOver ? 'bg-brand-100/70' : ''}`}>
        {tickets.map((t) => (
          <TarjetaArrastrable key={t.id} ticket={t} nombre={nombre} onAbrir={onAbrir} />
        ))}
        {tickets.length === 0 && <p className="px-2 py-6 text-center text-xs text-slate-400">Sin tickets</p>}
      </div>
    </section>
  )
}

// Tablero Kanban. Arrastrar una tarjeta a otra columna cambia su estado (`onMover(id, estado)`).
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
          <Columna key={e.value} estado={e} tickets={tickets.filter((t) => t.estado === e.value).sort(ordenarTickets)} nombre={nombre} onAbrir={onAbrir} />
        ))}
      </div>
      <DragOverlay>{ticketActivo ? <Tarjeta ticket={ticketActivo} nombre={nombre} flotante /> : null}</DragOverlay>
    </DndContext>
  )
}
