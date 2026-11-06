import { useCallback, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import useCarga from '../../hooks/useCarga'
import { fmtNota, metodoLabel, textoFaltan } from '../../lib/evaluaciones'
import * as servicioReal from '../../services/evaluaciones'
import RegistroNotas from './RegistroNotas'

// Resultados por estudiante: nota del módulo (con aviso de parcial y lo que falta) y, aparte, la nota final del nivel.
function Resultados({ salonId, servicio }) {
  const cargar = useCallback(() => servicio.resultadosSalon(salonId), [servicio, salonId])
  const { datos, cargando, error } = useCarga(cargar, null)
  if (error) return <p className="text-sm text-red-600">No se pudieron cargar los resultados: {error}</p>
  if (cargando || !datos) return <p className="text-sm text-slate-400">Cargando…</p>
  const { consolidacion, alumnos } = datos
  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Solo cuentan las notas publicadas. Lo que aún no tiene nota no se toma como cero.{' '}
        {consolidacion.metodo === 'sin_definir'
          ? 'La nota final del nivel está pendiente de confirmación de Coordinación.'
          : `Nota del nivel: ${metodoLabel(consolidacion.metodo)}${consolidacion.confirmada ? '' : ' (vista previa, sin confirmar)'}.`}
      </p>
      {alumnos.length === 0 ? (
        <p className="text-sm text-slate-400">No hay estudiantes en este salón.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {alumnos.map((a) => (
            <li key={a.alumno_id} className="px-4 py-3">
              <p className="text-sm font-medium text-slate-900">
                {a.nombre}
                {a.nivel?.definido && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    Nivel: <strong className="text-slate-900">{fmtNota(a.nivel.nota)}</strong> {a.nivel.parcial && <Badge color="peach">Parcial</Badge>}
                  </span>
                )}
              </p>
              <ul className="mt-1 space-y-0.5">
                {a.modulos.length === 0 && <li className="text-xs text-slate-400">Sin módulos.</li>}
                {a.modulos.map((m) => (
                  <li key={m.modulo_id} className="text-xs text-slate-600">
                    {m.nombre}:{' '}
                    {m.sin_plantilla ? (
                      <span className="text-slate-400">sin plantilla asignada</span>
                    ) : (
                      <>
                        <strong className="text-slate-900">{fmtNota(m.nota)}</strong>
                        {m.parcial && (
                          <>
                            {' '}
                            <Badge color="peach">Parcial</Badge> {m.peso_evaluado > 0 ? `evaluado ${fmtNota(m.peso_evaluado)} de ${fmtNota(m.peso_total)}` : 'sin notas publicadas'}
                            {m.faltan.length > 0 && ` · falta: ${textoFaltan(m.faltan)}`}
                          </>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Docente (o administración): salón → módulo → evaluación → registrar notas. Sin hojas de cálculo.
export default function EvaluacionesSalon({ salonId, servicio = servicioReal }) {
  const cargar = useCallback(() => servicio.estructuraSalon(salonId), [servicio, salonId])
  const { datos, cargando, error, recargar } = useCarga(cargar, null)
  const [moduloId, setModuloId] = useState(null)
  const [vista, setVista] = useState('notas')
  const [abierta, setAbierta] = useState(null)
  const [refresco, setRefresco] = useState(0)

  if (error) return <p className="text-sm text-red-600">No se pudieron cargar las evaluaciones: {error}</p>
  if (cargando || !datos) return <p className="py-6 text-center text-sm text-slate-500">Cargando…</p>
  const { modulos } = datos
  if (modulos.length === 0)
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-slate-500">Este salón aún no tiene módulos de evaluación. Administración los configura y les asigna una plantilla.</p>
      </Card>
    )
  const modulo = modulos.find((m) => m.id === moduloId) ?? modulos[0]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Módulos">
          {modulos.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={modulo.id === m.id}
              onClick={() => setModuloId(m.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${modulo.id === m.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {m.nombre}
            </button>
          ))}
        </div>
        <div className="flex gap-1 text-sm" role="group" aria-label="Vista">
          {[['notas', 'Registrar notas'], ['resultados', 'Resultados']].map(([id, texto]) => (
            <button key={id} aria-pressed={vista === id} onClick={() => setVista(id)} className={`rounded-lg px-3 py-1.5 font-medium ${vista === id ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-100'}`}>
              {texto}
            </button>
          ))}
        </div>
      </div>

      {vista === 'resultados' ? (
        <Resultados key={refresco} salonId={salonId} servicio={servicio} />
      ) : !modulo.version_id ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-slate-500">«{modulo.nombre}» todavía no tiene plantilla de evaluación. Pide a administración que la asigne.</p>
        </Card>
      ) : (
        <Card>
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-900">{modulo.nombre}</h2>
            <p className="text-xs text-slate-500">
              {modulo.plantilla} · versión {modulo.version}
              {modulo.ciclo != null && ` · ciclo ${modulo.ciclo}`}
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {modulo.evaluaciones.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {e.nombre} <span className="text-xs font-normal text-slate-500">peso {fmtNota(e.peso)}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {e.publicadas} publicadas
                    {e.borradores > 0 && ` · ${e.borradores} en borrador`}
                    {e.unidades.length > 0 && ` · ${e.unidades.length} unidades`}
                    {e.con_rubrica && ' · con rúbrica'}
                  </p>
                </div>
                <Button variant={e.publicadas === 0 && e.borradores === 0 ? 'primary' : 'secondary'} className="px-3 py-1.5" onClick={() => setAbierta(e)}>
                  Registrar notas
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {abierta && (
        <RegistroNotas
          evaluacionId={abierta.id}
          titulo={`${modulo.nombre} · ${abierta.nombre}`}
          servicio={servicio}
          onClose={() => setAbierta(null)}
          onCambio={async () => {
            setRefresco((r) => r + 1)
            await recargar()
          }}
        />
      )}
    </div>
  )
}
