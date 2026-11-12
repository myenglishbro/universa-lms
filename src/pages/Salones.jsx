import { useMemo, useState } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { inputClass } from '../components/ui/Field'
import Icon from '../components/ui/Icon'
import CerrarCicloModal from '../components/archivo/CerrarCicloModal'
import AsignacionDocentes, { porAsignar } from '../components/salones/AsignacionDocentes'
import SalonDetalle from '../components/salones/SalonDetalle'
import ImportarSalonesModal from '../components/salones/ImportarSalonesModal'
import SalonForm from '../components/salones/SalonForm'
import SalonesAgrupados from '../components/salones/SalonesAgrupados'
import SalonesTabla from '../components/salones/SalonesTabla'
import { descargarCompendio } from '../services/compendio'
import Tile from '../components/ui/Tile'
import { SIN_NIVEL, coincideNivel, estados, proximoAFinalizar } from '../lib/salones'

// Fila de filtros tipo botón con el número de salones que dejaría cada opción.
function Chips({ etiqueta, valor, onCambiar, opciones }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-14 shrink-0 pt-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{etiqueta}</span>
      <div role="group" aria-label={`Filtrar por ${etiqueta.toLowerCase()}`} className="flex flex-wrap gap-1.5">
        {opciones.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={valor === o.value}
            onClick={() => onCambiar(o.value)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              valor === o.value ? 'border-brand-600 bg-brand-600 text-white' : o.n === 0 ? 'border-slate-200 bg-white text-slate-300' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
            }`}
          >
            {o.label} <span className="opacity-70">{o.n}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Salones({ data, estudiantes, puedeEditar, salonInicialId = null, onVerEstudiante, onVerDocente }) {
  const { salones, niveles, docentes, catalogo, cargando, error, recargar, guardarSalon, cambiarEstado, crearDocente, archivados, archivarSalones } = data
  const [busqueda, setBusqueda] = useState('')
  const [nivel, setNivel] = useState('')
  const [estado, setEstado] = useState('')
  const [vista, setVista] = useState('tarjetas')
  const [menuMas, setMenuMas] = useState(false)
  const [detalleId, setDetalleId] = useState(salonInicialId)
  const [cerrandoCiclo, setCerrandoCiclo] = useState(false)
  const [asignando, setAsignando] = useState(false)
  const [importando, setImportando] = useState(false)
  const todosLosSalones = useMemo(() => [...salones, ...archivados], [salones, archivados])
  const [form, setForm] = useState(null) // null = cerrado, { salon } = abierto (salon null = crear)

  const texto = busqueda.trim().toLowerCase()
  const coincideTexto = (s) => !texto || `${s.nombre} ${s.codigo} ${s.docente}`.toLowerCase().includes(texto)
  // Los contadores de cada filtro respetan al otro: así se ve cuántos salones habría al elegirlo.
  const sinEstado = salones.filter((s) => coincideNivel(s, nivel) && coincideTexto(s))
  const sinNivel = salones.filter((s) => (!estado || s.estado === estado) && coincideTexto(s))
  const visibles = sinEstado.filter((s) => !estado || s.estado === estado)

  const activos = salones.filter((s) => s.estado === 'en_curso').length
  const porFinalizar = salones.filter(proximoAFinalizar).length
  const pendientes = salones.filter((s) => s.estado === 'pendiente').length
  const incompletos = salones.filter((s) => s.estado !== 'finalizado' && (!s.docente || !s.nivel)).length
  const nPorAsignar = porAsignar(salones).length
  const sinRegistrar = salones.filter((s) => s.progreso?.porRegistrar > 0 || s.pendientes?.sinGrabacion > 0).length

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
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Salones grupales</h1>
                <p className="mt-0.5 text-sm text-slate-500">Avance, docente y pendientes de cada salón</p>
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
                    <Icon name="teacher" className="h-4 w-4" /> Por asignar
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
                    Más acciones <Icon name="down" className="h-4 w-4" />
                  </button>
                  {menuMas && (
                    <>
                      <button type="button" aria-label="Cerrar menú" className="fixed inset-0 z-20 cursor-default" onClick={() => setMenuMas(false)} />
                      <div role="menu" className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg">
                        <button
                          role="menuitem"
                          type="button"
                          disabled={cargando || Boolean(error)}
                          onClick={() => { setMenuMas(false); setImportando(true) }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-brand-50 disabled:opacity-50"
                        >
                          <Icon name="up" className="h-4 w-4 text-brand-600" /> Importar salones (JSON)
                        </button>
                        {finalizados.length > 0 && (
                          <button
                            role="menuitem"
                            type="button"
                            onClick={() => { setMenuMas(false); setCerrandoCiclo(true) }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-brand-50"
                          >
                            <Icon name="box" className="h-4 w-4 text-brand-600" /> Cerrar ciclo
                            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{finalizados.length}</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <Button onClick={() => setForm({ salon: null })} disabled={cargando || Boolean(error)}>
                  <Icon name="plus" className="h-4 w-4" /> Nuevo salón
                </Button>
              </div>
            )}
          </header>

          {!cargando && !error && salones.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile icono="building" tono="brand" valor={activos} etiqueta="En curso" nota={pendientes > 0 ? `${pendientes} por empezar` : undefined} />
              <Tile icono="flag" tono={porFinalizar > 0 ? 'peach' : 'slate'} valor={porFinalizar} etiqueta="Por finalizar (14 días)" />
              <Tile icono="eye" tono={sinRegistrar > 0 ? 'peach' : 'slate'} valor={sinRegistrar} etiqueta="Con asistencia o grabación pendiente" />
              <Tile icono="info" tono={incompletos > 0 ? 'peach' : 'slate'} valor={incompletos} etiqueta="Sin docente o nivel" />
            </div>
          )}

          <Card>
            <div className="flex flex-wrap items-center gap-3 border-b border-brand-100 p-4">
              <div className="relative min-w-56 flex-1 sm:max-w-xs">
                <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, código o docente"
                  className={`${inputClass} pl-9`}
                />
              </div>
              <div role="group" aria-label="Forma de ver los salones" className="ml-auto inline-flex gap-0.5 rounded-xl bg-slate-100 p-0.5">
                {[
                  ['tarjetas', 'Tarjetas'],
                  ['tabla', 'Tabla'],
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

            {!cargando && !error && salones.length > 0 && (
              <div className="space-y-2 border-b border-brand-100 px-4 py-3">
                <Chips
                  etiqueta="Nivel"
                  valor={nivel}
                  onCambiar={setNivel}
                  opciones={[
                    { value: '', label: 'Todos', n: sinNivel.length },
                    ...niveles.map((n) => ({ value: n.id, label: n.nombre, n: sinNivel.filter((s) => s.nivelId === n.id).length })),
                    { value: SIN_NIVEL, label: 'Sin nivel', n: sinNivel.filter((s) => !s.nivelId).length },
                  ]}
                />
                <Chips
                  etiqueta="Estado"
                  valor={estado}
                  onCambiar={setEstado}
                  opciones={[
                    { value: '', label: 'Todos', n: sinEstado.length },
                    ...estados.map((e) => ({ value: e.value, label: e.label, n: sinEstado.filter((s) => s.estado === e.value).length })),
                  ]}
                />
              </div>
            )}

            {cargando ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">Cargando salones…</p>
            ) : error ? (
              <div className="px-4 py-10 text-center text-sm">
                <p className="text-red-600">No se pudieron cargar los salones: {error}</p>
                <Button variant="secondary" className="mt-3" onClick={recargar}>
                  Reintentar
                </Button>
              </div>
            ) : salones.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                Aún no hay salones registrados.{puedeEditar && ' Crea el primero con «Nuevo salón».'}
              </p>
            ) : visibles.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">Ningún salón coincide con la búsqueda.</p>
            ) : (
              (vista === 'tabla' ? (
                <SalonesTabla salones={visibles} puedeEditar={puedeEditar} onVer={setDetalleId} onEditar={(id) => setForm({ salon: salones.find((s) => s.id === id) })} />
              ) : (
                <SalonesAgrupados salones={visibles} niveles={niveles} puedeEditar={puedeEditar} abrirTodo={Boolean(nivel) || Boolean(texto)} onVer={setDetalleId} onEditar={(id) => setForm({ salon: salones.find((s) => s.id === id) })} />
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
