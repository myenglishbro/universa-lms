import { useState } from 'react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { fmtNota, sumaPesos } from '../../lib/evaluaciones'

// Qué mide cada tipo de componente, en palabras para el estudiante.
const QUE_MIDE = {
  test: 'Examen del módulo.',
  writing: 'Producción escrita, calificada con una rúbrica de 5 criterios.',
  project: 'Proyecto del módulo, calificado con una rúbrica de criterios.',
  spark: 'Tareas de la plataforma SPARK.',
  speaking: 'Expresión oral, calificada con una rúbrica.',
  participacion: 'Participación en las clases del módulo.',
  formative: 'Seguimiento continuo: 3 unidades con 5 habilidades cada una, más tu participación en clase.',
  otro: '',
}

const nombreModulos = (ms) => (ms.length === 1 ? ms[0].nombre : `${ms.slice(0, -1).map((m) => m.nombre).join(', ')} y ${ms[ms.length - 1].nombre}`)

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
              <th className="px-3 py-2">Componente</th>
              <th className="px-3 py-2 text-right">Vale</th>
              <th className="px-3 py-2">Qué se evalúa</th>
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
              <td className="px-3 py-2">Total del módulo</td>
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
      <h3 className="font-semibold">Cómo se calcula el Formative Assessment</h3>
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          En cada una de las <strong>3 unidades</strong> tu docente evalúa <strong>5 elementos con el mismo valor</strong> (los de la rúbrica del Formative de tu curso), así que cada unidad vale hasta 100.
        </li>
        <li>Se promedian las 3 unidades.</li>
        {part > 0 && (
          <li>
            Tu <strong>participación en clase</strong> (clases en las que cumpliste ÷ clases del módulo × 100) pesa el <strong>{fmtNota(part)} %</strong> del Formative.
          </li>
        )}
      </ol>
      <p className="rounded-lg bg-white/70 px-3 py-2 font-medium">
        Formative = {part > 0 ? `${fmtNota(100 - part)} % × promedio de las unidades + ${fmtNota(part)} % × participación` : 'promedio de las 3 unidades'}
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
  if (grupos.length === 0) return <p className="text-sm text-slate-500">Tu curso aún no tiene componentes de evaluación configurados.</p>
  return (
    <div className="space-y-4 text-sm text-slate-700">
      <section className="space-y-1">
        <h3 className="font-semibold text-slate-900">1. Tu nota de cada módulo</h3>
        <p>
          Cada componente se califica de 0 a 100 y <strong>aporta según su peso</strong>: aporte = peso × nota ÷ 100. La suma de los aportes es la nota de tu módulo.
        </p>
        <p className="text-xs text-slate-500">Ejemplo: un componente que vale 28 % y en el que sacas 75 aporta 28 × 75 ÷ 100 = 21 puntos.</p>
      </section>
      {grupos.map((g) => (
        <TablaPesos key={g.firma} g={g} />
      ))}
      {hayFormative && <Formative pp={pp} />}
      <section className="space-y-1">
        <h3 className="font-semibold text-slate-900">2. Resultado por ciclo</h3>
        <p>La nota del ciclo reúne los puntos de sus módulos y se expresa sobre 100.</p>
      </section>
      <section className="space-y-1">
        <h3 className="font-semibold text-slate-900">3. Lo que todavía no se evalúa no cuenta como cero</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Solo ves notas <strong>publicadas</strong> por tu docente. Hasta entonces el componente aparece como pendiente.</li>
          <li>Un componente cuenta cuando está completo (por ejemplo, el Formative necesita sus 3 unidades{Number(pp) > 0 ? ' y tu participación' : ''}). Mientras tanto tu resultado se marca como <strong>parcial</strong> y se calcula solo sobre lo ya evaluado.</li>
          <li>Tu asistencia se registra aparte y no entra en la nota.</li>
          <li>Si una nota se corrige, queda registrado el motivo.</li>
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
        ¿Cómo me evalúan?
      </Button>
      {abierto && (
        <Modal title="¿Cómo se calcula mi nota?" onClose={() => setAbierto(false)} wide>
          <ExplicacionContenido modulos={modulos} />
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={() => setAbierto(false)}>
              Entendido
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
