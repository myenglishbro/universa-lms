// Perfil interno de docentes (solo administración): descripción y valores por campo para filtrar al asignar.
// filtros = { texto: '', sel: { [campoId]: ['opción', …] } }. Dentro de un campo basta una opción (O); entre campos deben cumplirse todos (Y).
export const filtrosVacios = { texto: '', sel: {} }

export const hayFiltros = (f) => Boolean(f.texto.trim()) || Object.values(f.sel).some((v) => v.length > 0)

export function coincidePerfil(perfil, f) {
  const texto = f.texto.trim().toLowerCase()
  if (texto && !String(perfil?.descripcion ?? '').toLowerCase().includes(texto)) return false
  return Object.entries(f.sel).every(([campo, opciones]) => {
    if (!opciones.length) return true
    const tiene = perfil?.atributos?.[campo] ?? []
    return opciones.some((o) => tiene.includes(o))
  })
}

// Alterna una opción en los filtros sin mutar.
export function alternarOpcion(f, campoId, opcion) {
  const actual = f.sel[campoId] ?? []
  const nuevo = actual.includes(opcion) ? actual.filter((o) => o !== opcion) : [...actual, opcion]
  return { ...f, sel: { ...f.sel, [campoId]: nuevo } }
}

// Valores de un docente como [{ campo, opciones }] solo de campos activos y con algo marcado, en el orden de los campos.
export const valoresDe = (perfil, campos) =>
  campos.filter((c) => c.activo).map((c) => ({ campo: c.nombre, opciones: perfil?.atributos?.[c.id] ?? [] })).filter((x) => x.opciones.length > 0)
