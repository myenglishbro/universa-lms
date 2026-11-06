import { lazy, Suspense, useEffect, useState } from 'react'
import Layout from './components/layout/Layout'
import useAuth from './hooks/useAuth'
import useEstudiantes from './hooks/useEstudiantes'
import usePaquetes from './hooks/usePaquetes'
import useSalones from './hooks/useSalones'
import { pantallaInicial, puedeVer } from './lib/permisos'
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
const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
const Paquetes = lazy(() => import('./pages/Paquetes'))
const Salones = lazy(() => import('./pages/Salones'))
const UsuariosPersonal = lazy(() => import('./pages/UsuariosPersonal'))

// Pantallas que usan la lista de estudiantes/matrículas y la de paquetes: esos datos se piden al abrir la primera de ellas,
// no al entrar al panel (el dashboard solo necesita los salones).
const USAN_ESTUDIANTES = ['salones', 'estudiantes', 'paquetes', 'agenda']
const USAN_PAQUETES = ['estudiantes', 'paquetes', 'agenda', 'docentes']

// Navegación por estado: suficiente por ahora. Si hacen falta URLs reales, se evaluará react-router.
function Panel({ auth, vistas, onCambiarVista }) {
  const [page, setPage] = useState(() => pantallaInicial(auth.rol))
  // Elemento a mostrar en detalle al llegar desde otra pantalla (dashboard, agenda, fichas…).
  const [abierto, setAbierto] = useState({ salon: null, paquete: null, estudiante: null, docente: null })
  const admin = auth.rol === 'admin'
  const data = useSalones()
  // Los hooks piden sus datos la primera vez que `activo` es true y los conservan: volver a una pantalla no los descarga de nuevo.
  const estudiantes = useEstudiantes(undefined, USAN_ESTUDIANTES.includes(page))
  const paquetesBase = usePaquetes(admin && USAN_PAQUETES.includes(page)) // los paquetes (dinero) son solo de administración
  // Un alumno creado desde «Paquetes» también debe verse al matricular: ambas listas se refrescan juntas. Los alumnos de los
  // paquetes son los mismos estudiantes (una sola consulta).
  const paquetes = { ...paquetesBase, alumnos: estudiantes.estudiantes, recargar: () => Promise.all([paquetesBase.recargar(), estudiantes.recargar()]) }
  const usuario = { email: auth.session.user.email, rol: auth.rol }
  const ve = (pantalla) => page === pantalla && puedeVer(auth.rol, pantalla) // defensa extra: una pantalla no permitida nunca se pinta

  const navegar = (id) => {
    if (!puedeVer(auth.rol, id)) return
    setAbierto({ salon: null, paquete: null, estudiante: null, docente: null })
    setPage(id)
    if (id === 'salones' || id === 'estudiantes') estudiantes.recargar() // trae altas hechas en otra pantalla o por otra persona
  }
  const ir = (pagina, clave) => (id) => {
    if (!puedeVer(auth.rol, pagina)) return // p. ej. comercial no tiene la ficha del salón: el enlace no hace nada
    setAbierto({ salon: null, paquete: null, estudiante: null, docente: null, [clave]: id })
    setPage(pagina)
  }
  const verSalon = ir('salones', 'salon')
  const verPaquete = ir('paquetes', 'paquete')
  const verEstudiante = ir('estudiantes', 'estudiante')
  const verDocente = ir('docentes', 'docente')
  const verAgendaDeDocente = ir('agenda', 'docente')

  // Los estudiantes se leen en dos hooks (lista de paquetes y matrículas): se refrescan juntos.
  const recargarPersonas = () => Promise.all([estudiantes.recargar(), paquetes.recargar(), data.recargar()])

  return (
    <Layout current={page} onNavigate={navegar} usuario={usuario} onSignOut={auth.signOut} vistas={vistas} vista="gestion" onCambiarVista={onCambiarVista}>
      <Suspense fallback={<p className="p-6 text-sm text-slate-500">Cargando…</p>}>
      {ve('dashboard') && <Dashboard data={data} onVerSalon={verSalon} />}
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

// Una cuenta puede tener varias vistas (administración/comercial, docente, estudiante) y cambiar entre ellas sin cerrar sesión.
function Vistas({ auth }) {
  const vistas = [...(auth.rol ? ['gestion'] : []), ...(auth.portal.includes('docente') ? ['docente'] : []), ...(auth.portal.includes('estudiante') ? ['estudiante'] : [])]
  const [elegida, setElegida] = useState(leerVista)
  const vista = vistas.includes(elegida) ? elegida : vistas[0]
  const cambiar = (v) => {
    setElegida(v)
    try {
      localStorage.setItem(VISTA_KEY, v)
    } catch {
      /* sin almacenamiento: la vista solo dura esta sesión */
    }
  }
  if (vista === 'gestion') return <Panel auth={auth} vistas={vistas} onCambiarVista={cambiar} />
  return <PortalApp key={vista} vista={vista} email={auth.session.user.email} vistas={vistas} onCambiarVista={cambiar} onSignOut={auth.signOut} onRecargar={auth.recargar} />
}

const HASH_LOGIN = '#ingresar'
const HASH_REGISTRO = '#registro-profesor' // enlace que se les envía a los profesores para registrarse
const esHashAcceso = () => window.location.hash === HASH_LOGIN || window.location.hash === HASH_REGISTRO

// Quien no ha iniciado sesión ve la landing; «Ingresar» lleva al login (#ingresar) y #registro-profesor abre el registro de profesores.
// Solo esos hashes exactos, para no chocar con los de Supabase.
function useVerLogin() {
  const [ver, setVer] = useState(esHashAcceso)
  useEffect(() => {
    const alCambiar = () => setVer(esHashAcceso())
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])
  const ingresar = () => {
    window.location.hash = HASH_LOGIN
    setVer(true)
  }
  const volver = () => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    setVer(false)
  }
  return { ver, ingresar, volver }
}

export default function App() {
  return (
    <Suspense fallback={<Mensaje titulo="Cargando…" />}>
      <AppInterna />
    </Suspense>
  )
}

function AppInterna() {
  const auth = useAuth()
  const login = useVerLogin()

  if (!supabase)
    return (
      <Mensaje
        titulo="Falta configurar Supabase"
        texto="Crea el archivo .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example) y reinicia el servidor."
      />
    )
  if (auth.cargando) return <Mensaje titulo="Cargando…" />
  if (!auth.session)
    return login.ver ? (
      <Login onSignIn={auth.signIn} onVolver={login.volver} modoInicial={window.location.hash === HASH_REGISTRO ? 'registro' : 'ingresar'} />
    ) : (
      <Landing onIngresar={login.ingresar} />
    )
  // Profesor recién registrado: solo ve su perfil y su disponibilidad hasta que administración lo active como docente.
  if (!auth.rol && auth.portal.length === 0 && auth.registro)
    return <PortalApp vista="postulante" email={auth.session.user.email} vistas={[]} onCambiarVista={() => {}} onSignOut={auth.signOut} onRecargar={auth.recargar} />
  if (!auth.rol && auth.portal.length === 0)
    return (
      <Mensaje
        titulo="Tu usuario aún no tiene permisos"
        texto="Pide a un administrador que te asigne un rol."
        accion={{ label: 'Cerrar sesión', onClick: auth.signOut }}
      />
    )

  return <Vistas auth={auth} />
}
