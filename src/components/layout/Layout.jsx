import { useState } from 'react'
import Sidebar from './Sidebar'
import Icon from '../ui/Icon'

const COLAPSO_KEY = 'universa:menu-colapsado'
const leerColapso = () => {
  try {
    return localStorage.getItem(COLAPSO_KEY) === '1'
  } catch {
    return false
  }
}

export default function Layout({ current, onNavigate, usuario, onSignOut, items, vistas, vista, onCambiarVista, children }) {
  const [open, setOpen] = useState(false)
  const [colapsado, setColapsado] = useState(leerColapso)
  const alternar = () =>
    setColapsado((c) => {
      try {
        localStorage.setItem(COLAPSO_KEY, c ? '0' : '1')
      } catch {
        /* sin almacenamiento: solo dura esta sesión */
      }
      return !c
    })

  const navigate = (id) => {
    onNavigate(id)
    setOpen(false)
  }

  return (
    <div className="min-h-screen bg-mist">
      <Sidebar
        current={current}
        onNavigate={navigate}
        open={open}
        onClose={() => setOpen(false)}
        colapsado={colapsado}
        onAlternarColapso={alternar}
        usuario={usuario}
        onSignOut={onSignOut}
        items={items}
        vistas={vistas}
        vista={vista}
        onCambiarVista={(v) => {
          onCambiarVista(v)
          setOpen(false)
        }}
      />

      <div className={`transition-[padding] duration-200 ${colapsado ? 'lg:pl-[4.5rem]' : 'lg:pl-64'}`}>
        {/* Barra superior solo en móvil */}
        <header className="flex h-14 items-center gap-3 bg-brand-600 px-4 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Abrir menú" className="text-brand-100">
            <Icon name="menu" className="h-6 w-6" />
          </button>
          <img src="/landing/logo.png" alt="Universa" className="h-6 w-auto" />
        </header>

        <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
