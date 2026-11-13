import BancoEjercicios from '../components/ejercicios/BancoEjercicios'
import PageHeader from '../components/ui/PageHeader'

// Banco de ejercicios de administración: lo que se crea aquí lo ven y pueden usar todos los docentes.
export default function Ejercicios() {
  return (
    <>
      <PageHeader title="Exercise bank" description="Create exercises that all teachers can assign to their classrooms" />
      <BancoEjercicios esAdmin />
    </>
  )
}
