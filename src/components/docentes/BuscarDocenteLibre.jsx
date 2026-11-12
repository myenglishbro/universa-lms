import { useEffect, useMemo, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import { aConjunto, cubreHorarios } from '../../lib/disponibilidad'
import { tiposReserva, tituloReserva } from '../../lib/reservas'
import { formatFecha, hoyLima } from '../../lib/salones'
import { cancelarReserva, crearReserva, listarReservas } from '../../services/reservas'
import { disponibilidadDocentes } from '../../services/registros'
import { docentesOcupadosFranja } from '../../services/salones'

const diaIso = (fecha) => new Date(`${fecha}T00:00:00`).getDay() || 7 // 0 (domingo) → 7
const reservaVacia = { tipo: 'examen_nivel', titulo: '' }

// Buscador de docente libre: se indica una fecha y una franja (examen de nivel, entrevista…) y sale quién puede tomarla.
// Libre = activo, sin clase particular, sesión de salón ni reserva que se cruce, y con la disponibilidad que marcó cubriendo la franja.
// Los que no registraron disponibilidad se listan aparte: no tienen clase en ese momento, pero no se pudo comprobar su horario.
// Desde aquí se reserva: la reserva ocupa al docente como una clase (no podrá recibir otra a esa hora) hasta que se cancele.
// La base de datos vuelve a validar todo al reservar, así que dos personas no pueden reservar al mismo docente a la vez.
export default function BuscarDocenteLibre({ docentes, salones, onVerDocente, onClose }) {
  const [v, setV] = useState({ fecha: hoyLima(), inicio: '10:00', fin: '11:00' })
  const [disp, setDisp] = useState(null) // Map docenteId -> Set de franjas
  const [ocupados, setOcupados] = useState(null) // Map docenteId -> [textos]
  const [reservas, setReservas] = useState(null) // reservas programadas desde hoy
  const [error, setError] = useState('')
  const [reservando, setReservando] = useState(null) // { d, aviso }: docente al que se le arma una reserva
  const [datosReserva, setDatosReserva] = useState(reservaVacia)
  const [guardando, setGuardando] = useState(false)
  const [errorReserva, setErrorReserva] = useState('')
  const [cancelando, setCancelando] = useState('')
  const [version, setVersion] = useState(0) // sube al reservar o cancelar: vuelve a consultar quién está ocupado
  const cambiar = (e) => setV((x) => ({ ...x, [e.target.name]: e.target.value }))

  const valido = Boolean(v.fecha && v.inicio && v.fin && v.fin > v.inicio)

  useEffect(() => {
    let vigente = true
    disponibilidadDocentes()
      .then((filas) => {
        if (!vigente) return
        const por = new Map()
        for (const f of filas) por.set(f.docente_id, [...(por.get(f.docente_id) ?? []), f])
        setDisp(new Map([...por].map(([id, fs]) => [id, aConjunto(fs)])))
      })
      .catch(() => vigente && setDisp(new Map()))
    return () => {
      vigente = false
    }
  }, [])

  useEffect(() => {
    if (!valido) return undefined
    let vigente = true
    const t = setTimeout(() => {
      docentesOcupadosFranja(v.fecha, v.inicio, v.fin)
        .then((m) => {
          if (!vigente) return
          setOcupados(m)
          setError('')
        })
        .catch((e) => vigente && setError(e.message))
    }, 300)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [valido, v.fecha, v.inicio, v.fin, version])

  useEffect(() => {
    let vigente = true
    listarReservas(hoyLima())
      .then((r) => vigente && setReservas(r))
      .catch(() => vigente && setReservas([]))
    return () => {
      vigente = false
    }
  }, [version])

  // Al cambiar la fecha u hora se descarta la reserva a medio armar: ya no corresponde a lo que se ve.
  useEffect(() => {
    setReservando(null)
    setErrorReserva('')
  }, [v.fecha, v.inicio, v.fin])

  const reservar = async () => {
    setGuardando(true)
    setErrorReserva('')
    try {
      await crearReserva({ docenteId: reservando.d.id, fecha: v.fecha, horaInicio: v.inicio, horaFin: v.fin, ...datosReserva })
      setReservando(null)
      setDatosReserva(reservaVacia)
      setVersion((x) => x + 1)
    } catch (e) {
      setErrorReserva(e.message)
      setVersion((x) => x + 1) // por si el choque vino de un cambio reciente: se refresca la lista
    } finally {
      setGuardando(false)
    }
  }

  const cancelar = async (id) => {
    setCancelando(id)
    setError('')
    try {
      await cancelarReserva(id)
      setVersion((x) => x + 1)
    } catch (e) {
      setError(e.message)
    } finally {
      setCancelando('')
    }
  }

  const carga = useMemo(() => {
    const m = new Map()
    for (const s of salones) if (s.docenteId && s.estado !== 'finalizado') m.set(s.docenteId, (m.get(s.docenteId) ?? 0) + 1)
    return m
  }, [salones])

  const grupos = useMemo(() => {
    const g = { libres: [], sinDatos: [], ocupados: [], noDisponibles: [] }
    if (!valido || !ocupados || !disp) return g
    const franja = [{ dia: diaIso(v.fecha), horaInicio: v.inicio, horaFin: v.fin }]
    for (const d of docentes) {
      if (!d.activo) continue
      const n = carga.get(d.id) ?? 0
      if (ocupados.has(d.id)) {
        g.ocupados.push({ d, n, motivo: ocupados.get(d.id).join(', ') })
        continue
      }
      const franjas = disp.get(d.id)
      if (!franjas) g.sinDatos.push({ d, n })
      else if (cubreHorarios(franjas, franja)) g.libres.push({ d, n })
      else g.noDisponibles.push({ d, n })
    }
    const orden = (a, b) => a.n - b.n || a.d.nombre.localeCompare(b.d.nombre)
    for (const k of Object.keys(g)) g[k].sort(orden)
    return g
  }, [valido, ocupados, disp, docentes, carga, v.fecha, v.inicio, v.fin])

  const cargando = valido && (ocupados === null || disp === null) && !error

  // `aviso` indefinido = no se puede reservar (docente ocupado); '' = reservable sin advertencia; texto = reservable con advertencia.
  const bloque = (titulo, color, items, { nota, vacio, aviso } = {}) =>
    items.length === 0 && !vacio ? null : (
      <section className="mt-4" key={titulo}>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
          {titulo} <Badge color={color}>{items.length}</Badge>
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">{vacio}</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map(({ d, n, motivo }) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <button type="button" onClick={() => onVerDocente?.(d.id)} className="font-medium text-slate-900 hover:text-brand-700">
                    {d.nombre}
                  </button>
                  <p className="text-xs text-slate-500">{motivo ? `Busy: ${motivo}` : nota}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{n === 0 ? 'No classrooms' : `${n} active ${n === 1 ? 'classroom' : 'classrooms'}`}</span>
                  {aviso !== undefined && (
                    <Button variant="secondary" className="px-3 py-1" onClick={() => setReservando({ d, aviso })}>
                      Reserve
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    )

  return (
    <Modal wide="lg" title="Find a free teacher" onClose={onClose}>
      <p className="mb-4 text-sm text-slate-600">
        Enter the day and time you need (placement test, interview, meeting…) and you will see which teachers have no class at that moment. You can reserve them: while
        the reservation exists, no other class can be assigned to them at that time.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date" name="fecha" type="date" min={hoyLima()} value={v.fecha} onChange={cambiar} />
        <Field label="From" name="inicio" type="time" value={v.inicio} onChange={cambiar} />
        <Field label="To" name="fin" type="time" value={v.fin} onChange={cambiar} error={v.fin <= v.inicio ? 'Must be after the start' : undefined} />
      </div>

      {error && <p className="mt-3 text-sm text-red-600">Could not complete: {error}</p>}
      {cargando && <p className="mt-6 text-center text-sm text-slate-500">Searching…</p>}

      {valido && !cargando && !error && ocupados && disp && (
        <>
          <p className="mt-4 text-xs text-slate-500">
            {formatFecha(v.fecha)} · {v.inicio}–{v.fin}
          </p>
          {bloque('Free and available', 'brand', grupos.libres, {
            nota: 'Marked this slot as available',
            vacio: 'No teacher has this slot marked as available and free of classes.',
            aviso: '',
          })}
          {bloque('No class, but no availability on record', 'slate', grupos.sinDatos, {
            nota: 'No class at that time; confirm with the teacher.',
            aviso: 'They have not registered their availability: confirm with the teacher that they can.',
          })}
          {bloque('No class, but marked as not available', 'slate', grupos.noDisponibles, {
            nota: 'Their weekly availability does not cover this slot.',
            aviso: 'The teacher marked that they are NOT available at that time.',
          })}
          {bloque('Busy', 'peach', grupos.ocupados)}
        </>
      )}

      {reservando && (
        <section className="mt-5 rounded-2xl border border-brand-200 bg-brand-50/50 p-4" aria-label="New reservation">
          <h3 className="text-sm font-semibold text-slate-900">
            Reserve {reservando.d.nombre} · {formatFecha(v.fecha)} · {v.inicio}–{v.fin}
          </h3>
          {reservando.aviso && <p className="mt-1 text-sm text-peach-700">{reservando.aviso}</p>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Type" name="tipo" value={datosReserva.tipo} onChange={(e) => setDatosReserva((x) => ({ ...x, tipo: e.target.value }))} options={tiposReserva} />
            <Field
              label={datosReserva.tipo === 'otro' ? 'Reason' : 'Details (optional)'}
              name="titulo"
              value={datosReserva.titulo}
              onChange={(e) => setDatosReserva((x) => ({ ...x, titulo: e.target.value }))}
              placeholder="E.g.: Jane Smith"
            />
          </div>
          {errorReserva && <p className="mt-3 text-sm text-red-600">{errorReserva}</p>}
          <div className="mt-3 flex gap-2">
            <Button onClick={reservar} disabled={guardando || (datosReserva.tipo === 'otro' && !datosReserva.titulo.trim())}>
              {guardando ? 'Reserving…' : 'Confirm reservation'}
            </Button>
            <Button variant="ghost" onClick={() => setReservando(null)} disabled={guardando}>
              Cancel
            </Button>
          </div>
        </section>
      )}

      <section className="mt-6 border-t border-slate-100 pt-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
          Upcoming reservations <Badge color="brand">{reservas?.length ?? 0}</Badge>
        </h3>
        {reservas === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : reservas.length === 0 ? (
          <p className="text-sm text-slate-500">There are no reservations scheduled.</p>
        ) : (
          <ul className="space-y-1.5">
            {reservas.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span>
                  <span className="font-medium text-slate-900">{r.docente}</span> · {formatFecha(r.fecha)} {r.hora_inicio}–{r.hora_fin} · {tituloReserva(r)}
                </span>
                <Button variant="ghost" className="px-3 py-1 text-xs" disabled={cancelando === r.id} onClick={() => cancelar(r.id)}>
                  {cancelando === r.id ? 'Cancelling…' : 'Cancel reservation'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Modal>
  )
}
