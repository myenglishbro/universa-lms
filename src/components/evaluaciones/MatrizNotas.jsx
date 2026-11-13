import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Icon from '../ui/Icon'
import useCarga from '../../hooks/useCarga'
import { ESTADOS_CELDA, agruparPorCiclo, fmtNota, notaSobreEvaluado, textoCelda } from '../../lib/evaluaciones'
import { descargarInforme } from '../../lib/informeNotas'
import InformeDialogo from './InformeDialogo'
import * as servicioReal from '../../services/evaluaciones'
import CeldaNota from './CeldaNota'
import { NivelMcerContext } from './CriteriosRubrica'
import FormativeModal from './FormativeModal'
import ParticipacionModal from './ParticipacionModal'

// Anchos de las columnas fijas (px): solo Componente y Peso quedan pegadas a la izquierda al desplazar.
const W = { comp: 208, peso: 56 }
const ALTO_CAB = 76
const fija = (k, bg, extra = '') => ({
  style: { left: k === 'peso' ? W.comp : 0, width: W[k], minWidth: W[k] },
  className: `sticky z-10 border-b border-slate-100 ${bg} px-3 py-2 text-left align-middle text-sm ${extra}`,
})

// Aspecto de cada estado de una celda: punto de color + fondo suave. Se entiende de un vistazo sin leer la leyenda.
const UI_ESTADO = {
  publicada: { caja: 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100', punto: 'bg-emerald-500' },
  borrador: { caja: 'bg-amber-50 text-amber-900 hover:bg-amber-100', punto: 'bg-amber-400' },
  listo: { caja: 'bg-amber-50 text-amber-900 hover:bg-amber-100', punto: 'bg-amber-400' },
  parcial: { caja: 'bg-sky-50 text-sky-900 hover:bg-sky-100', punto: 'bg-sky-400' },
  en_curso: { caja: 'bg-sky-50 text-sky-900 hover:bg-sky-100', punto: 'bg-sky-400' },
  sin_nota: { caja: 'border border-dashed border-slate-200 bg-white text-slate-300 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600', punto: '' },
  sin_clases: { caja: 'bg-slate-50 text-slate-300 hover:bg-slate-100', punto: '' },
}
const uiEstado = (celda) => UI_ESTADO[celda?.estado ?? 'sin_nota'] ?? UI_ESTADO.sin_nota
const pendiente = (celda) => celda?.estado !== 'publicada'

const iniciales = (nombre = '') =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
const nombreCorto = (nombre = '') => {
  const p = nombre.split(/\s+/).filter(Boolean)
  return p.length > 2 ? `${p[0]} ${p[p.length > 3 ? 2 : 1]}` : nombre
}
const pesoTxt = (n) => (Number(n) > 0 ? fmtNota(n) : '')

// Una celda: nota grande, detalle pequeño (avance o aporte) y punto de estado. Clic para abrir la ficha.
function BotonCelda({ celda, evaluacion, alumno, onAbrir }) {
  const est = ESTADOS_CELDA[celda?.estado ?? 'sin_nota']
  const ui = uiEstado(celda)
  const vacia = !celda || celda.estado === 'sin_nota' || celda.estado === 'sin_clases'
  const detalle =
    celda?.tipo === 'formative'
      ? celda.provisional
        ? `${celda.unidades_registradas}/${celda.unidades_total} unid.${celda.participacion?.aplica ? ` · ${celda.participacion.cumplidas}/${celda.participacion.registradas} cl.` : ''}`
        : ''
      : celda?.tipo === 'participacion' && celda.total > 0 && celda.registradas > 0 && celda.puntaje != null
        ? `${celda.cumplidas}/${celda.total} classes`
        : celda?.tipo !== 'participacion' && celda?.unidades_total > 1 && celda.puntaje != null
          ? `${celda.unidades_registradas}/${celda.unidades_total} units`
          : ''
  const aporte = celda?.aporte != null ? `aporta ${fmtNota(celda.aporte)}` : ''
  return (
    <button
      type="button"
      onClick={() => onAbrir(evaluacion, alumno)}
      aria-label={`${evaluacion.nombre} for ${alumno.nombre}`}
      title={`${est.texto} — click to ${vacia ? 'grade' : 'open'}`}
      className={`group relative flex min-h-12 w-full flex-col items-center justify-center rounded-lg px-2 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${ui.caja}`}
    >
      {ui.punto && <span aria-hidden className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${ui.punto}`} />}
      {vacia ? (
        <>
          <span className="text-base leading-tight group-hover:hidden">—</span>
          <Icon name="plus" className="hidden h-4 w-4 group-hover:block" />
        </>
      ) : (
        <>
          <span className="text-base font-semibold leading-tight">{textoCelda(celda)}</span>
          {(detalle || aporte) && <span className="text-[10px] font-normal leading-tight opacity-70">{[detalle, aporte].filter(Boolean).join(' · ')}</span>}
        </>
      )}
    </button>
  )
}

const Marca = ({ children, tono }) => (
  <span className={`ml-1 rounded px-1 text-[10px] font-medium ${tono === 'rose' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{children}</span>
)

// Subtotal de un módulo (solo notas publicadas): puntos acumulados arriba, nota sobre lo evaluado abajo.
function SubtotalModulo({ r }) {
  if (!r || r.sin_plantilla || !(r.peso_evaluado > 0)) return <span className="text-slate-300">—</span>
  return (
    <span title={r.remedial ? `Remedial (original: ${fmtNota(r.puntos_original)} points)` : undefined}>
      <span className="font-semibold">
        {fmtNota(r.puntos)} / {fmtNota(r.peso_total)}
      </span>
      <span className="block text-[10px] font-normal text-slate-500">
        grade {fmtNota(r.nota)}
        {r.remedial && <Marca tono="rose">Remedial</Marca>}
        {r.parcial && <Marca>parcial</Marca>}
      </span>
    </span>
  )
}

function SubtotalAgregado({ r }) {
  if (!r || !(Number(r.escala_evaluada) > 0)) return <span className="text-slate-300">—</span>
  return (
    <span>
      <span className="font-semibold">
        {fmtNota(r.puntos)} / {fmtNota(r.escala)}
      </span>
      <span className="block text-[10px] font-normal opacity-70">
        grade {fmtNota(notaSobreEvaluado(r))}
        {r.remedial && <Marca tono="rose">Remedial</Marca>}
        {r.parcial && <Marca>parcial</Marca>}
      </span>
    </span>
  )
}

function Leyenda() {
  const items = [
    ['bg-emerald-500', 'Published'],
    ['bg-amber-400', 'Draft / ready to publish'],
    ['bg-sky-400', 'In progress (incomplete)'],
  ]
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
      {items.map(([c, t]) => (
        <span key={t} className="inline-flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${c}`} /> {t}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded border border-dashed border-slate-300" /> Not recorded
      </span>
      <span>Subtotals count published grades only.</span>
    </p>
  )
}

// Fila que ocupa todo el ancho (Ciclo, Módulo). El texto queda pegado a la izquierda aunque se desplace.
function Seccion({ columnas, className, children }) {
  return (
    <tr>
      <td colSpan={columnas} className={`border-b border-slate-100 p-0 ${className}`}>
        <div className="sticky left-0 w-max px-3 py-2">{children}</div>
      </td>
    </tr>
  )
}

function Tabla({ datos, alumnos, soloPendientes, onAbrir, onInforme }) {
  const { modulos, salon, consolidacion } = datos
  const grupos = useMemo(() => agruparPorCiclo(modulos), [modulos])
  const resumen = (a, id) => a.resumen.modulos.find((x) => x.modulo_id === id)
  const resumenCiclo = (a, ciclo) => a.resumen.ciclos.find((c) => (c.ciclo ?? null) === ciclo)
  const columnas = 2 + alumnos.length
  const verEval = (ev) => !soloPendientes || alumnos.some((a) => pendiente(a.celdas[ev.id]))
  const cabComp = fija('comp', 'bg-white')
  const cabPeso = fija('peso', 'bg-white')

  return (
    <div className="max-h-[75vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-max min-w-full border-separate border-spacing-0 text-sm" aria-label="Grade matrix">
        <thead>
          <tr style={{ height: ALTO_CAB }}>
            <th style={{ ...cabComp.style, top: 0, zIndex: 30 }} className={`${cabComp.className} border-slate-200 font-semibold text-slate-700`}>
              Componente
              <span className="block text-[11px] font-normal text-slate-400">{salon.nivel ?? 'No level'}</span>
            </th>
            <th style={{ ...cabPeso.style, top: 0, zIndex: 30 }} className={`${cabPeso.className} border-slate-200 text-right text-xs font-semibold text-slate-500`}>
              Weight
            </th>
            {alumnos.map((a) => (
              <th key={a.alumno_id} className="sticky top-0 z-20 min-w-32 border-b border-slate-200 bg-white px-2 py-2 text-center font-normal">
                <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{iniciales(a.nombre)}</span>
                <span className="mt-1 block max-w-32 truncate text-xs font-semibold text-slate-800" title={a.nombre}>
                  {nombreCorto(a.nombre)}
                </span>
                <button type="button" aria-label={`Report for ${a.nombre}`} onClick={() => onInforme(a)} className="text-[10px] text-brand-700 hover:underline">
                  PDF report
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => (
            <Fragment key={g.ciclo ?? 'sin'}>
              <Seccion columnas={columnas} className="bg-brand-600 text-white">
                <span className="text-xs font-semibold uppercase tracking-wider">{g.ciclo != null ? `Cycle ${g.ciclo}` : 'No cycle'}</span>
              </Seccion>
              {g.modulos.map((m) => {
                const evals = m.evaluaciones.filter(verEval)
                if (soloPendientes && evals.length === 0) return null
                return (
                  <Fragment key={m.id}>
                    <Seccion columnas={columnas} className="bg-slate-50">
                      <span className="text-sm font-semibold text-slate-800">{m.nombre}</span>
                      {m.plantilla && <span className="ml-2 text-xs font-normal text-slate-400">{m.plantilla}</span>}
                      {!m.version_id && <span className="ml-2 text-xs font-normal text-amber-600">No template assigned</span>}
                    </Seccion>
                    {evals.map((ev) => (
                      <tr key={ev.id}>
                        <td {...fija('comp', 'bg-white', 'text-slate-800')}>
                          {ev.nombre}
                          {ev.tipo === 'participacion' && <span className="block text-[10px] text-slate-400">participation per class</span>}
                          {ev.tipo === 'formative' && <span className="block text-[10px] text-slate-400">3 units{Number(ev.peso_participacion) > 0 ? ` + ${fmtNota(ev.peso_participacion)} % participation` : ''}</span>}
                        </td>
                        <td {...fija('peso', 'bg-white', 'text-right text-xs text-slate-500')}>{fmtNota(ev.peso)}</td>
                        {alumnos.map((a) => (
                          <td key={a.alumno_id} className="border-b border-slate-100 p-1">
                            <BotonCelda celda={a.celdas[ev.id]} evaluacion={{ ...ev, modulo: m.nombre }} alumno={a} onAbrir={onAbrir} />
                          </td>
                        ))}
                      </tr>
                    ))}
                    {m.version_id && (
                      <tr>
                        <td {...fija('comp', 'bg-slate-50', 'text-xs font-semibold text-slate-600')}>Module subtotal</td>
                        <td {...fija('peso', 'bg-slate-50', 'text-right text-xs text-slate-500')}>{m.escala != null ? fmtNota(m.escala) : ''}</td>
                        {alumnos.map((a) => (
                          <td key={a.alumno_id} className="border-b border-slate-100 bg-slate-50 px-2 py-1.5 text-center text-sm">
                            <SubtotalModulo r={resumen(a, m.id)} />
                          </td>
                        ))}
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              <tr>
                <td {...fija('comp', 'bg-brand-50', 'text-xs font-semibold text-brand-800')}>Subtotal {g.ciclo != null ? `cycle ${g.ciclo}` : 'no cycle'}</td>
                <td {...fija('peso', 'bg-brand-50', 'text-right text-xs text-brand-700')}>{pesoTxt(g.modulos.reduce((s, m) => s + (m.escala ?? 0), 0))}</td>
                {alumnos.map((a) => (
                  <td key={a.alumno_id} className="border-b border-brand-100 bg-brand-50 px-2 py-1.5 text-center text-sm text-brand-900">
                    <SubtotalAgregado r={resumenCiclo(a, g.ciclo)} />
                  </td>
                ))}
              </tr>
            </Fragment>
          ))}
          <tr>
            <td {...fija('comp', 'bg-slate-100', 'text-xs font-semibold text-slate-800')}>
              Level total
              <span className="block text-[10px] font-normal text-slate-500">published points</span>
            </td>
            <td {...fija('peso', 'bg-slate-100', 'text-right text-xs text-slate-600')}>{pesoTxt(modulos.reduce((s, m) => s + (m.escala ?? 0), 0))}</td>
            {alumnos.map((a) => (
              <td key={a.alumno_id} className="border-b border-slate-200 bg-slate-100 px-2 py-2 text-center text-sm text-slate-900">
                <SubtotalAgregado r={a.resumen.acumulado} />
              </td>
            ))}
          </tr>
          <tr>
            <td {...fija('comp', 'bg-white', 'text-xs font-semibold text-slate-900')}>Final level result</td>
            <td {...fija('peso', 'bg-white')} />
            {alumnos.map((a) => (
              <td key={a.alumno_id} className="border-b border-slate-100 px-2 py-2 text-center text-xs">
                {a.nivel?.definido && consolidacion.confirmada ? (
                  <span className="text-base font-semibold">
                    {fmtNota(a.nivel.nota)} {a.nivel.parcial && <Badge color="peach">Parcial</Badge>}
                  </span>
                ) : (
                  <span className="font-normal text-slate-400" title="Pending a rule confirmed by Coordination">
                    Pending
                  </span>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// Vista por estudiante (celulares y pantallas angostas): sus módulos como tarjetas, sin comprimir la matriz.
function VistaAlumno({ datos, onAbrir, onInforme }) {
  const { alumnos, modulos, consolidacion } = datos
  const [sel, setSel] = useState(alumnos[0]?.alumno_id ?? '')
  const a = alumnos.find((x) => x.alumno_id === sel) ?? alumnos[0]
  if (!a) return null
  const grupos = agruparPorCiclo(modulos)
  return (
    <div className="space-y-4">
      <select aria-label="Student" value={a.alumno_id} onChange={(e) => setSel(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
        {alumnos.map((x) => (
          <option key={x.alumno_id} value={x.alumno_id}>
            {x.nombre}
          </option>
        ))}
      </select>
      <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => onInforme(a)}>
        Download report for {a.nombre} (PDF)
      </Button>
      {grupos.map((g) => (
        <section key={g.ciclo ?? 'sin'} className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">{g.ciclo != null ? `Cycle ${g.ciclo}` : 'Modules without a cycle'}</h3>
          {g.modulos.map((m) => {
            const r = a.resumen.modulos.find((x) => x.modulo_id === m.id)
            return (
              <Card key={m.id} className="p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">{m.nombre}</h4>
                  <p className="text-xs text-slate-600">
                    {r && !r.sin_plantilla && r.peso_evaluado > 0 ? (
                      <>
                        {fmtNota(r.puntos)} / {fmtNota(r.peso_total)} pts {r.parcial && <Badge color="peach">Partial</Badge>} {r.remedial && <Badge color="rose">Remedial</Badge>}
                      </>
                    ) : (
                      'No published grades'
                    )}
                  </p>
                </div>
                {m.evaluaciones.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">No template assigned.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100">
                    {m.evaluaciones.map((ev) => {
                      const c = a.celdas[ev.id]
                      const est = ESTADOS_CELDA[c?.estado ?? 'sin_nota']
                      return (
                        <li key={ev.id}>
                          <button
                            type="button"
                            onClick={() => onAbrir({ ...ev, modulo: m.nombre }, a)}
                            aria-label={`${ev.nombre} for ${a.nombre}`}
                            className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
                          >
                            <span className="text-sm text-slate-800">
                              {ev.nombre} <span className="text-xs text-slate-400">weight {fmtNota(ev.peso)}</span>
                            </span>
                            <span className={`min-w-16 rounded px-2 py-1 text-center text-sm font-medium ${est.clase}`}>
                              {textoCelda(c)}
                              {c?.aporte != null && <span className="block text-[10px] font-normal opacity-70">aporta {fmtNota(c.aporte)}</span>}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
            )
          })}
          <p className="px-1 text-xs text-slate-600">
            Subtotal {g.ciclo != null ? `cycle ${g.ciclo}` : ''}: <strong>{(() => { const c = a.resumen.ciclos.find((x) => (x.ciclo ?? null) === g.ciclo); return c && c.escala_evaluada > 0 ? `${fmtNota(c.puntos)} / ${fmtNota(c.escala)} pts` : '—' })()}</strong>
          </p>
        </section>
      ))}
      <Card className="p-4 text-sm">
        <p>
          Level total (published points): <strong>{a.resumen.acumulado.escala_evaluada > 0 ? `${fmtNota(a.resumen.acumulado.puntos)} / ${fmtNota(a.resumen.acumulado.escala)}` : '—'}</strong>
        </p>
        <p className="mt-1">
          Final result: {a.nivel?.definido && consolidacion.confirmada ? <strong>{fmtNota(a.nivel.nota)}</strong> : <span className="text-slate-400">pending a rule confirmed by Coordination</span>}
        </p>
      </Card>
    </div>
  )
}

// Matriz de calificaciones del salón: estudiantes en columnas, componentes por módulo y ciclo en filas. Hacer clic en una celda abre su ficha.
export default function MatrizNotas({ salonId, servicio = servicioReal, vistaInicial }) {
  const cargar = useCallback(() => servicio.matrizSalon(salonId), [servicio, salonId])
  const { datos, cargando, error, recargar } = useCarga(cargar, null)
  const [editor, setEditor] = useState(null)
  const [mcer, setMcer] = useState(null)
  const nivelSalon = datos?.salon?.nivel
  useEffect(() => {
    let vivo = true
    servicioReal.mcerDeNivel(nivelSalon).then((m) => vivo && setMcer(m)).catch(() => {})
    return () => { vivo = false }
  }, [nivelSalon])
  const [informeListo, setInformeListo] = useState(null)
  const [fallo, setFallo] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [soloPendientes, setSoloPendientes] = useState(false)
  const ancha = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 1024px)').matches : true
  const [vista, setVista] = useState(vistaInicial ?? (ancha ? 'tabla' : 'alumno'))

  if (error) return <p className="text-sm text-red-600">Could not load the matrix: {error}</p>
  if (cargando || !datos) return <p className="py-6 text-center text-sm text-slate-500">Loading…</p>
  if (datos.modulos.length === 0)
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-slate-500">This classroom has no assessment modules yet. Administration sets them up and assigns a template.</p>
      </Card>
    )
  if (datos.alumnos.length === 0)
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-slate-500">There are no students enrolled in this classroom.</p>
      </Card>
    )

  const q = busqueda.trim().toLowerCase()
  const alumnosVisibles = q ? datos.alumnos.filter((x) => x.nombre.toLowerCase().includes(q)) : datos.alumnos
  const abrir = (evaluacion, alumno) => setEditor({ evaluacion, alumno })
  const informe = async (a) => {
    setFallo('')
    try {
      setInformeListo(await servicio.informeAlumno(salonId, a.alumno_id))
    } catch (e) {
      setFallo(`Could not generate the report: ${e.message}`)
    }
  }
  const Editor = editor?.evaluacion.tipo === 'participacion' ? ParticipacionModal : editor?.evaluacion.tipo === 'formative' ? FormativeModal : CeldaNota
  // La celda se lee de los datos vigentes (no del clic) para que el resumen del Formative se actualice al guardar.
  const celdaEditor = editor ? datos.alumnos.find((x) => x.alumno_id === editor.alumno.alumno_id)?.celdas[editor.evaluacion.id] : undefined

  return (
    <div className="space-y-3">
      {informeListo && (
        <InformeDialogo
          datos={informeListo}
          onClose={() => setInformeListo(null)}
          onGenerar={(extra) => {
            descargarInforme(informeListo, extra)
            setInformeListo(null)
          }}
        />
      )}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {vista === 'tabla' && (
          <>
            <label className="relative min-w-48 flex-1 sm:max-w-xs">
              <span className="sr-only">Search student</span>
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Search student…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <button
              type="button"
              aria-pressed={soloPendientes}
              onClick={() => setSoloPendientes((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${soloPendientes ? 'bg-amber-100 text-amber-800' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon name="filter" className="h-4 w-4" /> Pending only
            </button>
            <span className="text-xs text-slate-400">
              {alumnosVisibles.length === datos.alumnos.length ? `${datos.alumnos.length} students` : `${alumnosVisibles.length} of ${datos.alumnos.length} students`}
            </span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1 text-sm" role="group" aria-label="Matrix view">
          <div className="flex rounded-xl bg-slate-100 p-0.5">
            {[['tabla', 'Table'], ['alumno', 'By student']].map(([id, t]) => (
              <button key={id} aria-pressed={vista === id} onClick={() => setVista(id)} className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${vista === id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {t}
              </button>
            ))}
          </div>
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={recargar}>
            Refresh
          </Button>
        </div>
      </div>
      {vista === 'tabla' && <Leyenda />}
      {fallo && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fallo}</p>}
      {vista === 'tabla' ? (
        alumnosVisibles.length ? (
          <Tabla datos={datos} alumnos={alumnosVisibles} soloPendientes={soloPendientes} onAbrir={abrir} onInforme={informe} />
        ) : (
          <Card className="p-6 text-center">
            <p className="text-sm text-slate-500">No student matches “{busqueda}”.</p>
          </Card>
        )
      ) : (
        <VistaAlumno datos={datos} onAbrir={abrir} onInforme={informe} />
      )}
      {editor && (
        <NivelMcerContext.Provider value={mcer}>
        <Editor
          evaluacionId={editor.evaluacion.id}
          alumnoId={editor.alumno.alumno_id}
          titulo={`${editor.alumno.nombre} · ${editor.evaluacion.modulo} · ${editor.evaluacion.nombre}`}
          celda={celdaEditor}
          servicio={servicio}
          onClose={() => setEditor(null)}
          onCambio={recargar}
        />
        </NivelMcerContext.Provider>
      )}
    </div>
  )
}
