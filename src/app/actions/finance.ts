"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, exchangeRates, payments, costs, suppliers, orders } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManage } from "@/lib/perm";
import { notify, usersWithRole } from "@/lib/notify";
import { parseAmount, parseRate, toUsd, todayCaracas, PAYMENT_METHODS, usd } from "@/lib/money";
import { rateFor, ensureTodayRate, fetchBcvRate, AUTO_SOURCE } from "@/lib/rates";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const day = (f: FormData, k: string) => {
  const v = str(f, k);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : todayCaracas();
};
const back = (f: FormData, fallback: string) => {
  const v = str(f, "back");
  return v && v.startsWith("/") && !v.startsWith("//") ? v : fallback;
};
function fail(to: string, msg: string): never {
  const sep = to.includes("?") ? "&" : "?";
  redirect(`${to.split("#")[0]}${sep}error=${encodeURIComponent(msg)}${to.includes("#") ? "#" + to.split("#")[1] : ""}`);
}

async function manager() {
  const u = await requireUser();
  if (!canManage(u.role)) redirect("/");
  return u;
}

// Moneda, monto y tasa de un formulario, con el equivalente en USD.
async function amounts(f: FormData, to: string) {
  const amount = parseAmount(f.get("amount"));
  if (!amount || amount <= 0) fail(to, "Escribe un monto mayor que cero.");
  const currency = str(f, "currency") === "VES" ? "VES" : "USD";
  let rate = parseRate(f.get("rate"));
  if (currency === "VES" && !rate) {
    await ensureTodayRate();
    rate = (await rateFor(day(f, "date")))?.rate ?? null;
  }
  if (currency === "VES" && !rate) fail(to, "Registra la tasa del día en Finanzas antes de cargar montos en bolívares.");
  return { amount, currency: currency as "USD" | "VES", rate: currency === "VES" ? rate : null, amountUsd: toUsd(amount, currency, rate) };
}

export async function setRate(f: FormData) {
  const u = await manager();
  const to = back(f, "/finanzas");
  const rate = parseRate(f.get("rate"));
  if (!rate) fail(to, "Escribe la tasa en bolívares por dólar, por ejemplo 215,40.");
  const d = day(f, "day");
  await db.insert(exchangeRates).values({ day: d, rate: String(rate), source: str(f, "source") ?? "BCV", createdById: u.id })
    .onConflictDoUpdate({ target: exchangeRates.day, set: { rate: String(rate), source: str(f, "source") ?? "BCV", createdById: u.id } });
  revalidatePath("/finanzas", "layout");
  redirect(to);
}

// Trae la tasa oficial del BCV y la guarda como la de hoy (reemplaza la que hubiera).
export async function refreshBcvRate(f: FormData) {
  const u = await manager();
  const to = back(f, "/finanzas");
  let rate: number;
  try { rate = await fetchBcvRate(); } catch { fail(to, "No pudimos consultar la tasa del BCV en este momento. Cárgala a mano o intenta más tarde."); }
  const today = todayCaracas();
  await db.insert(exchangeRates).values({ day: today, rate: String(rate), source: AUTO_SOURCE, createdById: u.id })
    .onConflictDoUpdate({ target: exchangeRates.day, set: { rate: String(rate), source: AUTO_SOURCE, createdById: u.id } });
  revalidatePath("/finanzas", "layout");
  redirect(to);
}

export async function addPayment(f: FormData) {
  const u = await manager();
  const to = back(f, "/finanzas/cobros");
  const orderId = str(f, "orderId");
  let clientId = str(f, "clientId");
  const order = orderId ? await db.query.orders.findFirst({ where: eq(orders.id, orderId) }) : null;
  if (order) clientId = order.clientId;
  if (!clientId) fail(to, "Elige el cliente que pagó.");
  const m = await amounts(f, to);
  const methodRaw = str(f, "method");
  const method = methodRaw && (PAYMENT_METHODS as readonly string[]).includes(methodRaw) ? methodRaw : "Otro";
  await db.insert(payments).values({
    clientId, orderId: order?.id ?? null, ...m, amount: String(m.amount), rate: m.rate ? String(m.rate) : null, amountUsd: String(m.amountUsd),
    method, reference: str(f, "reference"), paidOn: day(f, "date"), notes: str(f, "notes"), createdById: u.id,
  });
  if (order) {
    await notify(await usersWithRole("DIRECCION"), `Cobro de ${usd(m.amountUsd)} registrado en #${order.number} ${order.title}`, { orderId: order.id, exclude: u.id, kind: "finanzas" });
    revalidatePath(`/ordenes/${order.id}`);
  }
  revalidatePath("/finanzas", "layout");
  redirect(to);
}

export async function deletePayment(id: string, backTo: string) {
  await manager();
  const [p] = await db.delete(payments).where(eq(payments.id, id)).returning();
  if (p?.orderId) revalidatePath(`/ordenes/${p.orderId}`);
  revalidatePath("/finanzas", "layout");
  redirect(backTo.startsWith("/") ? backTo : "/finanzas/cobros");
}

export async function addCost(f: FormData) {
  const u = await manager();
  const orderId = str(f, "orderId");
  const to = back(f, orderId ? `/ordenes/${orderId}#dinero` : "/finanzas/pagos");
  if (!orderId) fail(to, "Elige la orden a la que pertenece el costo.");
  const concept = str(f, "concept");
  if (!concept) fail(to, "Escribe el concepto, por ejemplo \"Impresión de lona\".");
  const m = await amounts(f, to);
  const paid = f.get("paid") === "on";
  await db.insert(costs).values({
    orderId, kind: str(f, "kind") === "GASTO" ? "GASTO" : "PROVEEDOR", supplierId: str(f, "supplierId"), concept,
    amount: String(m.amount), currency: m.currency, rate: m.rate ? String(m.rate) : null, amountUsd: String(m.amountUsd),
    status: paid ? "PAGADO" : "PENDIENTE", paidOn: paid ? day(f, "date") : null, method: paid ? str(f, "method") : null,
    reference: paid ? str(f, "reference") : null, createdById: u.id,
  });
  revalidatePath(`/ordenes/${orderId}`);
  revalidatePath("/finanzas", "layout");
  redirect(to);
}

export async function markCostPaid(id: string, f: FormData) {
  await manager();
  const c = await db.query.costs.findFirst({ where: eq(costs.id, id) });
  if (!c) redirect("/finanzas/pagos");
  const method = str(f, "method");
  await db.update(costs).set({ status: "PAGADO", paidOn: day(f, "date"), method: method && (PAYMENT_METHODS as readonly string[]).includes(method) ? method : "Otro", reference: str(f, "reference") }).where(eq(costs.id, id));
  revalidatePath(`/ordenes/${c.orderId}`);
  revalidatePath("/finanzas", "layout");
  redirect(back(f, "/finanzas/pagos"));
}

export async function deleteCost(id: string, backTo: string) {
  await manager();
  const [c] = await db.delete(costs).where(eq(costs.id, id)).returning();
  if (c) revalidatePath(`/ordenes/${c.orderId}`);
  revalidatePath("/finanzas", "layout");
  redirect(backTo.startsWith("/") ? backTo : "/finanzas/pagos");
}

export async function createSupplier(f: FormData) {
  await manager();
  const to = back(f, "/finanzas/pagos");
  const name = str(f, "name");
  if (!name) fail(to, "Escribe el nombre del proveedor.");
  await db.insert(suppliers).values({ name, kind: str(f, "kind") === "FREELANCER" ? "FREELANCER" : "PROVEEDOR", contact: str(f, "contact"), userId: str(f, "userId") });
  revalidatePath("/finanzas", "layout");
  redirect(to);
}
