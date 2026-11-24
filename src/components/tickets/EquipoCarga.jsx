import { useEffect, useMemo, useRef, useState } from 'react'
import NiceAvatar from 'react-nice-avatar'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import useCarga from '../../hooks/useCarga'
import { CABELLOS, CAMISAS, GAFAS, GORROS, PEINADOS, PIELES, ROPAS, SEXOS, aspectoAutomatico, configAvatar, sanear } from '../../lib/avatar'
import { PRESENCIA, presenciaDe, repartirRincones } from '../../lib/presencia'
import { cargaPorPersona, hoyLima, nombreCorto } from '../../lib/tickets'
import { avataresTickets, guardarAvatar, guardarPresencia } from '../../services/tickets'

const CAJA = { urgente: '#e11d48', alta: '#f59e0b', media: '#8b5cf6', baja: '#94a3b8' }
const MAX_CAJAS = 4
const MADERA = '#c9a27a'
const MADERA_OSCURA = '#a47c52'

const ANIMO = {
  libre: { texto: 'All clear!', clase: 'text-brand-700', barra: 'bg-brand-500' },
  tranquilo: { texto: 'Light load', clase: 'text-slate-600', barra: 'bg-brand-400' },
  cargado: { texto: 'Busy', clase: 'text-peach-700', barra: 'bg-peach-500' },
  agobiado: { texto: 'Overloaded', clase: 'text-rose-600', barra: 'bg-rose-500' },
}

// Pila de cajas (una por ticket abierto; el color es la prioridad) apoyada en (x, y).
function Pila({ cajas, x, y, w = 28 }) {
  const visibles = cajas.slice(0, MAX_CAJAS)
  const extra = cajas.length - visibles.length
  return (
    <g>
      {visibles.map((p, i) => (
        <g key={i} transform={`translate(${x + (i % 2 ? 1.5 : -1.5)} ${y - (i + 1) * 9})`}>
          <rect x={-w / 2} y="0" width={w} height="8.4" rx="2" fill={CAJA[p] ?? CAJA.media} stroke="#fff" strokeWidth="1.3" />
          <path d={`M${-w / 2} 3.2h${w}`} stroke="#fff" strokeOpacity=".4" strokeWidth="1" />
          <rect x="-2.5" y="0" width="5" height="8.4" fill="#fff" fillOpacity=".25" />
        </g>
      ))}
      {extra > 0 && (
        <g>
          <circle cx={x + w / 2 + 3} cy={y - visibles.length * 9 - 2} r="8" fill="#1b0042" />
          <text x={x + w / 2 + 3} y={y - visibles.length * 9 + 1.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">
            +{extra}
          </text>
        </g>
      )}
    </g>
  )
}

// Rincones de la oficina. Cada uno tiene su mobiliario detrás (fondo) y delante (frente) del personaje, dónde se sienta y dónde apoya su carga.
const RINCONES = [
  {
    id: 'escritorio',
    label: 'Desk',
    avatar: { x: 40, y: 40, s: 64 },
    pila: { x: 20, y: 98 },
    fondo: <rect x="26" y="52" width="72" height="68" rx="18" fill="#cbb5ee" />,
    frente: (
      <g>
        <rect x="8" y="98" width="144" height="9" rx="3" fill={MADERA} />
        <rect x="12" y="107" width="136" height="35" rx="3" fill={MADERA_OSCURA} />
        <path d="M80 107v35M14 124h132" stroke="#8a6440" strokeWidth="1.5" />
        <rect x="120" y="94" width="8" height="5" fill="#475569" />
        <rect x="102" y="64" width="44" height="31" rx="3" fill="#1b0042" />
        <rect x="106" y="68" width="36" height="23" rx="2" fill="#8b5cf6" fillOpacity=".55" />
        <path d="M110 74h22M110 80h28M110 86h16" stroke="#fff" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'reunion',
    label: 'Meeting room',
    avatar: { x: 56, y: 34, s: 62 },
    pila: { x: 20, y: 106 },
    fondo: (
      <g fill="#e6dcf7">
        <circle cx="30" cy="74" r="13" />
        <circle cx="130" cy="74" r="13" />
        <rect x="10" y="12" width="40" height="26" rx="3" fill="#fff" stroke="#cbb5ee" strokeWidth="2" />
      </g>
    ),
    frente: (
      <g>
        <rect x="73" y="118" width="14" height="24" fill="#8a6440" />
        <ellipse cx="80" cy="110" rx="72" ry="18" fill={MADERA_OSCURA} />
        <ellipse cx="80" cy="106" rx="72" ry="17" fill="#d9b58d" />
        <rect x="100" y="104" width="30" height="4" rx="1.5" fill="#cbd5e1" />
        <path d="M104 104l3-17h20l3 17z" fill="#475569" />
        <rect x="108" y="90" width="12" height="2.4" rx="1" fill="#fff" fillOpacity=".6" />
      </g>
    ),
  },
  {
    id: 'pizarra',
    label: 'Planning wall',
    avatar: { x: 50, y: 58, s: 60 },
    pila: { x: 132, y: 142 },
    fondo: (
      <g>
        <rect x="12" y="6" width="136" height="70" rx="5" fill="#fff" stroke="#cbb5ee" strokeWidth="3" />
        <rect x="22" y="14" width="26" height="20" rx="2" fill="#fde68a" />
        <rect x="54" y="14" width="26" height="20" rx="2" fill="#fbcfe8" />
        <rect x="112" y="14" width="26" height="20" rx="2" fill="#bae6fd" />
        <path d="M24 46h60M24 56h40M96 50h42M96 60h30" stroke="#a78bdb" strokeWidth="3" strokeLinecap="round" />
      </g>
    ),
    frente: (
      <g>
        <rect x="24" y="116" width="100" height="8" rx="3" fill={MADERA} />
        <rect x="28" y="124" width="92" height="18" rx="3" fill={MADERA_OSCURA} />
      </g>
    ),
  },
  {
    id: 'sala',
    label: 'Lounge',
    avatar: { x: 38, y: 44, s: 60 },
    pila: { x: 146, y: 106 },
    fondo: (
      <g fill="#a78bdb">
        <rect x="14" y="54" width="108" height="62" rx="18" />
        <rect x="6" y="72" width="22" height="52" rx="10" fill="#8b5cf6" />
        <rect x="108" y="72" width="22" height="52" rx="10" fill="#8b5cf6" />
      </g>
    ),
    frente: (
      <g>
        <rect x="22" y="100" width="92" height="28" rx="12" fill="#6a2cc8" />
        <path d="M30 108h76" stroke="#fff" strokeOpacity=".25" strokeWidth="2" strokeLinecap="round" />
        <rect x="143" y="106" width="3" height="34" fill="#8a6440" />
        <ellipse cx="144.5" cy="106" rx="14" ry="4" fill={MADERA} />
      </g>
    ),
  },
  {
    id: 'cafe',
    label: 'Coffee corner',
    avatar: { x: 62, y: 42, s: 62 },
    pila: { x: 140, y: 100 },
    fondo: (
      <g>
        <rect x="58" y="30" width="92" height="4" rx="2" fill={MADERA} />
        <g fill="#fff" stroke="#cbd5e1" strokeWidth="1">
          <rect x="66" y="20" width="9" height="10" rx="2" />
          <rect x="82" y="20" width="9" height="10" rx="2" />
          <rect x="98" y="20" width="9" height="10" rx="2" />
        </g>
        <rect x="10" y="40" width="40" height="58" rx="5" fill="#475569" />
        <rect x="16" y="46" width="28" height="16" rx="3" fill="#1b0042" />
        <circle cx="30" cy="72" r="4" fill="#f59e5b" />
        <rect x="24" y="84" width="12" height="10" rx="2" fill="#e2e8f0" />
      </g>
    ),
    frente: (
      <g>
        <rect x="6" y="98" width="148" height="9" rx="3" fill="#8a6440" />
        <rect x="10" y="107" width="140" height="35" rx="3" fill={MADERA_OSCURA} />
        <rect x="52" y="90" width="11" height="9" rx="2" fill="#fff" />
        <path d="M63 93q5 1 0 5" fill="none" stroke="#fff" strokeWidth="2" />
        <path d="M56 86q2-3 0-6M60 86q2-3 0-6" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'archivo',
    label: 'Records corner',
    avatar: { x: 30, y: 44, s: 60 },
    pila: { x: 134, y: 64 },
    fondo: (
      <g>
        <rect x="16" y="14" width="46" height="30" rx="3" fill="#fff" stroke="#cbb5ee" strokeWidth="2" />
        <path d="M22 36l10-10 8 8 6-6 10 10" fill="none" stroke="#a78bdb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    ),
    frente: (
      <g>
        <rect x="8" y="98" width="100" height="9" rx="3" fill={MADERA} />
        <rect x="12" y="107" width="92" height="35" rx="3" fill={MADERA_OSCURA} />
        <rect x="16" y="91" width="13" height="8" rx="2" fill="#c2763a" />
        <path d="M22 91c-6-6-4-12 0-14 5 4 5 9 0 14zM22 91c6-6 12-6 15-2-4 5-9 5-15 2z" fill="#22a06b" />
        <rect x="114" y="64" width="40" height="78" rx="4" fill="#94a3b8" />
        <path d="M114 90h40M114 116h40" stroke="#64748b" strokeWidth="1.6" />
        <rect x="127" y="75" width="14" height="3" rx="1.5" fill="#475569" />
        <rect x="127" y="101" width="14" height="3" rx="1.5" fill="#475569" />
        <rect x="127" y="127" width="14" height="3" rx="1.5" fill="#475569" />
      </g>
    ),
  },
]

// Un rincón de la oficina con su personaje. Al bajar la cantidad de tickets abiertos (se terminó uno): salto, caja que sale volando y «−1 ✓».
function Rincon({ c, rincon, aspecto, pres, activo, mio, onElegir }) {
  const a = ANIMO[c.animo]
  const previo = useRef(c.abiertos)
  const [liberado, setLiberado] = useState(false)
  useEffect(() => {
    if (c.abiertos < previo.current) {
      setLiberado(true)
      const t = setTimeout(() => setLiberado(false), 1700)
      previo.current = c.abiertos
      return () => clearTimeout(t)
    }
    previo.current = c.abiertos
  }, [c.abiertos])
  const carga = Math.min(100, Math.round((100 * c.abiertos) / 8))
  const ausente = pres.info.ausente
  const { x, y, s } = rincon.avatar
  const caja = { position: 'absolute', left: `${(x / 160) * 100}%`, top: `${(y / 150) * 100}%`, width: `${(s / 160) * 100}%`, aspectRatio: '1' }
  return (
    <button
      type="button"
      onClick={onElegir}
      aria-pressed={activo}
      title={`${nombreCorto(c.correo)} · ${rincon.label} · ${pres.info.label}: ${c.abiertos} open · ${c.vencidos} overdue · ${c.hechosSemana} done this week`}
      className={`group relative flex flex-col items-center rounded-2xl px-1.5 pb-2 pt-1 text-center transition hover:-translate-y-0.5 ${activo ? 'bg-white/80 ring-2 ring-brand-500' : 'hover:bg-white/50'}`}
    >
      <div className="mb-0.5 flex w-full items-center justify-between gap-1">
        <span className="truncate rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{rincon.label}</span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200">
          <span aria-hidden className={`h-2 w-2 rounded-full ${pres.info.punto}`} />
          {pres.info.label}
        </span>
      </div>
      <div className="relative w-full" style={{ aspectRatio: '160 / 150' }}>
        <svg viewBox="0 0 160 150" className="absolute inset-0 h-full w-full" aria-hidden>
          <ellipse cx="80" cy="144" rx="68" ry="5" fill="#33007a" fillOpacity=".08" />
          {rincon.fondo}
        </svg>
        {ausente ? (
          // Puesto vacío: el personaje no está, pero su carga de trabajo sigue sobre el mueble.
          <div style={caja} className="flex items-center justify-center">
            <span className="flex flex-col items-center rounded-xl bg-white/95 px-2.5 py-1.5 text-center shadow ring-1 ring-slate-200">
              <Icon name="clock" className="h-4 w-4 text-slate-400" />
              <span className="text-[11px] font-bold leading-tight text-slate-700">{pres.info.cartel}</span>
            </span>
          </div>
        ) : (
          <div style={caja} className={`${liberado ? 'chibi-jump' : c.animo === 'agobiado' ? 'chibi-shake' : 'chibi-bob'}`}>
            <NiceAvatar style={{ width: '100%', height: '100%' }} shape="square" {...configAvatar(aspecto, c.animo)} />
          </div>
        )}
        <svg viewBox="0 0 160 150" className="absolute inset-0 h-full w-full" role="img" aria-label={`${c.abiertos} open tickets`}>
          {rincon.frente}
          <Pila cajas={c.cajas} x={rincon.pila.x} y={rincon.pila.y} />
          {!ausente && c.animo === 'agobiado' && <path className="chibi-drop" d={`M${x + s - 6} ${y + 6}q4 6 0 10-4-4 0-10z`} fill="#7dd3fc" stroke="#38bdf8" strokeWidth="1" />}
          {!ausente && c.animo === 'libre' && (
            <g fill="#f59e5b">
              <path className="chibi-twinkle" d="M12 40l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
              <path className="chibi-twinkle" style={{ animationDelay: '.6s' }} d="M146 34l1.8 4.4 4.4 1.8-4.4 1.8-1.8 4.4-1.8-4.4-4.4-1.8 4.4-1.8z" fill="#a78bdb" />
            </g>
          )}
        </svg>
        {liberado && (
          <>
            <span aria-hidden className="chibi-fly pointer-events-none absolute left-[60%] top-[30%] h-3 w-8 rounded-sm bg-brand-500 ring-2 ring-white" />
            <span aria-hidden className="chibi-pop pointer-events-none absolute left-1/2 top-[22%] -translate-x-1/2 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-bold text-white shadow">
              −1 ✓
            </span>
          </>
        )}
      </div>
      <span className="mt-1 max-w-full truncate rounded-full bg-white px-2.5 py-0.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200">
        {nombreCorto(c.correo)}
        {mio ? ' (me)' : ''}
      </span>
      {ausente ? (
        <span className="mt-0.5 text-xs font-semibold text-slate-500">{c.abiertos > 0 ? 'Work waiting on the desk' : 'Nothing pending'}</span>
      ) : (
        <span className={`mt-0.5 text-xs font-semibold ${a.clase}`}>{a.texto}</span>
      )}
      {pres.mensaje && <span className="mt-0.5 max-w-full truncate text-[11px] italic text-slate-500">“{pres.mensaje}”</span>}
      <div className="mt-1 h-1.5 w-4/5 overflow-hidden rounded-full bg-white/80 ring-1 ring-slate-200/70" aria-hidden>
        <div className={`h-full rounded-full transition-all duration-700 ${a.barra}`} style={{ width: `${Math.max(carga, c.abiertos ? 8 : 0)}%` }} />
      </div>
      <span className="mt-0.5 text-[11px] text-slate-500">
        {c.abiertos} open{c.vencidos > 0 ? ` · ${c.vencidos} overdue` : ''}
      </span>
      {c.hechosSemana > 0 && (
        <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
          <Icon name="check" className="h-3 w-3" /> {c.hechosSemana} done this week
        </span>
      )}
    </button>
  )
}

function Colores({ lista, valor, onElegir, nombre }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={nombre}>
      {lista.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={valor === c} aria-label={`${nombre} ${c}`} onClick={() => onElegir(c)} style={{ backgroundColor: c }} className={`h-7 w-7 rounded-full ring-offset-2 ${valor === c ? 'ring-2 ring-brand-700' : 'ring-1 ring-slate-300'}`} />
      ))}
    </div>
  )
}
function Grupo({ titulo, children }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-slate-900">{titulo}</p>
      {children}
    </div>
  )
}
const chip = (activo) => `rounded-full px-3 py-1 text-xs font-semibold ${activo ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`
function Opciones({ lista, valor, onElegir, nombre }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={nombre}>
      {lista.map((p) => (
        <button key={p.id} type="button" role="radio" aria-checked={valor === p.id} onClick={() => onElegir(p.id)} className={chip(valor === p.id)}>
          {p.label}
        </button>
      ))}
    </div>
  )
}

// Ventana para que cada persona elija su personaje, con vista previa.
function ElegirPersonaje({ actual, onCerrar, onGuardado }) {
  const [a, setA] = useState(sanear(actual))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const poner = (k) => (v) => setA((p) => sanear({ ...p, [k]: v }))
  const guardar = async () => {
    setGuardando(true)
    setError('')
    try {
      await guardarAvatar(sanear(a))
      await onGuardado()
      onCerrar()
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }
  return (
    <Modal title="Choose your character" wide="xl" onClose={onCerrar}>
      <div className="grid gap-5 md:grid-cols-[12rem_1fr]">
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-b from-brand-50 to-white p-4 ring-1 ring-slate-200">
          <NiceAvatar style={{ width: '9rem', height: '9rem' }} shape="rounded" {...configAvatar(a, 'tranquilo')} bgColor="#e6dcf7" />
          <p className="text-center text-xs text-slate-500">Its expression changes with your workload.</p>
        </div>
        <div className="space-y-3.5">
          <Grupo titulo="Character">
            <Opciones lista={SEXOS} valor={a.sex} onElegir={poner('sex')} nombre="Character" />
          </Grupo>
          <Grupo titulo="Hairstyle">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Hairstyle">
              {PEINADOS[a.sex].map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={a.hairStyle === p.id} onClick={() => poner('hairStyle')(p.id)} className={`flex flex-col items-center rounded-xl p-1 text-[11px] font-semibold ${a.hairStyle === p.id ? 'bg-brand-50 text-brand-800 ring-2 ring-brand-500' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-brand-300'}`}>
                  <NiceAvatar style={{ width: '3.25rem', height: '3.25rem' }} shape="rounded" {...configAvatar({ ...a, hairStyle: p.id }, 'tranquilo')} bgColor="#f4effc" />
                  {p.label}
                </button>
              ))}
            </div>
          </Grupo>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Grupo titulo="Hair color">
              <Colores lista={CABELLOS} valor={a.hairColor} onElegir={poner('hairColor')} nombre="Hair color" />
            </Grupo>
            <Grupo titulo="Skin tone">
              <Colores lista={PIELES} valor={a.faceColor} onElegir={poner('faceColor')} nombre="Skin tone" />
            </Grupo>
            <Grupo titulo="Shirt">
              <Opciones lista={CAMISAS} valor={a.shirtStyle} onElegir={poner('shirtStyle')} nombre="Shirt" />
            </Grupo>
            <Grupo titulo="Shirt color">
              <Colores lista={ROPAS} valor={a.shirtColor} onElegir={poner('shirtColor')} nombre="Shirt color" />
            </Grupo>
            <Grupo titulo="Glasses">
              <Opciones lista={GAFAS} valor={a.glassesStyle} onElegir={poner('glassesStyle')} nombre="Glasses" />
            </Grupo>
            <Grupo titulo="Hat">
              <Opciones lista={GORROS} valor={a.hatStyle} onElegir={poner('hatStyle')} nombre="Hat" />
            </Grupo>
          </div>
        </div>
      </div>
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCerrar}>
          Cancel
        </Button>
        <Button type="button" onClick={guardar} disabled={guardando}>
          {guardando ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Modal>
  )
}

// Ventana para marcar el estado propio (ocupado, en reunión, almuerzo, fuera…), dejar un mensaje corto y elegir el rincón de la oficina.
function MiEstado({ actual, rincones, onCerrar, onGuardado }) {
  const [estado, setEstado] = useState(actual.estado)
  const [mensaje, setMensaje] = useState(actual.mensaje)
  const [rincon, setRincon] = useState(actual.rincon)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const guardar = async () => {
    setGuardando(true)
    setError('')
    try {
      await guardarPresencia(estado, mensaje, rincon, hoyLima())
      await onGuardado()
      onCerrar()
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }
  return (
    <Modal title="My status and office" wide onClose={onCerrar}>
      <div className="space-y-4">
        <Grupo titulo="Status">
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Status">
            {PRESENCIA.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={estado === p.id} onClick={() => setEstado(p.id)} className={`flex items-start gap-2.5 rounded-xl p-2.5 text-left ${estado === p.id ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-1 ring-slate-200 hover:ring-brand-300'}`}>
                <span aria-hidden className={`mt-1 h-3 w-3 shrink-0 rounded-full ${p.punto}`} />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{p.label}</span>
                  <span className="block text-xs text-slate-500">{p.ayuda}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">When you mark “At lunch” or “Gone for the day”, your character leaves the desk but your pending tickets stay visible. The status goes back to Available tomorrow.</p>
        </Grupo>
        <Grupo titulo="Short message (optional)">
          <input value={mensaje} onChange={(e) => setMensaje(e.target.value)} maxLength={60} placeholder="E.g.: Back at 3 pm" aria-label="Short message" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </Grupo>
        <Grupo titulo="My spot in the office">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="My spot in the office">
            {RINCONES.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={rincon === r.id} onClick={() => setRincon(r.id)} className={`relative overflow-hidden rounded-xl p-1 ${rincon === r.id ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-1 ring-slate-200 hover:ring-brand-300'}`}>
                <svg viewBox="0 0 160 150" className="h-auto w-full" aria-hidden>
                  {r.fondo}
                  {r.frente}
                </svg>
                <span className="block pb-1 text-center text-xs font-semibold text-slate-700">{r.label}</span>
              </button>
            ))}
          </div>
          {rincon && rincones.ocupados.includes(rincon) && <p className="mt-1.5 text-xs text-slate-500">Someone else also picked this spot: you will both have your own copy of it.</p>}
        </Grupo>
      </div>
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCerrar}>
          Cancel
        </Button>
        <Button type="button" onClick={guardar} disabled={guardando}>
          {guardando ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Modal>
  )
}

// Avatar pequeño con su punto de estado: así, con la oficina cerrada, se ve quién está y quién no.
function MiniAvatar({ c, aspecto, pres, activo, onElegir }) {
  const ausente = pres.info.ausente
  return (
    <button
      type="button"
      onClick={onElegir}
      aria-pressed={activo}
      title={`${nombreCorto(c.correo)} · ${pres.info.label}${pres.mensaje ? ` · ${pres.mensaje}` : ''} · ${c.abiertos} open${c.vencidos ? `, ${c.vencidos} overdue` : ''}`}
      className={`flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-left ring-1 transition hover:-translate-y-0.5 ${activo ? 'ring-2 ring-brand-500' : 'ring-slate-200'}`}
    >
      <span className="relative">
        {ausente ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400">
            <Icon name="clock" className="h-4 w-4" />
          </span>
        ) : (
          <NiceAvatar style={{ width: '2.25rem', height: '2.25rem' }} shape="circle" {...configAvatar(aspecto, c.animo)} bgColor="#e6dcf7" />
        )}
        <span aria-hidden className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${pres.info.punto}`} />
      </span>
      <span className="min-w-0">
        <span className="block max-w-24 truncate text-xs font-semibold text-slate-900">{nombreCorto(c.correo)}</span>
        <span className={`block text-[11px] ${c.vencidos ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>
          {c.abiertos} open{ausente ? ' · away' : ''}
        </span>
      </span>
    </button>
  )
}

const KEY = 'universa:equipo-abierto'
// La oficina empieza cerrada: solo se despliega cuando alguien pulsa «View office» (y se recuerda esa elección en el navegador).
const leerAbierto = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

// La oficina del equipo: cada persona en un rincón distinto (escritorio, sala de reuniones, pizarra…) con su carga de tickets al lado.
// Clic en un rincón = filtra el tablero por esa persona.
export default function EquipoCarga({ tickets, personal, miId, elegido, onElegir }) {
  const [abierta, setAbierta] = useState(leerAbierto)
  const [eligiendo, setEligiendo] = useState(false)
  const [estado, setEstado] = useState(false)
  // Si aún no están aplicadas las migraciones de personajes y estados, la oficina sigue funcionando con valores automáticos.
  const { datos: avatares, recargar: recargarAvatares } = useCarga(avataresTickets, null)
  // Los estados de los demás se actualizan solos (cada medio minuto y al volver a la pestaña).
  useEffect(() => {
    const t = setInterval(recargarAvatares, 30000)
    const alVolver = () => document.visibilityState === 'visible' && recargarAvatares()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [recargarAvatares])
  const hoy = hoyLima()
  const filas = useMemo(() => Object.fromEntries((avatares ?? []).map((a) => [a.user_id, a])), [avatares])
  const aspectoDe = (c) => (filas[c.id]?.config && Object.keys(filas[c.id].config).length ? sanear(filas[c.id].config) : aspectoAutomatico(c.correo))
  const presDe = (c) => presenciaDe(filas[c.id], hoy)
  const alternar = () =>
    setAbierta((o) => {
      try {
        localStorage.setItem(KEY, o ? '0' : '1')
      } catch {
        /* solo dura esta sesión */
      }
      return !o
    })
  const carga = useMemo(() => cargaPorPersona(tickets, personal.filter((p) => p.activo)), [tickets, personal])
  // Primero tú, luego quien más carga tiene.
  const orden = useMemo(() => carga.slice().sort((a, b) => (b.id === miId) - (a.id === miId) || b.abiertos - a.abiertos), [carga, miId])
  // Cada quien en el rincón que eligió; el resto, en los que nadie eligió.
  const rinconDe = useMemo(() => repartirRincones(orden.map((c) => c.id), Object.fromEntries(orden.map((c) => [c.id, presenciaDe(filas[c.id], hoy).rincon]))), [orden, filas, hoy])
  const total = carga.reduce((s, c) => s + c.abiertos, 0)
  const yo = carga.find((c) => c.id === miId)
  const fuera = orden.filter((c) => presDe(c).info.ausente).length
  if (carga.length === 0) return null
  return (
    <section aria-label="Team office" className="mb-4 overflow-hidden rounded-2xl ring-1 ring-slate-200">
      {/* Pared: título, ventanas y controles */}
      <div className="relative flex flex-wrap items-center justify-between gap-2 border-b-4 border-brand-200 bg-gradient-to-b from-brand-100 to-brand-50 px-4 py-3">
        <div className="pointer-events-none absolute inset-y-0 left-1/3 hidden items-center gap-3 md:flex" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-9 w-14 rounded-md bg-sky-100/80 ring-4 ring-white/80" />
          ))}
        </div>
        <h2 className="relative text-[13px] font-semibold text-brand-800">
          Team office <span className="font-medium text-brand-700/70">· {total} open{fuera > 0 ? ` · ${fuera} away` : ''}</span>
        </h2>
        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1">
          {yo && (
            <button type="button" onClick={() => setEstado(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline">
              <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${presDe(yo).info.punto}`} /> My status
            </button>
          )}
          {yo && abierta && (
            <button type="button" onClick={() => setEligiendo(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
              <Icon name="pencil" className="h-3.5 w-3.5" /> Choose my character
            </button>
          )}
          <button type="button" onClick={alternar} aria-expanded={abierta} className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700">
            <Icon name={abierta ? 'up' : 'down'} className="h-3.5 w-3.5" /> {abierta ? 'Hide office' : 'View office'}
          </button>
        </div>
      </div>
      {!abierta ? (
        <div className="flex flex-wrap gap-2 bg-white px-3 py-2.5">
          {orden.map((c) => (
            <MiniAvatar key={c.id} c={c} aspecto={aspectoDe(c)} pres={presDe(c)} activo={elegido === c.id} onElegir={() => onElegir(elegido === c.id ? '' : c.id)} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-2 gap-y-3 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" style={{ backgroundColor: '#fbf5ee', backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 79px, rgba(168,90,20,.07) 79px 80px)' }}>
          {orden.map((c) => (
            <Rincon key={c.id} c={c} rincon={RINCONES.find((r) => r.id === rinconDe[c.id]) ?? RINCONES[0]} aspecto={aspectoDe(c)} pres={presDe(c)} mio={c.id === miId} activo={elegido === c.id} onElegir={() => onElegir(elegido === c.id ? '' : c.id)} />
          ))}
        </div>
      )}
      {eligiendo && yo && <ElegirPersonaje actual={aspectoDe(yo)} onCerrar={() => setEligiendo(false)} onGuardado={recargarAvatares} />}
      {estado && yo && <MiEstado actual={{ ...presDe(yo), rincon: rinconDe[yo.id] }} rincones={{ ocupados: orden.filter((c) => c.id !== miId).map((c) => presDe(c).rincon).filter(Boolean) }} onCerrar={() => setEstado(false)} onGuardado={recargarAvatares} />}
    </section>
  )
}
