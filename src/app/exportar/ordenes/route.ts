import { getUser } from "@/lib/auth";
import { orderFilters } from "@/lib/order-filters";
import { ordersForExport } from "@/lib/reports";
import { canSeeMoney } from "@/lib/perm";
import { SERVICE_LABEL, STATUS_LABEL, PRIORITY_LABEL, type Status, type Service, type PriorityT } from "@/lib/labels";
import { workbook, sheet, xlsxResponse, caracasDay } from "@/lib/xlsx";

export async function GET(req: Request) {
  const u = await getUser();
  if (!u || u.role === "FREELANCER") return new Response("No autorizado", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const rows = await ordersForExport(orderFilters(u, sp));
  const money = canSeeMoney(u.role);
  const wb = workbook();
  sheet(wb, "Órdenes", [
    { header: "N.º", key: "number", width: 8 },
    { header: "Orden", key: "title", width: 40 },
    { header: "Cliente", key: "client", width: 26 },
    { header: "Servicio", key: "service", width: 18 },
    { header: "Etapa", key: "status", width: 22 },
    { header: "Prioridad", key: "priority", width: 11 },
    { header: "Responsable", key: "owner", width: 22 },
    { header: "Solicitada", key: "requestedAt", width: 12, date: true },
    { header: "Entrega", key: "dueDate", width: 12, date: true },
    ...(money ? [
      { header: "Precio", key: "budget", width: 14, money: true },
      { header: "Moneda", key: "currency", width: 9 },
      { header: "Factura", key: "invoiceNumber", width: 14 },
    ] : []),
  ], rows.map((o) => ({
    number: o.number, title: o.title, client: o.client, service: SERVICE_LABEL[o.serviceType as Service], status: STATUS_LABEL[o.status as Status],
    priority: PRIORITY_LABEL[o.priority as PriorityT], owner: o.owner ?? "", requestedAt: caracasDay(o.requestedAt), dueDate: caracasDay(o.dueDate),
    ...(money ? { budget: o.budget ? Number(o.budget) : null, currency: o.currency === "USD" ? "USD" : "Bs.", invoiceNumber: o.invoiceNumber ?? "" } : {}),
  })));
  const stamp = new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
  return xlsxResponse(wb, `ordenes-sotech-${stamp}.xlsx`);
}
