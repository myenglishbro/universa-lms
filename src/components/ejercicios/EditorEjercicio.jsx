import Button from '../ui/Button'
import Field from '../ui/Field'
import Icon from '../ui/Icon'
import { audioDriveEmbed, claveLista, itemVacio } from '../../lib/ejercicios'

const LETRAS = 'ABCDEFGH'

function Fila({ n, onQuitar, puedeQuitar, children }) {
  return (
    <li className="relative rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">{n}</span>
        {puedeQuitar && (
          <button type="button" onClick={onQuitar} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove item ${n}`}>
            <Icon name="trash" className="h-4 w-4" />
          </button>
        )}
      </div>
      {children}
    </li>
  )
}

// Editor visual del contenido de un ejercicio. Trabaja sobre el formato de autoría (con respuestas).
export default function EditorEjercicio({ tipo, datos, onChange }) {
  const lista = claveLista(tipo)
  const poner = (campo, valor) => onChange({ ...datos, [campo]: valor })
  const ponerItem = (i, nuevo) => poner(lista, datos[lista].map((x, j) => (j === i ? nuevo : x)))
  const agregar = () => poner(lista, [...datos[lista], itemVacio(tipo)])
  const quitar = (i) => poner(lista, datos[lista].filter((_, j) => j !== i))

  const etiquetaAgregar = { multiple_choice: 'Add question', listening: 'Add question', fill_gap: 'Add sentence', matching: 'Add pair', order_sentences: 'Add sentence', reading: 'Add statement' }[tipo]

  return (
    <div className="space-y-4">
      <Field label="Instructions for the student" value={datos.instrucciones ?? ''} onChange={(e) => poner('instrucciones', e.target.value)} placeholder="E.g. Choose the correct option." />

      {tipo === 'listening' && (
        <div>
          <Field
            label="Audio link on Google Drive"
            value={datos.audio_url ?? ''}
            onChange={(e) => poner('audio_url', e.target.value)}
            placeholder="https://drive.google.com/file/d/…/view"
            hint="In Drive: share → “Anyone with the link” → copy link."
          />
          {audioDriveEmbed(datos.audio_url) && (
            <iframe title="Audio preview" src={audioDriveEmbed(datos.audio_url)} allow="autoplay" className="mt-2 h-28 w-full rounded-xl border border-brand-100 bg-slate-50" />
          )}
        </div>
      )}

      {tipo === 'reading' && (
        <Field as="textarea" rows={7} label="Reading text" value={datos.texto ?? ''} onChange={(e) => poner('texto', e.target.value)} placeholder="Paste or write the text the student will read." />
      )}

      {(tipo === 'writing' || tipo === 'speaking') && (
        <>
          <Field as="textarea" rows={4} label="Prompt" value={datos.consigna ?? ''} onChange={(e) => poner('consigna', e.target.value)} placeholder={tipo === 'writing' ? 'Write an email to a friend about…' : 'Talk about your last holiday for one minute…'} />
          {tipo === 'writing' ? (
            <Field label="Suggested minimum words" type="number" min="0" value={datos.min_palabras ?? 0} onChange={(e) => poner('min_palabras', e.target.value)} className="max-w-48" />
          ) : (
            <Field label="Maximum recording length (seconds)" type="number" min="15" max="300" value={datos.segundos_max ?? 90} onChange={(e) => poner('segundos_max', e.target.value)} className="max-w-64" />
          )}
          <p className="rounded-xl bg-peach-50 px-4 py-3 text-sm text-peach-700">This exercise is not graded automatically: the teacher reviews it, grades it and leaves comments.</p>
        </>
      )}

      {lista && (
        <ul className="space-y-3">
          {datos[lista].map((it, i) => (
            <Fila key={i} n={i + 1} puedeQuitar={datos[lista].length > 1} onQuitar={() => quitar(i)}>
              {(tipo === 'multiple_choice' || tipo === 'listening') && (
                <div className="space-y-2">
                  <Field label="Question" value={it.enunciado} onChange={(e) => ponerItem(i, { ...it, enunciado: e.target.value })} />
                  <fieldset>
                    <legend className="mb-1 text-sm font-medium text-slate-700">Opciones (marca la correcta)</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {it.opciones.map((o, k) => (
                        <label key={k} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${it.correcta === k ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                          <input type="radio" name={`correcta-${i}`} checked={it.correcta === k} onChange={() => ponerItem(i, { ...it, correcta: k })} aria-label={`Option ${LETRAS[k]} is the correct one`} />
                          <span className="text-xs font-semibold text-slate-500">{LETRAS[k]}</span>
                          <input
                            value={o}
                            onChange={(e) => ponerItem(i, { ...it, opciones: it.opciones.map((x, j) => (j === k ? e.target.value : x)) })}
                            className="w-full min-w-0 border-0 bg-transparent p-0 text-sm focus:outline-none focus:ring-0"
                            placeholder={`Option ${LETRAS[k]}`}
                          />
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}

              {tipo === 'fill_gap' && (
                <Field
                  label="Sentence"
                  value={it.texto}
                  onChange={(e) => ponerItem(i, { texto: e.target.value })}
                  placeholder="She [[goes]] to school every day."
                  hint="Put the answer between [[ ]]. Several valid answers: [[are|'re]]."
                  error={it.texto && !/\[\[[^\]]+\]\]/.test(it.texto) ? 'Missing gap: write the answer between [[ ]]' : undefined}
                />
              )}

              {tipo === 'matching' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Elemento" value={it.izq} onChange={(e) => ponerItem(i, { ...it, izq: e.target.value })} />
                  <Field label="Its pair" value={it.der} onChange={(e) => ponerItem(i, { ...it, der: e.target.value })} />
                </div>
              )}

              {tipo === 'order_sentences' && (
                <Field label="Correct sentence" value={it} onChange={(e) => ponerItem(i, e.target.value)} placeholder="She goes to school every day." hint="Students will receive its words shuffled." />
              )}

              {tipo === 'reading' && (
                <div className="space-y-2">
                  <Field label="Statement" value={it.enunciado} onChange={(e) => ponerItem(i, { ...it, enunciado: e.target.value })} />
                  <div className="flex gap-2" role="group" aria-label="Is it true or false?">
                    {[
                      [true, 'Verdadera'],
                      [false, 'Falsa'],
                    ].map(([v, t]) => (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={it.verdadero === v}
                        onClick={() => ponerItem(i, { ...it, verdadero: v })}
                        className={`rounded-full border px-4 py-1.5 text-sm font-medium ${it.verdadero === v ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Fila>
          ))}
        </ul>
      )}
      {lista && (
        <Button type="button" variant="secondary" onClick={agregar}>
          <Icon name="plus" className="h-4 w-4" /> {etiquetaAgregar}
        </Button>
      )}
    </div>
  )
}

