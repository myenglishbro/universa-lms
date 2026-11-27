import { useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { horaLima } from '../../lib/horasDocentes'

// Entrada y salida del docente en una clase. El docente del salón marca (la hora la pone el servidor y se abre el Zoom);
// administración solo la ve. Entrar antes de la hora no es problema: se guarda la hora real.
export default function MarcaDocente({ clase, marca, hoy, puedeMarcar, servicio, onCambio }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const cancelada = clase.estado === 'cancelada'

  // El Zoom se abre en una pestaña que se crea en el mismo clic (si no, el navegador bloquea la ventana emergente).
  const ejecutar = async (accion) => {
    setOcupado(true)
    setError('')
    setAviso('')
    const w = accion.zoom ? window.open('', '_blank') : null
    try {
      const url = await accion.run()
      if (accion.zoom) {
        if (url && w) w.location.href = url
        else {
          w?.close()
          if (!url) setAviso('The Zoom link is not set yet: ask administration.')
        }
      }
      await onCambio()
    } catch (e) {
      w?.close()
      setError(e.message)
    } finally {
      setOcupado(false)
    }
  }
  const entrar = () => ejecutar({ zoom: true, run: async () => (await servicio.marcarEntrada(clase.sesion_id)).zoom })
  const abrirZoom = () => ejecutar({ zoom: true, run: () => servicio.zoomClase() })
  const salir = () => ejecutar({ run: () => servicio.marcarSalida(clase.sesion_id) })

  const hayMarca = !!marca
  const puedeEntrar = puedeMarcar && !hayMarca && !cancelada && clase.fecha === hoy
  const sinMarca = !hayMarca && !cancelada && clase.fecha < hoy

  if (!hayMarca && !puedeEntrar && !sinMarca) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      {hayMarca && (
        <>
          <span className="inline-flex items-center gap-1 text-slate-600">
            <Icon name="clock" className="h-3.5 w-3.5 text-brand-600" />
            In <strong className="font-semibold text-slate-900">{horaLima(marca.entrada)}</strong>
            <span className="text-slate-400">·</span>
            {marca.salida ? (
              <>
                Out <strong className="font-semibold text-slate-900">{horaLima(marca.salida)}</strong>
              </>
            ) : (
              <span className="text-peach-700">Exit not marked</span>
            )}
          </span>
          {marca.ajustada && <Badge color="slate">Corrected by administration</Badge>}
          {puedeMarcar && !marca.salida && (
            <>
              <Button variant="secondary" className="px-3 py-1 text-xs" onClick={abrirZoom} disabled={ocupado}>
                Open Zoom
              </Button>
              <Button className="px-3 py-1 text-xs" onClick={salir} disabled={ocupado}>
                Mark exit
              </Button>
            </>
          )}
        </>
      )}
      {puedeEntrar && (
        <Button className="px-3 py-1.5 text-xs" onClick={entrar} disabled={ocupado}>
          {ocupado ? 'Marking…' : 'Join class and mark entry'}
        </Button>
      )}
      {sinMarca && <Badge color="peach">No entry mark</Badge>}
      {aviso && <span className="text-peach-700">{aviso}</span>}
      {error && (
        <span role="alert" className="text-rose-700">
          {error}
        </span>
      )}
    </div>
  )
}
