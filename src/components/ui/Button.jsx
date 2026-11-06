const variants = {
  primary: 'bg-brand-600 text-white hover:-translate-y-px hover:bg-brand-700 active:translate-y-0 active:scale-[0.98]',
  secondary: 'border border-brand-200 bg-white text-brand-700 hover:border-brand-500 hover:bg-brand-50 hover:-translate-y-px active:translate-y-0 active:scale-[0.98]',
  ghost: 'text-brand-700 underline-offset-4 hover:bg-brand-50 hover:underline',
}

// Botones del sistema: primario (morado), secundario (contorno) y discreto. Píldora de 40 px, foco visible.
export default function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center min-h-10 gap-2 rounded-full px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}
