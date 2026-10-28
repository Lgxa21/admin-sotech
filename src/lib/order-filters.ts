import "server-only";
import { and, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { orders, clients } from "@/db";
import type { SessionUser } from "./auth";
import { visibleOrders } from "./access";
import { STATUSES, SERVICES, type Status } from "./labels";

export type OrderSearch = Record<string, string | undefined>;

// Filtros del tablero (los mismos para la lista y para exportar a Excel). La consulta debe unir clients.
export function orderFilters(u: SessionUser, sp: OrderSearch): SQL | undefined {
  const f: (SQL | undefined)[] = [visibleOrders(u)];
  if (sp.estado && (STATUSES as readonly string[]).includes(sp.estado)) f.push(eq(orders.status, sp.estado as Status));
  else if (!sp.cerradas) f.push(sql`${orders.status} <> 'PAGO_PROVEEDORES'`);
  if (sp.cliente) f.push(eq(orders.clientId, sp.cliente));
  if (sp.responsable) f.push(eq(orders.ownerId, sp.responsable));
  if (sp.servicio && (SERVICES as readonly string[]).includes(sp.servicio)) f.push(eq(orders.serviceType, sp.servicio as (typeof SERVICES)[number]));
  if (sp.q) f.push(or(ilike(orders.title, `%${sp.q}%`), ilike(clients.name, `%${sp.q}%`), sql`${orders.number}::text = ${sp.q.replace("#", "")}`));
  return and(...f);
}
