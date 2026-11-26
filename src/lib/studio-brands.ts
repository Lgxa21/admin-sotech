import "server-only";
import { and, eq, exists, sql } from "drizzle-orm";
import { brandGuides, clients, db, orders } from "@/db";
import { visibleOrders } from "./access";
import { getUser, type SessionUser } from "./auth";
import { contentStudioConfig } from "./content-studio";

export const studioBrandHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function getStudioUser() {
  const user = await getUser();
  return user && contentStudioConfig(user.role) ? user : null;
}

export function visibleStudioBrands(user: SessionUser) {
  const orderAccess = visibleOrders(user);
  return and(eq(clients.active, true), orderAccess && exists(
    db.select({ id: sql`1` }).from(orders).where(and(eq(orders.clientId, brandGuides.clientId), orderAccess)),
  ));
}
