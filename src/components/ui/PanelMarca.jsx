import Icon from './Icon'

// Pantalla de acceso. Escritorio: dos columnas, a la izquierda la mascota de Universa sobre un fondo lila con luces suaves y a la derecha el formulario.
// Móvil: una cabecera compacta con la mascota y el formulario sube sobre ella con esquinas redondeadas.
const PUNTOS = [
  { icono: 'headphones', texto: 'Live classes' },
  { icono: 'book', texto: 'Materials' },
  { icono: 'chart', texto: 'Your progress' },
]

function Burbuja({ icono, texto, className }) {
  return (
    <span className={`burbuja-flota absolute hidden items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-brand-800 shadow-lg shadow-brand-900/10 ring-1 ring-brand-100 backdrop-blur lg:inline-flex ${className}`}>
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-600">
        <Icon name={icono} className="h-3.5 w-3.5" />
      </span>
      {texto}
    </span>
  )
}

export default function PanelMarca({ children }) {
  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative isolate overflow-hidden bg-gradient-to-br from-brand-100 via-brand-50 to-peach-100 lg:sticky lg:top-0 lg:h-dvh">
        {/* Luces y textura de fondo */}
        <div aria-hidden="true" className="absolute -left-24 -top-24 -z-10 h-80 w-80 rounded-full bg-brand-200/60 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-28 right-[-4rem] -z-10 h-96 w-96 rounded-full bg-peach-200/70 blur-3xl" />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-[0.35] [background-image:radial-gradient(circle,var(--color-brand-200)_1.2px,transparent_1.2px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        />

        <div className="flex h-full flex-col items-center px-6 pb-14 pt-6 sm:px-10 lg:justify-between lg:px-14 lg:pb-12 lg:pt-14">
          {/* Titular */}
          <div className="w-full max-w-xl text-center lg:text-left">
            <span aria-hidden="true" className="mb-3 block h-1 w-10 rounded-full bg-peach-500 max-lg:mx-auto lg:mb-5 lg:w-14" />
            <p className="text-balance text-xl font-extrabold leading-snug tracking-tight text-brand-900 sm:text-2xl lg:text-[2.6rem] lg:leading-[1.1]">Your space for classes, schedule and grades.</p>
            <p className="mt-3 hidden max-w-md text-base text-brand-800/70 lg:block">Your live classes, your materials and your progress, all in one place.</p>
          </div>

          {/* Mascota */}
          <div className="relative mt-2 flex min-h-0 flex-1 items-center justify-center lg:mt-0 lg:w-full">
            <div aria-hidden="true" className="absolute aspect-square h-[78%] rounded-full bg-gradient-to-b from-peach-200 to-peach-100/40 blur-[2px] max-lg:h-40" />
            <img
              src="/login/mascota.webp"
              alt="Universa's robot mascot waving hello"
              width="800"
              height="887"
              fetchPriority="high"
              className="mascota-flota relative h-40 w-auto drop-shadow-[0_24px_30px_rgba(65,0,153,0.25)] sm:h-52 lg:h-[min(52dvh,30rem)]"
            />
            <Burbuja icono={PUNTOS[0].icono} texto={PUNTOS[0].texto} className="left-[4%] top-[14%] [animation-delay:-1s]" />
            <Burbuja icono={PUNTOS[1].icono} texto={PUNTOS[1].texto} className="right-[2%] top-[46%] [animation-delay:-2.5s]" />
            <Burbuja icono={PUNTOS[2].icono} texto={PUNTOS[2].texto} className="bottom-[10%] left-[8%] [animation-delay:-4s]" />
          </div>
        </div>
      </aside>

      <main className="relative z-10 -mt-8 flex justify-center rounded-t-[2rem] bg-white px-6 pb-12 pt-9 shadow-[0_-12px_30px_-12px_rgba(65,0,153,0.18)] sm:px-10 lg:mt-0 lg:items-center lg:rounded-none lg:p-14 lg:shadow-none">{children}</main>
    </div>
  )
}
