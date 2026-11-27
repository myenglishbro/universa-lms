import BancoEjercicios from '../../components/ejercicios/BancoEjercicios'
import PageHeader from '../../components/ui/PageHeader'

// Banco de ejercicios del docente: ve los de administración y crea los suyos (privados), que luego asigna a sus salones.
export default function BancoDocente() {
  return (
    <>
      <PageHeader title="Exercise bank" description="Browse the shared bank and create your own exercises to assign to your classrooms" />
      <BancoEjercicios puedeCrear />
    </>
  )
}
