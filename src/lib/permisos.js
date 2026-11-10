// Qué pantallas del panel de gestión ve cada rol. Solo adapta la interfaz: la seguridad real la aplican las políticas RLS
// (ver migración rol_rrhh). `admin` ve todo y es el único que edita. «tickets» (Task Board) es de todo el personal activo
// (admin, comercial, rrhh): todos pueden crear y gestionar tickets; docentes y estudiantes no tienen panel de gestión.
const PANTALLAS = {
  admin: null, // null = todas
  rrhh: ['dashboard', 'tickets', 'salones', 'estudiantes', 'registros', 'feriados'],
  comercial: ['dashboard', 'tickets'],
}

// Pantallas que existen en el panel de gestión: son también el segmento de la URL (/panel/estudiantes).
export const PANTALLAS_PANEL = ['dashboard', 'tickets', 'agenda', 'salones', 'paquetes', 'estudiantes', 'docentes', 'frecuencias', 'evaluaciones', 'ejercicios', 'archivo', 'registros', 'zonas', 'usuarios', 'feriados']

export const puedeVer = (rol, pantalla) => {
  if (!(rol in PANTALLAS)) return false
  return PANTALLAS[rol] === null || PANTALLAS[rol].includes(pantalla)
}

export const pantallaInicial = (rol) => (puedeVer(rol, 'dashboard') ? 'dashboard' : PANTALLAS[rol]?.[0] ?? 'dashboard')
