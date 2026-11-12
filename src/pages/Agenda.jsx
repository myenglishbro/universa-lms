import { useMemo, useRef, useState } from 'react'
import CancelarClaseModal from '../components/paquetes/CancelarClaseModal'
import ClaseForm from '../components/paquetes/ClaseForm'
import ItemAgenda from '../components/agenda/ItemAgenda'
import HorarioSemanal from '../components/agenda/HorarioSemanal'
import ProgramarParticular from '../components/agenda/ProgramarParticular'
import Ayuda from '../components/ui/Ayuda'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { inputClass } from '../components/ui/Field'
import Icon from '../components/ui/Icon'
import PageHeader from '../components/ui/PageHeader'
import useAgenda from '../hooks/useAgenda'
import {
  SIN_DOCENTE,
  claveItem,
  diasDeSemana,
  estadosAgenda,
  filtrarAgenda,
  lunesDe,
  modalidadesAgenda,
  nombreDia,
  diaMes,
  rangoSemana,
  sumarDias,
} from '../lib/agenda'
import { hoyISO } from '../lib/paquetes'
import * as paquetesReal from '../services/paquetes'
import { registrarRealizada } from '../services/calendario'

// Agenda académica: clases grupales (salones) y particulares (paquetes de horas) de la semana, en una sola vista.
// Reutiliza los datos del calendario de salones y las funciones de paquetes; no guarda nada propio.
function Resumen({ icono, tono, valor, etiqueta }) {
  const t = tono === 'peach' ? 'bg-peach-100 text-peach-700' : tono === 'slate' ? 'bg-teal-50 text-teal-700' : 'bg-brand-100 text-brand-600'
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white p-3 shadow-sm">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t}`}>
        <Icon name={icono} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none text-slate-900">{valor}</p>
        <p className="mt-1 text-xs leading-tight text-slate-500">{etiqueta}</p>
      </div>
    </div>
  )
}

export default function Agenda({
  docentes,
  paquetes,
  puedeEditar,
  onRecargarSalones,
  onVerSalon,
  onVerPaquete,
  onVerAlumno,
  docenteInicialId = '',
  servicio = paquetesReal,
  realizada = registrarRealizada,
  api,
}) {
  const [ancla, setAncla] = useState(hoyISO())
  const lunes = lunesDe(ancla)
  const dias = diasDeSemana(ancla)
  const agenda = useAgenda(dias[0], dias[6], api)
  const [f, setF] = useState({ docenteId: docenteInicialId, modalidad: '', estado: '', soloConflictos: false })
  const [modal, setModal] = useState(null) // { tipo, item? }
  const [vista, setVista] = useState('horario')
  const [sel, setSel] = useState(null) // clase abierta desde el horario
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(null)
  const enCurso = useRef(false)

  const visibles = useMemo(() => filtrarAgenda(agenda.items, f, agenda.conflictos), [agenda.items, agenda.conflictos, f])
  const porDia = useMemo(() => Object.fromEntries(dias.map((d) => [d, visibles.filter((i) => i.fecha === d)])), [dias, visibles])
  const nConflictos = agenda.items.filter((i) => agenda.conflictos.has(claveItem(i))).length
  const nGrupales = visibles.filter((i) => i.origen === 'grupal').length
  const nParticulares = visibles.length - nGrupales
  const hoy = hoyISO()
  const nPorRegistrar = visibles.filter((i) => i.estado === 'programada' && i.fecha < hoy).length

  const refrescar = () => Promise.all([agenda.recargar(), paquetes.recargar(), onRecargarSalones?.()])

  // Acción directa (botón): bloquea repeticiones mientras se procesa y vuelve a leer la agenda.
  const ejecutar = async (item, fn) => {
    if (enCurso.current) return
    enCurso.current = true
    setOcupado(claveItem(item))
    setError('')
    try {
      await fn()
      await refrescar()
    } catch (e) {
      setError(e.message)
    } finally {
      enCurso.current = false
      setOcupado(null)
    }
  }
  const enModal = async (fn) => {
    await fn()
    await refrescar()
    setModal(null)
  }

  const paqueteDe = (id) => paquetes.paquetes.find((p) => p.id === id) ?? { id, libres: 0 }
  const claseDe = (i) => ({ id: i.id, docente_id: i.docenteId || null, fecha: i.fecha, hora_inicio: i.horaInicio, hora_fin: i.horaFin, minutos: i.minutos, nota: '' })

  const acciones = {
    editable: puedeEditar,
    confirmar: (i) => ejecutar(i, () => servicio.marcarDictada(i.id)),
    realizada: (i) => ejecutar(i, () => realizada(i.id)),
    reprogramar: (i) => setModal({ tipo: 'reprogramar', item: i }),
    cancelar: (i) => setModal({ tipo: 'cancelar', item: i }),
    verSalon: onVerSalon,
    verPaquete: onVerPaquete,
    verAlumno: onVerAlumno,
  }

  // Desde el panel de detalle, las acciones cierran el panel antes de actuar.
  const accionesSel = {
    ...acciones,
    confirmar: (i) => (setSel(null), acciones.confirmar(i)),
    realizada: (i) => (setSel(null), acciones.realizada(i)),
    reprogramar: (i) => (setSel(null), acciones.reprogramar(i)),
    cancelar: (i) => (setSel(null), acciones.cancelar(i)),
  }

  const docenteOpciones = [
    { value: '', label: 'All teachers' },
    ...docentes.map((d) => ({ value: d.id, label: d.nombre })),
    { value: SIN_DOCENTE, label: 'No teacher' },
  ]

  return (
    <>
      <PageHeader
        title="Academic agenda"
        description="The week's schedule: all the academy's classes in one place"
        action={
          puedeEditar && (
            <Button onClick={() => setModal({ tipo: 'programar' })}>
              <Icon name="plus" className="h-4 w-4" /> Schedule a private class
            </Button>
          )
        }
      />

      <Ayuda id="agenda" titulo="What is the Agenda for?">
        <p>
          Here you see the <strong>week's schedule</strong>, like a school timetable: each block is a class. Nothing needs to be entered here: it builds itself from what already exists.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded border-l-4 border-l-brand-600 bg-brand-100" /> <strong>Group class</strong>: comes from a classroom
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded border-l-4 border-l-teal-600 bg-teal-50 ring-1 ring-teal-200" /> <strong>Private class</strong>: comes from a student's hour package
          </span>
        </div>
        <p className="text-slate-600">
          Tap any class to see its details and mark it as held or cancelled. A private class you mark as taught <strong>deducts an hour from the student's package</strong>.
        </p>
      </Ayuda>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Resumen icono="calendar" tono="brand" valor={visibles.length} etiqueta={visibles.length === 1 ? 'Class this week' : 'Classes this week'} />
        <Resumen icono="building" tono="brand" valor={nGrupales} etiqueta="Group" />
        <Resumen icono="users" tono="slate" valor={nParticulares} etiqueta="Private" />
        <Resumen
          icono="alert"
          tono={nPorRegistrar + nConflictos > 0 ? 'peach' : 'slate'}
          valor={nPorRegistrar + nConflictos}
          etiqueta={nPorRegistrar + nConflictos > 0 ? `To review (${nPorRegistrar} unrecorded${nConflictos ? `, ${nConflictos} overlaps` : ''})` : 'Nothing to review'}
        />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-brand-100 p-3 sm:p-4">
          <Button variant="secondary" className="px-2.5" aria-label="Previous week" onClick={() => setAncla(sumarDias(lunes, -7))}>
            <Icon name="back" className="h-4 w-4" />
          </Button>
          <Button variant="secondary" onClick={() => setAncla(hoy)}>
            Today
          </Button>
          <Button variant="secondary" className="px-2.5" aria-label="Next week" onClick={() => setAncla(sumarDias(lunes, 7))}>
            <Icon name="back" className="h-4 w-4 rotate-180" />
          </Button>
          <span className="px-2 text-base font-semibold text-slate-900">{rangoSemana(lunes)}</span>
          <input type="date" value={ancla} onChange={(e) => e.target.value && setAncla(e.target.value)} className={`${inputClass} w-auto`} aria-label="Go to date" />
          <div role="group" aria-label="How to view the agenda" className="ml-auto inline-flex gap-0.5 rounded-xl bg-slate-100 p-0.5">
            {[
              ['horario', 'Timetable'],
              ['lista', 'List'],
            ].map(([v, t]) => (
              <button
                key={v}
                type="button"
                aria-pressed={vista === v}
                onClick={() => setVista(v)}
                className={`rounded-lg px-4 py-1.5 text-sm transition-colors ${vista === v ? 'bg-white font-semibold text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
          <Icon name="filter" className="h-4 w-4 text-slate-400" />
          <select value={f.docenteId} onChange={(e) => setF({ ...f, docenteId: e.target.value })} className={`${inputClass} w-auto`} aria-label="Filter by teacher">
            {docenteOpciones.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select value={f.modalidad} onChange={(e) => setF({ ...f, modalidad: e.target.value })} className={`${inputClass} w-auto`} aria-label="Filter by modality">
            {modalidadesAgenda.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })} className={`${inputClass} w-auto`} aria-label="Filter by status">
            {estadosAgenda.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={f.soloConflictos} onChange={(e) => setF({ ...f, soloConflictos: e.target.checked })} className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
            Schedule overlaps only
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border-l-4 border-l-brand-600 bg-brand-100" /> Group (classroom)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border-l-4 border-l-teal-600 bg-teal-50 ring-1 ring-teal-200" /> Private (package)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm outline outline-2 outline-peach-500" /> Past and not yet recorded
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm ring-2 ring-rose-400" /> Teacher has another class at the same time
          </span>
        </div>
      </Card>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {agenda.error && <p className="mb-4 text-sm text-red-600">Could not load the agenda: {agenda.error}</p>}

      {agenda.cargando ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading agenda…</p>
      ) : vista === 'horario' ? (
        <HorarioSemanal
          dias={dias}
          porDia={porDia}
          conflictos={agenda.conflictos}
          feriados={agenda.feriados}
          hoy={hoy}
          puedeEditar={puedeEditar}
          onElegir={setSel}
          onProgramar={(fecha) => setModal({ tipo: 'programar', fecha })}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {dias.map((d) => (
            <Card key={d} className={d === hoy ? 'ring-2 ring-brand-200' : ''}>
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  {nombreDia(d)} <span className="font-normal text-slate-500">{diaMes(d)}</span>
                </h2>
                <span className="flex items-center gap-2">
                  {d === hoy && <Badge color="brand">Today</Badge>}
                  {agenda.feriados.has(d) && <Badge color="peach">{agenda.feriados.get(d)}</Badge>}
                  {puedeEditar && (
                    <button type="button" className="text-slate-400 hover:text-brand-700" aria-label={`Schedule a private class on ${diaMes(d)}`} onClick={() => setModal({ tipo: 'programar', fecha: d })}>
                      <Icon name="plus" className="h-4 w-4" />
                    </button>
                  )}
                </span>
              </div>
              {porDia[d].length === 0 ? (
                <p className="px-3 py-4 text-xs text-slate-400">No classes.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {porDia[d].map((i) => (
                    <ItemAgenda
                      key={claveItem(i)}
                      item={i}
                      cruces={agenda.conflictos.get(claveItem(i)) ?? []}
                      feriado={i.estado === 'programada' ? (agenda.feriados.get(i.fecha) ?? '') : ''}
                      acciones={acciones}
                      ocupado={ocupado}
                    />
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}

      {sel && (
        <Modal title={`${nombreDia(sel.fecha)} ${diaMes(sel.fecha)}`} onClose={() => setSel(null)}>
          <ul className="-mx-2">
            <ItemAgenda
              item={sel}
              cruces={agenda.conflictos.get(claveItem(sel)) ?? []}
              feriado={sel.estado === 'programada' ? (agenda.feriados.get(sel.fecha) ?? '') : ''}
              acciones={accionesSel}
              ocupado={ocupado}
            />
          </ul>
        </Modal>
      )}

      {modal?.tipo === 'programar' && (
        <ProgramarParticular
          paquetes={paquetes.paquetes}
          fechaInicial={modal.fecha ?? ''}
          onClose={() => setModal(null)}
          onSave={(paquete, v) => enModal(() => servicio.programarClase(paquete.id, v))}
        />
      )}
      {modal?.tipo === 'reprogramar' && (
        <ClaseForm
          paquete={paqueteDe(modal.item.paqueteId)}
          clase={claseDe(modal.item)}
          docentes={docentes}
          onClose={() => setModal(null)}
          onSave={(v) => enModal(() => servicio.reprogramarClase(modal.item.id, v))}
        />
      )}
      {modal?.tipo === 'cancelar' && (
        <CancelarClaseModal clase={claseDe(modal.item)} onClose={() => setModal(null)} onConfirm={(v) => enModal(() => servicio.cancelarClase(modal.item.id, v))} />
      )}
    </>
  )
}
