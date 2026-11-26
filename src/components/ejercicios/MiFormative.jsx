import { useCallback } from 'react'
import Badge from '../ui/Badge'
import Card from '../ui/Card'
import useCarga from '../../hooks/useCarga'
import { ELEMENTOS, aCien, nota2 } from '../../lib/formativeBanco'
import * as servicioReal from '../../services/ejercicios'

// «Mi Formative»: el estudiante ve en vivo sus 5 elementos por unidad (siempre sobre 100), su avance y la nota de la unidad cuando ya se completó.
// Lo pendiente se muestra como pendiente, nunca como cero.
const entero = (n) => String(Math.round(n * 10) / 10)
const colorNota = (n) => (n >= 70 ? 'bg-emerald-500' : n >= 40 ? 'bg-peach-500' : 'bg-rose-400')

function Unidad({ u }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">{u.unidad}</h4>
        {u.oficial != null ? (
          <Badge color="brand">Unit grade {nota2(u.oficial)} / 100</Badge>
        ) : u.provisional != null ? (
          <Badge color="peach">Avance {nota2(u.provisional)} / 100 · {u.completos} de 5</Badge>
        ) : (
          <Badge color="slate">No grades yet</Badge>
        )}
      </div>
      <ul className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
        {ELEMENTOS.map((h) => {
          const n = aCien(u.elementos?.[h.id]?.valor)
          return (
            <li key={h.id} className="rounded-xl bg-slate-50 px-3 py-2">
              <span className="block text-xs font-medium text-slate-500">{h.label}</span>
              {n == null ? (
                <span className="mt-1 block text-xs italic text-slate-400">Pending</span>
              ) : (
                <>
                  <span className="block">
                    <strong className="text-lg font-bold text-slate-900">{entero(n)}</strong>
                    <span className="text-xs text-slate-400"> / 100</span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <span className={`block h-full rounded-full ${colorNota(n)}`} style={{ width: `${Math.max(0, Math.min(100, n))}%` }} />
                  </span>
                </>
              )}
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
      <h3 className="text-base font-semibold text-slate-900">My Formative</h3>
      <p className="mb-3 text-xs text-slate-500">It updates automatically when you submit your official activities or when your teacher records a grade. When the 5 elements of the unit are complete, it is published in “My grades”.</p>
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
