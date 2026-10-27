import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, notifications, users } from "@/db";
import type { RoleT } from "./labels";

export async function notify(userIds: (string | null | undefined)[], text: string, opts: { orderId?: string; urgent?: boolean; exclude?: string } = {}) {
  const ids = [...new Set(userIds.filter((x): x is string => !!x && x !== opts.exclude))];
  if (!ids.length) return;
  await db.insert(notifications).values(ids.map((userId) => ({ userId, text, orderId: opts.orderId, urgent: !!opts.urgent })));
}

export async function usersWithRole(...roles: RoleT[]) {
  const rows = await db.select({ id: users.id }).from(users).where(and(inArray(users.role, roles), eq(users.active, true)));
  return rows.map((r) => r.id);
}
