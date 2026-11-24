import Icon from '../ui/Icon'

// Maquetas pequeñas que enseñan DÓNDE hacer clic. Se dibujan con los mismos nombres y colores de la plataforma,
// así no hay capturas que se queden viejas cuando cambie algo.

const TONOS = {
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  peach: 'bg-peach-50 text-peach-700 ring-peach-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
}

// Anillo que parpadea alrededor de lo que hay que tocar.
const Marca = ({ children, className = '' }) => (
  <span className={`relative inline-flex ${className}`}>
    <span aria-hidden className="absolute -inset-1 animate-pulse rounded-xl ring-2 ring-peach-500 print:animate-none" />
    <span className="relative">{children}</span>
  </span>
)

function Pantalla({ titulo, children, className = '' }) {
  return (
    <figure className={`overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 ${className}`}>
      <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-2.5 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        <figcaption className="ml-2 truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">{titulo}</figcaption>
      </div>
      <div className="p-3">{children}</div>
    </figure>
  )
}

function Menu({ items, on }) {
  const iconos = { 'My courses': 'play', 'My classrooms': 'building', 'Exercise bank': 'pen', 'My profile': 'user', 'Student Zone': 'book', 'Teacher Zone': 'book', Help: 'info', 'My account': 'key' }
  return (
    <Pantalla titulo="Left menu" className="max-w-[13rem]">
      <ul className="-m-1 space-y-0.5 rounded-lg bg-brand-600 p-2">
        {items.map((it) => (
          <li key={it} className="text-xs">
            {it === on ? (
              <Marca className="w-full">
                <span className="flex w-full items-center gap-2 rounded-md bg-white px-2 py-1.5 font-semibold text-brand-700">
                  <Icon name={iconos[it] ?? 'list'} className="h-3.5 w-3.5" /> {it}
                </span>
              </Marca>
            ) : (
              <span className="flex items-center gap-2 px-2 py-1.5 text-brand-100">
                <Icon name={iconos[it] ?? 'list'} className="h-3.5 w-3.5" /> {it}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Pantalla>
  )
}

function Tabs({ items, on }) {
  return (
    <Pantalla titulo="Tabs at the top">
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) =>
          it === on ? (
            <Marca key={it}>
              <span className="inline-flex rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">{it}</span>
            </Marca>
          ) : (
            <span key={it} className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              {it}
            </span>
          ),
        )}
      </div>
    </Pantalla>
  )
}

function Boton({ texto, icono }) {
  return (
    <Pantalla titulo="Button" className="max-w-xs">
      <div className="flex justify-center py-1">
        <Marca>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
            {icono && <Icon name={icono} className="h-4 w-4" />} {texto}
          </span>
        </Marca>
      </div>
    </Pantalla>
  )
}

function Etiqueta({ texto, tono = 'brand', titulo = 'You will see' }) {
  return (
    <Pantalla titulo={titulo} className="max-w-xs">
      <div className="flex justify-center py-1">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${TONOS[tono]}`}>{texto}</span>
      </div>
    </Pantalla>
  )
}

function Aviso({ texto, tono = 'peach', icono = 'alert' }) {
  return (
    <Pantalla titulo="You will see">
      <p className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ring-1 ring-inset ${TONOS[tono]}`}>
        <Icon name={icono} className="mt-0.5 h-4 w-4 shrink-0" />
        {texto}
      </p>
    </Pantalla>
  )
}

const ESTADOS = {
  Present: 'bg-emerald-100 text-emerald-700',
  Late: 'bg-peach-100 text-peach-700',
  Absent: 'bg-rose-100 text-rose-700',
}
function Asistencia({ filas, marcable = false }) {
  return (
    <Pantalla titulo={marcable ? 'Classes & attendance' : 'Attendance'}>
      <ul className="space-y-1.5">
        {filas.map(([nombre, estado]) => (
          <li key={nombre} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-slate-700">{nombre}</span>
            {marcable ? (
              <span className="flex gap-1">
                {Object.keys(ESTADOS).map((e) => (
                  <span key={e} className={`rounded-full px-2 py-0.5 font-semibold ${e === estado ? ESTADOS[e] : 'bg-slate-50 text-slate-400'}`}>
                    {e}
                  </span>
                ))}
              </span>
            ) : (
              <span className={`rounded-full px-2 py-0.5 font-semibold ${ESTADOS[estado]}`}>{estado}</span>
            )}
          </li>
        ))}
      </ul>
    </Pantalla>
  )
}

// Recorrido: cajas unidas por flechas (ej. Open → Task 1 → Task 2 → Send).
function Flujo({ items }) {
  return (
    <Pantalla titulo="The path" className="sm:col-span-2">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs">
        {items.map((it, i) => (
          <li key={it} className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 font-semibold text-brand-800 ring-1 ring-inset ring-brand-100">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] text-white">{i + 1}</span>
              {it}
            </span>
            {i < items.length - 1 && <Icon name="back" className="h-3.5 w-3.5 rotate-180 text-slate-300" />}
          </li>
        ))}
      </ol>
    </Pantalla>
  )
}

// Barra de margen de inasistencias: muestra cuánto falta para el límite.
function Margen({ usado, limite, texto }) {
  const pct = Math.min(100, Math.round((100 * usado) / limite))
  return (
    <Pantalla titulo="Attendance">
      <div className="text-xs">
        <div className="mb-1 flex justify-between font-medium text-slate-600">
          <span>{texto}</span>
          <span>
            {usado} / {limite}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-peach-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Pantalla>
  )
}

export default function Visual({ v, menu }) {
  switch (v.t) {
    case 'menu':
      return <Menu items={menu} on={v.on} />
    case 'tabs':
      return <Tabs items={v.items} on={v.on} />
    case 'boton':
      return <Boton texto={v.texto} icono={v.icono} />
    case 'etiqueta':
      return <Etiqueta texto={v.texto} tono={v.tono} />
    case 'aviso':
      return <Aviso texto={v.texto} tono={v.tono} icono={v.icono} />
    case 'asistencia':
      return <Asistencia filas={v.filas} marcable={v.marcable} />
    case 'flujo':
      return <Flujo items={v.items} />
    case 'margen':
      return <Margen usado={v.usado} limite={v.limite} texto={v.texto} />
    default:
      return null
  }
}
