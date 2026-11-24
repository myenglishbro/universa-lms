import { useMemo, useState } from 'react'
import Card from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import PageHeader from '../../components/ui/PageHeader'
import Visual from '../../components/ayuda/Visuales'
import { GUIAS_DOCENTE, GUIAS_ESTUDIANTE, TEMAS_DOCENTE, TEMAS_ESTUDIANTE } from '../../data/ayuda'

// «**texto**» → negrita. Los textos de ayuda son propios, no entrada de usuarios.
function Texto({ children }) {
  return children.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith('**') ? (
      <strong key={i} className="font-semibold text-slate-900">
        {parte.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{parte}</span>
    ),
  )
}

const MENU = {
  estudiante: ['My courses', 'Student Zone', 'Help', 'My account'],
  docente: ['My classrooms', 'Exercise bank', 'My profile', 'Teacher Zone', 'Help', 'My account'],
}

function Guia({ guia, abierta, onAlternar, rol }) {
  return (
    <Card className="overflow-hidden print:break-inside-avoid print:shadow-none">
      <button type="button" onClick={onAlternar} aria-expanded={abierta} className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50 print:hover:bg-transparent">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Icon name={guia.icono} className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900 sm:text-base">{guia.titulo}</span>
          <span className="block text-xs text-slate-500 sm:text-sm">{guia.resumen}</span>
        </span>
        <Icon name="down" className={`h-5 w-5 shrink-0 text-slate-400 transition-transform print:hidden ${abierta ? 'rotate-180' : ''}`} />
      </button>
      <div className={`${abierta ? 'block' : 'hidden'} border-t border-slate-100 px-4 pb-4 pt-3 print:block`}>
        {guia.ver?.length > 0 && (
          <div className="mb-4 grid gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 sm:grid-cols-2 print:bg-white">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:col-span-2">Where to look</p>
            {guia.ver.map((v, i) => (
              <Visual key={i} v={v} menu={MENU[rol]} />
            ))}
          </div>
        )}
        <ol className="space-y-3">
          {guia.pasos.map((p, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-600">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
              <span className="pt-0.5 leading-relaxed">
                <Texto>{p}</Texto>
              </span>
            </li>
          ))}
        </ol>
        {guia.nota && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-peach-50 px-3 py-2 text-xs text-peach-700 ring-1 ring-peach-200 sm:text-sm">
            <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
            {guia.nota}
          </p>
        )}
      </div>
    </Card>
  )
}

// Centro de ayuda: guías cortas por tema con buscador, y botón para imprimir o guardar todo como PDF.
export default function CentroAyuda({ rol }) {
  const docente = rol === 'docente'
  const temas = docente ? TEMAS_DOCENTE : TEMAS_ESTUDIANTE
  const guias = docente ? GUIAS_DOCENTE : GUIAS_ESTUDIANTE
  const [tema, setTema] = useState('todos')
  const [texto, setTexto] = useState('')
  const [abierta, setAbierta] = useState(guias[0].id)

  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase()
    return guias.filter((g) => (tema === 'todos' || g.tema === tema) && (!q || `${g.titulo} ${g.resumen} ${g.pasos.join(' ')}`.toLowerCase().includes(q)))
  }, [guias, tema, texto])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Help center"
        description={docente ? 'Short guides to use the platform as a teacher' : 'Short guides to use the platform as a student'}
        action={
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 print:hidden">
            <Icon name="doc" className="h-4 w-4" /> Print / save as PDF
          </button>
        }
      />

      <div className="mb-4 space-y-3 print:hidden">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Search a guide: attendance, grades, exam…"
            aria-label="Search guides"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Topics">
          {[{ id: 'todos', label: 'All', icono: 'list' }, ...temas].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tema === t.id}
              onClick={() => setTema(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${tema === t.id ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
            >
              <Icon name={t.icono} className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {visibles.map((g) => (
          <Guia key={g.id} rol={rol} guia={g} abierta={abierta === g.id} onAlternar={() => setAbierta(abierta === g.id ? '' : g.id)} />
        ))}
        {visibles.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">No guide matches your search. Try another word.</p>}
      </div>

      <p className="mt-6 flex items-center gap-2 text-sm text-slate-500 print:hidden">
        <Icon name="mail" className="h-4 w-4" /> Still have a question? Write to administration.
      </p>
    </div>
  )
}
