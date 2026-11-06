import Button from '../components/ui/Button'
import Card from '../components/ui/Card'

// Pantalla centrada para estados globales: cargando, falta configuración, sin permisos.
export default function Mensaje({ titulo, texto, accion }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold text-slate-900">{titulo}</h1>
        {texto && <p className="mt-2 text-sm text-slate-600">{texto}</p>}
        {accion && (
          <Button variant="secondary" className="mt-4" onClick={accion.onClick}>
            {accion.label}
          </Button>
        )}
      </Card>
    </div>
  )
}
