"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, approvalLinks, orders, clients, comments, tasks, statusChanges, users } from "@/db";
import { requireUser } from "@/lib/auth";
import { canAccessOrder } from "@/lib/access";
import { canManage } from "@/lib/perm";
import { notify, usersWithRole } from "@/lib/notify";
import { SERVICES, fromInputDate } from "@/lib/labels";

const token = () => randomBytes(18).toString("base64url");
const str = (f: FormData, k: string, max = 4000) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
};

// ---------- Enlace de aprobación (interno) ----------
export async function createApprovalLink(orderId: string, f: FormData) {
  const u = await requireUser();
  if (u.role === "FREELANCER" || !(await canAccessOrder(u, orderId))) redirect(`/ordenes/${orderId}`);
  const o = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!o) redirect("/ordenes");
  if (o.status !== "ENVIADO_CLIENTE") redirect(`/ordenes/${orderId}?error=${encodeURIComponent("Primero dirección debe aprobar la pieza y enviarla al cliente.")}`);
  const pieceUrl = str(f, "pieceUrl", 2000);
  if (pieceUrl && !/^https?:\/\//i.test(pieceUrl)) redirect(`/ordenes/${orderId}?error=${encodeURIComponent("El enlace de la pieza debe empezar por https://")}#cliente`);
  // Un solo enlace activo por orden: los anteriores sin respuesta se anulan.
  await db.update(approvalLinks).set({ status: "ANULADO" }).where(and(eq(approvalLinks.orderId, orderId), eq(approvalLinks.status, "PENDIENTE")));
  await db.insert(approvalLinks).values({
    orderId, token: token(), pieceUrl, message: str(f, "message"), round: o.revisionRoundsUsed + 1, createdById: u.id,
  });
  revalidatePath(`/ordenes/${orderId}`);
  redirect(`/ordenes/${orderId}#cliente`);
}

export async function cancelApprovalLink(id: string, orderId: string) {
  const u = await requireUser();
  if (u.role === "FREELANCER") redirect(`/ordenes/${orderId}`);
  await db.update(approvalLinks).set({ status: "ANULADO" }).where(and(eq(approvalLinks.id, id), eq(approvalLinks.status, "PENDIENTE")));
  revalidatePath(`/ordenes/${orderId}`);
  redirect(`/ordenes/${orderId}#cliente`);
}

// ---------- Respuesta del cliente (página pública, sin cuenta) ----------
export async function respondApproval(tok: string, f: FormData) {
  if (str(f, "website")) redirect(`/aprobar/${tok}`); // campo trampa contra bots
  const link = await db.query.approvalLinks.findFirst({ where: eq(approvalLinks.token, tok), with: { order: true } });
  if (!link || link.status !== "PENDIENTE" || link.order.status !== "ENVIADO_CLIENTE") redirect(`/aprobar/${tok}`);
  const decision = f.get("decision") === "aprobar" ? "APROBADO" : "CAMBIOS";
  const comment = str(f, "comment");
  const who = str(f, "name", 120);
  if (decision === "CAMBIOS" && !comment) redirect(`/aprobar/${tok}?error=${encodeURIComponent("Cuéntanos qué cambios necesitas.")}`);
  const o = link.order;
  const by = who ? `${who} (cliente)` : "El cliente";
  const now = new Date();

  await db.update(approvalLinks).set({ status: decision, clientName: who, clientComment: comment, respondedAt: now }).where(eq(approvalLinks.id, link.id));
  if (decision === "APROBADO") {
    await db.update(orders).set({ status: "APROBADO", statusChangedAt: now, updatedAt: now }).where(eq(orders.id, o.id));
    await db.insert(statusChanges).values({ orderId: o.id, from: o.status, to: "APROBADO", userId: link.createdById, note: `${by} aprobó desde el enlace` });
    await db.insert(comments).values({ orderId: o.id, authorId: link.createdById, kind: "cambio_cliente", body: `${by} aprobó la pieza (ronda ${link.round}).${comment ? `\n\n"${comment}"` : ""}` });
    await notify([o.ownerId, link.createdById, ...(await usersWithRole("DIRECCION"))], `${by} aprobó #${o.number} ${o.title}`, { orderId: o.id });
    await notify(await usersWithRole("ADMINISTRACION"), `#${o.number} ${o.title} está lista para facturar`, { orderId: o.id });
  } else {
    const rounds = o.revisionRoundsUsed + 1;
    await db.update(orders).set({ status: "AJUSTES", statusChangedAt: now, updatedAt: now, revisionRoundsUsed: rounds }).where(eq(orders.id, o.id));
    await db.insert(statusChanges).values({ orderId: o.id, from: o.status, to: "AJUSTES", userId: link.createdById, note: `${by} pidió cambios desde el enlace` });
    await db.insert(comments).values({ orderId: o.id, authorId: link.createdById, kind: "cambio_cliente", body: `${by} pidió cambios (ronda ${rounds}):\n\n${comment}` });
    await db.insert(tasks).values({ orderId: o.id, title: `Cambios del cliente, ronda ${rounds}`, notes: comment, assigneeId: o.ownerId, createdById: link.createdById, status: "PENDIENTE" });
    const over = rounds > o.revisionRoundsIncluded;
    await notify([o.ownerId, link.createdById], `${by} pidió cambios en #${o.number}: ${comment!.slice(0, 90)}`, { orderId: o.id });
    if (over) await notify(await usersWithRole("DIRECCION", "ADMINISTRACION"), `#${o.number} ${o.title}: el cliente pidió la ronda ${rounds} y solo hay ${o.revisionRoundsIncluded} incluidas`, { orderId: o.id, urgent: true });
  }
  revalidatePath(`/ordenes/${o.id}`);
  redirect(`/aprobar/${tok}?ok=1`);
}

// ---------- Enlace de pedidos por cliente ----------
export async function enableRequestLink(clientId: string) {
  const u = await requireUser();
  if (!canManage(u.role)) redirect("/");
  await db.update(clients).set({ requestToken: token() }).where(eq(clients.id, clientId));
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}#pedidos`);
}

export async function disableRequestLink(clientId: string) {
  const u = await requireUser();
  if (!canManage(u.role)) redirect("/");
  await db.update(clients).set({ requestToken: null }).where(eq(clients.id, clientId));
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}#pedidos`);
}

export async function submitClientRequest(tok: string, f: FormData) {
  if (str(f, "website")) redirect(`/pedido/${tok}?ok=1`);
  const c = await db.query.clients.findFirst({ where: eq(clients.requestToken, tok) });
  if (!c || !c.active) redirect(`/pedido/${tok}`);
  const title = str(f, "title", 200);
  const brief = str(f, "brief");
  if (!title || !brief) redirect(`/pedido/${tok}?error=${encodeURIComponent("Escribe qué necesitas y una descripción.")}`);
  const [director] = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "DIRECCION"), eq(users.active, true))).orderBy(asc(users.createdAt)).limit(1);
  if (!director) redirect(`/pedido/${tok}?error=${encodeURIComponent("No pudimos registrar el pedido. Escríbenos directamente.")}`);
  const svc = str(f, "serviceType");
  const who = str(f, "name", 120);
  const [o] = await db.insert(orders).values({
    title, clientId: c.id, serviceType: svc && (SERVICES as readonly string[]).includes(svc) ? (svc as (typeof SERVICES)[number]) : "OTRO",
    brief: `${brief}${who ? `\n\nPedido por: ${who}` : ""}`, referenceLinks: str(f, "references"), platform: str(f, "platform", 200),
    dueDate: fromInputDate(f.get("dueDate")), createdById: director.id, source: "cliente",
  }).returning();
  await db.insert(statusChanges).values({ orderId: o.id, from: null, to: "RECIBIDO", userId: director.id, note: `Pedido de ${c.name} desde su enlace` });
  await notify(await usersWithRole("DIRECCION", "ADMINISTRACION"), `Nuevo pedido de ${c.name}: ${title}`, { orderId: o.id });
  revalidatePath("/ordenes");
  redirect(`/pedido/${tok}?ok=1`);
}
