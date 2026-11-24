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

const NEXT_STAGES: Record<Status, readonly Status[]> = {
  RECIBIDO: ["BRIEF_REVISION"],
  BRIEF_REVISION: ["EN_PRODUCCION"],
  EN_PRODUCCION: ["REVISION_INTERNA"],
  REVISION_INTERNA: ["ENVIADO_CLIENTE", "EN_PRODUCCION"],
  ENVIADO_CLIENTE: ["APROBADO", "AJUSTES"],
  AJUSTES: ["REVISION_INTERNA"],
  APROBADO: ["ENTREGADO"],
  ENTREGADO: ["FACTURADO"],
  FACTURADO: ["PAGO_PROVEEDORES"],
  PAGO_PROVEEDORES: [],
};

export function canTransition(u: MoveUser, from: Status, to: Status, reason?: string) {
  return canMoveTo(u, to) && (
    from === to || NEXT_STAGES[from].includes(to) || (canManage(u.role) && Boolean(reason?.trim()))
  );
}
