import { useEffect, useState } from 'react'
import PortalApp from './PortalApp'
import Layout from './components/layout/Layout'
import useAuth from './hooks/useAuth'
import useEstudiantes from './hooks/useEstudiantes'
import usePaquetes from './hooks/usePaquetes'
import useSalones from './hooks/useSalones'
import { supabase } from './lib/supabase'
import Agenda from './pages/Agenda'
import Dashboard from './pages/Dashboard'
import Docentes from './pages/Docentes'
import Estudiantes from './pages/Estudiantes'
import Ejercicios from './pages/Ejercicios'
import ArchivoCiclos from './pages/ArchivoCiclos'
import Evaluaciones from './pages/Evaluaciones'
import Feriados from './pages/Feriados'
import Registros from './pages/Registros'
import ZonasAdmin from './pages/ZonasAdmin'
import Frecuencias from './pages/Frecuencias'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Mensaje from './pages/Mensaje'
import Paquetes from './pages/Paquetes'
import Salones from './pages/Salones'

// Navegación por estado: suficiente por ahora. Si hacen falta URLs reales, se evaluará react-router.
function Panel({ auth, vistas, onCambiarVista }) {
  const [page, setPage] = useState('dashboard')
  // Elemento a mostrar en detalle al llegar desde otra pantalla (dashboard, agenda, fichas…).
  const [abierto, setAbierto] = useState({ salon: null, paquete: null, estudiante: null, docente: null })
  const data = useSalones()
  const paquetesBase = usePaquetes()
  const estudiantes = useEstudiantes()
  // Un alumno creado desde «Paquetes» también debe verse al matricular: ambas listas se refrescan juntas.
  const paquetes = { ...paquetesBase, recargar: () => Promise.all([paquetesBase.recargar(), estudiantes.recargar()]) }
  const usuario = { email: auth.session.user.email, rol: auth.rol }
  const admin = auth.rol === 'admin'

  const navegar = (id) => {
    setAbierto({ salon: null, paquete: null, estudiante: null, docente: null })
    setPage(id)
    if (id === 'salones' || id === 'estudiantes') estudiantes.recargar() // trae altas hechas en otra pantalla o por otra persona
  }
  const ir = (pagina, clave) => (id) => {
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
      {page === 'dashboard' && <Dashboard data={data} onVerSalon={verSalon} />}
      {page === 'agenda' && (
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
      {page === 'salones' && (
        <Salones
          data={data}
          estudiantes={estudiantes}
          salonInicialId={abierto.salon}
          puedeEditar={admin}
          onVerEstudiante={verEstudiante}
          onVerDocente={verDocente}
        />
      )}
      {page === 'paquetes' && (
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
      {page === 'estudiantes' && (
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
      {page === 'docentes' && (
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
      {page === 'frecuencias' && admin && <Frecuencias catalogo={data.catalogo} salones={data.salones} onCambio={data.recargarCatalogo} />}
      {page === 'evaluaciones' && admin && <Evaluaciones niveles={data.niveles} onVerSalon={verSalon} />}
      {page === 'ejercicios' && admin && <Ejercicios />}
      {page === 'archivo' && admin && <ArchivoCiclos archivados={data.archivados} />}
      {page === 'registros' && admin && <Registros onCambio={data.recargar} />}
      {page === 'zonas' && admin && <ZonasAdmin />}
      {page === 'feriados' &&<Feriados puedeEditar={admin} onCambio={data.recargar} />}
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
