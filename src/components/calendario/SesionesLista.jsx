import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { formatFechaCorta, numerarSesiones } from '../../lib/calendario'
import { formatFecha, hoyLima } from '../../lib/salones'

function Fila({ s, numero, avisos, repuesta, acciones, puedeRecuperar, ocupado }) {
  const cancelada = s.estado === 'cancelada'
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
      <span className="w-8 text-slate-400">{numero ? `#${numero}` : '—'}</span>
      <span className={`w-20 font-medium ${cancelada ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
        {formatFechaCorta(s.fecha)}
      </span>
      <span className="w-28 text-slate-600">
        {s.horaInicio}–{s.horaFin}
      </span>
      <span className="flex flex-1 flex-wrap items-center gap-1.5">
        {s.tipo === 'recuperacion' && <Badge color="brand">Make-up</Badge>}
        {s.manual && s.tipo === 'regular' && <Badge>Date pinned</Badge>}
        {s.estado === 'realizada' && <Badge color="brand">Held</Badge>}
        {cancelada && <Badge>Cancelled</Badge>}
        {cancelada && repuesta && <span className="text-xs text-slate-500">made up on {formatFecha(repuesta.fecha)}</span>}
        {avisos.map((a) => (
          <Badge key={a} color="peach">
            {a}
          </Badge>
        ))}
      </span>
      {acciones && (
        <span className="flex gap-1">
          {s.estado === 'programada' && s.fecha <= hoyLima() && (
            <Button variant="ghost" className="px-2 py-1" disabled={ocupado} onClick={() => acciones.realizada(s)}>
              Held
            </Button>
          )}
          {s.estado === 'programada' && (
            <>
              <Button variant="ghost" className="px-2 py-1" onClick={() => acciones.cancelar(s)}>
                Cancel
              </Button>
              <Button variant="ghost" className="px-2 py-1" onClick={() => acciones.reprogramar(s)}>
                Reschedule
              </Button>
            </>
          )}
          {cancelada && !repuesta && puedeRecuperar && (
            <Button variant="ghost" className="px-2 py-1" onClick={() => acciones.recuperar(s)}>
              Schedule make-up
            </Button>
          )}
          {s.estado !== 'programada' && (
            <Button variant="ghost" className="px-2 py-1" onClick={() => acciones.corregir(s)}>
              Correct
            </Button>
          )}
        </span>
      )}
    </li>
  )
}

function Grupo({ titulo, color, children }) {
  return (
    <div>
      <h3 className={`border-b border-slate-100 px-4 py-2 text-xs font-medium uppercase ${color ?? 'text-slate-500'}`}>{titulo}</h3>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </div>
  )
}

// acciones: null para solo lectura (rol comercial).
export default function SesionesLista({ sesiones, conflictos, feriados, sinProgramar, acciones, ocupado }) {
  const hoy = hoyLima()
  const numeros = numerarSesiones(sesiones)
  const diasFeriado = new Map(feriados.map((f) => [f.fecha, f.nombre]))
  const repuestas = new Map(sesiones.filter((s) => s.recuperaA && s.estado !== 'cancelada').map((s) => [s.recuperaA, s]))

  const avisosDe = (s) => {
    if (s.estado !== 'programada') return []
    const avisos = []
    if (diasFeriado.has(s.fecha)) avisos.push(`Holiday: ${diasFeriado.get(s.fecha)}`)
    for (const c of conflictos.filter((x) => x.sesionId === s.id)) avisos.push(`Teacher busy with ${c.texto}`)
    return avisos
  }

  const fila = (s) => (
    <Fila
      key={s.id}
      s={s}
      numero={numeros.get(s.id)}
      avisos={avisosDe(s)}
      repuesta={repuestas.get(s.id)}
      acciones={acciones}
      puedeRecuperar={sinProgramar > 0}
      ocupado={ocupado}
    />
  )

  const porRegistrar = sesiones.filter((s) => s.estado === 'programada' && s.fecha < hoy)
  const proximas = sesiones.filter((s) => s.estado === 'programada' && s.fecha >= hoy)
  const historial = sesiones.filter((s) => s.estado !== 'programada').sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <Card className="mt-4 divide-y divide-slate-200">
      {porRegistrar.length > 0 && (
        <Grupo titulo={`To record (${porRegistrar.length}) · past sessions pending confirmation`} color="text-peach-700">
          {porRegistrar.map(fila)}
        </Grupo>
      )}
      <Grupo titulo={`Upcoming sessions (${proximas.length})`}>
        {proximas.length === 0 ? <li className="px-4 py-3 text-sm text-slate-400">There are no upcoming sessions scheduled.</li> : proximas.map(fila)}
      </Grupo>
      {historial.length > 0 && (
        <details>
          <summary className="cursor-pointer px-4 py-2 text-xs font-medium uppercase text-slate-500">
            History ({historial.length})
          </summary>
          <ul className="divide-y divide-slate-100">{historial.map(fila)}</ul>
        </details>
      )}
    </Card>
  )
}
