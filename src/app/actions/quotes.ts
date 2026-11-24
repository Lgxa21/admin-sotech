"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, quotes, quoteItems, orders, statusChanges } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManage } from "@/lib/perm";
import { parseAmount } from "@/lib/money";
import { SERVICES } from "@/lib/labels";
import { str, fail } from "@/lib/form";
import { audit } from "@/lib/audit";

async function manager() {
  const u = await requireUser();
  if (!canManage(u.role)) redirect("/");
  return u;
}

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
  const path = `/finanzas/cotizaciones/${id ?? "nueva"}`;
  if (!data.clientId) fail(path, "Elige un cliente.");
  if (!items.length) fail(path, "Agrega al menos una línea con descripción.");
  const quoteId = await db.transaction(async (tx) => {
    let qid = id;
    if (id) {
      const [q] = await tx.select().from(quotes).where(eq(quotes.id, id)).for("update");
      if (!q || q.orderId) return id;
      await tx.update(quotes).set({ ...data, updatedAt: new Date() }).where(eq(quotes.id, id));
      await tx.delete(quoteItems).where(eq(quoteItems.quoteId, id));
    } else {
      const [q] = await tx.insert(quotes).values({ ...data, createdById: u.id }).returning();
      qid = q.id;
    }
    await tx.insert(quoteItems).values(items.map((it) => ({ ...it, quoteId: qid!, qty: String(it.qty), unitPrice: String(it.unitPrice) })));
    return qid!;
  });
  revalidatePath("/finanzas/cotizaciones");
  redirect(`/finanzas/cotizaciones/${quoteId}`);
}

export async function setQuoteStatus(id: string, status: "BORRADOR" | "ENVIADA" | "RECHAZADA") {
  await manager();
  await db.update(quotes).set({ status, updatedAt: new Date() }).where(and(eq(quotes.id, id), isNull(quotes.orderId)));
  revalidatePath("/finanzas/cotizaciones");
  revalidatePath(`/finanzas/cotizaciones/${id}`);
}

export async function convertQuote(id: string, f: FormData) {
  const u = await manager();
  const svc = str(f, "serviceType");
  const result = await db.transaction(async (tx) => {
    const [q] = await tx.select().from(quotes).where(eq(quotes.id, id)).for("update");
    if (!q) return null;
    if (q.orderId) return { orderId: q.orderId, created: false };
    const items = await tx.query.quoteItems.findMany({
      where: eq(quoteItems.quoteId, id),
      orderBy: [asc(quoteItems.position)],
    });
    const total = items.reduce((sum, item) => sum + Number(item.qty) * Number(item.unitPrice), 0);
    const brief = items.map((item) => `• ${Number(item.qty)} × ${item.description}`).join("\n")
      + (q.notes ? `\n\n${q.notes}` : "");
    const [order] = await tx.insert(orders).values({
      title: q.title, clientId: q.clientId, serviceType: svc && (SERVICES as readonly string[]).includes(svc) ? (svc as (typeof SERVICES)[number]) : "OTRO",
      brief, budget: total.toFixed(2), currency: q.currency, createdById: u.id, source: "cotizacion",
    }).returning();
    await tx.insert(statusChanges).values({ orderId: order.id, from: null, to: "RECIBIDO", userId: u.id, note: `Creada desde la cotización C-${q.number}` });
    await tx.update(quotes).set({ status: "APROBADA", orderId: order.id, updatedAt: new Date() }).where(eq(quotes.id, id));
    return { orderId: order.id, created: true };
  });
  revalidatePath("/finanzas/cotizaciones");
  if (!result) redirect("/finanzas/cotizaciones");
  redirect(`/ordenes/${result.orderId}${result.created ? "/editar" : ""}`);
}

export async function deleteQuote(id: string) {
  const u = await manager();
  const [q] = await db.delete(quotes).where(and(eq(quotes.id, id), isNull(quotes.orderId))).returning();
  if (q) {
    await audit("quote_deleted", { actorId: u.id, entityType: "quote", entityId: id, detail: { number: q.number, title: q.title } });
  }
  revalidatePath("/finanzas/cotizaciones");
  redirect("/finanzas/cotizaciones");
}
