import useEstudiantes from '../../hooks/useEstudiantes'
import MatriculasSalon from './MatriculasSalon'

// Variante autónoma: carga sus propios estudiantes y matrículas desde Supabase (mismas consultas que la pantalla «Estudiantes»).
// Se usa cuando el detalle del salón no recibe los datos desde arriba, así la sección funciona sin depender de esa conexión.
export default function MatriculasSalonAuto({ onCambio, ...props }) {
  const datos = useEstudiantes()
  return <MatriculasSalon {...props} data={datos} onCambio={() => Promise.all([datos.recargar(), onCambio?.()])} />
}
