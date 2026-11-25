import BancoEjercicios from '../../components/ejercicios/BancoEjercicios'
import PageHeader from '../../components/ui/PageHeader'

// Banco del docente: ejercicios de administración más los suyos.
export default function BancoDocente() {
  return (
    <>
      <PageHeader title="Exercise bank" description="Browse the exercises published by administration. Assign them to your classrooms from each classroom's Exercises tab" />
      <BancoEjercicios />
    </>
  )
}
