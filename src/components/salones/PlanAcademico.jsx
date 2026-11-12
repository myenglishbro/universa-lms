import Field from '../ui/Field'
import {
  cuota,
  etiquetaHorario,
  formatHoras,
  horariosDe,
  modalidadesDe,
  normalizarSeleccion,
  opcionesCiclos,
  rangoPorDefecto,
  resolverPlan,
  seleccionDe,
  tiposAlumnoDe,
} from '../../lib/catalogo'

// Elección guiada del plan académico: Modalidad → Clases → (Alumno) → Ciclos. El nivel ya viene elegido en «Datos básicos».
// Cada paso aparece solo cuando el anterior está resuelto. Las cifras salen del catálogo en Supabase,
// que además valida todo al guardar. `onChange(parche)` actualiza el formulario.
export default function PlanAcademico({ catalogo, nivelCodigo, values, onChange, tieneCalendario }) {
  const { planes, error: errorCatalogo, cargando } = catalogo
  // Solo los planes vigentes; el plan que el salón ya tiene se conserva aunque deje de estar vigente.
  const disponibles = planes.filter((p) => p.nivelCodigo === nivelCodigo && (p.vigente || p.id === values.planId))
  const plan = disponibles.find((p) => p.id === values.planId) ?? null
  // Con plan, la selección se deduce de él (así también funciona al editar antes de que cargue el catálogo).
  const sel = plan ? seleccionDe(plan) : { modalidad: values.modalidad, nivel: nivelCodigo, horario: values.horario, tipo: values.tipo }

  const elegir = (campo, valor) => {
    const nueva = normalizarSeleccion(disponibles, { ...sel, [campo]: valor })
    const elegido = resolverPlan(disponibles, nueva)
    const parche = { ...nueva, planId: elegido?.id ?? '' }
    if (elegido) {
      const rango = elegido.id === values.planId ? { cicloDesde: values.cicloDesde, cicloHasta: values.cicloHasta } : rangoPorDefecto(elegido)
      Object.assign(parche, rango)
      if (!tieneCalendario) parche.totalSesiones = cuota(elegido, rango.cicloDesde, rango.cicloHasta).sesiones
    } else {
      Object.assign(parche, { cicloDesde: '', cicloHasta: '' })
    }
    onChange(parche)
  }

  const elegirCiclos = (valor) => {
    const [desde, hasta] = valor.split('-').map(Number)
    const parche = { cicloDesde: desde, cicloHasta: hasta }
    if (!tieneCalendario) parche.totalSesiones = cuota(plan, desde, hasta).sesiones
    onChange(parche)
  }

  if (cargando) return <p className="text-sm text-slate-500 sm:col-span-2">Loading academic plans…</p>
  if (errorCatalogo)
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:col-span-2">
        Could not load the academic plans ({errorCatalogo}). Turn this option off to save the classroom without a plan.
      </p>
    )

  if (!nivelCodigo) return <p className="text-sm text-slate-500 sm:col-span-2">First choose the academic level in “Basic details”.</p>
  if (disponibles.length === 0)
    return <p className="text-sm text-slate-500 sm:col-span-2">This level has no academic plans available. You can save the classroom without a plan.</p>

  const horarios = sel.nivel ? horariosDe(disponibles, sel.modalidad, sel.nivel) : []
  const tipos = sel.horario ? tiposAlumnoDe(disponibles, sel) : []
  const resumen = plan ? cuota(plan, Number(values.cicloDesde), Number(values.cicloHasta)) : null
  const ciclos = plan ? opcionesCiclos(plan) : []

  return (
    <>
      <Field
        label="Modality"
        value={sel.modalidad}
        onChange={(e) => elegir('modalidad', e.target.value)}
        options={[{ value: '', label: 'Select a modality' }, ...modalidadesDe(disponibles)]}
      />
      {sel.modalidad && (
        <Field
          label="Plan classes"
          value={sel.horario}
          onChange={(e) => elegir('horario', e.target.value)}
          options={[{ value: '', label: 'Select' }, ...horarios]}
          hint="How many classes per week and how long each lasts, per the plan."
        />
      )}
      {tipos.length > 0 && (
        <Field
          label="Is the student new or continuing?"
          value={sel.tipo}
          onChange={(e) => elegir('tipo', e.target.value)}
          options={[{ value: '', label: 'Select' }, ...tipos]}
          hint="Changes the number of sessions in the plan."
        />
      )}
      {plan && (
        <Field
          label="Cycles covered by the classroom"
          value={`${values.cicloDesde}-${values.cicloHasta}`}
          onChange={(e) => elegirCiclos(e.target.value)}
          options={ciclos}
          hint={ciclos.length > 1 ? 'Choose the whole level or a single cycle.' : undefined}
        />
      )}
      {plan && resumen && (
        <p className="text-sm text-slate-600 sm:col-span-2">
          <strong className="font-semibold text-slate-900">{resumen.sesiones} sessions</strong> · {formatHoras(resumen.horas)} h
          <span className="text-slate-500"> · {etiquetaHorario(plan)}</span>
        </p>
      )}
    </>
  )
}
