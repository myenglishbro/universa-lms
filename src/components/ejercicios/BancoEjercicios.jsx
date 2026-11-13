import { useCallback, useEffect, useMemo, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { inputClass } from '../ui/Field'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import CrearEjercicio from './CrearEjercicio'
import EjercicioJugador from './EjercicioJugador'
import useCarga from '../../hooks/useCarga'
import { TIPOS, TONOS, cantidadItems, compilar, tipoDe } from '../../lib/ejercicios'
import { supabase } from '../../lib/supabase'
import * as servicioReal from '../../services/ejercicios'

const sinTildes = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

function TarjetaEjercicio({ e, esMio, puedeEditar, onVer, onEditar, onBase, onQuitar, onElegir }) {
  const t = tipoDe(e.tipo)
  const n = cantidadItems(e.tipo, e.datos)
  return (
    <Card className="flex flex-col p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONOS[t.tono]}`}>
          <Icon name={t.icono} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-semibold text-slate-900">{e.titulo}</h3>
          <p className="text-xs text-slate-500">
            {t.label}
            {n != null && ` · ${n} ${n === 1 ? 'elemento' : 'elementos'}`}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {e.nivel && <Badge color="brand">{e.nivel}</Badge>}
        {e.tema && <Badge color="slate">{e.tema}</Badge>}
        <Badge color={e.publico ? 'brand' : 'peach'}>{e.publico ? 'Bank' : 'Mine'}</Badge>
        {!t.auto && <Badge color="peach">Needs review</Badge>}
      </div>
      <p className="mt-2 text-xs text-slate-400">Created by {e.autor_nombre}</p>
      <div className="mt-auto flex flex-wrap items-center gap-1 pt-3">
        {onElegir ? (
          <Button type="button" className="flex-1" onClick={() => onElegir(e)}>
            Use this exercise
          </Button>
        ) : null}
        <Button type="button" variant="ghost" className="px-3 py-1 text-xs" onClick={() => onVer(e)}>
          <Icon name="eye" className="h-4 w-4" /> View
        </Button>
        {!onElegir && puedeEditar && esMio && (
          <>
            <Button type="button" variant="ghost" className="px-3 py-1 text-xs" onClick={() => onEditar(e)}>
              <Icon name="pencil" className="h-4 w-4" /> Edit
            </Button>
            <Button type="button" variant="ghost" className="px-3 py-1 text-xs" onClick={() => onQuitar(e)}>
              <Icon name="trash" className="h-4 w-4" /> Quitar
            </Button>
          </>
        )}
        {!onElegir && puedeEditar && !esMio && (
          <Button type="button" variant="ghost" className="px-3 py-1 text-xs" onClick={() => onBase(e)}>
            <Icon name="copy" className="h-4 w-4" /> Use as a base
          </Button>
        )}
      </div>
    </Card>
  )
}

// Banco de ejercicios. Administración: crea y edita el banco. Docente: ve el banco, crea los suyos y puede usar uno como base.
// Con `onElegir` funciona como selector (para asignar a un salón).
export default function BancoEjercicios({ esAdmin = false, userId: userIdProp, onElegir = null, servicio = servicioReal }) {
  const [userIdAuth, setUserIdAuth] = useState(null)
  useEffect(() => {
    if (!userIdProp) supabase.auth.getUser().then(({ data }) => setUserIdAuth(data?.user?.id ?? null))
  }, [userIdProp])
  const userId = userIdProp ?? userIdAuth
  const cargar = useCallback(() => servicio.listarEjercicios(), [servicio])
  const { datos: lista, cargando, error, recargar } = useCarga(cargar, [])
  const [busqueda, setBusqueda] = useState('')
  const [tipo, setTipo] = useState('')
  const [alcance, setAlcance] = useState('todos') // todos | banco | mios
  const [form, setForm] = useState(null) // { ejercicio }
  const [ver, setVer] = useState(null)
  const [falla, setFalla] = useState('')

  const esMio = (e) => (esAdmin ? e.publico : e.autor_user_id === userId)
  const texto = sinTildes(busqueda.trim())
  const visibles = useMemo(
    () =>
      lista.filter(
        (e) =>
          (!tipo || e.tipo === tipo) &&
          (alcance === 'todos' || (alcance === 'banco' ? e.publico : !e.publico)) &&
          (!texto || sinTildes(`${e.titulo} ${e.tema ?? ''} ${e.nivel ?? ''} ${e.autor_nombre}`).includes(texto)),
      ),
    [lista, tipo, alcance, texto],
  )
  const conteo = (t) => lista.filter((e) => e.tipo === t).length

  const guardar = async (id, e) => {
    await servicio.guardarEjercicio(id, e)
    setForm(null)
    await recargar()
  }
  const quitar = async (e) => {
    if (!window.confirm(`Remove “${e.titulo}”? Classrooms where it was already assigned keep it.`)) return
    setFalla('')
    try {
      await servicio.archivarEjercicio(e.id)
      await recargar()
    } catch (err) {
      setFalla(err.message)
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Search by title, topic or level" className={`${inputClass} pl-9`} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!esAdmin && !onElegir && (
            <div role="group" aria-label="View" className="inline-flex gap-0.5 rounded-xl bg-slate-100 p-0.5">
              {[
                ['todos', 'All'],
                ['banco', 'Bank'],
                ['mios', 'Míos'],
              ].map(([v, t]) => (
                <button key={v} type="button" aria-pressed={alcance === v} onClick={() => setAlcance(v)} className={`rounded-lg px-3 py-1.5 text-sm ${alcance === v ? 'bg-white font-semibold text-brand-700 shadow-sm' : 'text-slate-600'}`}>
                  {t}
                </button>
              ))}
            </div>
          )}
          {!onElegir && (
            <Button type="button" onClick={() => setForm({ ejercicio: null })}>
              <Icon name="plus" className="h-4 w-4" /> New exercise
            </Button>
          )}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter by type">
        <button type="button" aria-pressed={!tipo} onClick={() => setTipo('')} className={`rounded-full border px-3.5 py-1.5 text-sm transition ${!tipo ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'}`}>
          All <span className="opacity-70">{lista.length}</span>
        </button>
        {TIPOS.map((t) => (
          <button key={t.id} type="button" aria-pressed={tipo === t.id} onClick={() => setTipo(tipo === t.id ? '' : t.id)} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition ${tipo === t.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'}`}>
            <Icon name={t.icono} className="h-4 w-4" /> {t.label} <span className="opacity-70">{conteo(t.id)}</span>
          </button>
        ))}
      </div>

      {falla && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{falla}</p>}

      {cargando ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading exercises…</p>
      ) : error ? (
        <div className="py-10 text-center text-sm">
          <p className="text-red-600">Could not load the bank: {error}</p>
          <Button variant="secondary" className="mt-3" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-14 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
            <Icon name="sparkle" className="h-7 w-7" />
          </span>
          <p className="mt-4 text-base font-semibold text-slate-900">{esAdmin ? 'The bank is empty' : 'There are no exercises yet'}</p>
          <p className="mt-1 text-sm text-slate-500">{esAdmin ? 'Create the first exercise: all teachers will be able to use it.' : 'Create your first exercise or wait for administration to publish exercises in the bank.'}</p>
          {!onElegir && (
            <Button className="mt-5" onClick={() => setForm({ ejercicio: null })}>
              <Icon name="plus" className="h-4 w-4" /> Create exercise
            </Button>
          )}
        </div>
      ) : visibles.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">No exercise matches your search.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map((e) => (
            <TarjetaEjercicio
              key={e.id}
              e={e}
              esMio={esMio(e)}
              puedeEditar
              onVer={setVer}
              onEditar={(x) => setForm({ ejercicio: x })}
              onBase={(x) => setForm({ ejercicio: { ...x, id: null } })}
              onQuitar={quitar}
              onElegir={onElegir}
            />
          ))}
        </div>
      )}

      {form && <CrearEjercicio key={form.ejercicio?.id ?? form.ejercicio?.titulo ?? 'nuevo'} ejercicio={form.ejercicio} onGuardar={guardar} onClose={() => setForm(null)} />}

      {ver && (
        <Modal title={ver.titulo} onClose={() => setVer(null)} wide="xl">
          <div className="rounded-2xl bg-canvas p-4 sm:p-6">
            <EjercicioJugador ejercicio={{ id: 'previa', tipo: ver.tipo, titulo: ver.titulo, contenido: compilar(ver.tipo, ver.datos).contenido }} vistaPrevia />
          </div>
        </Modal>
      )}
    </>
  )
}
