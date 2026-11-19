import { useMemo, useState } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { inputClass } from '../components/ui/Field'
import Icon from '../components/ui/Icon'
import CerrarCicloModal from '../components/archivo/CerrarCicloModal'
import AsignacionDocentes, { porAsignar } from '../components/salones/AsignacionDocentes'
import SalonDetalle from '../components/salones/SalonDetalle'
import ImportarSalonesModal from '../components/salones/ImportarSalonesModal'
import RespaldoSalonesModal from '../components/salones/RespaldoSalonesModal'
import SalonForm from '../components/salones/SalonForm'
import SalonesAgrupados from '../components/salones/SalonesAgrupados'
import SalonesTabla from '../components/salones/SalonesTabla'
import { descargarCompendio } from '../services/compendio'
import FranjaAtencion from '../components/salones/FranjaAtencion'
import { SIN_NIVEL, coincideNivel, estados, proximoAFinalizar } from '../lib/salones'

// Filtro segmentado: una sola barra con todas las opciones y el número de salones que dejaría cada una.
function Segmentado({ etiqueta, valor, onCambiar, opciones }) {
  return (
    <div role="group" aria-label={`Filter by ${etiqueta.toLowerCase()}`} className="inline-flex max-w-full flex-wrap gap-0.5 rounded-xl bg-slate-100 p-0.5">
      {opciones.map((o) => {
        const activo = valor === o.value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambiar(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              activo ? 'bg-white font-semibold text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {o.icono && <Icon name={o.icono} className="h-3.5 w-3.5" />}
            {o.label}
            <span className={`rounded-full px-1.5 text-xs ${activo ? 'bg-brand-50 text-brand-700' : 'text-slate-400'}`}>{o.n}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function Salones({ data, estudiantes, puedeEditar, salonInicialId = null, onVerEstudiante, onVerDocente }) {
  const { salones, niveles, docentes, catalogo, cargando, error, recargar, guardarSalon, cambiarEstado, eliminarSalon, crearDocente, archivados, archivarSalones } = data
  const [busqueda, setBusqueda] = useState('')
  const [nivel, setNivel] = useState('')
  const [estado, setEstado] = useState('')
  const [tipo, setTipo] = useState('') // '' = todos · 'grupal' · 'paquete'
  const [vista, setVista] = useState('tarjetas')
  const [menuMas, setMenuMas] = useState(false)
  const [detalleId, setDetalleId] = useState(salonInicialId)
  const [cerrandoCiclo, setCerrandoCiclo] = useState(false)
  const [asignando, setAsignando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [respaldando, setRespaldando] = useState(false)
  const [foco, setFoco] = useState('') // pendiente elegido en «Needs attention» ('' = ninguno)
  const [verFiltros, setVerFiltros] = useState(false)
  const todosLosSalones = useMemo(() => [...salones, ...archivados], [salones, archivados])
  const [form, setForm] = useState(null) // null = cerrado, { salon } = abierto (salon null = crear)

  const texto = busqueda.trim().toLowerCase()
  const coincideTexto = (s) => !texto || `${s.nombre} ${s.codigo} ${s.docente}`.toLowerCase().includes(texto)
  // Los contadores de cada filtro respetan al otro: así se ve cuántos salones habría al elegirlo.
  const coincideTipo = (s) => !tipo || (tipo === 'paquete' ? Boolean(s.paquete) : !s.paquete)
  // Pendientes que muestra la franja «Needs attention»; cada uno cuenta sobre todos los salones y, al elegirlo, filtra la lista.
  const GRUPOS_ATENCION = [
    { clave: 'asistencia', etiqueta: 'Attendance missing', tono: 'peach', ayuda: 'Past classes with no attendance recorded', prueba: (s) => s.progreso?.porRegistrar > 0 },
    { clave: 'sin_docente', etiqueta: 'No teacher', tono: 'rose', ayuda: 'Classrooms without an assigned teacher', prueba: (s) => s.estado !== 'finalizado' && !s.docente },
    { clave: 'por_finalizar', etiqueta: 'Ending soon', tono: 'peach', ayuda: 'Ending in the next 14 days', prueba: proximoAFinalizar },
    { clave: 'sin_nivel', etiqueta: 'No level', tono: 'rose', ayuda: 'Classrooms without an academic level', prueba: (s) => s.estado !== 'finalizado' && !s.nivel },
    { clave: 'grabacion', etiqueta: 'No recording', tono: 'peach', ayuda: 'Past classes with no recording', prueba: (s) => s.pendientes?.sinGrabacion > 0 },
  ].map((g) => ({ ...g, n: salones.filter(g.prueba).length }))
  const coincideFoco = (s) => !foco || Boolean(GRUPOS_ATENCION.find((g) => g.clave === foco)?.prueba(s))
  const sinEstado = salones.filter((s) => coincideNivel(s, nivel) && coincideTexto(s) && coincideTipo(s) && coincideFoco(s))
  const sinNivel = salones.filter((s) => (!estado || s.estado === estado) && coincideTexto(s) && coincideTipo(s) && coincideFoco(s))
  const sinTipo = salones.filter((s) => coincideNivel(s, nivel) && (!estado || s.estado === estado) && coincideTexto(s) && coincideFoco(s))
  const visibles = sinEstado.filter((s) => !estado || s.estado === estado)

  const nPorAsignar = porAsignar(salones).length
  const nFiltros = (tipo ? 1 : 0) + (nivel ? 1 : 0)

  const guardar = async (valores) => {
    await guardarSalon(form.salon?.id ?? null, valores)
    setForm(null)
  }

  const finalizados = salones.filter((s) => s.estado === 'finalizado')
  const ciclosExistentes = [...new Set(archivados.map((s) => s.cicloArchivo))]

  const detalle = salones.find((s) => s.id === detalleId)

  return (
    <>
      {detalle ? (
        <SalonDetalle
          salon={detalle}
          salones={salones}
          estudiantes={estudiantes}
          onVerEstudiante={onVerEstudiante}
          onVerDocente={onVerDocente}
          puedeEditar={puedeEditar}
          onVolver={() => setDetalleId(null)}
          onEditar={() => setForm({ salon: detalle })}
          onCambiarEstado={cambiarEstado}
          onEliminar={async (id) => {
            await eliminarSalon(id)
            setDetalleId(null)
          }}
          onRecargar={recargar}
        />
      ) : (
        <>
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm">
                <Icon name="building" className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Group classrooms</h1>
                <p className="mt-0.5 text-sm text-slate-500">Progress, teacher and pending items for each classroom</p>
              </div>
            </div>
            {puedeEditar && (
              <div className="flex flex-wrap items-center gap-2">
                {nPorAsignar > 0 && (
                  <button
                    type="button"
                    onClick={() => setAsignando(true)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full bg-peach-50 px-4 py-2 text-sm font-semibold text-peach-700 ring-1 ring-inset ring-peach-200 transition hover:bg-peach-100"
                  >
                    <Icon name="teacher" className="h-4 w-4" /> Unassigned
                    <span className="rounded-full bg-peach-700 px-2 py-0.5 text-xs text-white">{nPorAsignar}</span>
                  </button>
                )}
                <div className="relative">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={menuMas}
                    onClick={() => setMenuMas((v) => !v)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    More actions <Icon name="down" className="h-4 w-4" />
                  </button>
                  {menuMas && (
                    <>
                      <button type="button" aria-label="Close menu" className="fixed inset-0 z-20 cursor-default" onClick={() => setMenuMas(false)} />
                      <div role="menu" className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg">
                        <button
                          role="menuitem"
                          type="button"
                          disabled={cargando || Boolean(error)}
                          onClick={() => { setMenuMas(false); setImportando(true) }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-brand-50 disabled:opacity-50"
                        >
                          <Icon name="up" className="h-4 w-4 text-brand-600" /> Import classrooms (JSON)
                        </button>
                        <button
                          role="menuitem"
                          type="button"
                          disabled={cargando || Boolean(error) || estudiantes?.cargando}
                          onClick={() => { setMenuMas(false); setRespaldando(true) }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-brand-50 disabled:opacity-50"
                        >
                          <Icon name="doc" className="h-4 w-4 text-brand-600" /> Back up classrooms (Excel)
                        </button>
                        {finalizados.length > 0 && (
                          <button
                            role="menuitem"
                            type="button"
                            onClick={() => { setMenuMas(false); setCerrandoCiclo(true) }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-brand-50"
                          >
                            <Icon name="box" className="h-4 w-4 text-brand-600" /> Close cycle
                            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{finalizados.length}</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <Button onClick={() => setForm({ salon: null })} disabled={cargando || Boolean(error)}>
                  <Icon name="plus" className="h-4 w-4" /> New classroom
                </Button>
              </div>
            )}
          </header>

          {!cargando && !error && salones.length > 0 && <FranjaAtencion grupos={GRUPOS_ATENCION} activo={foco} onElegir={setFoco} />}

          <Card>
            <div className="flex flex-wrap items-center gap-3 border-b border-brand-100 p-4">
              {!cargando && !error && salones.length > 0 && (
                <Segmentado
                  etiqueta="Status"
                  valor={estado}
                  onCambiar={setEstado}
                  opciones={[
                    { value: '', label: 'All', n: sinEstado.length },
                    ...estados.map((e) => ({ value: e.value, label: e.label, n: sinEstado.filter((s) => s.estado === e.value).length })),
                  ]}
                />
              )}
              <div className="relative min-w-48 flex-1 sm:max-w-xs">
                <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Search by name, code or teacher"
                  aria-label="Search classrooms"
                  className={`${inputClass} pl-9`}
                />
              </div>
              <div className="ml-auto flex items-center gap-2">
                {!cargando && !error && salones.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      aria-expanded={verFiltros}
                      onClick={() => setVerFiltros((v) => !v)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
                    >
                      <Icon name="filter" className="h-4 w-4" /> Filters
                      {nFiltros > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">{nFiltros}</span>}
                    </button>
                    {verFiltros && (
                      <>
                        <button type="button" aria-label="Close filters" className="fixed inset-0 z-20 cursor-default" onClick={() => setVerFiltros(false)} />
                        <div role="dialog" aria-label="Filters" className="absolute right-0 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
                          <div>
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Type</p>
                            <Segmentado
                              etiqueta="Type"
                              valor={tipo}
                              onCambiar={setTipo}
                              opciones={[
                                { value: '', label: 'All', n: sinTipo.length },
                                { value: 'grupal', label: 'Group', icono: 'users', n: sinTipo.filter((s) => !s.paquete).length },
                                { value: 'paquete', label: 'Hour package', icono: 'clock', n: sinTipo.filter((s) => s.paquete).length },
                              ]}
                            />
                          </div>
                          <div>
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Level</p>
                            <select value={nivel} onChange={(e) => setNivel(e.target.value)} aria-label="Filter by level" className={`${inputClass} w-full`}>
                              <option value="">All levels ({sinNivel.length})</option>
                              {niveles.map((n) => (
                                <option key={n.id} value={n.id}>
                                  {n.nombre} ({sinNivel.filter((s) => s.nivelId === n.id).length})
                                </option>
                              ))}
                              <option value={SIN_NIVEL}>No level ({sinNivel.filter((s) => !s.nivelId).length})</option>
                            </select>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div role="group" aria-label="How to view classrooms" className="inline-flex gap-0.5 rounded-xl bg-slate-100 p-0.5">
                  {[
                    ['tarjetas', 'Cards'],
                    ['tabla', 'Table'],
                  ].map(([v, t]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={vista === v}
                      onClick={() => setVista(v)}
                      className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${vista === v ? 'bg-white font-semibold text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {!cargando && !error && salones.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 border-b border-brand-100 px-4 py-2 text-sm text-slate-500">
                <span>
                  {visibles.length} {visibles.length === 1 ? 'classroom' : 'classrooms'}
                </span>
                {(tipo || estado || nivel || texto || foco) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTipo('')
                      setEstado('')
                      setNivel('')
                      setBusqueda('')
                      setFoco('')
                    }}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {cargando ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">Loading classrooms…</p>
            ) : error ? (
              <div className="px-4 py-10 text-center text-sm">
                <p className="text-red-600">Could not load classrooms: {error}</p>
                <Button variant="secondary" className="mt-3" onClick={recargar}>
                  Retry
                </Button>
              </div>
            ) : salones.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                No classrooms yet.{puedeEditar && ' Create the first one with “New classroom”.'}
              </p>
            ) : visibles.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">No classroom matches your search.</p>
            ) : (
              (vista === 'tabla' ? (
                <SalonesTabla salones={visibles} puedeEditar={puedeEditar} onVer={setDetalleId} onEditar={(id) => setForm({ salon: salones.find((s) => s.id === id) })} />
              ) : (
                <SalonesAgrupados salones={visibles} niveles={niveles} puedeEditar={puedeEditar} abrirTodo={Boolean(nivel) || Boolean(texto) || Boolean(tipo) || Boolean(foco)} onVer={setDetalleId} onEditar={(id) => setForm({ salon: salones.find((s) => s.id === id) })} />
              ))
            )}
          </Card>
        </>
      )}

      {cerrandoCiclo && (
        <CerrarCicloModal
          finalizados={finalizados}
          ciclosExistentes={ciclosExistentes}
          onConfirm={async (ids, ciclo, { descargar }) => {
            // Primero se guardan los Excel: tras archivar, las matrículas se cierran y los informes salen de la copia fija.
            if (descargar) for (const id of ids) await descargarCompendio(salones.find((s) => s.id === id))
            await archivarSalones(ids, ciclo)
            setCerrandoCiclo(false)
          }}
          onClose={() => setCerrandoCiclo(false)}
        />
      )}

      {asignando && (
        <AsignacionDocentes
          salones={salones}
          docentes={docentes}
          onAsignar={(salon, docenteId) => guardarSalon(salon.id, { ...salon, docenteId })}
          onClose={() => setAsignando(false)}
        />
      )}

      {respaldando && <RespaldoSalonesModal salones={todosLosSalones} estudiantes={estudiantes?.estudiantes ?? []} matriculas={estudiantes?.matriculas ?? []} onClose={() => setRespaldando(false)} />}

      {importando && (
        <ImportarSalonesModal
          salones={todosLosSalones}
          niveles={niveles}
          docentes={docentes}
          catalogo={catalogo}
          onTerminar={recargar}
          onClose={() => setImportando(false)}
        />
      )}

      {form && (
        <SalonForm
          key={form.salon?.id ?? 'nuevo'}
          salon={form.salon}
          niveles={niveles}
          docentes={docentes}
          catalogo={catalogo}
          onSave={guardar}
          onCrearDocente={crearDocente}
          onClose={() => setForm(null)}
        />
      )}
    </>
  )
}
