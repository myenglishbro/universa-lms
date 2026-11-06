import { useEffect, useState } from 'react'
import DocenteForm from '../components/docentes/DocenteForm'
import CuentaAcceso from '../components/portal/CuentaAcceso'
import GrillaDisponibilidad from '../components/disponibilidad/GrillaDisponibilidad'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { inputClass } from '../components/ui/Field'
import Icon from '../components/ui/Icon'
import PageHeader from '../components/ui/PageHeader'
import { diaMes, nombreDia, sumarDias } from '../lib/agenda'
import { aConjunto, resumenDisponibilidad } from '../lib/disponibilidad'
import { minutosTexto } from '../lib/paquetes'
import { formatFecha, hoyLima } from '../lib/salones'
import { listarAgenda } from '../services/agenda'
import * as servicioReal from '../services/personas'
import { disponibilidadDocentes, perfilesDocentes } from '../services/registros'

const DIAS_PROXIMOS = 14

// Docentes: consulta, alta y edición; muestra sus salones, paquetes privados y próximas clases (de la Agenda).
export default function Docentes({ data, paquetes, puedeEditar, docenteInicialId = null, onVerSalon, onVerPaquete, onVerAgenda, onCrear, onCambio, cargarAgenda = listarAgenda, servicio = servicioReal }) {
  const { salones, docentes, cargando, error } = data
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('activos')
  const [detalleId, setDetalleId] = useState(docenteInicialId)
  const [form, setForm] = useState(null) // { docente } (null = nuevo)
  const [proximas, setProximas] = useState(null) // null = cargando
  const [perfiles, setPerfiles] = useState(new Map()) // docenteId -> { foto_url, celular }
  const [disp, setDisp] = useState(new Map()) // docenteId -> Set de franjas

  // Foto, celular y disponibilidad que dejó cada docente (si la migración de registros aún no está, la ficha funciona igual).
  useEffect(() => {
    let vigente = true
    Promise.all([perfilesDocentes(), disponibilidadDocentes()])
      .then(([pf, dp]) => {
        if (!vigente) return
        setPerfiles(new Map(pf.map((x) => [x.docente_id, x])))
        const m = new Map()
        for (const f of dp) m.set(f.docente_id, [...(m.get(f.docente_id) ?? []), f])
        setDisp(new Map([...m].map(([id, fs]) => [id, aConjunto(fs)])))
      })
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [])

  const detalle = docentes.find((d) => d.id === detalleId)
  useEffect(() => {
    if (!detalleId) return undefined
    let vigente = true
    const hoy = hoyLima()
    cargarAgenda(hoy, sumarDias(hoy, DIAS_PROXIMOS))
      .then((filas) => vigente && setProximas(filas.filter((f) => f.docente_id === detalleId && f.estado === 'programada')))
      .catch(() => vigente && setProximas([]))
    return () => {
      vigente = false
      setProximas(null)
    }
  }, [detalleId, cargarAgenda])

  const texto = busqueda.trim().toLowerCase()
  const visibles = docentes.filter(
    (d) => (filtro === 'todos' || (filtro === 'activos' ? d.activo : !d.activo)) && (!texto || `${d.nombre} ${d.correo ?? ''}`.toLowerCase().includes(texto)),
  )
  const salonesDe = (id) => salones.filter((s) => s.docenteId === id)

  const guardar = async (v) => {
    if (form.docente) await servicio.editarDocente(form.docente.id, v)
    else {
      const nuevo = await onCrear(v)
      setDetalleId(nuevo.id)
    }
    await onCambio()
    setForm(null)
  }

  const misSalones = detalle ? salonesDe(detalle.id) : []
  const misPaquetes = detalle ? paquetes.filter((p) => p.docente_id === detalle.id && p.estado === 'activo') : []

  return (
    <>
      {detalle ? (
        <>
          <button onClick={() => setDetalleId(null)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
            <Icon name="back" className="h-4 w-4" /> Volver a docentes
          </button>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <Avatar nombre={detalle.nombre} fotoUrl={perfiles.get(detalle.id)?.foto_url} tamano="xl" />
              <div>
                <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold text-slate-900">
                  {detalle.nombre} {!detalle.activo && <Badge color="slate">Inactivo</Badge>}
                </h1>
                <p className="text-sm text-slate-500">{detalle.correo || 'Sin correo'}</p>
                {perfiles.get(detalle.id)?.celular && <p className="text-sm text-slate-500">{perfiles.get(detalle.id).celular}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => onVerAgenda(detalle.id)}>
                <Icon name="calendar" className="h-4 w-4" /> Ver en la Agenda
              </Button>
              {puedeEditar && (
                <Button variant="secondary" onClick={() => setForm({ docente: detalle })}>
                  Editar
                </Button>
              )}
            </div>
          </div>

          <Card className="p-6">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Próximas clases ({DIAS_PROXIMOS} días)</h2>
            {proximas === null ? (
              <p className="text-sm text-slate-400">Cargando…</p>
            ) : proximas.length === 0 ? (
              <p className="text-sm text-slate-400">Sin clases programadas en los próximos {DIAS_PROXIMOS} días.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {proximas.map((c) => (
                  <li key={`${c.origen}:${c.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="inline-block w-28 font-medium text-slate-900">
                        {nombreDia(c.fecha).slice(0, 3)} {diaMes(c.fecha)}
                      </span>
                      {c.hora_inicio.slice(0, 5)}–{c.hora_fin.slice(0, 5)} · {c.titulo}
                    </span>
                    <Badge color={c.origen === 'grupal' ? 'brand' : 'peach'}>{c.origen === 'grupal' ? 'Grupal' : 'Particular'}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="mt-6 p-6">
            <h2 className="mb-1 text-base font-semibold text-slate-900">Disponibilidad semanal</h2>
            {disp.get(detalle.id)?.size ? (
              <>
                <p className="mb-3 text-sm text-slate-600">{resumenDisponibilidad(disp.get(detalle.id))}</p>
                <GrillaDisponibilidad value={disp.get(detalle.id)} />
              </>
            ) : (
              <p className="text-sm text-slate-400">Este docente aún no marcó su disponibilidad.</p>
            )}
          </Card>

          {puedeEditar && <CuentaAcceso rol="docente" persona={detalle.id} correoSugerido={detalle.correo ?? ''} />}

          <Card className="mt-6 p-6">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Salones asignados</h2>
            {misSalones.length === 0 ? (
              <p className="text-sm text-slate-400">No tiene salones asignados. Asígnalo desde «Editar» en el salón.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {misSalones.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <button type="button" className="text-sm font-medium text-slate-900 hover:text-brand-700" onClick={() => onVerSalon(s.id)}>
                      {s.nombre}
                    </button>
                    <span className="text-xs text-slate-500">
                      {s.nivel || 'Sin nivel asignado'} · desde {formatFecha(s.fechaInicio)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="mt-6 p-6">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Paquetes privados activos</h2>
            {misPaquetes.length === 0 ? (
              <p className="text-sm text-slate-400">No tiene paquetes privados activos asignados.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {misPaquetes.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <button type="button" className="text-sm font-medium text-slate-900 hover:text-brand-700" onClick={() => onVerPaquete(p.id)}>
                      {p.alumno}
                    </button>
                    <span className="text-xs text-slate-500">{minutosTexto(p.disponibles)} disponibles</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : (
        <>
          <PageHeader
            title="Docentes"
            description={cargando ? 'Cargando…' : `${docentes.filter((d) => d.activo).length} activos · ${docentes.length} registrados`}
            action={
              puedeEditar && (
                <Button onClick={() => setForm({ docente: null })} disabled={cargando || Boolean(error)}>
                  <Icon name="plus" className="h-4 w-4" /> Nuevo docente
                </Button>
              )
            }
          />
          <Card>
            <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
              <div className="relative min-w-56 flex-1 sm:max-w-xs">
                <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o correo" className={`${inputClass} pl-9`} />
              </div>
              <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className={`${inputClass} w-auto`} aria-label="Filtrar docentes">
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
                <option value="todos">Todos</option>
              </select>
            </div>
            {cargando ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">Cargando docentes…</p>
            ) : error ? (
              <p className="px-4 py-10 text-center text-sm text-red-600">No se pudieron cargar los docentes: {error}</p>
            ) : visibles.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                {docentes.length === 0 ? 'Aún no hay docentes. Registra el primero con «Nuevo docente».' : 'Ningún docente coincide con la búsqueda.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Docente</th>
                      <th className="px-4 py-2.5 font-medium">Correo</th>
                      <th className="px-4 py-2.5 font-medium">Salones</th>
                      <th className="px-4 py-2.5 font-medium">Paquetes privados</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibles.map((d) => {
                      const nSal = salonesDe(d.id).filter((s) => s.estado !== 'finalizado').length
                      const nPaq = paquetes.filter((p) => p.docente_id === d.id && p.estado === 'activo').length
                      return (
                        <tr key={d.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDetalleId(d.id)}>
                          <td className="px-4 py-2.5 font-medium text-slate-900">
                            {d.nombre} {!d.activo && <Badge color="slate">Inactivo</Badge>}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{d.correo || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-600">{nSal || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-600">{nPaq || '—'}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-brand-700">Ver</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {form && <DocenteForm key={form.docente?.id ?? 'nuevo'} docente={form.docente} onSave={guardar} onClose={() => setForm(null)} />}
    </>
  )
}
