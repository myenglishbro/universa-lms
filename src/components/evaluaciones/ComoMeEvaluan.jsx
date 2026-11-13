import { useState } from 'react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { fmtNota, sumaPesos } from '../../lib/evaluaciones'

// Qué mide cada tipo de componente, en palabras para el estudiante.
const QUE_MIDE = {
  test: 'Module exam.',
  writing: 'Written production, graded with a 5-criteria rubric.',
  project: 'Module project, graded with a criteria rubric.',
  spark: 'SPARK platform tasks.',
  speaking: 'Oral expression, graded with a rubric.',
  participacion: 'Participation in the module classes.',
  formative: 'Continuous follow-up: 3 units with 5 skills each, plus your class participation.',
  otro: '',
}

const nombreModulos = (ms) => (ms.length === 1 ? ms[0].nombre : `${ms.slice(0, -1).map((m) => m.nombre).join(', ')} and ${ms[ms.length - 1].nombre}`)

// Módulos con la misma distribución de pesos se explican juntos (p. ej. «Módulos 1, 2 y 3» frente al módulo final).
function gruposDePesos(modulos) {
  const grupos = []
  for (const m of modulos) {
    if (m.sin_plantilla || !m.evaluaciones?.length) continue
    const firma = m.evaluaciones.map((e) => `${e.nombre}:${e.peso}:${e.peso_participacion ?? ''}`).join('|')
    let g = grupos.find((x) => x.firma === firma)
    if (!g) {
      g = { firma, modulos: [], evaluaciones: m.evaluaciones }
      grupos.push(g)
    }
    g.modulos.push(m)
  }
  return grupos
}

function TablaPesos({ g }) {
  const total = sumaPesos(g.evaluaciones)
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-900">{nombreModulos(g.modulos)}</h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2">Component</th>
              <th className="px-3 py-2 text-right">Worth</th>
              <th className="px-3 py-2">What is assessed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {g.evaluaciones.map((e) => (
              <tr key={e.nombre}>
                <td className="px-3 py-2 font-medium text-slate-900">{e.nombre}</td>
                <td className="px-3 py-2 text-right">{fmtNota(e.peso)} {total === 100 ? '%' : 'pts'}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{QUE_MIDE[e.tipo] ?? ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 text-sm font-semibold text-slate-900">
            <tr>
              <td className="px-3 py-2">Module total</td>
              <td className="px-3 py-2 text-right">{fmtNota(total)} {total === 100 ? '%' : 'pts'}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

function Formative({ pp }) {
  const part = Number(pp) || 0
  return (
    <section className="space-y-2 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
      <h3 className="font-semibold">How the Formative Assessment is calculated</h3>
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          In each of the <strong>3 units</strong> your teacher assesses <strong>5 elements of equal value</strong> (those in your course's Formative rubric), so each unit is worth up to 100.
        </li>
        <li>The 3 units are averaged.</li>
        {part > 0 && (
          <li>
            Your <strong>class participation</strong> (classes you met ÷ module classes × 100) weighs <strong>{fmtNota(part)} %</strong> of the Formative.
          </li>
        )}
      </ol>
      <p className="rounded-lg bg-white/70 px-3 py-2 font-medium">
        Formative = {part > 0 ? `${fmtNota(100 - part)} % × unit average + ${fmtNota(part)} % × participation` : 'average of the 3 units'}
      </p>
      {part > 0 && (
        <p className="text-xs">
          Ejemplo: unidades 80, 90 y 70 (promedio 80) y participación en 6 de 8 clases (75): {fmtNota(100 - part)} % × 80 + {fmtNota(part)} % × 75 = <strong>{fmtNota(Math.round(((100 - part) * 80 + part * 75)) / 100)}</strong>.
        </p>
      )}
    </section>
  )
}

// Explica al estudiante cómo se calcula su nota, con los pesos REALES de su curso (salen de las plantillas, no son un texto fijo).
export function ExplicacionContenido({ modulos }) {
  const grupos = gruposDePesos(modulos)
  const pp = modulos.flatMap((m) => m.evaluaciones ?? []).find((e) => e.tipo === 'formative' && Number(e.peso_participacion) > 0)?.peso_participacion
  const hayFormative = modulos.some((m) => (m.evaluaciones ?? []).some((e) => e.tipo === 'formative'))
  if (grupos.length === 0) return <p className="text-sm text-slate-500">Your course has no assessment components configured yet.</p>
  return (
    <div className="space-y-4 text-sm text-slate-700">
      <section className="space-y-1">
        <h3 className="font-semibold text-slate-900">1. Your grade for each module</h3>
        <p>
          Each component is graded from 0 to 100 and <strong>contributes according to its weight</strong>: contribution = weight × grade ÷ 100. The sum of the contributions is your module grade.
        </p>
        <p className="text-xs text-slate-500">Example: a component worth 28 % in which you score 75 contributes 28 × 75 ÷ 100 = 21 points.</p>
      </section>
      {grupos.map((g) => (
        <TablaPesos key={g.firma} g={g} />
      ))}
      {hayFormative && <Formative pp={pp} />}
      <section className="space-y-1">
        <h3 className="font-semibold text-slate-900">2. Result per cycle</h3>
        <p>The cycle grade gathers the points of its modules and is expressed out of 100.</p>
      </section>
      <section className="space-y-1">
        <h3 className="font-semibold text-slate-900">3. What has not been assessed yet does not count as zero</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>You only see grades <strong>published</strong> by your teacher. Until then the component shows as pending.</li>
          <li>A component counts once it is complete (for example, the Formative needs its 3 units{Number(pp) > 0 ? ' and your participation' : ''}). Meanwhile your result is marked <strong>partial</strong> and calculated only on what has been assessed.</li>
          <li>Your attendance is recorded separately and does not count toward the grade.</li>
          <li>If a grade is corrected, the reason is recorded.</li>
        </ul>
      </section>
    </div>
  )
}

export default function ComoMeEvaluan({ modulos, className = '' }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <Button variant="secondary" className={`px-3 py-1 text-xs ${className}`} onClick={() => setAbierto(true)} aria-haspopup="dialog">
        How am I assessed?
      </Button>
      {abierto && (
        <Modal title="How is my grade calculated?" onClose={() => setAbierto(false)} wide>
          <ExplicacionContenido modulos={modulos} />
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={() => setAbierto(false)}>
              Got it
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
