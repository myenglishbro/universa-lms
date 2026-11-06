// Gráficos circulares en SVG, sin librerías. Anillo = un porcentaje; Dona = varias porciones.

// Anillo de progreso. `valor` 0–100 (o null = sin dato). Hijos = texto central.
export function Anillo({ valor, size = 72, grosor = 8, color = 'var(--color-brand-500)', etiqueta = 'Progreso', fondo = 'var(--color-brand-100)', children }) {
  const r = (size - grosor) / 2
  const c = 2 * Math.PI * r
  const pct = valor == null ? 0 : Math.max(0, Math.min(100, valor))
  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuenow={valor == null ? undefined : Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={fondo} strokeWidth={grosor} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset 0.7s ease' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-center font-semibold" style={{ fontSize: size * 0.24, color }}>
        {children ?? (valor == null ? '—' : `${Math.round(pct)}%`)}
      </span>
    </div>
  )
}

// Dona con porciones: segmentos = [{ valor, color }]. Hijos = texto central.
export function Dona({ segmentos, size = 120, grosor = 16, etiqueta = 'Distribución', children }) {
  const r = (size - grosor) / 2
  const c = 2 * Math.PI * r
  const total = segmentos.reduce((n, s) => n + s.valor, 0)
  let acumulado = 0
  return (
    <div role="img" aria-label={etiqueta} className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-brand-50)" strokeWidth={grosor} />
        {total > 0 &&
          segmentos
            .filter((s) => s.valor > 0)
            .map((s, i) => {
              const largo = (s.valor / total) * c
              const el = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={grosor}
                  strokeDasharray={`${Math.max(0, largo - 2)} ${c}`}
                  strokeDashoffset={-acumulado}
                />
              )
              acumulado += largo
              return el
            })}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</span>
    </div>
  )
}
