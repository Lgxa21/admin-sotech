"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, ilike, and, or } from "drizzle-orm";
import { db, orders, comments, statusChanges, tasks, users } from "@/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { canAccessOrder } from "@/lib/access";
import { notify, usersWithRole } from "@/lib/notify";
import { canManage } from "@/lib/perm";
import { cleanBrief } from "@/lib/briefs";
import {
  STATUSES, SERVICES, PRIORITIES, STATUS_LABEL, fromInputDate, type Status,
} from "@/lib/labels";
import { str, pick, fail, isUuid } from "@/lib/form";
import { canMoveTo } from "@/lib/order-workflow";

function orderFields(f: FormData, u: SessionUser) {
  const base = {
    title: str(f, "title") ?? "Sin título",
    clientId: str(f, "clientId")!,
    serviceType: pick(SERVICES, str(f, "serviceType"), "OTRO"),
    priority: pick(PRIORITIES, str(f, "priority"), "MEDIA"),
    brief: cleanBrief(str(f, "brief")),
    copy: str(f, "copy"),
    platform: str(f, "platform"),
    formats: str(f, "formats"),
    referenceLinks: str(f, "referenceLinks"),
    dueDate: fromInputDate(f.get("dueDate")),
    ownerId: str(f, "ownerId"),
    revisionRoundsIncluded: Math.max(0, Number(str(f, "revisionRoundsIncluded") ?? 2) || 0),
    internalNotes: str(f, "internalNotes"),
    isRecurring: f.get("isRecurring") === "on",
  };
  if (!canManage(u.role)) return base;
  const budget = str(f, "budget");
  return {
    ...base,
    budget: budget ? budget.replace(/\./g, "").replace(",", ".") : null,
    currency: pick(["USD", "VES"] as const, str(f, "currency"), "USD"),
    invoiceNumber: str(f, "invoiceNumber"),
  };
}

export async function createOrder(f: FormData) {
  const u = await requireUser();
  if (!canManage(u.role)) fail("/ordenes/nueva", "Solo dirección o administración crean órdenes.");
  const data = orderFields(f, u);
  if (!isUuid(data.clientId)) fail("/ordenes/nueva", "Elige un cliente.");
  const o = await db.transaction(async (tx) => {
    const [row] = await tx.insert(orders).values({ ...data, createdById: u.id }).returning();
    await tx.insert(statusChanges).values({ orderId: row.id, from: null, to: "RECIBIDO", userId: u.id, note: "Orden creada" });
    return row;
  });
  await notify([o.ownerId], `Te asignaron la orden #${o.number}: ${o.title}`, { orderId: o.id, exclude: u.id, kind: "tarea" });
  revalidatePath("/ordenes");
  redirect(`/ordenes/${o.id}?ok=${encodeURIComponent("Orden creada.")}`);
}

export async function updateOrder(id: string, f: FormData) {
  const u = await requireUser();
  if (!canManage(u.role)) fail(`/ordenes/${id}/editar`, "No tienes permiso para editar esta orden.");
  const prev = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!prev) fail("/ordenes", "La orden no existe.");
  const data = orderFields(f, u);
  if (!isUuid(data.clientId)) fail(`/ordenes/${id}/editar`, "Elige un cliente.");
  await db.update(orders).set({ ...data, updatedAt: new Date() }).where(eq(orders.id, id));
  if (data.ownerId && data.ownerId !== prev.ownerId) {
    await notify([data.ownerId], `Te asignaron la orden #${prev.number}: ${data.title}`, { orderId: id, exclude: u.id, kind: "tarea" });
  }
  revalidatePath(`/ordenes/${id}`);
  redirect(`/ordenes/${id}?ok=${encodeURIComponent("Cambios guardados.")}`);
}

export async function moveOrder(id: string, toRaw: string, note?: string) {
  const u = await requireUser();
  const to = pick(STATUSES, toRaw, "RECIBIDO");
  if (!(await canAccessOrder(u, id))) return { error: "No tienes acceso a esta orden." };
  if (!canMoveTo(u, to)) {
    return { error: to === "ENVIADO_CLIENTE" ? "Solo dirección puede aprobar y enviar una pieza al cliente." : "Tu rol no puede mover la orden a esa etapa." };
  }
  const o = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!o || o.status === to) return { ok: true };

  let rounds = o.revisionRoundsUsed;
  if (o.status === "ENVIADO_CLIENTE" && to === "AJUSTES") rounds += 1;

  await db.transaction(async (tx) => {
    await tx.update(orders).set({ status: to, statusChangedAt: new Date(), revisionRoundsUsed: rounds, updatedAt: new Date() }).where(eq(orders.id, id));
    await tx.insert(statusChanges).values({ orderId: id, from: o.status, to, userId: u.id, note: note || null });
  });

  const label = `#${o.number} ${o.title}`;
  await notify([o.ownerId], `${label} pasó a "${STATUS_LABEL[to]}"`, { orderId: id, exclude: u.id, kind: "estado" });
  if (to === "REVISION_INTERNA") {
    await notify(await usersWithRole("DIRECCION"), `${label} está lista para tu revisión`, { orderId: id, exclude: u.id, kind: "estado" });
  }
  if (to === "AJUSTES" && rounds > o.revisionRoundsIncluded) {
    await notify(await usersWithRole("DIRECCION", "ADMINISTRACION"),
      `${label}: el cliente pidió la ronda ${rounds} y solo hay ${o.revisionRoundsIncluded} incluidas`, { orderId: id, urgent: true, kind: "urgencia" });
  }
  if (to === "APROBADO" || to === "ENTREGADO") {
    await notify(await usersWithRole("ADMINISTRACION"), `${label} está lista para facturar`, { orderId: id, exclude: u.id, kind: "finanzas" });
  }
  revalidatePath("/ordenes");
  revalidatePath(`/ordenes/${id}`);
  revalidatePath("/");
  return { ok: true };
}

export async function moveOrderForm(id: string, f: FormData) {
  const r = await moveOrder(id, String(f.get("to") || ""), str(f, "note") ?? undefined);
  if (r && "error" in r && r.error) redirect(`/ordenes/${id}?error=${encodeURIComponent(r.error)}`);
  redirect(`/ordenes/${id}`);
}

async function mentioned(body: string) {
  const names = [...body.matchAll(/@([\p{L}][\p{L}\-]+)/gu)].map((m) => m[1]);
  if (!names.length) return [];
  // Una sola query con OR en lugar de N+1.
  const conds = names.map((n) => ilike(users.name, `${n}%`));
  const found = await db.select({ id: users.id }).from(users).where(and(eq(users.active, true), or(...conds)));
  return found.map((r) => r.id);
}

export async function addComment(id: string, f: FormData) {
  const u = await requireUser();
  const body = str(f, "body");
  if (!body || !(await canAccessOrder(u, id))) redirect(`/ordenes/${id}`);
  const o = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!o) redirect("/ordenes");
  await db.insert(comments).values({ orderId: id, authorId: u.id, body });
  const ids = await mentioned(body);
  await notify(ids, `${u.name} te mencionó en #${o.number}: ${body.slice(0, 90)}`, { orderId: id, exclude: u.id, kind: "mencion" });
  revalidatePath(`/ordenes/${id}`);
  redirect(`/ordenes/${id}#comentarios`);
}

export async function registerClientChange(id: string, f: FormData) {
  const u = await requireUser();
  const body = str(f, "body");
  if (!body || !(await canAccessOrder(u, id)) || u.role === "FREELANCER") redirect(`/ordenes/${id}`);
  const o = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!o) redirect("/ordenes");
  await db.transaction(async (tx) => {
    await tx.insert(comments).values({ orderId: id, authorId: u.id, body, kind: "cambio_cliente" });
    await tx.insert(tasks).values({
      orderId: id, title: `Cambio del cliente: ${body.slice(0, 80)}`, notes: body,
      assigneeId: o.ownerId, createdById: u.id, status: "PENDIENTE",
    });
  });
  await notify([o.ownerId], `Cambio del cliente en #${o.number}: ${body.slice(0, 90)}`, { orderId: id, exclude: u.id, kind: "tarea" });
  revalidatePath(`/ordenes/${id}`);
  redirect(`/ordenes/${id}#comentarios`);
}

export async function raiseUrgency(id: string, f: FormData) {
  const u = await requireUser();
  const body = str(f, "body");
  if (!body || !(await canAccessOrder(u, id))) redirect(`/ordenes/${id}`);
  const o = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!o) redirect("/ordenes");
  await db.transaction(async (tx) => {
    await tx.update(orders).set({ priority: "URGENTE", updatedAt: new Date() }).where(eq(orders.id, id));
    await tx.insert(comments).values({ orderId: id, authorId: u.id, body, kind: "urgencia" });
  });
  await notify(await usersWithRole("DIRECCION"), `URGENCIA en #${o.number} ${o.title}: ${body.slice(0, 90)}`, { orderId: id, urgent: true, exclude: u.id, kind: "urgencia" });
  revalidatePath(`/ordenes/${id}`);
  revalidatePath("/");
  redirect(`/ordenes/${id}#comentarios`);
}
