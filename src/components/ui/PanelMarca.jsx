import Icon from './Icon'

const PUNTOS = [
  { icono: 'calendar', texto: 'Tu horario y tus clases siempre a la mano' },
  { icono: 'play', texto: 'Materiales y grabaciones en un solo lugar' },
  { icono: 'check', texto: 'Tu avance y tus notas, claros y al día' },
]

// Pantalla de acceso con la identidad de Universa: panel morado con degradado y logo, y al lado el formulario.
// En móvil el panel se reduce a una banda con el logo.
export default function PanelMarca({ children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative flex flex-col overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 px-6 py-5 text-white lg:p-12">
        <span className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-peach-500/20" />
        <span className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/5" />
        <img src="/landing/logo.png" alt="Universa" width="800" height="172" className="relative h-9 w-auto self-start lg:h-11" />
        <div className="relative mt-auto hidden lg:block">
          <p className="max-w-md text-4xl font-extrabold leading-[1.1] tracking-tight text-peach-500">Tu espacio de clases, agenda y notas.</p>
          <ul className="mt-8 space-y-4">
            {PUNTOS.map((p) => (
              <li key={p.texto} className="flex items-center gap-3 text-brand-50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icon name={p.icono} className="h-5 w-5 text-peach-200" />
                </span>
                {p.texto}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="flex items-center justify-center bg-canvas px-5 py-10 sm:p-12">{children}</main>
    </div>
  )
}
