import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, lt, sql, type SQL } from "drizzle-orm";
import { db, orders, clients, payments, costs, suppliers } from "@/db";
import { moneyByOrder } from "./finance";
import type { Status } from "./labels";

const BILLABLE: Status[] = ["APROBADO", "ENTREGADO", "FACTURADO", "PAGO_PROVEEDORES"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return {
    start: `${month}-01`, next: `${next}-01`,
    startTs: new Date(`${month}-01T00:00:00-04:00`), nextTs: new Date(`${next}-01T00:00:00-04:00`),
    label: `${MONTHS[m - 1]} ${y}`,
  };
}

// Todo lo de un mes: cobros, pagos, rentabilidad por cliente y lo que queda por cobrar.
export async function monthReport(month: string) {
  const r = monthRange(month);
  const [cobros, pagos, monthOrders, billable] = await Promise.all([
    db.select({
      paidOn: payments.paidOn, client: clients.name, orderNumber: orders.number, orderTitle: orders.title, method: payments.method,
      reference: payments.reference, amount: payments.amount, currency: payments.currency, rate: payments.rate, amountUsd: payments.amountUsd,
    }).from(payments).innerJoin(clients, eq(clients.id, payments.clientId)).leftJoin(orders, eq(orders.id, payments.orderId))
      .where(and(gte(payments.paidOn, r.start), lt(payments.paidOn, r.next))).orderBy(asc(payments.paidOn)),
    db.select({
      paidOn: costs.paidOn, kind: costs.kind, concept: costs.concept, supplier: suppliers.name, client: clients.name, orderNumber: orders.number,
      method: costs.method, reference: costs.reference, amount: costs.amount, currency: costs.currency, rate: costs.rate, amountUsd: costs.amountUsd,
    }).from(costs).innerJoin(orders, eq(orders.id, costs.orderId)).innerJoin(clients, eq(clients.id, orders.clientId)).leftJoin(suppliers, eq(suppliers.id, costs.supplierId))
      .where(and(eq(costs.status, "PAGADO"), gte(costs.paidOn, r.start), lt(costs.paidOn, r.next))).orderBy(asc(costs.paidOn)),
    db.select({ id: orders.id, budget: orders.budget, currency: orders.currency, client: clients.name, clientId: clients.id })
      .from(orders).innerJoin(clients, eq(clients.id, orders.clientId))
      .where(and(gte(orders.requestedAt, r.startTs), lt(orders.requestedAt, r.nextTs), isNotNull(orders.budget))),
    db.select({ id: orders.id, number: orders.number, title: orders.title, budget: orders.budget, currency: orders.currency, client: clients.name })
      .from(orders).innerJoin(clients, eq(clients.id, orders.clientId))
      .where(and(inArray(orders.status, BILLABLE), isNotNull(orders.budget))).orderBy(asc(orders.statusChangedAt)),
  ]);
  const mm = await moneyByOrder(monthOrders);
  const byClient = new Map<string, { name: string; n: number; price: number; costs: number }>();
  for (const o of monthOrders) {
    const x = mm.get(o.id)!;
    const c = byClient.get(o.clientId) ?? { name: o.client, n: 0, price: 0, costs: 0 };
    c.n++; c.price += x.price; c.costs += x.costs;
    byClient.set(o.clientId, c);
  }
  const bm = await moneyByOrder(billable);
  const receivable = billable.map((o) => ({ ...o, m: bm.get(o.id)! })).filter((o) => o.m.pending > 0.009);
  const totIn = cobros.reduce((a, c) => a + Number(c.amountUsd), 0);
  const totOut = pagos.reduce((a, c) => a + Number(c.amountUsd), 0);
  const profit = [...byClient.values()].sort((a, b) => b.price - b.costs - (a.price - a.costs));
  return {
    label: r.label, cobros, pagos, profit, receivable,
    totals: {
      in: totIn, out: totOut, net: totIn - totOut,
      price: profit.reduce((a, c) => a + c.price, 0), costs: profit.reduce((a, c) => a + c.costs, 0),
      receivable: receivable.reduce((a, o) => a + o.m.pending, 0),
    },
  };
}

export async function ordersForExport(where: SQL | undefined) {
  return db.select({
    number: orders.number, title: orders.title, client: clients.name, serviceType: orders.serviceType, status: orders.status, priority: orders.priority,
    requestedAt: orders.requestedAt, dueDate: orders.dueDate, budget: orders.budget, currency: orders.currency, invoiceNumber: orders.invoiceNumber,
    owner: sql<string | null>`(select name from users where users.id = ${orders.ownerId})`,
  }).from(orders).innerJoin(clients, eq(clients.id, orders.clientId)).where(where).orderBy(desc(orders.number));
}
