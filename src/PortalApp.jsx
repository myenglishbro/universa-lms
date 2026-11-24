import { lazy, Suspense, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import CambiarClave from './components/portal/CambiarClave'
import EncuestaClase from './components/portal/EncuestaClase'
import Layout from './components/layout/Layout'
import PageHeader from './components/ui/PageHeader'
import Card from './components/ui/Card'
import Icon from './components/ui/Icon'
const MisCursos = lazy(() => import('./pages/portal/MisCursos'))
const MisSalones = lazy(() => import('./pages/portal/MisSalones'))
const MiPerfil = lazy(() => import('./pages/portal/MiPerfil'))
const BancoDocente = lazy(() => import('./pages/portal/BancoDocente'))
const ZonaDocumentos = lazy(() => import('./pages/portal/ZonaDocumentos'))
const CentroAyuda = lazy(() => import('./pages/portal/CentroAyuda'))

const cuenta = { id: 'cuenta', label: 'My account', icon: 'key' }
const ayuda = { id: 'ayuda', label: 'Help', icon: 'info' }
const items = {
  estudiante: [{ id: 'cursos', label: 'My courses', icon: 'play' }, { id: 'zona', label: 'Student Zone', icon: 'book' }, ayuda, cuenta],
  docente: [{ id: 'salones', label: 'My classrooms', icon: 'building' }, { id: 'banco', label: 'Exercise bank', icon: 'pen' }, { id: 'perfil', label: 'My profile', icon: 'user' }, { id: 'zona', label: 'Teacher Zone', icon: 'book' }, ayuda, cuenta],
  postulante: [{ id: 'perfil', label: 'My registration', icon: 'user' }, cuenta],
}

const AVISO_KEY = 'universa:ayuda-vista'
const avisoVisto = () => {
  try {
    return localStorage.getItem(AVISO_KEY) === '1'
  } catch {
    return false
  }
}

// Aviso de bienvenida (una sola vez por navegador) que lleva al Centro de ayuda.
function AvisoAyuda({ onVer }) {
  const [visible, setVisible] = useState(() => !avisoVisto())
  if (!visible) return null
  const cerrar = (ir) => {
    try {
      localStorage.setItem(AVISO_KEY, '1')
    } catch {
      /* sin almacenamiento: reaparecerá la próxima vez */
    }
    setVisible(false)
    if (ir) onVer()
  }
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3 ring-1 ring-brand-100">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
        <Icon name="info" className="h-5 w-5" />
      </span>
      <p className="min-w-0 flex-1 text-sm text-brand-900">
        <strong className="font-semibold">New here?</strong> Read the short guides to learn how the platform works. You can find them any time in <strong className="font-semibold">Help</strong>, in the menu.
      </p>
      <button type="button" onClick={() => cerrar(true)} className="rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">
        See the guides
      </button>
      <button type="button" onClick={() => cerrar(false)} className="rounded-xl px-2 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100">
        Dismiss
      </button>
    </div>
  )
}

function MiCuenta({ email }) {
  return (
    <div>
      <PageHeader title="My account" description="The details you sign in with" />
      <Card className="max-w-md p-6">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Icon name="mail" className="h-4 w-4" /> Email
        </p>
        <p className="mt-1 text-base font-semibold text-slate-900">{email}</p>
        <CambiarClave email={email} />
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0" />
          If you forgot your current password, write to administration and they will help you recover access.
        </p>
      </Card>
    </div>
  )
}

// Portal del estudiante, del docente o del profesor recién registrado (`postulante`, a la espera de activación).
// Cada vista solo consulta funciones de Supabase que devuelven lo que corresponde a la cuenta.
// La página sale de la URL (/docente/perfil, /estudiante/cursos…): recargar, volver atrás y compartir el enlace funcionan.
export default function PortalApp({ vista, email, vistas, onCambiarVista, onSignOut, onRecargar }) {
  const navigate = useNavigate()
  const base = `/${vista}`
  const pagina = useParams()['*']?.split('/')[0]
  if (!items[vista].some((i) => i.id === pagina)) return <Navigate to={`${base}/${items[vista][0].id}`} replace />
  return (
    <Layout base={base} current={pagina} onNavigate={(id) => navigate(`${base}/${id}`)} usuario={{ email, rol: vista }} onSignOut={onSignOut} items={items[vista]} vistas={vistas} vista={vista} onCambiarVista={onCambiarVista}>
      {vista === 'estudiante' && <EncuestaClase />}
      {pagina !== 'ayuda' && (vista === 'estudiante' || vista === 'docente') && <AvisoAyuda onVer={() => navigate(`${base}/ayuda`)} />}
      <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      {pagina === 'ayuda' ? (
        <CentroAyuda rol={vista} />
      ) : pagina === 'cuenta' ? (
        <MiCuenta email={email} />
      ) : pagina === 'zona' ? (
        <ZonaDocumentos zona={vista === 'docente' ? 'docentes' : 'estudiantes'} />
      ) : pagina === 'banco' ? (
        <BancoDocente />
      ) : pagina === 'perfil' ? (
        <MiPerfil estado={vista} onRecargar={onRecargar} />
      ) : vista === 'estudiante' ? (
        <MisCursos />
      ) : (
        <MisSalones />
      )}
      </Suspense>
    </Layout>
  )
}
