import { useState } from 'react'
import Modal from '../ui/Modal'
import Field from '../ui/Field'
import Button from '../ui/Button'
import { aplicarBorrador } from '../../lib/borradorReporte'
import { propuestaComentarios } from '../../lib/comentariosInforme'
import { HABILIDADES_INFORME, SECCIONES_HABILIDAD, ciclosDelInforme, datosAuto } from '../../lib/informeNotas'

// Datos que completa quien emite el informe antes de imprimirlo (nada se inventa: lo vacío se imprime en blanco).
export default function InformeDialogo({ datos, guardados = {}, onClose, onGenerar }) {
  const [idiomas, setIdiomas] = useState(() => ({ idiomaPortada: 'en', idiomaHabilidades: 'es', ...(guardados[String(datosAuto(datos).ciclo)]?.idiomas ?? {}) }))
  const [cargadoDeGuardado, setCargadoDeGuardado] = useState(() => Boolean(guardados[String(datosAuto(datos).ciclo)]))
  const [v, setV] = useState(() => {
    const auto = datosAuto(datos)
    const prop = propuestaComentarios(datos, auto.ciclo, idiomas) // comentarios estandarizados según las notas publicadas; se pueden editar
    const base = { idEstudiante: '', ranking: '', desempeno: '', estado: '', comentario: prop.comentario, programa: '', habilidades: prop.habilidades, ...auto }
    return aplicarBorrador(base, guardados[String(auto.ciclo)]) // lo guardado la vez anterior manda sobre la propuesta
  })
  const [notas, setNotas] = useState(() => propuestaComentarios(datos, datosAuto(datos).ciclo, idiomas).notas)
  const regenerar = (nuevosIdiomas = idiomas, ciclo = v.ciclo) => {
    const prop = propuestaComentarios(datos, ciclo, nuevosIdiomas)
    setV((p) => ({ ...p, comentario: prop.comentario, habilidades: prop.habilidades }))
    setNotas(prop.notas)
    setCargadoDeGuardado(false)
  }
  // Al cambiar de ciclo: si ya hay un borrador guardado de ese ciclo se carga; si no, se propone de nuevo según las notas.
  const cambiarCiclo = (e) => {
    const ciclo = e.target.value
    const gd = guardados[String(ciclo)]
    if (!gd) {
      set('ciclo')(e)
      return regenerar(idiomas, ciclo)
    }
    const nuevos = { ...idiomas, ...(gd.idiomas ?? {}) }
    const prop = propuestaComentarios(datos, ciclo, nuevos)
    setIdiomas(nuevos)
    setNotas(prop.notas)
    setV((p) => aplicarBorrador({ ...p, ciclo, comentario: prop.comentario, habilidades: prop.habilidades }, gd))
    setCargadoDeGuardado(true)
  }
  const cambiarIdioma = (k) => (e) => {
    const n = { ...idiomas, [k]: e.target.value }
    setIdiomas(n)
    regenerar(n)
  }
  const setHab = (k, s) => (e) => setV((p) => ({ ...p, habilidades: { ...p.habilidades, [k]: { ...p.habilidades[k], [s]: e.target.value } } }))
  const set = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.value }))
  const ciclos = ciclosDelInforme(datos).filter((c) => c.ciclo != null)
  return (
    <Modal title={`Report for ${datos.estudiante}`} onClose={onClose} wide>
      <p className="mb-4 text-sm text-slate-600">
        Horario, periodo, nivel y asistencia ya vienen del salón; puedes corregirlos aquí. El resto es opcional. El informe es de un solo ciclo (2 módulos). El nivel de desempeño y el resultado se calculan sobre 100 (aprueba con 70) cuando el ciclo está completo.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {ciclos.length > 1 && (
          <Field label="Report cycle" options={ciclos.map((c) => ({ value: String(c.ciclo), label: `Cycle ${c.ciclo}` }))} value={String(v.ciclo)} onChange={cambiarCiclo} />
        )}
        <Field label="Student ID" value={v.idEstudiante} onChange={set('idEstudiante')} />
        <Field label="Nivel / CEFR" value={v.nivelCefr} onChange={set('nivelCefr')} placeholder="Ej. BASIC · A1.2 – A2.1" />
        <Field label="Schedule" value={v.horario} onChange={set('horario')} placeholder="E.g. Monday, Wednesday and Friday 7 PM" />
        <Field label="Cycle period" value={v.periodo} onChange={set('periodo')} placeholder="E.g. 02/11/2026 to 17/02/2027" />
      </div>
      <p className="mb-1 mt-4 text-sm font-medium text-slate-700">Attendance (number of classes)</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field label="Programadas" inputMode="numeric" value={v.programadas} onChange={set('programadas')} />
        <Field label="Presente" inputMode="numeric" value={v.presentes} onChange={set('presentes')} />
        <Field label="Tardanza" inputMode="numeric" value={v.tardanzas} onChange={set('tardanzas')} />
        <Field label="Falta injustificada" inputMode="numeric" value={v.ausencias} onChange={set('ausencias')} />
        <Field label="Falta justificada" inputMode="numeric" value={v.justificadas} onChange={set('justificadas')} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Class rank" value={v.ranking} onChange={set('ranking')} />
        <Field label="Performance level (optional)" value={v.desempeno} onChange={set('desempeno')} hint="Empty = per the scale" />
        <Field label="Result (optional)" value={v.estado} onChange={set('estado')} hint="Empty = per the grade" />
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-brand-50/60 p-3">
        <p className="min-w-56 flex-1 text-xs text-slate-600">
          {cargadoDeGuardado ? 'Loaded from the draft saved the last time you generated this report. ' : 'The comments below are proposed from the published grades (by performance level). '}
          Edit anything you want; what you write is saved when you generate the report.
        </p>
        <Field label="Cover comment language" options={[{ value: 'en', label: 'English' }, { value: 'es', label: 'Español' }]} value={idiomas.idiomaPortada} onChange={cambiarIdioma('idiomaPortada')} />
        <Field label="Skill reports language" options={[{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }]} value={idiomas.idiomaHabilidades} onChange={cambiarIdioma('idiomaHabilidades')} />
        <Button type="button" variant="secondary" onClick={() => regenerar(idiomas)}>
          Fill from grades
        </Button>
      </div>
      <Field className="mt-3" as="textarea" rows={3} label="Teacher's comment (cover)" value={v.comentario} onChange={set('comentario')} />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Next step" value={v.siguiente} onChange={set('siguiente')} placeholder="E.g. Functional · Cycle 2" />
        <Field label="Program (optional)" value={v.programa} onChange={set('programa')} placeholder="E.g. Continuo Grupal" />
      </div>
      <details className="mt-4 rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Report by skill (optional)</summary>
        <p className="mt-1 text-xs text-slate-500">Proposed from each skill's published grade; skills without a grade stay empty. Only skills with text are printed, on extra “Academic report” pages.</p>
        <div className="mt-3 space-y-4">
          {HABILIDADES_INFORME.map((k) => (
            <fieldset key={k} className="space-y-2">
              <legend className="text-sm font-medium text-brand-700">{k} <span className="text-xs font-normal text-slate-500">{notas[k] == null ? '· no published grade' : `· ${Math.round(notas[k])} %`}</span></legend>
              {SECCIONES_HABILIDAD.map(([s, t]) => (
                <Field key={s} as="textarea" rows={2} label={t} value={v.habilidades[k]?.[s] ?? ''} onChange={setHab(k, s)} />
              ))}
            </fieldset>
          ))}
        </div>
      </details>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => onGenerar(v, idiomas)}>Generate report (PDF)</Button>
      </div>
    </Modal>
  )
}
