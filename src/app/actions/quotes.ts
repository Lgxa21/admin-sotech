"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, quotes, quoteItems, orders, statusChanges } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManage } from "@/lib/perm";
import { parseAmount } from "@/lib/money";
import { SERVICES } from "@/lib/labels";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

async function manager() {
  const u = await requireUser();
  if (!canManage(u.role)) redirect("/");
  return u;
}

// Líneas de la cotización desde los campos repetidos desc / qty / price.
function itemsFrom(f: FormData) {
  const desc = f.getAll("desc").map(String);
  const qty = f.getAll("qty");
  const price = f.getAll("price");
  return desc
    .map((d, i) => ({ description: d.trim(), qty: parseAmount(qty[i]) ?? 1, unitPrice: parseAmount(price[i]) ?? 0, position: i }))
    .filter((it) => it.description);
}

function fields(f: FormData) {
  const vu = str(f, "validUntil");
  return {
    clientId: str(f, "clientId")!,
    title: str(f, "title") ?? "Cotización",
    currency: (str(f, "currency") === "VES" ? "VES" : "USD") as "USD" | "VES",
    validUntil: vu && /^\d{4}-\d{2}-\d{2}$/.test(vu) ? vu : null,
    notes: str(f, "notes"),
  };
}

export async function saveQuote(id: string | null, f: FormData) {
  const u = await manager();
  const data = fields(f);
  const items = itemsFrom(f);
  if (!data.clientId) redirect(`/finanzas/cotizaciones/${id ?? "nueva"}?error=${encodeURIComponent("Elige un cliente.")}`);
  if (!items.length) redirect(`/finanzas/cotizaciones/${id ?? "nueva"}?error=${encodeURIComponent("Agrega al menos una línea con descripción.")}`);
  let quoteId = id;
  if (id) {
    const q = await db.query.quotes.findFirst({ where: eq(quotes.id, id) });
    if (!q || q.orderId) redirect(`/finanzas/cotizaciones/${id}`);
    await db.update(quotes).set({ ...data, updatedAt: new Date() }).where(eq(quotes.id, id));
    await db.delete(quoteItems).where(eq(quoteItems.quoteId, id));
  } else {
    const [q] = await db.insert(quotes).values({ ...data, createdById: u.id }).returning();
    quoteId = q.id;
  }
  await db.insert(quoteItems).values(items.map((it) => ({ ...it, quoteId: quoteId!, qty: String(it.qty), unitPrice: String(it.unitPrice) })));
  revalidatePath("/finanzas/cotizaciones");
  redirect(`/finanzas/cotizaciones/${quoteId}`);
}

export async function setQuoteStatus(id: string, status: "BORRADOR" | "ENVIADA" | "RECHAZADA") {
  await manager();
  await db.update(quotes).set({ status, updatedAt: new Date() }).where(eq(quotes.id, id));
  revalidatePath("/finanzas/cotizaciones");
  revalidatePath(`/finanzas/cotizaciones/${id}`);
}

// El cliente aprobó: se crea la orden con el precio de la cotización.
export async function convertQuote(id: string, f: FormData) {
  const u = await manager();
  const q = await db.query.quotes.findFirst({ where: eq(quotes.id, id), with: { items: { orderBy: [asc(quoteItems.position)] } } });
  if (!q) redirect("/finanzas/cotizaciones");
  if (q.orderId) redirect(`/ordenes/${q.orderId}`);
  const total = q.items.reduce((a, it) => a + Number(it.qty) * Number(it.unitPrice), 0);
  const svc = str(f, "serviceType");
  const brief = q.items.map((it) => `• ${Number(it.qty)} × ${it.description}`).join("\n") + (q.notes ? `\n\n${q.notes}` : "");
  const [o] = await db.insert(orders).values({
    title: q.title, clientId: q.clientId, serviceType: svc && (SERVICES as readonly string[]).includes(svc) ? (svc as (typeof SERVICES)[number]) : "OTRO",
    brief, budget: total.toFixed(2), currency: q.currency, createdById: u.id, source: "cotizacion",
  }).returning();
  await db.insert(statusChanges).values({ orderId: o.id, from: null, to: "RECIBIDO", userId: u.id, note: `Creada desde la cotización C-${q.number}` });
  await db.update(quotes).set({ status: "APROBADA", orderId: o.id, updatedAt: new Date() }).where(eq(quotes.id, id));
  revalidatePath("/finanzas/cotizaciones");
  redirect(`/ordenes/${o.id}/editar`);
}

export async function deleteQuote(id: string) {
  await manager();
  const q = await db.query.quotes.findFirst({ where: eq(quotes.id, id) });
  if (q && !q.orderId) await db.delete(quotes).where(eq(quotes.id, id));
  revalidatePath("/finanzas/cotizaciones");
  redirect("/finanzas/cotizaciones");
}
