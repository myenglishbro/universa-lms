import Badge from '../ui/Badge'
import { estadoLabel } from '../../lib/salones'

const color = { en_curso: 'brand', pendiente: 'peach', finalizado: 'slate' }

export default function EstadoBadge({ estado }) {
  return <Badge color={color[estado]}>{estadoLabel(estado)}</Badge>
}
