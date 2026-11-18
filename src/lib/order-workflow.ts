import { canManage, isDirector } from "./perm";
import type { RoleT } from "./labels";
import type { Status } from "./labels";

export type MoveUser = { role: RoleT };

/** Quién puede mover una orden a cada etapa. */
export function canMoveTo(u: MoveUser, to: Status) {
  if (u.role === "FREELANCER") return false;
  if (to === "ENVIADO_CLIENTE") return isDirector(u.role); // solo dirección aprueba antes del cliente
  if (to === "FACTURADO" || to === "PAGO_PROVEEDORES") return canManage(u.role);
  if (canManage(u.role)) return true;
  // Producción puede marcar aprobación/entrega operativa (p. ej. el cliente llamó).
  return ["BRIEF_REVISION", "EN_PRODUCCION", "REVISION_INTERNA", "AJUSTES", "APROBADO", "ENTREGADO"].includes(to);
}
