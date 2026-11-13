import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import Layout from './components/layout/Layout'
import useAuth from './hooks/useAuth'
import useNotificacionesTickets from './hooks/useNotificacionesTickets'
import useEstudiantes from './hooks/useEstudiantes'
import usePaquetes from './hooks/usePaquetes'
import useSalones from './hooks/useSalones'
import { PANTALLAS_PANEL, pantallaInicial, puedeVer } from './lib/permisos'
import { supabase } from './lib/supabase'
import Mensaje from './pages/Mensaje'

// Cada pantalla se descarga solo cuando se abre: el primer arranque no carga el código de todas (ni el de la landing, si ya hay sesión).
const PortalApp = lazy(() => import('./PortalApp'))
const Agenda = lazy(() => import('./pages/Agenda'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Docentes = lazy(() => import('./pages/Docentes'))
const Estudiantes = lazy(() => import('./pages/Estudiantes'))
const Ejercicios = lazy(() => import('./pages/Ejercicios'))
const ArchivoCiclos = lazy(() => import('./pages/ArchivoCiclos'))
const Evaluaciones = lazy(() => import('./pages/Evaluaciones'))
const Feriados = lazy(() => import('./pages/Feriados'))
const Registros = lazy(() => import('./pages/Registros'))
const ZonasAdmin = lazy(() => import('./pages/ZonasAdmin'))
const Frecuencias = lazy(() => import('./pages/Frecuencias'))
const Login = lazy(() => import('./pages/Login'))
const Paquetes = lazy(() => import('./pages/Paquetes'))
const Salones = lazy(() => import('./pages/Salones'))
const UsuariosPersonal = lazy(() => import('./pages/UsuariosPersonal'))
const TaskBoard = lazy(() => import('./pages/TaskBoard'))

// Pantallas que usan la lista de estudiantes/matrículas y la de paquetes: esos datos se piden al abrir la primera de ellas,
// no al entrar al panel (el dashboard solo necesita los salones).
const USAN_ESTUDIANTES = ['salones', 'estudiantes', 'paquetes', 'agenda']
const USAN_PAQUETES = ['estudiantes', 'paquetes', 'agenda', 'docentes']

const SIN_ABIERTO = { salon: null, paquete: null, estudiante: null, docente: null }

// La pantalla sale de la URL (/panel/estudiantes). El elemento que se abre en detalle al llegar desde otra pantalla (dashboard, agenda,
// fichas…) viaja en el estado de la navegación: no ensucia la URL y sobrevive a recargar y a «atrás».
function Panel({ auth, vistas, onCambiarVista, onSignOut }) {
  const navigate = useNavigate()
  const location = useLocation()
  const slug = useParams()['*']?.split('/')[0]
  const permitida = PANTALLAS_PANEL.includes(slug) && puedeVer(auth.rol, slug)
  const page = permitida ? slug : pantallaInicial(auth.rol)
  const abierto = { ...SIN_ABIERTO, ...location.state?.abierto }
  const admin = auth.rol === 'admin'
  const data = useSalones()
  const notifTickets = useNotificacionesTickets(puedeVer(auth.rol, 'tickets')) // contador del menú (el Task Board es de todo el personal)
  // Los hooks piden sus datos la primera vez que `activo` es true y los conservan: volver a una pantalla no los descarga de nuevo.
  const estudiantes = useEstudiantes(undefined, USAN_ESTUDIANTES.includes(page))
  const paquetesBase = usePaquetes(admin && USAN_PAQUETES.includes(page)) // los paquetes (dinero) son solo de administración
  // Un alumno creado desde «Paquetes» también debe verse al matricular: ambas listas se refrescan juntas. Los alumnos de los
  // paquetes son los mismos estudiantes (una sola consulta).
  const paquetes = { ...paquetesBase, alumnos: estudiantes.estudiantes, recargar: () => Promise.all([paquetesBase.recargar(), estudiantes.recargar()]) }
  const usuario = { email: auth.session.user.email, rol: auth.rol }
  const ve = (pantalla) => page === pantalla && puedeVer(auth.rol, pantalla) // defensa extra: una pantalla no permitida nunca se pinta

  const irA = (pantalla, abierto) => {
    const destino = `/panel/${pantalla}`
    // Volver a pulsar la misma pantalla no apila entradas en el historial.
    navigate(destino, { state: abierto ? { abierto } : null, replace: location.pathname === destino })
  }
  const navegar = (id) => {
    if (!puedeVer(auth.rol, id)) return
    irA(id)
    if (id === 'salones' || id === 'estudiantes') estudiantes.recargar() // trae altas hechas en otra pantalla o por otra persona
  }
  const ir = (pagina, clave) => (id) => {
    if (!puedeVer(auth.rol, pagina)) return // p. ej. comercial no tiene la ficha del salón: el enlace no hace nada
    irA(pagina, { [clave]: id })
  }
  const verSalon = ir('salones', 'salon')
  const verPaquete = ir('paquetes', 'paquete')
  const verEstudiante = ir('estudiantes', 'estudiante')
  const verDocente = ir('docentes', 'docente')
  const verAgendaDeDocente = ir('agenda', 'docente')

  // Los estudiantes se leen en dos hooks (lista de paquetes y matrículas): se refrescan juntos.
  const recargarPersonas = () => Promise.all([estudiantes.recargar(), paquetes.recargar(), data.recargar()])

  if (!permitida) return <Navigate to={`/panel/${page}`} replace />

  return (
    <Layout base="/panel" current={page} onNavigate={navegar} usuario={usuario} onSignOut={onSignOut} vistas={vistas} vista="gestion" onCambiarVista={onCambiarVista} badges={{ tickets: notifTickets.pendientes }}>
      <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      {ve('dashboard') && <Dashboard data={data} onVerSalon={verSalon} />}
      {ve('tickets') && <TaskBoard miId={auth.session.user.id} notif={notifTickets} />}
      {ve('agenda') && (
        <Agenda
          key={abierto.docente ?? 'agenda'}
          docenteInicialId={abierto.docente ?? ''}
          docentes={data.docentes}
          paquetes={paquetes}
          puedeEditar={admin}
          onRecargarSalones={data.recargar}
          onVerSalon={verSalon}
          onVerPaquete={verPaquete}
          onVerAlumno={verEstudiante}
        />
      )}
      {ve('salones') && (
        <Salones
          data={data}
          estudiantes={estudiantes}
          salonInicialId={abierto.salon}
          puedeEditar={admin}
          onVerEstudiante={verEstudiante}
          onVerDocente={verDocente}
        />
      )}
      {ve('paquetes') && (
        <Paquetes
          key={abierto.paquete ?? 'lista'}
          paqueteInicialId={abierto.paquete}
          data={paquetes}
          docentes={data.docentes}
          niveles={data.niveles}
          puedeEditar={admin}
          onVerAlumno={verEstudiante}
        />
      )}
      {ve('estudiantes') && (
        <Estudiantes
          key={abierto.estudiante ?? 'lista'}
          estudianteInicialId={abierto.estudiante}
          data={estudiantes}
          salones={[...data.salones, ...data.archivados]}
          paquetes={paquetes.paquetes}
          puedeEditar={admin}
          onVerSalon={verSalon}
          onVerPaquete={verPaquete}
          onCambio={recargarPersonas}
        />
      )}
      {ve('docentes') && (
        <Docentes
          key={abierto.docente ?? 'lista'}
          docenteInicialId={abierto.docente}
          data={data}
          paquetes={paquetes.paquetes}
          puedeEditar={admin}
          onVerSalon={verSalon}
          onVerPaquete={verPaquete}
          onVerAgenda={verAgendaDeDocente}
          onCrear={data.crearDocente}
          onCambio={data.recargar}
        />
      )}
      {ve('frecuencias') && admin && <Frecuencias catalogo={data.catalogo} salones={data.salones} onCambio={data.recargarCatalogo} />}
      {ve('evaluaciones') && admin && <Evaluaciones niveles={data.niveles} onVerSalon={verSalon} />}
      {ve('ejercicios') && admin && <Ejercicios />}
      {ve('archivo') && admin && <ArchivoCiclos archivados={data.archivados} />}
      {ve('registros') && <Registros onCambio={data.recargar} puedeEditar={admin} />}
      {ve('zonas') && admin && <ZonasAdmin />}
      {ve('usuarios') && admin && <UsuariosPersonal miCorreo={usuario.email} />}
      {ve('feriados') && <Feriados puedeEditar={admin} onCambio={data.recargar} />}
      </Suspense>
    </Layout>
  )
}

const VISTA_KEY = 'universa:vista'
const leerVista = () => {
  try {
    return localStorage.getItem(VISTA_KEY)
  } catch {
    return null
  }
}
const guardarVista = (v) => {
  try {
    localStorage.setItem(VISTA_KEY, v)
  } catch {
    /* sin almacenamiento: la vista solo dura esta sesión */
  }
}
const RUTA_VISTA = { gestion: '/panel', docente: '/docente', estudiante: '/estudiante' }
const PROTEGIDAS = ['/panel/*', '/docente/*', '/estudiante/*', '/postulante/*']

// Enlaces antiguos con hash (#ingresar, #registro-profesor) → su URL real. Cualquier otro hash (p. ej. los de Supabase) no se toca.
const RUTA_DE_HASH = { '#ingresar': '/ingresar', '#registro-profesor': '/registro-profesor' }
function useHashAntiguo() {
  const navigate = useNavigate()
  const { hash } = useLocation()
  useEffect(() => {
    const destino = RUTA_DE_HASH[hash]
    if (destino) navigate(destino, { replace: true })
  }, [hash, navigate])
}

// Tras entrar: vuelve a la página que se pidió (si se llegó desde un enlace protegido) o a la inicial de la vista preferida.
function Inicio({ vistas }) {
  const { state } = useLocation()
  const preferida = leerVista()
  const vista = vistas.includes(preferida) ? preferida : vistas[0]
  const from = state?.from
  return <Navigate to={from ? from.pathname + from.search : RUTA_VISTA[vista]} replace />
}

// Una cuenta puede tener varias vistas (administración/comercial, docente, estudiante) y cambiar entre ellas sin cerrar sesión.
// La vista activa es el primer tramo de la URL (/panel, /docente, /estudiante).
function Vistas({ auth, onSignOut }) {
  const navigate = useNavigate()
  const vistas = [...(auth.rol ? ['gestion'] : []), ...(auth.portal.includes('docente') ? ['docente'] : []), ...(auth.portal.includes('estudiante') ? ['estudiante'] : [])]
  const cambiar = (v) => {
    guardarVista(v)
    navigate(RUTA_VISTA[v])
  }
  const portal = (vista) => (
    <PortalApp key={vista} vista={vista} email={auth.session.user.email} vistas={vistas} onCambiarVista={cambiar} onSignOut={onSignOut} onRecargar={auth.recargar} />
  )
  return (
    <Routes>
      <Route path="/panel/*" element={vistas.includes('gestion') ? <Panel auth={auth} vistas={vistas} onCambiarVista={cambiar} onSignOut={onSignOut} /> : <Inicio vistas={vistas} />} />
      <Route path="/docente/*" element={vistas.includes('docente') ? portal('docente') : <Inicio vistas={vistas} />} />
      <Route path="/estudiante/*" element={vistas.includes('estudiante') ? portal('estudiante') : <Inicio vistas={vistas} />} />
      <Route path="*" element={<Inicio vistas={vistas} />} />
    </Routes>
  )
}

export default function App() {
  return (
    <Suspense fallback={<Mensaje titulo="Loading…" />}>
      <AppInterna />
    </Suspense>
  )
}

function AppInterna() {
  const auth = useAuth()
  useHashAntiguo()
  if (!supabase)
    return (
      <Mensaje
        titulo="Supabase is not configured"
        texto="Create the .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example) and restart the server."
      />
    )
  if (auth.cargando) return <Mensaje titulo="Loading…" />
  if (!auth.session)
    return (
      <Routes>
        <Route path="/ingresar" element={<Login onSignIn={auth.signIn} />} />
        <Route path="/registro-profesor" element={<Login onSignIn={auth.signIn} />} />
        {PROTEGIDAS.map((path) => (
          <Route key={path} path={path} element={<SinSesion />} />
        ))}
        <Route path="*" element={<Navigate to="/ingresar" replace />} />
      </Routes>
    )
  // Profesor recién registrado: solo ve su perfil y su disponibilidad hasta que administración lo active como docente.
  if (!auth.rol && auth.portal.length === 0 && auth.registro)
    return (
      <Routes>
        <Route path="/postulante/*" element={<PortalApp vista="postulante" email={auth.session.user.email} vistas={[]} onCambiarVista={() => {}} onSignOut={auth.signOut} onRecargar={auth.recargar} />} />
        <Route path="*" element={<Navigate to="/postulante" replace />} />
      </Routes>
    )
  if (!auth.rol && auth.portal.length === 0)
    return (
      <Mensaje
        titulo="Your user has no permissions yet"
        texto="Ask an administrator to assign you a role."
        accion={{ label: 'Sign out', onClick: auth.signOut }}
      />
    )

  return <Vistas auth={auth} onSignOut={auth.signOut} />
}

// Quien llega a una página protegida sin sesión va al login y, al entrar, vuelve a esa página.
function SinSesion() {
  const location = useLocation()
  return <Navigate to="/ingresar" replace state={{ from: location }} />
}
