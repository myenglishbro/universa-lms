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
        {s.tipo === 'recuperacion' && <Badge color="brand">Recuperación</Badge>}
        {s.manual && s.tipo === 'regular' && <Badge>Fecha fijada</Badge>}
        {s.estado === 'realizada' && <Badge color="brand">Realizada</Badge>}
        {cancelada && <Badge>Cancelada</Badge>}
        {cancelada && repuesta && <span className="text-xs text-slate-500">repuesta el {formatFecha(repuesta.fecha)}</span>}
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
              Realizada
            </Button>
          )}
          {s.estado === 'programada' && (
            <>
              <Button variant="ghost" className="px-2 py-1" onClick={() => acciones.cancelar(s)}>
                Cancelar
              </Button>
              <Button variant="ghost" className="px-2 py-1" onClick={() => acciones.reprogramar(s)}>
                Reprogramar
              </Button>
            </>
          )}
          {cancelada && !repuesta && puedeRecuperar && (
            <Button variant="ghost" className="px-2 py-1" onClick={() => acciones.recuperar(s)}>
              Programar recuperación
            </Button>
          )}
          {s.estado !== 'programada' && (
            <Button variant="ghost" className="px-2 py-1" onClick={() => acciones.corregir(s)}>
              Corregir
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
    if (diasFeriado.has(s.fecha)) avisos.push(`Feriado: ${diasFeriado.get(s.fecha)}`)
    for (const c of conflictos.filter((x) => x.sesionId === s.id)) avisos.push(`Docente ocupado en ${c.texto}`)
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
        <Grupo titulo={`Por registrar (${porRegistrar.length}) · sesiones pasadas pendientes de validar`} color="text-peach-700">
          {porRegistrar.map(fila)}
        </Grupo>
      )}
      <Grupo titulo={`Próximas sesiones (${proximas.length})`}>
        {proximas.length === 0 ? <li className="px-4 py-3 text-sm text-slate-400">No hay sesiones próximas programadas.</li> : proximas.map(fila)}
      </Grupo>
      {historial.length > 0 && (
        <details>
          <summary className="cursor-pointer px-4 py-2 text-xs font-medium uppercase text-slate-500">
            Historial ({historial.length})
          </summary>
          <ul className="divide-y divide-slate-100">{historial.map(fila)}</ul>
        </details>
      )}
    </Card>
  )
}
