// Foto de perfil a partir de un enlace de Google Drive (el profesor sube su foto a su Drive y pega el enlace).
// Solo se aceptan enlaces de Drive; la imagen se pide como miniatura, que Drive entrega si el archivo está compartido con «Cualquier persona con el enlace».
export function idDeDrive(url) {
  try {
    const u = new URL((url ?? '').trim())
    if (u.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(u.hostname)) return null
    const m = u.pathname.match(/\/d\/([\w-]+)/)
    const id = m?.[1] ?? u.searchParams.get('id')
    return id && /^[\w-]+$/.test(id) ? id : null
  } catch {
    return null
  }
}

export const fotoDeDrive = (url) => {
  const id = idDeDrive(url)
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w400` : null
}

// Mensaje de error o '' si el enlace sirve como foto (vacío = sin foto, también válido).
export function validarFoto(url) {
  const t = (url ?? '').trim()
  if (!t) return ''
  return idDeDrive(t) ? '' : 'Pega el enlace de tu foto en Google Drive (clic derecho en la foto → Compartir → Copiar enlace)'
}
