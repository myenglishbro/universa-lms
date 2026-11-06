import Badge from '../ui/Badge'
import SalonesCards from './SalonesCards'
import { SIN_NIVEL, estados } from '../../lib/salones'

const ORDEN_ESTADO = { en_curso: 0, pendiente: 1, finalizado: 2 }
const TONO = { en_curso: 'brand', pendiente: 'peach', finalizado: 'slate' }

// Salones agrupados por nivel académico (en el orden oficial de los niveles) y, dentro de cada nivel, por estado:
// primero los que están en curso, luego los pendientes y al final los finalizados.
export default function SalonesAgrupados({ salones, niveles, puedeEditar, onVer, onEditar }) {
  const grupos = [
    ...niveles.map((n) => ({ id: n.id, nombre: n.nombre, lista: salones.filter((s) => s.nivelId === n.id) })),
    { id: SIN_NIVEL, nombre: 'Sin nivel asignado', lista: salones.filter((s) => !s.nivelId) },
  ].filter((g) => g.lista.length > 0)

  return (
    <div className="divide-y divide-brand-100">
      {grupos.map((g) => {
        const ordenados = [...g.lista].sort((a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || a.nombre.localeCompare(b.nombre))
        return (
          <section key={g.id} aria-label={`Nivel ${g.nombre}`}>
            <header className="flex flex-wrap items-center gap-2 bg-brand-50/60 px-4 py-3">
              <h2 className="text-base font-bold text-brand-800">{g.nombre}</h2>
              <span className="text-sm text-slate-500">
                {g.lista.length} {g.lista.length === 1 ? 'salón' : 'salones'}
              </span>
              <span className="ml-auto flex flex-wrap gap-1.5">
                {estados.map((e) => {
                  const n = g.lista.filter((s) => s.estado === e.value).length
                  return (
                    n > 0 && (
                      <Badge key={e.value} color={TONO[e.value]}>
                        {n} {e.label.toLowerCase()}
                      </Badge>
                    )
                  )
                })}
              </span>
            </header>
            <SalonesCards salones={ordenados} puedeEditar={puedeEditar} onVer={onVer} onEditar={onEditar} />
          </section>
        )
      })}
    </div>
  )
}
