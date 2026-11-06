import BancoEjercicios from '../../components/ejercicios/BancoEjercicios'
import PageHeader from '../../components/ui/PageHeader'

// Banco del docente: ejercicios de administración más los suyos.
export default function BancoDocente() {
  return (
    <>
      <PageHeader title="Banco de ejercicios" description="Usa los ejercicios de administración o crea los tuyos con ayuda de una IA" />
      <BancoEjercicios />
    </>
  )
}
