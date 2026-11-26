import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { useState } from 'react'
import Icon from '../ui/Icon'
import { ESTADOS, ESTILO_ESTADO, areaDe, colorAvatar, diasSinMovimiento, estancado, etiquetaTipo, hoyLima, nombreCorto, ordenarTickets, progresoChecklist, responsablesDe, vencido } from '../../lib/tickets'

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

// Tarjeta ligera: un icono de color por área, el título y poco más. Sin bordes pesados ni líneas internas: lo importante se lee de un vistazo.
function Anillo({ hechos, total, completo }) {
  const r = 6.5
  const c = 2 * Math.PI * r
  return (
    <span className="inline-flex items-center gap-1" title={`Checklist: ${hechos} of ${total} steps done`}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="-rotate-90">
        <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2" className="stroke-slate-200" />
        <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - hechos / total)} className={`transition-all duration-500 ${completo ? 'stroke-emerald-500' : 'stroke-brand-500'}`} />
      </svg>
      <span className={`tabular-nums ${completo ? 'font-semibold text-emerald-700' : ''}`}>
        {hechos}/{total}
      </span>
    </span>
  )
}

function Tarjeta({ ticket, nombre, flotante = false, posicion = 0, onCompletar, indice = 0 }) {
  const atrasado = vencido(ticket)
  const hoyEs = ticket.fecha_limite === hoyLima() && ticket.estado !== 'realizado'
  const hecho = ticket.estado === 'realizado'
  const lista = progresoChecklist(ticket)
  const parado = estancado(ticket)
  const area = areaDe(ticket.area)
  const [listo, setListo] = useState(false)
  return (
    <div
      style={flotante ? undefined : { animationDelay: `${Math.min(indice, 8) * 30}ms` }}
      className={`group relative w-full rounded-2xl bg-white p-3.5 text-left transition duration-200 ${
        flotante
          ? 'rotate-2 scale-105 shadow-2xl ring-2 ring-brand-300'
          : 'tk-in shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18)] hover:ring-slate-900/10 active:scale-[0.985]'
      } ${hecho ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        <span
          title={area ? area.label : 'No area'}
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3 ${area ? area.chip : 'bg-slate-50 text-slate-300 ring-slate-200'}`}
        >
          <Icon name={area ? area.icono : 'inbox'} className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1 pr-6">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span className="truncate">{area ? area.label : 'No area'}</span>
            {ticket.prioridad === 'urgente' && <span className="rounded-full bg-rose-600 px-1.5 py-px text-[10px] normal-case tracking-normal text-white">Urgent</span>}
            {ticket.prioridad === 'alta' && <span className="rounded-full bg-peach-100 px-1.5 py-px text-[10px] normal-case tracking-normal text-peach-700">High</span>}
          </p>
          <p className={`mt-0.5 line-clamp-3 text-[14px] font-semibold leading-snug text-slate-900 ${hecho ? 'line-through decoration-slate-300' : ''}`}>{ticket.titulo}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
            {posicion > 0 && <span className="rounded bg-slate-100 px-1 font-bold text-slate-500" title="Position in the queue: 1 is the next one to attend">#{posicion}</span>}
            <span className="truncate">
              {ticket.codigo} · {etiquetaTipo(ticket.tipo)}
            </span>
            {parado && <span className="shrink-0 text-peach-700" title="No activity on this ticket">· stalled {diasSinMovimiento(ticket)}d</span>}
          </p>
        </div>
      </div>

      {(responsablesDe(ticket).length > 0 || ticket.n_comentarios > 0 || lista.total > 0 || ticket.fecha_limite) && (
        <div className="mt-3 flex items-center justify-between gap-2 pl-12">
          <Responsables ids={responsablesDe(ticket)} nombre={nombre} />
          <span className="flex shrink-0 items-center gap-2.5 text-[11px] text-slate-400">
            {lista.total > 0 && <Anillo hechos={lista.hechos} total={lista.total} completo={lista.completo} />}
            {ticket.n_comentarios > 0 && (
              <span className="inline-flex items-center gap-0.5" title={`${ticket.n_comentarios} comments`}>
                <Icon name="doc" className="h-3.5 w-3.5" /> {ticket.n_comentarios}
              </span>
            )}
            {ticket.fecha_limite && (
              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ${atrasado ? 'bg-rose-50 font-semibold text-rose-700' : hoyEs ? 'bg-peach-50 font-semibold text-peach-700' : ''}`}>
                <Icon name={atrasado ? 'alert' : 'calendar'} className="h-3 w-3" /> {formatoFecha(ticket.fecha_limite)}
              </span>
            )}
          </span>
        </div>
      )}
      {responsablesDe(ticket).length === 0 && !flotante && (
        <p className="mt-2 pl-12 text-[11px] font-medium text-peach-700">Unassigned</p>
      )}

      {onCompletar && !flotante && (
        <button
          type="button"
          title={hecho ? 'Reopen' : 'Mark as done'}
          aria-label={`${hecho ? 'Reopen' : 'Mark as done'} ${ticket.codigo}`}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            setListo(true)
            setTimeout(() => onCompletar(ticket.id, hecho ? 'pendiente' : 'realizado'), 220)
          }}
          className={`absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border text-slate-300 opacity-0 transition duration-200 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-600 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-emerald-400 group-hover:opacity-100 ${listo ? 'tk-pop border-emerald-500 bg-emerald-500 text-white opacity-100' : 'border-slate-200 bg-white'}`}
        >
          <Icon name={hecho ? 'back' : 'check'} className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

function TarjetaArrastrable({ ticket, nombre, onAbrir, posicion, onCompletar, indice }) {
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
      className={`cursor-grab touch-manipulation rounded-2xl transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
    >
      <Tarjeta ticket={ticket} nombre={nombre} posicion={posicion} onCompletar={onCompletar} indice={indice} />
    </div>
  )
}

// Tarjetas que se muestran de entrada por columna; el resto se despliega con «Show more» para que la columna nunca se haga interminable.
const INICIAL = { realizado: 5 }
const LOTE = 10
const INICIAL_POR_DEFECTO = 8

function Columna({ estado, tickets, nombre, onAbrir, onCompletar, arrastrando, visibleEnMovil }) {
  const { setNodeRef, isOver } = useDroppable({ id: estado.value })
  const e = ESTILO_ESTADO[estado.value]
  const [limite, setLimite] = useState(INICIAL[estado.value] ?? INICIAL_POR_DEFECTO)
  const mostrados = tickets.slice(0, limite)
  const restantes = tickets.length - mostrados.length
  const atrasados = tickets.filter((t) => vencido(t)).length
  return (
    <section aria-label={estado.label} className={`${visibleEnMovil ? 'flex' : 'hidden'} min-w-0 flex-col rounded-3xl bg-slate-100/60 p-2.5 lg:flex lg:flex-1`}>
      <h2 className="flex items-center gap-2 px-2 pb-2 pt-1.5 text-[13px] font-semibold text-slate-700">
        <span className={`h-2 w-2 rounded-full ${e.punto}`} />
        {estado.label}
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500 shadow-sm">{tickets.length}</span>
        {atrasados > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600" title={`${atrasados} overdue`}>
            <Icon name="alert" className="h-3 w-3" /> {atrasados} overdue
          </span>
        )}
      </h2>
      <div
        ref={setNodeRef}
        className={`max-h-[70vh] min-h-28 flex-1 space-y-3 overflow-y-auto overscroll-contain rounded-2xl p-1 [scrollbar-width:thin] transition duration-200 ${
          isOver ? `${e.soltar} scale-[1.01] ring-2 ring-inset` : arrastrando ? 'bg-white/50 ring-1 ring-dashed ring-inset ring-slate-300' : ''
        }`}
      >
        {mostrados.map((t, i) => (
          <TarjetaArrastrable key={t.id} ticket={t} nombre={nombre} onAbrir={onAbrir} onCompletar={onCompletar} indice={i} posicion={estado.value === 'realizado' ? 0 : i + 1} />
        ))}
        {tickets.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300/80 px-2 py-8 text-center text-xs text-slate-400">{arrastrando ? `Drop here to move to “${estado.label}”` : 'Nothing here'}</p>
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
            onCompletar={onMover}
            arrastrando={Boolean(activo)}
            visibleEnMovil={movil === e.value}
          />
        ))}
      </div>
      <DragOverlay>{ticketActivo ? <Tarjeta ticket={ticketActivo} nombre={nombre} flotante /> : null}</DragOverlay>
    </DndContext>
  )
}
