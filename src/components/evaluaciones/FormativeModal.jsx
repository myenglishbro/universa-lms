import { useState } from 'react'
import Badge from '../ui/Badge'
import Modal from '../ui/Modal'
import { fmtNota } from '../../lib/evaluaciones'
import * as servicioReal from '../../services/evaluaciones'
import { ContenidoCelda } from './CeldaNota'
import { ContenidoParticipacion } from './ParticipacionModal'

// Resumen en vivo del Formative de un estudiante: las 3 unidades, la participación y la nota que resulta.
export function ResumenFormative({ celda }) {
  if (!celda || celda.tipo !== 'formative') return null
  const part = celda.participacion
  const pp = Number(celda.peso_participacion) || 0
  return (
    <div className="space-y-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900" role="status" aria-label="Resumen del Formative">
      <ul className="grid gap-2 sm:grid-cols-3">
        {celda.unidades.map((u) => (
          <li key={u.unidad} className="rounded-lg bg-white/70 px-3 py-2">
            <p className="text-xs text-brand-700">{u.unidad}</p>
            <p className="font-semibold">
              {u.puntaje == null ? '—' : fmtNota(u.puntaje)} <span className="text-[10px] font-normal text-slate-500">{u.estado === 'publicada' ? 'publicada' : u.estado === 'borrador' ? 'borrador' : 'sin nota'}</span>
            </p>
          </li>
        ))}
      </ul>
      <p>
        Promedio de unidades: <strong>{celda.promedio_unidades == null ? '—' : fmtNota(celda.promedio_unidades)}</strong>
        {part?.aplica && (
          <>
            {' '}
            · Participación ({fmtNota(pp)} %): <strong>{part.puntaje == null ? '—' : fmtNota(part.puntaje)}</strong>{' '}
            <span className="text-xs">
              ({part.cumplidas} cumplidas de {part.registradas} registradas · {part.total} clases en el módulo{part.publicada ? ' · publicada' : ''})
            </span>
          </>
        )}
      </p>
      <p>
        {celda.provisional ? 'Avance provisional del Formative' : 'Nota del Formative'}: <strong>{celda.puntaje == null ? '—' : `${fmtNota(celda.puntaje)}/100`}</strong>
        {celda.aporte != null && <> · aporta {fmtNota(celda.aporte)} puntos al módulo</>}
        {celda.provisional && <Badge color="peach">Aún no suma al módulo</Badge>}
      </p>
      {celda.provisional && <p className="text-xs text-brand-800">Cuenta para el módulo cuando estén publicadas las 3 unidades{part?.aplica ? ' y la participación' : ''}. Lo que falta no se cuenta como cero.</p>}
    </div>
  )
}

// Ficha del Formative de un estudiante: pestaña «Unidades» (5 criterios por unidad) y pestaña «Participación» (clases del módulo).
export default function FormativeModal({ evaluacionId, alumnoId, titulo, celda, servicio = servicioReal, onClose, onCambio }) {
  const conParticipacion = celda?.participacion?.aplica !== false
  const [pestana, setPestana] = useState('unidades')
  return (
    <Modal title={titulo} onClose={onClose} wide>
      <div className="space-y-4">
        <ResumenFormative celda={celda} />
        {conParticipacion && (
          <div className="flex gap-1" role="tablist" aria-label="Partes del Formative">
            {[['unidades', 'Unidades (5 criterios)'], ['participacion', 'Participación por clase']].map(([id, t]) => (
              <button
                key={id}
                role="tab"
                aria-selected={pestana === id}
                onClick={() => setPestana(id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${pestana === id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        {pestana === 'unidades' || !conParticipacion ? (
          <ContenidoCelda evaluacionId={evaluacionId} alumnoId={alumnoId} servicio={servicio} onClose={onClose} onCambio={onCambio} />
        ) : (
          <ContenidoParticipacion evaluacionId={evaluacionId} alumnoId={alumnoId} servicio={servicio} onClose={onClose} onCambio={onCambio} />
        )}
      </div>
    </Modal>
  )
}
