import { useMemo, useState } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { inputClass } from '../components/ui/Field'
import Icon from '../components/ui/Icon'
import EstadoBadge from '../components/salones/EstadoBadge'
import { SIN_NIVEL, estados, formatFecha } from '../lib/salones'
import { VENTANAS, analizarSalon, calcularIndicadores, filtrarFilas, ordenarPorFin, textoDias } from '../lib/dashboardComercial'

// Vista inicial recomendada; "Restablecer" en cambio limpia todos los criterios.
const filtrosIniciales = { ventana: '30', nivelId: '', estado: 'en_curso', revisar: false }
const sinFiltros = { ventana: 'todos', nivelId: '', estado: '', revisar: false }

const cortoVentana = { vencidos: 'Vencidos', 7: 'Esta semana', 15: '15 días', 30: 'Este mes', todos: 'Todos' }
const largoVentana = { vencidos: 'Ya vencidos', 7: 'Terminan esta semana', 15: 'Terminan en 15 días', 30: 'Terminan este mes' }

// Colores del semáforo: rojo = ya pasó, durazno = urgente, morado = pronto, gris = sin prisa.
const TONOS = {
  rose: { icono: 'bg-rose-100 text-rose-600', chip: 'bg-rose-50 text-rose-700 ring-rose-200', barra: 'bg-rose-500', borde: 'border-l-rose-500' },
  peach: { icono: 'bg-peach-100 text-peach-700', chip: 'bg-peach-50 text-peach-700 ring-peach-200', barra: 'bg-peach-500', borde: 'border-l-peach-500' },
  brand: { icono: 'bg-brand-100 text-brand-600', chip: 'bg-brand-50 text-brand-700 ring-brand-200', barra: 'bg-brand-500', borde: 'border-l-brand-500' },
  slate: { icono: 'bg-slate-100 text-slate-500', chip: 'bg-slate-50 text-slate-600 ring-slate-200', barra: 'bg-slate-300', borde: 'border-l-slate-300' },
}

// Tarjeta-resumen: icono + número grande + una frase que dice qué hacer. Al tocarla filtra la lista de abajo.
function Indicador({ icono, tono = 'brand', label, valor, nota, activo, onClick, className = '' }) {
  const t = TONOS[tono]
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={`group flex flex-col gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        activo ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-brand-100'
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.icono}`}>
          <Icon name={icono} className="h-5 w-5" />
        </span>
        <span className="text-3xl font-bold tracking-tight text-slate-900">{valor}</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-0.5 min-h-8 text-xs leading-snug text-slate-500">{nota}</p>
      </div>
    </button>
  )
}

// Aviso principal: lo más importante que el equipo comercial debe hacer hoy.
function Prioridad({ ind, cargando, onVer }) {
  if (cargando) return null
  const caso =
    ind.vencidos > 0
      ? { tono: 'rose', icono: 'alert', texto: `${ind.vencidos} ${ind.vencidos === 1 ? 'salón ya debió' : 'salones ya debieron'} terminar`, detalle: 'Confirma con el área académica si siguen activos o hay que cerrarlos.', p: { ventana: 'vencidos', estado: 'en_curso' } }
      : ind.en7 > 0
        ? { tono: 'peach', icono: 'flag', texto: `${ind.en7} ${ind.en7 === 1 ? 'salón termina' : 'salones terminan'} esta semana`, detalle: 'Es el momento de contactar a sus estudiantes y proponer el siguiente nivel.', p: { ventana: '7', estado: 'en_curso' } }
        : ind.en30 > 0
          ? { tono: 'brand', icono: 'calendar', texto: `${ind.en30} ${ind.en30 === 1 ? 'salón termina' : 'salones terminan'} este mes`, detalle: 'Ve preparando la próxima apertura con tiempo.', p: { ventana: '30', estado: 'en_curso' } }
          : { tono: 'slate', icono: 'check', texto: 'Todo tranquilo por ahora', detalle: 'Ningún salón en curso termina en los próximos 30 días.', p: null }
  const t = TONOS[caso.tono]
  return (
    <div className={`mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-l-4 bg-white p-4 shadow-sm ${t.borde} border-brand-100`}>
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${t.icono}`}>
        <Icon name={caso.icono} className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Lo más importante hoy</p>
        <p className="text-lg font-semibold text-slate-900">{caso.texto}</p>
        <p className="text-sm text-slate-500">{caso.detalle}</p>
      </div>
      {caso.p && <Button onClick={() => onVer(caso.p)}>Ver salones</Button>}
    </div>
  )
}

// Barra apilada: cómo se reparten los salones en curso según qué tan cerca está su fin.
function Urgencia({ filas }) {
  const grupos = useMemo(() => {
    const g = { vencidos: 0, semana: 0, mes: 0, despues: 0, sinFecha: 0 }
    for (const { salon, a } of filas) {
      if (salon.estado !== 'en_curso') continue
      if (a.vencido) g.vencidos++
      else if (a.en7) g.semana++
      else if (a.en8a30) g.mes++
      else if (a.dias === null) g.sinFecha++
      else g.despues++
    }
    return g
  }, [filas])
  const total = Object.values(grupos).reduce((n, x) => n + x, 0)
  if (total === 0) return null
  const partes = [
    { k: 'vencidos', label: 'Ya vencidos', tono: 'rose' },
    { k: 'semana', label: 'Esta semana', tono: 'peach' },
    { k: 'mes', label: 'Este mes', tono: 'brand' },
    { k: 'despues', label: 'Más adelante', tono: 'slate' },
    { k: 'sinFecha', label: 'Sin fecha', tono: 'slate' },
  ].filter((p) => grupos[p.k] > 0)
  return (
    <Card className="mt-4 p-4">
      <p className="mb-3 text-sm font-semibold text-slate-900">
        ¿Cuándo terminan tus {total} {total === 1 ? 'salón' : 'salones'} en curso?
      </p>
      <div role="img" aria-label="Reparto de salones en curso según su fecha de fin" className="flex h-4 overflow-hidden rounded-full bg-slate-100">
        {partes.map((p) => (
          <div key={p.k} className={p.k === 'sinFecha' ? 'bg-slate-200' : TONOS[p.tono].barra} style={{ width: `${(grupos[p.k] / total) * 100}%` }} title={`${p.label}: ${grupos[p.k]}`} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
        {partes.map((p) => (
          <li key={p.k} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${p.k === 'sinFecha' ? 'bg-slate-200' : TONOS[p.tono].barra}`} />
            {p.label}: <strong className="text-slate-900">{grupos[p.k]}</strong>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// Control segmentado para la ventana de finalización.
function Segmentado({ opciones, valor, onChange }) {
  return (
    <div role="group" aria-label="¿Cuándo terminan?" className="grid grid-cols-5 gap-0.5 rounded-xl bg-slate-100 p-0.5 lg:inline-grid">
      {opciones.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={valor === o.value}
          className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-sm transition-colors sm:px-3 ${
            valor === o.value ? 'bg-white font-semibold text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {cortoVentana[o.value]}
        </button>
      ))}
    </div>
  )
}

function FiltroActivo({ children, onQuitar }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-brand-700">
      {children}
      <button onClick={onQuitar} aria-label={`Quitar filtro: ${children}`} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-brand-100">
        ×
      </button>
    </span>
  )
}

// Etiquetas con icono y lenguaje claro; el `title` explica el motivo al pasar el cursor.
function Etiqueta({ tono, icono, children, ayuda }) {
  return (
    <span title={ayuda} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONOS[tono].chip}`}>
      <Icon name={icono} className="h-3 w-3" /> {children}
    </span>
  )
}

function Etiquetas({ a }) {
  const items = []
  if (a.provisional) items.push(<Etiqueta key="p" tono="peach" icono="clock" ayuda="Aún faltan clases por programar, por eso la fecha de fin es una estimación.">Fecha estimada</Etiqueta>)
  if (a.porValidar) items.push(<Etiqueta key="v" tono="peach" icono="eye" ayuda="Hay clases que ya pasaron y nadie ha marcado como realizadas o canceladas.">Clases sin confirmar</Etiqueta>)
  if (a.sinCalendario) items.push(<Etiqueta key="c" tono="slate" icono="calendar" ayuda="Este salón aún no tiene clases programadas en el calendario.">Sin calendario</Etiqueta>)
  if (items.length === 0) return null
  return <div className="mt-2 flex flex-wrap gap-1.5">{items}</div>
}

// Cuánto falta, con el color del semáforo.
function Plazo({ salon: s, a }) {
  let tono = 'slate'
  let icono = 'clock'
  if (s.estado === 'finalizado') return <span className="text-xs text-slate-400">Finalizado</span>
  if (a.vencido) [tono, icono] = ['rose', 'alert']
  else if (a.en7) [tono, icono] = ['peach', 'flag']
  else if (a.en30) [tono, icono] = ['brand', 'calendar']
  return (
    <div className="text-right">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${TONOS[tono].chip}`}>
        <Icon name={icono} className="h-4 w-4" /> {a.dias === null ? 'Sin fecha' : a.vencido ? textoDias(a, s.estado) : a.dias === 0 ? 'Termina hoy' : `Faltan ${textoDias(a, s.estado)}`}
      </span>
      <p className="mt-1 text-xs text-slate-500">
        {a.fin ? `Fin: ${formatFecha(a.fin)}` : 'Define una fecha de fin'}
        {a.origen === 'calendario' && a.provisional ? ' (estimada)' : ''}
      </p>
    </div>
  )
}

function FilaSalon({ s, a, onVer }) {
  const p = s.progreso
  const pct = a.tieneCalendario && p.sesiones ? Math.round((p.realizadas / p.sesiones) * 100) : null
  const tono = s.estado === 'finalizado' ? 'slate' : a.vencido ? 'rose' : a.en7 ? 'peach' : a.en30 ? 'brand' : 'slate'
  return (
    <li className={`grid gap-4 border-l-4 px-4 py-4 hover:bg-brand-50/40 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center ${TONOS[tono].borde}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-900">{s.codigo}</p>
          {s.estado !== 'en_curso' && <EstadoBadge estado={s.estado} />}
        </div>
        <p className="truncate text-sm text-slate-600">{s.nombre}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Icon name="box" className="h-3.5 w-3.5" /> {s.nivel || <span className="text-peach-700">Sin nivel</span>}
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="teacher" className="h-3.5 w-3.5" /> {s.docente || <span className="text-slate-400">Sin docente</span>}
          </span>
        </p>
        <Etiquetas a={a} />
      </div>

      <div className="min-w-0">
        {pct !== null ? (
          <>
            <p className="mb-1 flex justify-between text-xs text-slate-600">
              <span>{p.realizadas} de {p.sesiones} clases dadas</span>
              <strong className="text-slate-900">{pct}%</strong>
            </p>
            <div role="progressbar" aria-label={`Avance de ${s.codigo}`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2.5 overflow-hidden rounded-full bg-brand-50">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-peach-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-400">Quedan {p.restantes} clases</p>
          </>
        ) : (
          <p className="text-xs text-slate-400">Sin clases en el calendario todavía</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 md:justify-end">
        <Plazo salon={s} a={a} />
        <Button variant="secondary" className="px-4 py-1.5" onClick={() => onVer(s.id)}>
          Ver
        </Button>
      </div>
    </li>
  )
}

export default function Dashboard({ data, onVerSalon }) {
  const { salones, niveles, cargando, error, recargar } = data
  const [f, setF] = useState(filtrosIniciales)
  const [verFiltros, setVerFiltros] = useState(false)
  const set = (cambios) => setF((actual) => ({ ...actual, ...cambios }))

  // Cambios que mantienen coherentes los criterios (evitan combinaciones que siempre dan vacío):
  // "Vencidos" solo existe para salones en curso y "por revisar" nunca incluye finalizados.
  const cambiarVentana = (ventana) => set(ventana === 'vencidos' ? { ventana, estado: 'en_curso' } : { ventana })
  const cambiarEstado = (estado) =>
    setF((a) => ({
      ...a,
      estado,
      ventana: a.ventana === 'vencidos' && estado !== 'en_curso' && estado !== '' ? 'todos' : a.ventana,
      revisar: a.revisar && estado !== 'finalizado',
    }))
  const cambiarRevisar = (revisar) => setF((a) => ({ ...a, revisar, estado: revisar && a.estado === 'finalizado' ? '' : a.estado }))

  const filas = useMemo(() => salones.map((salon) => ({ salon, a: analizarSalon(salon) })), [salones])
  const ind = useMemo(() => calcularIndicadores(filas), [filas])
  const visibles = useMemo(() => ordenarPorFin(filtrarFilas(filas, f)), [filas, f])

  const v = (n) => (cargando || error ? '…' : n)
  // Una tarjeta está activa solo si los filtros coinciden exactamente con su atajo.
  const es = (p) => f.ventana === p.ventana && f.estado === p.estado && f.revisar === p.revisar && !f.nivelId
  const aplicar = (p) => () => setF({ ...sinFiltros, ...p })

  const nivelNombre = f.nivelId === SIN_NIVEL ? 'Sin nivel asignado' : niveles.find((n) => n.id === f.nivelId)?.nombre
  const estadoNombre = estados.find((e) => e.value === f.estado)?.label
  const hayFiltros = f.ventana !== 'todos' || f.nivelId || f.estado || f.revisar

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-brand-700">Dashboard comercial</h1>
        <p className="mt-1 text-sm text-slate-500">Mira qué salones están por terminar para ofrecer a tiempo el siguiente nivel.</p>
      </div>

      <Prioridad ind={ind} cargando={cargando || Boolean(error)} onVer={(p) => setF({ ...sinFiltros, ...p })} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Indicador
          icono="building"
          tono="brand"
          label="Salones activos"
          valor={v(ind.enCurso)}
          nota={ind.vencidos > 0 && !cargando ? `${ind.vencidos} ya debieron terminar` : 'Clases dándose ahora'}
          activo={es({ ventana: 'todos', estado: 'en_curso', revisar: false })}
          onClick={aplicar({ estado: 'en_curso' })}
        />
        <Indicador
          icono="flag"
          tono="peach"
          label="Terminan esta semana"
          valor={v(ind.en7)}
          nota={ind.en7 > 0 ? 'Contacta a sus estudiantes ya' : 'Ninguno por ahora'}
          activo={es({ ventana: '7', estado: 'en_curso', revisar: false })}
          onClick={aplicar({ ventana: '7', estado: 'en_curso' })}
        />
        <Indicador
          icono="calendar"
          tono="brand"
          label="Terminan este mes"
          valor={v(ind.en30)}
          nota="Próximos 30 días (incluye los de esta semana)"
          activo={es({ ventana: '30', estado: 'en_curso', revisar: false })}
          onClick={aplicar({ ventana: '30', estado: 'en_curso' })}
        />
        <Indicador
          icono="clock"
          tono="slate"
          label="Por empezar"
          valor={v(ind.pendientes)}
          nota="Aún no inician clases"
          activo={es({ ventana: 'todos', estado: 'pendiente', revisar: false })}
          onClick={aplicar({ estado: 'pendiente' })}
        />
        <Indicador
          icono="info"
          tono={ind.revisar > 0 ? 'peach' : 'slate'}
          label="Datos por revisar"
          valor={v(ind.revisar)}
          nota="Falta calendario o confirmar clases"
          activo={es({ ventana: 'todos', estado: '', revisar: true })}
          onClick={aplicar({ revisar: true })}
          className="col-span-2 lg:col-span-1"
        />
      </div>
      <p className="mt-2 text-xs text-slate-400">Toca una tarjeta para ver esos salones en la lista.</p>

      {!cargando && !error && <Urgencia filas={filas} />}

      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 p-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Lista de salones</h2>
            <p className="text-xs text-slate-500">Ordenados por quién termina primero</p>
          </div>
          <Segmentado opciones={VENTANAS} valor={f.ventana} onChange={cambiarVentana} />
          <button
            type="button"
            onClick={() => setVerFiltros((x) => !x)}
            aria-expanded={verFiltros}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            <Icon name="filter" className="h-4 w-4" /> Más filtros
          </button>
        </div>

        {verFiltros && (
          <div className="grid gap-3 border-b border-brand-100 bg-brand-50/40 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
            <select value={f.nivelId} onChange={(e) => set({ nivelId: e.target.value })} className={inputClass} aria-label="Filtrar por nivel académico">
              <option value="">Todos los niveles</option>
              {niveles.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nombre}
                </option>
              ))}
              <option value={SIN_NIVEL}>Sin nivel asignado</option>
            </select>
            <select value={f.estado} onChange={(e) => cambiarEstado(e.target.value)} className={inputClass} aria-label="Filtrar por estado">
              <option value="">Todos los estados</option>
              {estados.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={f.revisar} onChange={(e) => cambiarRevisar(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
              Solo datos por revisar
            </label>
          </div>
        )}

        <div className="flex min-h-10 flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
          {hayFiltros ? (
            <>
              <span>Mostrando:</span>
              {f.ventana !== 'todos' && <FiltroActivo onQuitar={() => set({ ventana: 'todos' })}>{largoVentana[f.ventana]}</FiltroActivo>}
              {f.nivelId && <FiltroActivo onQuitar={() => set({ nivelId: '' })}>{nivelNombre}</FiltroActivo>}
              {f.estado && <FiltroActivo onQuitar={() => set({ estado: '' })}>{estadoNombre}</FiltroActivo>}
              {f.revisar && <FiltroActivo onQuitar={() => set({ revisar: false })}>Datos por revisar</FiltroActivo>}
              <button onClick={() => setF(sinFiltros)} className="ml-1 font-medium text-brand-700 hover:underline">
                Ver todos
              </button>
            </>
          ) : (
            <span>Mostrando todos los salones.</span>
          )}
        </div>

        {cargando ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">Cargando salones…</p>
        ) : error ? (
          <div className="px-4 py-12 text-center text-sm">
            <p className="text-red-600">No se pudieron cargar los salones: {error}</p>
            <Button variant="secondary" className="mt-3" onClick={recargar}>
              Reintentar
            </Button>
          </div>
        ) : salones.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="font-medium text-slate-900">Aún no hay salones registrados</p>
            <p className="mt-1 text-sm text-slate-500">Cuando el área académica cree salones, aparecerán aquí.</p>
          </div>
        ) : visibles.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <Icon name="check" className="h-6 w-6" />
            </span>
            <p className="mt-3 font-medium text-slate-900">Ningún salón coincide con lo que elegiste</p>
            <p className="mt-1 text-sm text-slate-500">Prueba con un plazo más amplio o quita algún filtro.</p>
            <Button variant="secondary" className="mt-3" onClick={() => setF(sinFiltros)}>
              Ver todos los salones
            </Button>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {visibles.map(({ salon, a }) => (
                <FilaSalon key={salon.id} s={salon} a={a} onVer={onVerSalon} />
              ))}
            </ul>
            <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
              {visibles.length} {visibles.length === 1 ? 'salón' : 'salones'} · «Fecha estimada» significa que aún faltan clases por programar
            </p>
          </>
        )}
      </Card>
    </>
  )
}
