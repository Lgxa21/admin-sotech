import { getUser } from "@/lib/auth";
import { canManage } from "@/lib/perm";
import { monthReport } from "@/lib/reports";
import { todayCaracas } from "@/lib/money";
import { workbook, sheet, xlsxResponse, day } from "@/lib/xlsx";

export async function GET(req: Request) {
  const u = await getUser();
  if (!u || !canManage(u.role)) return new Response("No autorizado", { status: 403 });
  const q = new URL(req.url).searchParams.get("mes");
  const month = q && /^\d{4}-\d{2}$/.test(q) ? q : todayCaracas().slice(0, 7);
  const r = await monthReport(month);
  const wb = workbook();
  sheet(wb, "Resumen", [{ header: "Concepto", key: "k", width: 40 }, { header: "USD", key: "v", width: 16, money: true }], [
    { k: "Cobrado en el mes", v: r.totals.in },
    { k: "Pagado a proveedores y gastos", v: r.totals.out },
    { k: "Queda en caja", v: r.totals.net },
    { k: "Precio de las órdenes del mes", v: r.totals.price },
    { k: "Costos de las órdenes del mes", v: r.totals.costs },
    { k: "Margen de las órdenes del mes", v: r.totals.price - r.totals.costs },
    { k: "Por cobrar (a hoy)", v: r.totals.receivable },
  ]);
  sheet(wb, "Cobros", [
    { header: "Fecha", key: "date", width: 12, date: true }, { header: "Cliente", key: "client", width: 26 }, { header: "Orden", key: "order", width: 34 },
    { header: "Método", key: "method", width: 14 }, { header: "Referencia", key: "reference", width: 16 }, { header: "Monto", key: "amount", width: 14, money: true },
    { header: "Moneda", key: "currency", width: 9 }, { header: "Tasa", key: "rate", width: 12 }, { header: "USD", key: "usd", width: 14, money: true },
  ], r.cobros.map((c) => ({
    date: day(c.paidOn), client: c.client, order: c.orderNumber ? `#${c.orderNumber} ${c.orderTitle}` : "", method: c.method, reference: c.reference ?? "",
    amount: Number(c.amount), currency: c.currency === "USD" ? "USD" : "Bs.", rate: c.rate ? Number(c.rate) : null, usd: Number(c.amountUsd),
  })), { client: "Total", usd: r.totals.in });
  sheet(wb, "Pagos y gastos", [
    { header: "Fecha", key: "date", width: 12, date: true }, { header: "Tipo", key: "kind", width: 12 }, { header: "Concepto", key: "concept", width: 30 },
    { header: "A quién", key: "supplier", width: 22 }, { header: "Cliente / orden", key: "order", width: 30 }, { header: "Método", key: "method", width: 14 },
    { header: "Monto", key: "amount", width: 14, money: true }, { header: "Moneda", key: "currency", width: 9 }, { header: "USD", key: "usd", width: 14, money: true },
  ], r.pagos.map((c) => ({
    date: day(c.paidOn), kind: c.kind === "GASTO" ? "Gasto" : "Proveedor", concept: c.concept, supplier: c.supplier ?? "", order: `${c.client} · #${c.orderNumber}`,
    method: c.method ?? "", amount: Number(c.amount), currency: c.currency === "USD" ? "USD" : "Bs.", usd: Number(c.amountUsd),
  })), { concept: "Total", usd: r.totals.out });
  sheet(wb, "Rentabilidad", [
    { header: "Cliente", key: "name", width: 28 }, { header: "Órdenes", key: "n", width: 10 }, { header: "Precio USD", key: "price", width: 14, money: true },
    { header: "Costos USD", key: "costs", width: 14, money: true }, { header: "Margen USD", key: "margin", width: 14, money: true }, { header: "Margen %", key: "pct", width: 10 },
  ], r.profit.map((c) => ({ name: c.name, n: c.n, price: c.price, costs: c.costs, margin: c.price - c.costs, pct: c.price ? Math.round(((c.price - c.costs) / c.price) * 100) / 100 : 0 })),
  { name: "Total", price: r.totals.price, costs: r.totals.costs, margin: r.totals.price - r.totals.costs }).getColumn(6).numFmt = "0%";
  sheet(wb, "Por cobrar", [
    { header: "Orden", key: "order", width: 36 }, { header: "Cliente", key: "client", width: 26 }, { header: "Precio USD", key: "price", width: 14, money: true },
    { header: "Cobrado USD", key: "collected", width: 14, money: true }, { header: "Pendiente USD", key: "pending", width: 14, money: true },
  ], r.receivable.map((o) => ({ order: `#${o.number} ${o.title}`, client: o.client, price: o.m.price, collected: o.m.collected, pending: o.m.pending })),
  { order: "Total", pending: r.totals.receivable });
  return xlsxResponse(wb, `finanzas-sotech-${month}.xlsx`);
}
