import "server-only";
import { and, eq, isNull, lte, or, gte } from "drizzle-orm";
import { db, retainers, orders, tasks, statusChanges, clients, users } from "@/db";
import { notify } from "./notify";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const currentPeriod = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" }).slice(0, 7);
export const periodLabel = (p: string) => `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;

// Crea la orden del mes de cada iguala activa que todavía no la tenga. Es seguro llamarla muchas veces.
export async function ensureRetainerOrders(period = currentPeriod()) {
  const active = await db.select().from(retainers).where(and(
    eq(retainers.active, true), lte(retainers.startPeriod, period),
    or(isNull(retainers.endPeriod), gte(retainers.endPeriod, period)),
  ));
  let created = 0;
  for (const r of active) {
    const exists = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.retainerId, r.id), eq(orders.period, period))).limit(1);
    if (exists.length) continue;
    const [creator] = r.ownerId ? [{ id: r.ownerId }] : await db.select({ id: users.id }).from(users).where(and(eq(users.role, "DIRECCION"), eq(users.active, true))).limit(1);
    if (!creator) continue;
    const [y, m] = period.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const due = new Date(`${period}-${String(Math.min(r.dueDay, lastDay)).padStart(2, "0")}T18:00:00-04:00`);
    const items = r.items ?? [];
    const [o] = await db.insert(orders).values({
      title: `${r.title} · ${periodLabel(period)}`, clientId: r.clientId, serviceType: r.serviceType, budget: r.amount, currency: r.currency,
      ownerId: r.ownerId, createdById: creator.id, isRecurring: true, retainerId: r.id, period, source: "iguala", dueDate: due,
      revisionRoundsIncluded: r.revisionRounds,
      brief: items.length ? `Entregables del mes:\n${items.map((i) => `• ${i.qty} × ${i.title}`).join("\n")}` : null,
    }).onConflictDoNothing().returning();
    if (!o) continue;
    await db.insert(statusChanges).values({ orderId: o.id, from: null, to: "RECIBIDO", userId: creator.id, note: `Orden mensual de la iguala (${periodLabel(period)})` });
    if (items.length) {
      await db.insert(tasks).values(items.map((i) => ({ orderId: o.id, title: `${i.qty} × ${i.title}`, assigneeId: r.ownerId, createdById: creator.id, status: "PENDIENTE" as const, dueDate: due })));
    }
    const [c] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, r.clientId));
    await notify([r.ownerId], `Se creó la orden de ${periodLabel(period)} de la iguala de ${c?.name ?? "un cliente"}`, { orderId: o.id });
    created++;
  }
  return created;
}
