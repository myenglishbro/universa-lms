import { useCallback, useMemo, useState } from 'react'
import useCarga from '../../hooks/useCarga'
import * as asistenciaReal from '../../services/asistencia'
import { minutosTexto } from '../../lib/paquetes'
import Button from '../ui/Button'
import { Anillo } from '../ui/Anillo'
import Icon from '../ui/Icon'
import SalonNav from './SalonNav'
import CalendarioSalon from '../calendario/CalendarioSalon'
import EjerciciosSalon from '../ejercicios/EjerciciosSalon'
import GestionContenido from '../portal/GestionContenido'
import VistaEstudianteSalon from './VistaEstudianteSalon'
import EvaluacionesPanel from '../evaluaciones/EvaluacionesPanel'
import ModulosAdmin from '../evaluaciones/ModulosAdmin'
import SeguimientoSalon from '../seguimiento/SeguimientoSalon'
import BotonCompendio from './BotonCompendio'
import EnlaceRecursos from '../portal/EnlaceRecursos'
import EstadoBadge from './EstadoBadge'
import MatriculasSalon from './MatriculasSalon'
import MatriculasSalonAuto from './MatriculasSalonAuto'
import ResumenAdmin, { PorAtender } from './ResumenAdmin'
import { alertasSalon } from '../../lib/alertasSalon'
import { mensajeAviso } from '../../lib/pendientesClase'
import { porcentajeAvance } from '../../lib/asistencia'
import { cuposSalon } from '../../lib/matriculas'
import { portadaDe } from '../../lib/recursos'
import { diasParaFin, estados, formatHorario } from '../../lib/salones'

// Indicador de la franja inferior de la cabecera; con `onClick` es un acceso directo.
function Dato({ icono, valor, etiqueta, nota, alerta = false, onClick }) {
  const Raiz = onClick ? 'button' : 'div'
  return (
    <Raiz type={onClick ? 'button' : undefined} onClick={onClick} className={`flex items-center gap-3 px-4 py-3 text-left ${onClick ? 'transition hover:bg-white/10' : ''}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${alerta ? 'bg-peach-200 text-peach-800' : 'bg-white/20 text-white'}`}>
        <Icon name={icono} className="h-4 w-4" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-xl font-bold">{valor}</span>
        <span className="block truncate text-xs text-white/80">
          {etiqueta}
          {nota ? ` · ${nota}` : ''}
        </span>
      </span>
    </Raiz>
  )
}

// Detalle de un salón para la administración: cabecera con indicadores, avisos «Por atender» y pestañas por tema.
export default function SalonDetalle({ salon, salones = [], estudiantes, puedeEditar, onVolver, onEditar, onCambiarEstado, onEliminar, onRecargar, onVerEstudiante, onVerDocente }) {
  const [error, setError] = useState('')

  const eliminar = async () => {
    if (!window.confirm(`Delete classroom “${salon.nombre}”?

Its schedule and calendar will be deleted and the teacher will be freed up.${horas ? ' Its hour package and history will also be deleted.' : ''} This cannot be undone.`)) return
    setError('')
    try {
      await onEliminar(salon.id)
    } catch (err) {
      setError(err.message)
    }
  }
  const [cambiando, setCambiando] = useState(false)
  const [tab, setTab] = useState('resumen')

  const cambiarEstado = async (e) => {
    setCambiando(true)
    setError('')
    try {
      await onCambiarEstado(salon.id, e.target.value)
    } catch (err) {
      setError(err.message)
    } finally {
      setCambiando(false)
    }
  }

  const p = salon.progreso
  // Salón de un paquete de horas: el progreso se mide en horas (la base lo devuelve solo si el salón tiene paquete).
  const cargarHoras = useCallback(() => asistenciaReal.progresoDelSalon(salon.id).then((r) => r.horas ?? null), [salon.id])
  const { datos: horas } = useCarga(cargarHoras, null, puedeEditar)
  const pct = horas ? porcentajeAvance(horas.consumidas, horas.contratadas) : p ? porcentajeAvance(p.realizadas, p.total) : null
  const cupos = estudiantes && !estudiantes.cargando ? cuposSalon(salon, estudiantes.matriculas) : null
  const dias = diasParaFin(salon)
  const alertas = useMemo(() => alertasSalon(salon, estudiantes, puedeEditar), [salon, estudiantes, puedeEditar])

  const grupos = [
    {
      titulo: 'General',
      items: [
        { id: 'resumen', label: 'Overview', icono: 'home' },
        { id: 'estudiantes', label: 'Students', icono: 'users', conteo: cupos ? cupos.ocupados : null },
        { id: 'calendario', label: 'Calendar', icono: 'calendar', conteo: p?.sesiones || null },
      ],
    },
    ...(puedeEditar
      ? [
          {
            titulo: 'Academic management',
            items: [
              { id: 'asistencia', label: 'Classes & attendance', icono: 'check', conteo: p?.porRegistrar || null },
              { id: 'evaluaciones', label: 'Assessments', icono: 'chart' },
              { id: 'ejercicios', label: 'Exercises', icono: 'pen' },
              { id: 'recursos', label: 'Course resources', icono: 'book' },
            ],
          },
          { titulo: 'Preview', items: [{ id: 'vista', label: 'Student view', icono: 'eye' }] },
        ]
      : []),
  ]
  const tabs = grupos.flatMap((g) => g.items)

  const ir = (id) => {
    setTab(tabs.some((t) => t.id === id) ? id : 'resumen')
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <button onClick={onVolver} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <Icon name="back" className="h-4 w-4" /> Back to classrooms
      </button>

      <div className={`relative mb-4 overflow-hidden rounded-3xl bg-gradient-to-br text-white shadow-md ${portadaDe(salon.nombre)}`}>
        <span className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <span className="pointer-events-none absolute -bottom-24 right-32 h-52 w-52 rounded-full bg-white/10" />
        <div className="relative p-6 pb-5 sm:p-7 sm:pb-5">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">{salon.codigo}</span>
                <EstadoBadge estado={salon.estado} />
                {horas && <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">Hour package</span>}
              </div>
              <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">{salon.nombre}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-white/90">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="box" className="h-4 w-4" /> {salon.nivel || 'No level'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="teacher" className="h-4 w-4" /> {salon.docente || 'No teacher'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="clock" className="h-4 w-4" /> {formatHorario(salon.horarios)}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/95 p-3 pr-5 text-slate-900 shadow-lg">
              <Anillo valor={pct} size={64} grosor={7} etiqueta="Classroom progress" />
              <div>
                <p className="text-xs text-slate-500">Classroom progress</p>
                <p className="text-sm font-semibold text-brand-800">
                  {horas ? `${minutosTexto(horas.consumidas)} of ${minutosTexto(horas.contratadas)} used` : p?.total ? `${p.realizadas} of ${p.total} classes` : 'No total defined'}
                </p>
              </div>
            </div>
          </div>

          {puedeEditar && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-white/80">
                Status
                <select
                  value={salon.estado}
                  onChange={cambiarEstado}
                  disabled={cambiando}
                  className="rounded-xl border-0 bg-white/95 py-2 pl-3 pr-8 text-sm font-medium text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/60"
                  aria-label="Change status"
                >
                  {estados.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="mx-1 hidden h-6 w-px bg-white/25 sm:block" />
              <Button variant="secondary" onClick={onEditar}>
                <Icon name="pencil" className="h-4 w-4" /> Edit
              </Button>
              <BotonCompendio salon={salon} />
              <EnlaceRecursos salonId={salon.id} url={salon.enlaceRecursos ?? ''} claro />
              {onEliminar && (
                <button
                  type="button"
                  onClick={eliminar}
                  title="Delete classroom"
                  aria-label="Delete classroom"
                  className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur transition hover:bg-rose-500"
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Indicadores dentro de la cabecera: ahorran una fila entera y siguen siendo accesos directos. */}
        <div className="relative grid grid-cols-2 divide-x divide-white/15 border-t border-white/20 bg-black/10 backdrop-blur-sm sm:grid-cols-4">
          <Dato icono="users" valor={cupos ? `${cupos.ocupados}/${cupos.capacidad}` : '…'} etiqueta="Enrolled students" onClick={() => ir('estudiantes')} />
          {horas ? (
            <Dato icono="clock" valor={minutosTexto(Math.max(horas.disponibles, 0))} etiqueta="Hours remaining" nota={`${p?.realizadas ?? 0} held`} onClick={() => ir('calendario')} />
          ) : (
            <Dato icono="check" valor={p ? p.realizadas : '—'} etiqueta="Classes held" nota={p?.restantes != null ? `${p.restantes} left` : undefined} onClick={() => ir('calendario')} />
          )}
          <Dato icono="flag" valor={dias === null ? '—' : dias < 0 ? 'Overdue' : dias === 0 ? 'Today' : `${dias} d`} etiqueta="Until estimated end" alerta={dias !== null && dias <= 14} />
          <Dato
            icono="alert"
            valor={alertas.length}
            etiqueta={alertas.length === 1 ? 'Item to review' : 'Items to review'}
            alerta={alertas.length > 0}
            onClick={alertas.length ? () => document.getElementById('por-atender')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : undefined}
          />
        </div>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <PorAtender alertas={alertas} onIr={ir} aviso={puedeEditar ? mensajeAviso(salon) : ''} />

      <div className="grid gap-5 lg:grid-cols-[264px_minmax(0,1fr)] lg:items-start">
      <SalonNav grupos={grupos} activa={tab} onCambiar={setTab} />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-w-0">
        {tab === 'resumen' && <ResumenAdmin salon={salon} estudiantes={estudiantes} puedeEditar={puedeEditar} onVerDocente={onVerDocente} />}

        {/* Con datos compartidos desde la app se usan; si no llegan, la sección los carga por su cuenta (nunca queda vacía). */}
        {tab === 'estudiantes' &&
          (estudiantes ? (
            <MatriculasSalon
              salon={salon}
              salones={salones}
              data={estudiantes}
              puedeEditar={puedeEditar}
              onCambio={() => Promise.all([estudiantes.recargar?.(), onRecargar?.()])}
              onVerEstudiante={onVerEstudiante}
            />
          ) : (
            <MatriculasSalonAuto salon={salon} salones={salones} puedeEditar={puedeEditar} onCambio={onRecargar} onVerEstudiante={onVerEstudiante} />
          ))}

        {tab === 'calendario' && <CalendarioSalon salon={salon} puedeEditar={puedeEditar} onCambio={onRecargar} />}

        {tab === 'ejercicios' && puedeEditar && <EjerciciosSalon key={salon.id} salonId={salon.id} esAdmin />}

        {tab === 'vista' && puedeEditar && <VistaEstudianteSalon key={salon.id} salon={salon} />}

        {tab === 'recursos' && puedeEditar && <GestionContenido key={salon.id} salonId={salon.id} />}

        {tab === 'asistencia' && puedeEditar && <SeguimientoSalon key={salon.id} salonId={salon.id} onCambio={onRecargar} />}

        {tab === 'evaluaciones' && puedeEditar && (
          <div className="space-y-4">
            <ModulosAdmin key={`m${salon.id}`} salonId={salon.id} cicloDesde={salon.cicloDesde} cicloHasta={salon.cicloHasta} />
            <EvaluacionesPanel key={`e${salon.id}`} salonId={salon.id} esAdmin />
          </div>
        )}
      </div>
      </div>
    </>
  )
}
