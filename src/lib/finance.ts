import "server-only";
import { inArray, sql } from "drizzle-orm";
import { db, payments, costs } from "@/db";
import { rateFor } from "./rates";

export type OrderMoney = { price: number; collected: number; costs: number; costsPaid: number; margin: number; pending: number };

// Totales en USD por orden: precio, cobrado, costos (pagados y por pagar) y margen.
export async function moneyByOrder(list: { id: string; budget: string | null; currency: "USD" | "VES" }[]) {
  const out = new Map<string, OrderMoney>();
  if (!list.length) return out;
  const ids = list.map((o) => o.id);
  const [paid, cost, rate] = await Promise.all([
    db.select({ orderId: payments.orderId, total: sql<string>`sum(${payments.amountUsd})` }).from(payments).where(inArray(payments.orderId, ids)).groupBy(payments.orderId),
    db.select({
      orderId: costs.orderId,
      total: sql<string>`sum(${costs.amountUsd})`,
      paid: sql<string>`coalesce(sum(${costs.amountUsd}) filter (where ${costs.status} = 'PAGADO'), 0)`,
    }).from(costs).where(inArray(costs.orderId, ids)).groupBy(costs.orderId),
    list.some((o) => o.currency === "VES") ? rateFor() : Promise.resolve(null),
  ]);
  const paidBy = new Map(paid.map((p) => [p.orderId, Number(p.total)]));
  const costBy = new Map(cost.map((c) => [c.orderId, { total: Number(c.total), paid: Number(c.paid) }]));
  for (const o of list) {
    const raw = Number(o.budget ?? 0);
    const price = o.currency === "VES" ? (rate ? Math.round((raw / rate.rate) * 100) / 100 : 0) : raw;
    const collected = paidBy.get(o.id) ?? 0;
    const c = costBy.get(o.id) ?? { total: 0, paid: 0 };
    out.set(o.id, { price, collected, costs: c.total, costsPaid: c.paid, margin: Math.round((price - c.total) * 100) / 100, pending: Math.max(0, Math.round((price - collected) * 100) / 100) });
  }
  return out;
}
