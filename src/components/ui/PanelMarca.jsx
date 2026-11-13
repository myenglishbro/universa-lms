// Pantalla de acceso: foto de una clase en vivo bajo un velo morado de la marca, y el formulario sobre fondo blanco.
// Escritorio: dos columnas. Móvil: la foto es una cabecera y el formulario sube sobre ella con esquinas redondeadas.
export default function PanelMarca({ children }) {
  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative isolate h-56 overflow-hidden bg-brand-900 text-white sm:h-72 lg:sticky lg:top-0 lg:h-dvh">
        <img
          src="/login/fondo.webp"
          alt=""
          width="1024"
          height="1024"
          fetchPriority="high"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[78%_28%] lg:object-[72%_center]"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-900/95 via-brand-800/60 to-brand-700/35 lg:bg-gradient-to-tr lg:from-brand-900/90 lg:via-brand-800/45 lg:to-brand-700/10" />

        <div className="flex h-full flex-col justify-end p-6 pb-10 sm:p-10 sm:pb-12 lg:p-14">
          <div>
            <span aria-hidden="true" className="mb-4 block h-0.5 w-10 bg-peach-500 lg:mb-6 lg:w-14" />
            <p className="max-w-md text-xl font-semibold leading-snug tracking-tight sm:text-2xl lg:text-[2.6rem] lg:leading-[1.12]">Your space for classes, schedule and grades.</p>
            <p className="mt-3 hidden max-w-sm text-base text-brand-100 lg:block">Your live classes, your materials and your progress, all in one place.</p>
          </div>
        </div>
      </aside>

      <main className="relative z-10 -mt-6 flex justify-center rounded-t-3xl bg-white px-6 pb-12 pt-9 sm:px-10 lg:mt-0 lg:items-center lg:rounded-none lg:p-14">{children}</main>
    </div>
  )
}
