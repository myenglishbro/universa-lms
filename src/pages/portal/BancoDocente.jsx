import BancoEjercicios from '../../components/ejercicios/BancoEjercicios'
import PageHeader from '../../components/ui/PageHeader'

// Banco del docente: ejercicios de administración más los suyos.
export default function BancoDocente() {
  return (
    <>
      <PageHeader title="Exercise bank" description="Use the administration exercises or create your own with the help of an AI" />
      <BancoEjercicios />
    </>
  )
}
