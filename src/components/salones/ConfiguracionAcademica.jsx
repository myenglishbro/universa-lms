import { seleccionDe } from '../../lib/catalogo'
import { mensajeModo, modoConfiguracion } from '../../lib/resumenSalon'
import FrecuenciaSalon from './FrecuenciaSalon'
import PlanAcademico from './PlanAcademico'

const sinPlan = { planId: '', modalidad: '', nivel: '', horario: '', tipo: '', cicloDesde: '', cicloHasta: '' }

function Opcion({ activa, onToggle, titulo, descripcion }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activa}
      onClick={onToggle}
      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
        activa ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${activa ? 'bg-brand-600' : 'bg-slate-300'}`}
      >
        <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${activa ? 'translate-x-4' : ''}`} />
      </span>
      <span>
        <span className="block text-sm font-medium text-slate-900">{titulo}</span>
        <span className="block text-xs text-slate-500">{descripcion}</span>
      </span>
    </button>
  )
}

// Bloque «Configuración académica»: plan y frecuencia son opcionales e independientes. Cada uno se activa con un
// interruptor y solo entonces muestra sus campos. Al desactivarlo se limpian sus valores.
export default function ConfiguracionAcademica({
  catalogo,
  nivelCodigo,
  values,
  onChange,
  tieneCalendario,
  usaPlan,
  setUsaPlan,
  usaFrecuencia,
  setUsaFrecuencia,
  errorPlan,
  errorFrecuencia,
}) {
  const planElegido = catalogo.planes.find((p) => p.id === values.planId)
  const modalidadCodigo = planElegido ? seleccionDe(planElegido).modalidad : values.modalidad

  const alternarPlan = () => {
    if (usaPlan) onChange(sinPlan)
    setUsaPlan(!usaPlan)
  }
  const alternarFrecuencia = () => {
    if (usaFrecuencia) onChange({ frecuenciaId: '' })
    setUsaFrecuencia(!usaFrecuencia)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Opcion activa={usaPlan} onToggle={alternarPlan} titulo="Usar un plan académico" descripcion="Calcula las sesiones y los ciclos del nivel." />
        <Opcion activa={usaFrecuencia} onToggle={alternarFrecuencia} titulo="Usar una frecuencia de clases" descripcion="Revisa las clases por semana y su duración." />
      </div>

      {usaPlan && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Plan académico</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <PlanAcademico catalogo={catalogo} nivelCodigo={nivelCodigo} values={values} onChange={onChange} tieneCalendario={tieneCalendario} />
          </div>
          {errorPlan && <p className="mt-1 text-sm text-red-600">{errorPlan}</p>}
        </div>
      )}

      {usaFrecuencia && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Frecuencia</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <FrecuenciaSalon
              catalogo={catalogo}
              frecuenciaId={values.frecuenciaId}
              modalidadCodigo={modalidadCodigo}
              onChange={(frecuenciaId) => onChange({ frecuenciaId })}
            />
          </div>
          {errorFrecuencia && <p className="mt-1 text-sm text-red-600">{errorFrecuencia}</p>}
        </div>
      )}

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {mensajeModo[modoConfiguracion({ planId: usaPlan, frecuenciaId: usaFrecuencia })]}
        {tieneCalendario && usaPlan && ' Este salón ya tiene calendario: cambiar el plan no modifica sus sesiones.'}
      </p>
    </div>
  )
}
