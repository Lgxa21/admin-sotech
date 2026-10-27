"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, ilike, and } from "drizzle-orm";
import { db, orders, comments, statusChanges, tasks, users } from "@/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { canAccessOrder } from "@/lib/access";
import { notify, usersWithRole } from "@/lib/notify";
import { canManage, isDirector } from "@/lib/perm";
import {
  STATUSES, SERVICES, PRIORITIES, STATUS_LABEL, fromInputDate, type Status,
} from "@/lib/labels";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const pick = <T extends readonly string[]>(list: T, v: string | null, fallback: T[number]): T[number] =>
  v && (list as readonly string[]).includes(v) ? (v as T[number]) : fallback;

function orderFields(f: FormData, u: SessionUser) {
  const base = {
    title: str(f, "title") ?? "Sin título",
    clientId: str(f, "clientId")!,
    serviceType: pick(SERVICES, str(f, "serviceType"), "OTRO"),
    priority: pick(PRIORITIES, str(f, "priority"), "MEDIA"),
    brief: str(f, "brief"),
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
  // Montos y factura solo los registra quien puede ver dinero.
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
  if (!canManage(u.role)) throw new Error("Solo dirección o administración crean órdenes.");
  const data = orderFields(f, u);
  if (!data.clientId) throw new Error("Elige un cliente.");
  const [o] = await db.insert(orders).values({ ...data, createdById: u.id }).returning();
  await db.insert(statusChanges).values({ orderId: o.id, from: null, to: "RECIBIDO", userId: u.id, note: "Orden creada" });
  await notify([o.ownerId], `Te asignaron la orden #${o.number}: ${o.title}`, { orderId: o.id, exclude: u.id });
  revalidatePath("/ordenes");
  redirect(`/ordenes/${o.id}`);
}

export async function updateOrder(id: string, f: FormData) {
  const u = await requireUser();
  if (!canManage(u.role)) throw new Error("No tienes permiso para editar esta orden.");
  const prev = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!prev) throw new Error("La orden no existe.");
  const data = orderFields(f, u);
  await db.update(orders).set({ ...data, updatedAt: new Date() }).where(eq(orders.id, id));
  if (data.ownerId && data.ownerId !== prev.ownerId) {
    await notify([data.ownerId], `Te asignaron la orden #${prev.number}: ${data.title}`, { orderId: id, exclude: u.id });
  }
  revalidatePath(`/ordenes/${id}`);
  redirect(`/ordenes/${id}`);
}

// Quién puede mover una orden a cada etapa.
function canMoveTo(u: SessionUser, to: Status) {
  if (u.role === "FREELANCER") return false;
  if (to === "ENVIADO_CLIENTE") return isDirector(u.role); // solo dirección aprueba antes del cliente
  if (to === "FACTURADO" || to === "PAGO_PROVEEDORES") return canManage(u.role);
  if (canManage(u.role)) return true;
  return ["BRIEF_REVISION", "EN_PRODUCCION", "REVISION_INTERNA", "AJUSTES", "APROBADO", "ENTREGADO"].includes(to);
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

  await db.update(orders).set({ status: to, statusChangedAt: new Date(), revisionRoundsUsed: rounds, updatedAt: new Date() }).where(eq(orders.id, id));
  await db.insert(statusChanges).values({ orderId: id, from: o.status, to, userId: u.id, note: note || null });

  const label = `#${o.number} ${o.title}`;
  await notify([o.ownerId], `${label} pasó a "${STATUS_LABEL[to]}"`, { orderId: id, exclude: u.id });
  if (to === "REVISION_INTERNA") {
    await notify(await usersWithRole("DIRECCION"), `${label} está lista para tu revisión`, { orderId: id, exclude: u.id });
  }
  if (to === "AJUSTES" && rounds > o.revisionRoundsIncluded) {
    await notify(await usersWithRole("DIRECCION", "ADMINISTRACION"),
      `${label}: el cliente pidió la ronda ${rounds} y solo hay ${o.revisionRoundsIncluded} incluidas`, { orderId: id, urgent: true });
  }
  if (to === "APROBADO" || to === "ENTREGADO") {
    await notify(await usersWithRole("ADMINISTRACION"), `${label} está lista para facturar`, { orderId: id, exclude: u.id });
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

// @nombre en un comentario avisa a esa persona.
async function mentioned(body: string) {
  const names = [...body.matchAll(/@([\p{L}][\p{L}\-]+)/gu)].map((m) => m[1]);
  if (!names.length) return [];
  const found = await Promise.all(names.map((n) => db.select({ id: users.id }).from(users).where(and(ilike(users.name, `${n}%`), eq(users.active, true)))));
  return found.flat().map((r) => r.id);
}

export async function addComment(id: string, f: FormData) {
  const u = await requireUser();
  const body = str(f, "body");
  if (!body || !(await canAccessOrder(u, id))) redirect(`/ordenes/${id}`);
  const o = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  await db.insert(comments).values({ orderId: id, authorId: u.id, body });
  const ids = await mentioned(body);
  await notify(ids, `${u.name} te mencionó en #${o!.number}: ${body.slice(0, 90)}`, { orderId: id, exclude: u.id });
  revalidatePath(`/ordenes/${id}`);
  redirect(`/ordenes/${id}#comentarios`);
}

// Caso real: "el cliente me dice en persona un cambio y no lo anoto".
export async function registerClientChange(id: string, f: FormData) {
  const u = await requireUser();
  const body = str(f, "body");
  if (!body || !(await canAccessOrder(u, id)) || u.role === "FREELANCER") redirect(`/ordenes/${id}`);
  const o = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!o) redirect("/ordenes");
  await db.insert(comments).values({ orderId: id, authorId: u.id, body, kind: "cambio_cliente" });
  await db.insert(tasks).values({
    orderId: id, title: `Cambio del cliente: ${body.slice(0, 80)}`, notes: body,
    assigneeId: o.ownerId, createdById: u.id, status: "PENDIENTE",
  });
  await notify([o.ownerId], `Cambio del cliente en #${o.number}: ${body.slice(0, 90)}`, { orderId: id, exclude: u.id });
  revalidatePath(`/ordenes/${id}`);
  redirect(`/ordenes/${id}#comentarios`);
}

// Urgencias: primero a dirección, que decide a qué área va.
export async function raiseUrgency(id: string, f: FormData) {
  const u = await requireUser();
  const body = str(f, "body");
  if (!body || !(await canAccessOrder(u, id))) redirect(`/ordenes/${id}`);
  const o = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!o) redirect("/ordenes");
  await db.update(orders).set({ priority: "URGENTE", updatedAt: new Date() }).where(eq(orders.id, id));
  await db.insert(comments).values({ orderId: id, authorId: u.id, body, kind: "urgencia" });
  await notify(await usersWithRole("DIRECCION"), `URGENCIA en #${o.number} ${o.title}: ${body.slice(0, 90)}`, { orderId: id, urgent: true, exclude: u.id });
  revalidatePath(`/ordenes/${id}`);
  revalidatePath("/");
  redirect(`/ordenes/${id}#comentarios`);
}
