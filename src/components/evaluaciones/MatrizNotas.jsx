import { Fragment, useCallback, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import useCarga from '../../hooks/useCarga'
import { ESTADOS_CELDA, agruparPorCiclo, fmtNota, notaSobreEvaluado, textoCelda } from '../../lib/evaluaciones'
import { descargarInforme } from '../../lib/informeNotas'
import InformeDialogo from './InformeDialogo'
import * as servicioReal from '../../services/evaluaciones'
import CeldaNota from './CeldaNota'
import ParticipacionModal from './ParticipacionModal'

// Anchos de las columnas fijas (px). Se usan para que queden pegadas a la izquierda al desplazar.
const W = { nivel: 84, ciclo: 56, modulo: 92, comp: 168, peso: 60 }
const LEFT = { nivel: 0, ciclo: W.nivel, modulo: W.nivel + W.ciclo, comp: W.nivel + W.ciclo + W.modulo, peso: W.nivel + W.ciclo + W.modulo + W.comp }
const fija = (k, bg, extra = '') => ({ style: { left: LEFT[k], width: W[k], minWidth: W[k] }, className: `sticky z-10 border-b border-r border-slate-200 ${bg} px-2 py-1.5 text-left align-top text-xs ${extra}` })

const pesoTxt = (n) => (Number(n) > 0 ? fmtNota(n) : '')
const aporteTxt = (c) => (c?.aporte == null ? '' : fmtNota(c.aporte))

// El contenido de una celda: nota, avance (5/10) o guion. Colores discretos por estado.
function BotonCelda({ celda, evaluacion, alumno, onAbrir }) {
  const est = ESTADOS_CELDA[celda?.estado ?? 'sin_nota']
  const sub =
    celda?.tipo === 'participacion' && celda.total > 0 && celda.registradas > 0 && celda.puntaje != null
      ? `${celda.cumplidas}/${celda.total} clases`
      : celda?.tipo !== 'participacion' && celda?.unidades_total > 1 && celda.puntaje != null
        ? `${celda.unidades_registradas}/${celda.unidades_total} unid.`
        : ''
  return (
    <button
      type="button"
      onClick={() => onAbrir(evaluacion, alumno)}
      aria-label={`${evaluacion.nombre} de ${alumno.nombre}`}
      title={`${est.texto} — clic para abrir`}
      className={`flex min-h-10 w-full flex-col items-center justify-center rounded px-2 py-1 text-sm font-medium hover:ring-2 hover:ring-brand-300 ${est.clase} ${celda?.estado === 'borrador' || celda?.estado === 'listo' ? 'italic' : ''}`}
    >
      <span>{textoCelda(celda)}</span>
      {sub && <span className="text-[10px] font-normal opacity-70">{sub}</span>}
    </button>
  )
}

// Subtotal de un módulo (solo notas publicadas): nota sobre lo evaluado y puntos acumulados.
function SubtotalModulo({ r, columna }) {
  if (!r || r.sin_plantilla) return <span className="text-slate-300">—</span>
  if (columna === 'puntaje')
    return (
      <span title={r.remedial ? `Remedial (original: ${fmtNota(r.puntos_original)} puntos)` : undefined}>
        {r.peso_evaluado > 0 ? fmtNota(r.nota) : '—'}
        {r.remedial && <span className="ml-1 rounded bg-rose-50 px-1 text-[10px] text-rose-700">Remedial</span>}
        {r.parcial && r.peso_evaluado > 0 && <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] text-amber-700">parcial</span>}
      </span>
    )
  return <span>{r.peso_evaluado > 0 ? `${fmtNota(r.puntos)} / ${fmtNota(r.peso_total)}` : '—'}</span>
}

function SubtotalAgregado({ r, columna }) {
  if (!r || !(Number(r.escala_evaluada) > 0)) return <span className="text-slate-300">—</span>
  if (columna === 'puntaje')
    return (
      <span>
        {fmtNota(notaSobreEvaluado(r))}
        {r.remedial && <span className="ml-1 rounded bg-rose-50 px-1 text-[10px] text-rose-700">Remedial</span>}
        {r.parcial && <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] text-amber-700">parcial</span>}
      </span>
    )
  return <span>{`${fmtNota(r.puntos)} / ${fmtNota(r.escala)}`}</span>
}

function Leyenda() {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
      {['publicada', 'borrador', 'en_curso', 'sin_nota'].map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className={`inline-block h-3 w-3 rounded border border-slate-200 ${ESTADOS_CELDA[k].clase}`} />
          {k === 'borrador' ? 'Borrador / lista para publicar' : k === 'en_curso' ? 'En curso (incompleta)' : ESTADOS_CELDA[k].texto}
        </span>
      ))}
      <span>Los subtotales cuentan solo notas publicadas.</span>
    </p>
  )
}

function Tabla({ datos, onAbrir, onInforme }) {
  const { modulos, alumnos, salon, consolidacion } = datos
  const grupos = agruparPorCiclo(modulos)
  const resumen = (a, id) => a.resumen.modulos.find((x) => x.modulo_id === id)
  const resumenCiclo = (a, ciclo) => a.resumen.ciclos.find((c) => (c.ciclo ?? null) === ciclo)

  // Filas en orden, con los rowSpan de las columnas agrupadas (Nivel, Ciclo, Módulo) ya calculados.
  const filasModulo = (m) => m.evaluaciones.length + 1
  const filasCiclo = (g) => g.modulos.reduce((s, m) => s + filasModulo(m), 0) + 1
  const totalFilas = grupos.reduce((s, g) => s + filasCiclo(g), 0) + 2
  const filas = []
  for (const g of grupos) {
    let primeraCiclo = true
    for (const m of g.modulos) {
      let primeraModulo = true
      const base = () => {
        const f = { g, m, nivel: filas.length === 0, ciclo: primeraCiclo, modulo: primeraModulo }
        primeraCiclo = false
        primeraModulo = false
        return f
      }
      for (const ev of m.evaluaciones) filas.push({ ...base(), tipo: 'eval', ev })
      filas.push({ ...base(), tipo: 'modulo' })
    }
    filas.push({ tipo: 'ciclo', g })
  }
  const nivelTxt = salon.nivel ?? 'Sin nivel'

  const celdasAgrupadas = (f) => (
    <>
      {f.nivel && (
        <td rowSpan={totalFilas} {...fija('nivel', 'bg-white', 'font-medium text-slate-700')}>
          {nivelTxt}
        </td>
      )}
      {f.ciclo && (
        <td rowSpan={filasCiclo(f.g)} {...fija('ciclo', 'bg-white', 'font-medium text-slate-700')}>
          {f.g.ciclo != null ? `Ciclo ${f.g.ciclo}` : 'Sin ciclo'}
        </td>
      )}
      {f.modulo && (
        <td rowSpan={filasModulo(f.m)} {...fija('modulo', 'bg-white', 'font-medium text-slate-800')}>
          {f.m.nombre}
          {f.m.plantilla && <span className="block text-[10px] font-normal text-slate-400">{f.m.plantilla}</span>}
        </td>
      )}
    </>
  )

  return (
    <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-max min-w-full border-separate border-spacing-0 text-sm" aria-label="Matriz de calificaciones">
        <thead>
          <tr>
            {[['nivel', 'Nivel'], ['ciclo', 'Ciclo'], ['modulo', 'Módulo'], ['comp', 'Componente'], ['peso', 'Peso']].map(([k, t]) => {
              const f = fija(k, 'bg-slate-50', 'font-semibold text-slate-700')
              return (
                <th key={k} rowSpan={2} style={{ ...f.style, top: 0, zIndex: 30 }} className={f.className}>
                  {t}
                </th>
              )
            })}
            {alumnos.map((a) => (
              <th key={a.alumno_id} colSpan={2} className="sticky top-0 z-20 h-8 border-b border-r border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-xs font-semibold text-slate-800">
                <span className="block">{a.nombre}</span>
                <button type="button" aria-label={`Informe de ${a.nombre}`} onClick={() => onInforme(a)} className="text-[10px] font-normal text-brand-700 underline">
                  Informe PDF
                </button>
              </th>
            ))}
          </tr>
          <tr>
            {alumnos.map((a) => (
              <Fragment key={a.alumno_id}>
                <th className="sticky top-8 z-20 min-w-24 border-b border-r border-slate-200 bg-slate-50 px-2 py-1 text-center text-[11px] font-medium text-slate-500">Puntaje</th>
                <th className="sticky top-8 z-20 min-w-24 border-b border-r border-slate-200 bg-slate-50 px-2 py-1 text-center text-[11px] font-medium text-slate-500">Aporte</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => {
            if (f.tipo === 'eval')
              return (
                <tr key={f.ev.id}>
                  {celdasAgrupadas(f)}
                  <td {...fija('comp', 'bg-white', 'text-slate-800')}>
                    {f.ev.nombre}
                    {f.ev.tipo === 'participacion' && <span className="block text-[10px] text-slate-400">participación por clase</span>}
                  </td>
                  <td {...fija('peso', 'bg-white', 'text-right text-slate-600')}>{fmtNota(f.ev.peso)}</td>
                  {alumnos.map((a) => {
                    const c = a.celdas[f.ev.id]
                    return (
                      <Fragment key={a.alumno_id}>
                        <td className="border-b border-r border-slate-100 p-1 text-center">
                          <BotonCelda celda={c} evaluacion={{ ...f.ev, modulo: f.m.nombre }} alumno={a} onAbrir={onAbrir} />
                        </td>
                        <td className={`border-b border-r border-slate-100 px-2 text-center text-xs ${c?.estado === 'publicada' ? 'text-slate-800' : 'italic text-slate-400'}`}>{aporteTxt(c)}</td>
                      </Fragment>
                    )
                  })}
                </tr>
              )
            if (f.tipo === 'modulo')
              return (
                <tr key={`s${f.m.id}`} className="bg-slate-50 font-medium">
                  {celdasAgrupadas(f)}
                  <td {...fija('comp', 'bg-slate-50', 'font-semibold text-slate-700')}>{f.m.version_id ? 'Subtotal del módulo' : 'Sin plantilla asignada'}</td>
                  <td {...fija('peso', 'bg-slate-50', 'text-right text-slate-600')}>{f.m.escala != null ? fmtNota(f.m.escala) : ''}</td>
                  {alumnos.map((a) => (
                    <Fragment key={a.alumno_id}>
                      <td className="border-b border-r border-slate-100 px-2 py-1.5 text-center text-sm">
                        <SubtotalModulo r={resumen(a, f.m.id)} columna="puntaje" />
                      </td>
                      <td className="border-b border-r border-slate-100 px-2 py-1.5 text-center text-sm">
                        <SubtotalModulo r={resumen(a, f.m.id)} columna="aporte" />
                      </td>
                    </Fragment>
                  ))}
                </tr>
              )
            return (
              <tr key={`c${i}`} className="bg-brand-50 font-semibold">
                <td colSpan={2} {...fija('modulo', 'bg-brand-50', 'text-brand-800')} style={{ left: LEFT.modulo }}>
                  Subtotal {f.g.ciclo != null ? `ciclo ${f.g.ciclo}` : 'sin ciclo'}
                </td>
                <td {...fija('peso', 'bg-brand-50', 'text-right text-brand-800')}>{pesoTxt(f.g.modulos.reduce((s, m) => s + (m.escala ?? 0), 0))}</td>
                {alumnos.map((a) => (
                  <Fragment key={a.alumno_id}>
                    <td className="border-b border-r border-brand-100 px-2 py-1.5 text-center text-sm">
                      <SubtotalAgregado r={resumenCiclo(a, f.g.ciclo)} columna="puntaje" />
                    </td>
                    <td className="border-b border-r border-brand-100 px-2 py-1.5 text-center text-sm">
                      <SubtotalAgregado r={resumenCiclo(a, f.g.ciclo)} columna="aporte" />
                    </td>
                  </Fragment>
                ))}
              </tr>
            )
          })}
          <tr className="bg-slate-100 font-semibold">
            <td colSpan={3} {...fija('ciclo', 'bg-slate-100', 'text-slate-800')} style={{ left: LEFT.ciclo }}>
              Resultado acumulado del nivel (puntos publicados)
            </td>
            <td {...fija('peso', 'bg-slate-100', 'text-right text-slate-700')}>{pesoTxt(modulos.reduce((s, m) => s + (m.escala ?? 0), 0))}</td>
            {alumnos.map((a) => (
              <Fragment key={a.alumno_id}>
                <td className="border-b border-r border-slate-200 px-2 py-1.5 text-center text-sm">
                  <SubtotalAgregado r={a.resumen.acumulado} columna="puntaje" />
                </td>
                <td className="border-b border-r border-slate-200 px-2 py-1.5 text-center text-sm">
                  <SubtotalAgregado r={a.resumen.acumulado} columna="aporte" />
                </td>
              </Fragment>
            ))}
          </tr>
          <tr className="bg-white font-semibold">
            <td colSpan={3} {...fija('ciclo', 'bg-white', 'text-slate-900')} style={{ left: LEFT.ciclo }}>
              Resultado final del nivel
            </td>
            <td {...fija('peso', 'bg-white', 'text-right text-slate-600')} />
            {alumnos.map((a) => (
              <td key={a.alumno_id} colSpan={2} className="border-b border-r border-slate-200 px-2 py-1.5 text-center text-xs">
                {a.nivel?.definido && consolidacion.confirmada ? (
                  <span className="text-sm">
                    {fmtNota(a.nivel.nota)} {a.nivel.parcial && <Badge color="peach">Parcial</Badge>}
                  </span>
                ) : (
                  <span className="font-normal text-slate-400">Pendiente de regla confirmada por Coordinación</span>
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
      <select aria-label="Estudiante" value={a.alumno_id} onChange={(e) => setSel(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
        {alumnos.map((x) => (
          <option key={x.alumno_id} value={x.alumno_id}>
            {x.nombre}
          </option>
        ))}
      </select>
      <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => onInforme(a)}>
        Descargar informe de {a.nombre} (PDF)
      </Button>
      {grupos.map((g) => (
        <section key={g.ciclo ?? 'sin'} className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">{g.ciclo != null ? `Ciclo ${g.ciclo}` : 'Módulos sin ciclo'}</h3>
          {g.modulos.map((m) => {
            const r = a.resumen.modulos.find((x) => x.modulo_id === m.id)
            return (
              <Card key={m.id} className="p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">{m.nombre}</h4>
                  <p className="text-xs text-slate-600">
                    {r && !r.sin_plantilla && r.peso_evaluado > 0 ? (
                      <>
                        {fmtNota(r.puntos)} / {fmtNota(r.peso_total)} pts {r.parcial && <Badge color="peach">Parcial</Badge>} {r.remedial && <Badge color="rose">Remedial</Badge>}
                      </>
                    ) : (
                      'Sin notas publicadas'
                    )}
                  </p>
                </div>
                {m.evaluaciones.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">Sin plantilla asignada.</p>
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
                            aria-label={`${ev.nombre} de ${a.nombre}`}
                            className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
                          >
                            <span className="text-sm text-slate-800">
                              {ev.nombre} <span className="text-xs text-slate-400">peso {fmtNota(ev.peso)}</span>
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
            Subtotal {g.ciclo != null ? `ciclo ${g.ciclo}` : ''}: <strong>{(() => { const c = a.resumen.ciclos.find((x) => (x.ciclo ?? null) === g.ciclo); return c && c.escala_evaluada > 0 ? `${fmtNota(c.puntos)} / ${fmtNota(c.escala)} pts` : '—' })()}</strong>
          </p>
        </section>
      ))}
      <Card className="p-4 text-sm">
        <p>
          Acumulado del nivel (puntos publicados): <strong>{a.resumen.acumulado.escala_evaluada > 0 ? `${fmtNota(a.resumen.acumulado.puntos)} / ${fmtNota(a.resumen.acumulado.escala)}` : '—'}</strong>
        </p>
        <p className="mt-1">
          Resultado final: {a.nivel?.definido && consolidacion.confirmada ? <strong>{fmtNota(a.nivel.nota)}</strong> : <span className="text-slate-400">pendiente de regla confirmada por Coordinación</span>}
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
  const [informeListo, setInformeListo] = useState(null)
  const [fallo, setFallo] = useState('')
  const ancha = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 1024px)').matches : true
  const [vista, setVista] = useState(vistaInicial ?? (ancha ? 'tabla' : 'alumno'))

  if (error) return <p className="text-sm text-red-600">No se pudo cargar la matriz: {error}</p>
  if (cargando || !datos) return <p className="py-6 text-center text-sm text-slate-500">Cargando…</p>
  if (datos.modulos.length === 0)
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-slate-500">Este salón aún no tiene módulos de evaluación. Administración los configura y les asigna una plantilla.</p>
      </Card>
    )
  if (datos.alumnos.length === 0)
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-slate-500">No hay estudiantes matriculados en este salón.</p>
      </Card>
    )

  const abrir = (evaluacion, alumno) => setEditor({ evaluacion, alumno })
  const informe = async (a) => {
    setFallo('')
    try {
      setInformeListo(await servicio.informeAlumno(salonId, a.alumno_id))
    } catch (e) {
      setFallo(`No se pudo generar el informe: ${e.message}`)
    }
  }
  const Editor = editor?.evaluacion.tipo === 'participacion' ? ParticipacionModal : CeldaNota

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Leyenda />
        <div className="flex gap-1 text-sm" role="group" aria-label="Vista de la matriz">
          {[['tabla', 'Tabla'], ['alumno', 'Por estudiante']].map(([id, t]) => (
            <button key={id} aria-pressed={vista === id} onClick={() => setVista(id)} className={`rounded-lg px-3 py-1.5 font-medium ${vista === id ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-100'}`}>
              {t}
            </button>
          ))}
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={recargar}>
            Actualizar
          </Button>
        </div>
      </div>
      {fallo && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fallo}</p>}
      {vista === 'tabla' ? <Tabla datos={datos} onAbrir={abrir} onInforme={informe} /> : <VistaAlumno datos={datos} onAbrir={abrir} onInforme={informe} />}
      {editor && (
        <Editor
          evaluacionId={editor.evaluacion.id}
          alumnoId={editor.alumno.alumno_id}
          titulo={`${editor.alumno.nombre} · ${editor.evaluacion.modulo} · ${editor.evaluacion.nombre}`}
          servicio={servicio}
          onClose={() => setEditor(null)}
          onCambio={recargar}
        />
      )}
    </div>
  )
}
