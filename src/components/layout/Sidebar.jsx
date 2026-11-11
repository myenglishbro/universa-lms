import { useState } from 'react'
import { Link } from 'react-router-dom'
import { puedeVer } from '../../lib/permisos'
import Icon from '../ui/Icon'

// Menú del panel de gestión, agrupado por tema. `grupo` es el título de la sección (sin `grupo` = suelto, arriba, sin título).
// El orden de la lista es el orden en pantalla; un grupo sin opciones visibles para el rol no se muestra.
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'tickets', label: 'Task Board', icon: 'list' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar' },

  { id: 'salones', label: 'Salones grupales', icon: 'building', grupo: 'Académico' },
  { id: 'paquetes', label: 'Paquetes de horas', icon: 'box', grupo: 'Académico' },
  { id: 'evaluaciones', label: 'Evaluaciones', icon: 'doc', soloAdmin: true, grupo: 'Académico' },
  { id: 'ejercicios', label: 'Banco de ejercicios', icon: 'pen', soloAdmin: true, grupo: 'Académico' },
  { id: 'zonas', label: 'Teacher & Student Zone', icon: 'book', soloAdmin: true, grupo: 'Académico' },
  { id: 'archivo', label: 'Archivo de ciclos', icon: 'copy', soloAdmin: true, grupo: 'Académico' },

  { id: 'estudiantes', label: 'Estudiantes', icon: 'users', grupo: 'Personas' },
  { id: 'docentes', label: 'Docentes', icon: 'teacher', grupo: 'Personas' },
  { id: 'registros', label: 'Profesores registrados', icon: 'userplus', soloAdmin: true, grupo: 'Personas' },

  { id: 'frecuencias', label: 'Frecuencias', icon: 'clock', soloAdmin: true, grupo: 'Configuración' },
  { id: 'feriados', label: 'Feriados', icon: 'flag', grupo: 'Configuración' },
  { id: 'usuarios', label: 'Usuarios del personal', icon: 'key', soloAdmin: true, grupo: 'Configuración' },
]

// Secciones plegadas por la persona (se recuerdan en este navegador). La sección de la pantalla actual nunca se oculta.
const CERRADOS_KEY = 'universa:menu-secciones-cerradas'
const leerCerrados = () => {
  try {
    const v = JSON.parse(localStorage.getItem(CERRADOS_KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

// Agrupa las opciones visibles conservando el orden: [{ nombre: undefined | 'Académico', items: [...] }].
function agrupar(visibles) {
  const grupos = []
  for (const item of visibles) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.nombre === item.grupo) ultimo.items.push(item)
    else grupos.push({ nombre: item.grupo, items: [item] })
  }
  return grupos
}

const rolLabel = { admin: 'Administrador', comercial: 'Comercial', rrhh: 'Recursos Humanos', docente: 'Docente', estudiante: 'Estudiante', postulante: 'Profesor (registro en revisión)' }
const vistaLabel = { gestion: 'Administración', docente: 'Portal docente', estudiante: 'Portal estudiante' }

// Clic normal = navegación interna; con Ctrl/⌘/clic central el enlace se abre en otra pestaña como cualquier URL.
const clicNormal = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

export default function Sidebar({ base, current, onNavigate, open, onClose, usuario, onSignOut, items = navItems, badges = {}, vistas = [], vista, onCambiarVista, colapsado = false, onAlternarColapso }) {
  // Colapsado solo aplica en pantallas grandes (lg): en móvil el menú siempre se abre completo como cajón.
  const ocultar = colapsado ? 'lg:hidden' : ''
  const centrar = colapsado ? 'lg:justify-center lg:px-0' : ''
  // El menú del panel de gestión se filtra por rol (lib/permisos); los menús de los portales no usan esos roles y se muestran completos.
  const visibles = items.filter((item) => (items === navItems ? puedeVer(usuario.rol, item.id) : !item.soloAdmin || usuario.rol === 'admin'))
  const [cerrados, setCerrados] = useState(leerCerrados)
  const alternarSeccion = (nombre) =>
    setCerrados((c) => {
      const nuevo = c.includes(nombre) ? c.filter((x) => x !== nombre) : [...c, nombre]
      try {
        localStorage.setItem(CERRADOS_KEY, JSON.stringify(nuevo))
      } catch {
        /* sin almacenamiento: solo dura esta sesión */
      }
      return nuevo
    })
  const grupos = agrupar(visibles)

  const enlace = (item) => (
    <Link
      key={item.id}
      to={`${base}/${item.id}`}
      onClick={(e) => {
        if (!clicNormal(e)) return
        e.preventDefault()
        onNavigate(item.id)
      }}
      title={colapsado ? item.label : undefined}
      aria-label={item.label}
      aria-current={current === item.id ? 'page' : undefined}
      className={`flex min-h-10 w-full items-center gap-3 rounded-full px-4 text-sm font-medium transition-colors ${centrar} ${
        current === item.id ? 'bg-peach-500 text-brand-900' : 'text-brand-100 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon name={item.icon} className="h-5 w-5 shrink-0" />
      <span className={`truncate ${ocultar}`}>{item.label}</span>
      {badges[item.id] > 0 && (
        <span aria-label={`${badges[item.id]} sin leer`} className={`ml-auto min-w-5 rounded-full bg-peach-500 px-1.5 text-center text-xs font-semibold text-brand-900 ${ocultar}`}>
          {badges[item.id]}
        </span>
      )}
    </Link>
  )

  return (
    <>
      {/* Fondo oscuro en móvil */}
      {open && <div className="fixed inset-0 z-30 bg-brand-900/50 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-64 flex-col bg-brand-600 text-brand-100 transition-[transform,width] duration-200 lg:translate-x-0 ${
          colapsado ? 'lg:w-[4.5rem]' : ''
        } ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className={`flex h-20 shrink-0 items-center justify-between px-6 ${colapsado ? 'lg:justify-center lg:px-0' : ''}`}>
          <img src="/landing/logo.png" alt="Universa" className={`h-8 w-auto ${ocultar}`} />
          {colapsado && <img src="/favicon.svg" alt="Universa" className="hidden h-8 w-8 lg:block" />}
        </div>

        {/* Las opciones se desplazan si no caben en la altura de la pantalla; cambiar vista y la cuenta quedan siempre a la vista. */}
        <nav aria-label="Menú principal" className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-2 [scrollbar-color:rgba(255,255,255,.25)_transparent] [scrollbar-width:thin]">
          {grupos.map((g, i) => {
            // Sin título = opciones sueltas. Con título = sección plegable; si contiene la pantalla actual siempre se ve abierta.
            if (!g.nombre) return <div key={`suelto-${i}`} className="space-y-1">{g.items.map(enlace)}</div>
            const contieneActual = g.items.some((it) => it.id === current)
            const abierta = contieneActual || !cerrados.includes(g.nombre)
            const idLista = `menu-seccion-${i}`
            return (
              <div key={g.nombre} className={`pt-2 ${colapsado ? 'lg:mt-2 lg:border-t lg:border-white/10 lg:pt-2' : ''}`}>
                <button
                  type="button"
                  onClick={() => alternarSeccion(g.nombre)}
                  disabled={contieneActual}
                  aria-expanded={abierta}
                  aria-controls={idLista}
                  title={contieneActual ? 'Contiene la pantalla actual' : undefined}
                  className={`flex w-full items-center justify-between rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-200 transition-colors hover:text-white disabled:cursor-default disabled:hover:text-brand-200 ${ocultar}`}
                >
                  {g.nombre}
                  <Icon name="down" className={`h-4 w-4 transition-transform ${abierta ? '' : '-rotate-90'} ${contieneActual ? 'opacity-30' : ''}`} />
                </button>
                {/* Con el menú colapsado (solo íconos) las opciones se muestran siempre: no hay título que despliegue. */}
                <div id={idLista} className={`space-y-1 ${abierta ? '' : colapsado ? 'hidden lg:block' : 'hidden'}`}>
                  {g.items.map(enlace)}
                </div>
              </div>
            )
          })}
        </nav>

        {vistas.length > 1 && (
          <div className="shrink-0 border-t border-white/10 px-3 py-3">
            <p className={`mb-1 flex items-center gap-1.5 px-1 text-xs font-medium uppercase text-brand-200 ${ocultar}`}>
              <Icon name="switch" className="h-3.5 w-3.5" /> Cambiar vista
            </p>
            <div className={`space-y-1 ${colapsado ? 'lg:space-y-1' : ''}`}>
              {vistas.map((v) => (
                <button
                  key={v}
                  onClick={() => onCambiarVista(v)}
                  title={colapsado ? vistaLabel[v] : undefined}
                  aria-label={vistaLabel[v]}
                  aria-current={vista === v ? 'true' : undefined}
                  className={`flex w-full items-center rounded-full px-4 py-2 text-left text-sm ${colapsado ? 'lg:justify-center lg:px-0' : ''} ${vista === v ? 'bg-white font-medium text-brand-700' : 'text-brand-100 hover:bg-white/5'}`}
                >
                  <span className={ocultar}>{vistaLabel[v]}</span>
                  {colapsado && <span className="hidden font-semibold lg:inline">{vistaLabel[v].charAt(0)}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`shrink-0 border-t border-white/10 p-4 text-sm ${colapsado ? 'lg:px-2' : ''}`}>
          <div className={ocultar}>
            <p className="truncate font-medium text-white">{usuario.email}</p>
            <p className="text-xs text-brand-200">{rolLabel[usuario.rol]}</p>
          </div>
          <button
            onClick={onSignOut}
            title={colapsado ? 'Cerrar sesión' : undefined}
            aria-label="Cerrar sesión"
            className={`mt-2 flex items-center gap-2 text-xs font-medium text-peach-200 hover:underline ${colapsado ? 'lg:mx-auto lg:mt-0 lg:h-10 lg:w-10 lg:justify-center lg:rounded-full lg:hover:bg-white/10 lg:hover:no-underline' : ''}`}
          >
            {colapsado && <Icon name="logout" className="hidden h-5 w-5 lg:block" />}
            <span className={ocultar}>Cerrar sesión</span>
          </button>
          {onAlternarColapso && (
            <button
              onClick={onAlternarColapso}
              aria-label={colapsado ? 'Expandir menú' : 'Colapsar menú'}
              aria-expanded={!colapsado}
              title={colapsado ? 'Expandir menú' : 'Colapsar menú'}
              className={`mt-3 hidden h-10 w-full items-center gap-2 rounded-full text-xs font-medium text-brand-200 transition-colors hover:bg-white/10 hover:text-white lg:flex ${colapsado ? 'justify-center' : 'px-4'}`}
            >
              <Icon name="back" className={`h-5 w-5 shrink-0 transition-transform ${colapsado ? 'rotate-180' : ''}`} />
              {!colapsado && 'Colapsar menú'}
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
