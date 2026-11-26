// Da formato a un texto largo (lectura o consigna): título, párrafos con aire, listas y,
// si todo viene en un solo bloque, lo reparte en párrafos de unas 3 oraciones.

// Si la consigna llega en una sola línea («… 1. Say… 2. Spell… - His name is… - Her name is…»), separa las partes.
function separar(texto) {
  let t = String(texto ?? '').replace(/\r/g, '')
  t = t.replace(/(?<=[.:!?…])\s+(?=\d{1,2}[.)]\s+\S)/g, '\n') // «1. … 2. …»
  t = t.replace(/(?<=[.:!?…])\s+-\s+(?=\S)/g, '\n- ') // «- … - …»
  t = t.replace(/(?<=[.!?…])\s+(?=(?:Example|Examples|Model|Sample|Tip|Remember|Note)s?:)/gi, '\n') // «Example: …»
  t = t.replace(/(?<=[a-z]:)\s+(?=(?:\d{1,2}[.)]|-)\s+\S)/g, '\n') // «include the following: 1. …»
  t = t.replace(/(?<=[a-z]:)\s+(?=(?:Use|Include|Mention|Remember)\b)/g, '\n')
  t = t.replace(/(?<=[.!?…])\s+(?=[^.!?\n]*:\n)/g, '\n') // frase que termina en «:» y abre una lista
  return t
}

function bloques(texto) {
  const lineas = separar(texto).split('\n').map((l) => l.trim())
  const out = []
  let lista = null
  for (const l of lineas) {
    if (!l) {
      lista = null
      continue
    }
    const item = l.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/)
    if (item) {
      if (!lista) {
        lista = { tipo: 'lista', items: [], ordenada: /^\d/.test(l) }
        out.push(lista)
      }
      lista.items.push(item[1])
      continue
    }
    lista = null
    const h = l.match(/^#{1,3}\s+(.*)$/)
    out.push(h ? { tipo: 'titulo', texto: h[1] } : { tipo: 'p', texto: l })
  }
  // Un solo párrafo muy largo: se parte por oraciones.
  if (out.length === 1 && out[0].tipo === 'p' && out[0].texto.length > 420) {
    const oraciones = out[0].texto.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [out[0].texto]
    const grupos = []
    for (let i = 0; i < oraciones.length; i += 3) grupos.push({ tipo: 'p', texto: oraciones.slice(i, i + 3).join('').trim() })
    return grupos
  }
  // Primera línea corta y sin punto final: es el título.
  const [a] = out
  if (out.length > 1 && a.tipo === 'p' && a.texto.length <= 90 && !/[.!?,;:]$/.test(a.texto)) out[0] = { tipo: 'titulo', texto: a.texto, principal: true }
  return out
}

export default function TextoFormateado({ texto, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {bloques(texto).map((b, i) => {
        if (b.tipo === 'titulo') {
          return b.principal || i === 0 ? (
            <h3 key={i} className="border-b border-brand-100 pb-2 text-xl font-semibold leading-snug text-slate-900">
              {b.texto}
            </h3>
          ) : (
            <h4 key={i} className="pt-1 text-base font-semibold text-brand-800">
              {b.texto}
            </h4>
          )
        }
        if (b.tipo === 'lista') {
          const Tag = b.ordenada ? 'ol' : 'ul'
          return (
            <Tag key={i} className={`space-y-1.5 pl-6 marker:text-brand-500 ${b.ordenada ? 'list-decimal' : 'list-disc'}`}>
              {b.items.map((x, k) => (
                <li key={k}>{x}</li>
              ))}
            </Tag>
          )
        }
        if (/^(Example|Examples|Model|Sample)s?:/i.test(b.texto)) {
          const [rotulo, ...resto] = b.texto.split(':')
          return (
            <p key={i} className="rounded-xl border-l-4 border-peach-300 bg-peach-50 px-4 py-3 text-[15px] italic text-slate-800">
              <span className="mr-1 text-xs font-semibold uppercase not-italic tracking-wide text-peach-700">{rotulo}</span> {resto.join(':').trim()}
            </p>
          )
        }
        if (/:$/.test(b.texto) && b.texto.length < 140) {
          return (
            <p key={i} className="pt-1 font-semibold text-slate-900">
              {b.texto}
            </p>
          )
        }
        return (
          <p key={i} className="text-pretty">
            {b.texto}
          </p>
        )
      })}
    </div>
  )
}
