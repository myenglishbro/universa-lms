import { useCallback } from 'react'
import Badge from '../ui/Badge'
import Card from '../ui/Card'
import useCarga from '../../hooks/useCarga'
import { ELEMENTOS, nota2 } from '../../lib/formativeBanco'
import * as servicioReal from '../../services/ejercicios'

// «Mi Formative»: el estudiante ve en vivo sus 5 elementos por unidad (de 0 a 5), su avance y la nota de la unidad cuando ya se completó.
// Lo pendiente se muestra como pendiente, nunca como cero.
function Unidad({ u }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">{u.unidad}</h4>
        {u.oficial != null ? (
          <Badge color="brand">Nota de la unidad {nota2(u.oficial)} / 100</Badge>
        ) : u.provisional != null ? (
          <Badge color="peach">Avance {nota2(u.provisional)} / 100 · {u.completos} de 5</Badge>
        ) : (
          <Badge color="slate">Sin notas todavía</Badge>
        )}
      </div>
      <ul className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-5">
        {ELEMENTOS.map((h) => {
          const el = u.elementos?.[h.id]
          return (
            <li key={h.id} className="flex items-baseline justify-between gap-2 sm:block">
              <span className="text-xs text-slate-500">{h.label}</span>
              <span className="block">
                {el?.valor == null ? <span className="text-xs italic text-slate-400">pendiente</span> : <strong className="text-slate-900">{nota2(el.valor)}</strong>}
                {el?.valor != null && <span className="text-xs text-slate-400"> / 5</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function MiFormative({ salonId, servicio = servicioReal }) {
  const cargar = useCallback(() => servicio.miFormative(salonId), [servicio, salonId])
  const { datos, error } = useCarga(cargar, null)
  // Sin módulos con Formative (o si no carga) no se muestra nada: no estorba a la lista de ejercicios.
  if (error || !datos || datos.length === 0) return null
  return (
    <Card className="mb-5 p-4">
      <h3 className="text-base font-semibold text-slate-900">Mi Formative</h3>
      <p className="mb-3 text-xs text-slate-500">Se actualiza sola cuando entregas tus actividades oficiales o cuando tu docente registra una nota. Cuando los 5 elementos de la unidad están completos, se publica en «Mis calificaciones».</p>
      <div className="space-y-4">
        {datos.map((m) => (
          <section key={m.evaluacion_id}>
            {datos.length > 1 && <p className="mb-1 text-xs font-medium uppercase text-brand-700">{m.modulo}</p>}
            <div className="space-y-2">
              {m.unidades.map((u) => (
                <Unidad key={u.unidad} u={u} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Card>
  )
}
