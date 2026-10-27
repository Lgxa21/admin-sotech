import type { RoleT } from "./labels";

// Solo dirección y administración ven montos.
export const canSeeMoney = (r: RoleT) => r === "DIRECCION" || r === "ADMINISTRACION";
// Dirección y administración gestionan clientes y órdenes.
export const canManage = (r: RoleT) => r === "DIRECCION" || r === "ADMINISTRACION";
// Solo dirección aprueba una pieza antes de enviarla al cliente y administra el equipo.
export const isDirector = (r: RoleT) => r === "DIRECCION";
