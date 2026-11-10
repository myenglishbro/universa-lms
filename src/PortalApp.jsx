import { lazy, Suspense } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import Layout from './components/layout/Layout'
import PageHeader from './components/ui/PageHeader'
import Card from './components/ui/Card'
import Icon from './components/ui/Icon'
const MisCursos = lazy(() => import('./pages/portal/MisCursos'))
const MisSalones = lazy(() => import('./pages/portal/MisSalones'))
const MiPerfil = lazy(() => import('./pages/portal/MiPerfil'))
const BancoDocente = lazy(() => import('./pages/portal/BancoDocente'))
const ZonaDocumentos = lazy(() => import('./pages/portal/ZonaDocumentos'))

const cuenta = { id: 'cuenta', label: 'Mi cuenta', icon: 'key' }
const items = {
  estudiante: [{ id: 'cursos', label: 'Mis cursos', icon: 'play' }, { id: 'zona', label: 'Student Zone', icon: 'book' }, cuenta],
  docente: [{ id: 'salones', label: 'Mis salones', icon: 'building' }, { id: 'banco', label: 'Banco de ejercicios', icon: 'pen' }, { id: 'perfil', label: 'Mi perfil', icon: 'user' }, { id: 'zona', label: 'Teacher Zone', icon: 'book' }, cuenta],
  postulante: [{ id: 'perfil', label: 'Mi registro', icon: 'user' }, cuenta],
}

function MiCuenta({ email }) {
  return (
    <div>
      <PageHeader title="Mi cuenta" description="Los datos con los que ingresas" />
      <Card className="max-w-md p-6">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Icon name="mail" className="h-4 w-4" /> Correo
        </p>
        <p className="mt-1 text-base font-semibold text-slate-900">{email}</p>
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0" />
          Tu contraseña la administra Universa. Si la olvidaste o quieres cambiarla, escribe a administración.
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
      <Suspense fallback={<p className="p-6 text-sm text-slate-500">Cargando…</p>}>
      {pagina === 'cuenta' ? (
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
