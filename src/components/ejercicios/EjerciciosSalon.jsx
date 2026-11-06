import { useCallback, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Field from '../ui/Field'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import BancoEjercicios from './BancoEjercicios'
import RevisionEjercicio from './RevisionEjercicio'
import useCarga from '../../hooks/useCarga'
import { TONOS, fmtPuntaje, tipoDe } from '../../lib/ejercicios'
import { formatFecha } from '../../lib/salones'
import * as servicioReal from '../../services/ejercicios'

// Pestaña «Ejercicios» de un salón (docente o administración): lo asignado, quién entregó y qué falta revisar.
export default function EjerciciosSalon({ salonId, esAdmin = false, userId, servicio = servicioReal }) {
  const cargar = useCallback(() => servicio.ejerciciosDelSalon(salonId), [servicio, salonId])
  const { datos: lista, cargando, error, recargar } = useCarga(cargar, [])
  const [eligiendo, setEligiendo] = useState(false)
  const [elegido, setElegido] = useState(null)
  const [limite, setLimite] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [falla, setFalla] = useState('')
  const [abierta, setAbierta] = useState(null)

  const cerrar = () => {
    setEligiendo(false)
    setElegido(null)
    setLimite('')
    setFalla('')
  }
  const asignar = async () => {
    setGuardando(true)
    setFalla('')
    try {
      await servicio.asignarEjercicio(elegido.id, salonId, limite)
      cerrar()
      await recargar()
    } catch (e) {
      setFalla(e.message)
    } finally {
      setGuardando(false)
    }
  }
  const quitar = async (a) => {
    if (!window.confirm(`¿Quitar «${a.titulo}» de este salón? Las entregas dejarán de verse.`)) return
    try {
      await servicio.quitarAsignacion(a.id)
      await recargar()
    } catch (e) {
      setFalla(e.message)
    }
  }

  if (abierta) return <RevisionEjercicio asignacionId={abierta} servicio={servicio} onVolver={() => { setAbierta(null); recargar() }} />

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">Asigna ejercicios del banco (o los tuyos) y revisa lo que entregan tus estudiantes.</p>
        <Button onClick={() => setEligiendo(true)}>
          <Icon name="plus" className="h-4 w-4" /> Asignar ejercicio
        </Button>
      </div>
      {falla && !eligiendo && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{falla}</p>}

      {cargando ? (
        <p className="py-10 text-center text-sm text-slate-500">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-red-600">No se pudieron cargar los ejercicios: {error}</p>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-12 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-peach-100 text-peach-700">
            <Icon name="pen" className="h-7 w-7" />
          </span>
          <p className="mt-4 text-base font-semibold text-slate-900">Todavía no hay ejercicios en este salón</p>
          <p className="mt-1 text-sm text-slate-500">Elige uno del banco y tus estudiantes lo verán en su pestaña «Ejercicios».</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {lista.map((a) => {
            const t = tipoDe(a.tipo)
            return (
              <Card key={a.id} className="flex items-center gap-4 p-4">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${TONOS[t.tono]}`}>
                  <Icon name={t.icono} className="h-6 w-6" />
                </span>
                <button type="button" onClick={() => setAbierta(a.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-base font-semibold text-slate-900 hover:text-brand-700">{a.titulo}</p>
                  <p className="text-xs text-slate-500">
                    {t.label} · {a.entregas} de {a.total} entregaron
                    {a.fecha_limite && ` · hasta ${formatFecha(a.fecha_limite)}`}
                    {a.promedio != null && ` · promedio ${fmtPuntaje(a.promedio)}`}
                  </p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${a.total ? Math.round((100 * a.entregas) / a.total) : 0}%` }} />
                  </div>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {a.pendientes > 0 && <Badge color="peach">{a.pendientes} por revisar</Badge>}
                  <button type="button" onClick={() => quitar(a)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Quitar ${a.titulo}`}>
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {eligiendo && !elegido && (
        <Modal title="Elige un ejercicio" onClose={cerrar} wide="xl">
          <BancoEjercicios esAdmin={esAdmin} userId={userId} servicio={servicio} onElegir={setElegido} />
        </Modal>
      )}
      {elegido && (
        <Modal title="Asignar a este salón" onClose={cerrar}>
          <div className="space-y-4">
            <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
              <strong>{elegido.titulo}</strong>
              <span className="block text-xs text-brand-700">{tipoDe(elegido.tipo).label}</span>
            </p>
            <Field label="Fecha límite (opcional)" type="date" value={limite} onChange={(e) => setLimite(e.target.value)} hint="Los estudiantes pueden enviarlo después, pero verán la fecha." />
            {falla && <p role="alert" className="text-sm text-rose-700">{falla}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setElegido(null)}>
                Atrás
              </Button>
              <Button onClick={asignar} disabled={guardando}>
                {guardando ? 'Asignando…' : 'Asignar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
