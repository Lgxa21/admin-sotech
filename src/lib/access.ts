import "server-only";
import { and, eq, exists, or, sql, type SQL } from "drizzle-orm";
import { db, orders, tasks } from "@/db";
import type { SessionUser } from "./auth";
import { canManage } from "./perm";

// Condición SQL de las órdenes que un usuario puede ver.
export function visibleOrders(u: SessionUser): SQL | undefined {
  if (canManage(u.role)) return undefined;
  const hasTask = exists(db.select({ x: sql`1` }).from(tasks).where(and(eq(tasks.orderId, orders.id), eq(tasks.assigneeId, u.id))));
  if (u.role === "FREELANCER") return hasTask;
  return or(eq(orders.ownerId, u.id), hasTask);
}

export async function canAccessOrder(u: SessionUser, orderId: string) {
  const where = visibleOrders(u);
  const row = await db.select({ id: orders.id }).from(orders).where(where ? and(eq(orders.id, orderId), where) : eq(orders.id, orderId)).limit(1);
  return row.length > 0;
}
