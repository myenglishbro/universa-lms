import BancoEjercicios from '../components/ejercicios/BancoEjercicios'
import PageHeader from '../components/ui/PageHeader'

// Banco de ejercicios de administración: lo que se crea aquí lo ven y pueden usar todos los docentes.
export default function Ejercicios() {
  return (
    <>
      <PageHeader title="Banco de ejercicios" description="Crea ejercicios para que todos los docentes los asignen a sus salones" />
      <BancoEjercicios esAdmin />
    </>
  )
}
