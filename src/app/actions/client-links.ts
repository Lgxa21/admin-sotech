"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, approvalLinks, orders, clients, comments, statusChanges, users } from "@/db";
import { requireUser } from "@/lib/auth";
import { canAccessOrder } from "@/lib/access";
import { canManage } from "@/lib/perm";
import { notify, usersWithRole } from "@/lib/notify";
import { SERVICES, fromInputDate } from "@/lib/labels";
import { cleanBrief } from "@/lib/briefs";
import { str, fail } from "@/lib/form";
import { rateLimit } from "@/lib/rate-limit";
import { invalidateApprovalLinks, recordClientRevision } from "@/lib/client-revisions";
import { headers } from "next/headers";

const token = () => randomBytes(18).toString("base64url");

async function publicLimit(key: string, path: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const limited = rateLimit(`${key}:${ip}`, 20, 60 * 60_000);
  if (!limited.ok) fail(path, `Demasiados envíos. Espera ${limited.retryAfterSec} segundos.`);
}

// ---------- Enlace de aprobación (interno) ----------
export async function createApprovalLink(orderId: string, f: FormData) {
  const u = await requireUser();
  if (u.role === "FREELANCER" || !(await canAccessOrder(u, orderId))) redirect(`/ordenes/${orderId}`);
  const pieceUrl = str(f, "pieceUrl", 2000);
  if (pieceUrl && !/^https?:\/\//i.test(pieceUrl)) fail(`/ordenes/${orderId}`, "El enlace de la pieza debe empezar por https://");
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) redirect("/ordenes");
    if (order.status !== "ENVIADO_CLIENTE") fail(`/ordenes/${orderId}`, "Primero dirección debe aprobar la pieza y enviarla al cliente.");
    await invalidateApprovalLinks(tx, orderId);
    await tx.insert(approvalLinks).values({
      orderId, token: token(), pieceUrl, message: str(f, "message"), round: order.revisionRoundsUsed + 1, createdById: u.id,
    });
  });
  revalidatePath(`/ordenes/${orderId}`);
  redirect(`/ordenes/${orderId}#cliente`);
}

export async function cancelApprovalLink(id: string, orderId: string) {
  const u = await requireUser();
  if (u.role === "FREELANCER" || !(await canAccessOrder(u, orderId))) redirect(`/ordenes/${orderId}`);
  await db.update(approvalLinks).set({ status: "ANULADO" })
    .where(and(eq(approvalLinks.id, id), eq(approvalLinks.orderId, orderId), eq(approvalLinks.status, "PENDIENTE")));
  revalidatePath(`/ordenes/${orderId}`);
  redirect(`/ordenes/${orderId}#cliente`);
}

// ---------- Respuesta del cliente (página pública, sin cuenta) ----------
export async function respondApproval(tok: string, f: FormData) {
  await publicLimit("aprobar", `/aprobar/${tok}`);
  if (str(f, "website")) redirect(`/aprobar/${tok}`);
  const link = await db.query.approvalLinks.findFirst({ where: eq(approvalLinks.token, tok), with: { order: true } });
  if (!link || link.status !== "PENDIENTE" || link.order.status !== "ENVIADO_CLIENTE") redirect(`/aprobar/${tok}`);
  const decision = f.get("decision") === "aprobar" ? "APROBADO" : "CAMBIOS";
  const comment = str(f, "comment");
  const who = str(f, "name", 120);
  if (decision === "CAMBIOS" && !comment) redirect(`/aprobar/${tok}?error=${encodeURIComponent("Cuéntanos qué cambios necesitas.")}`);
  const by = who ? `${who} (cliente)` : "El cliente";
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, link.orderId)).for("update");
    if (!o || o.status !== "ENVIADO_CLIENTE" || link.round !== o.revisionRoundsUsed + 1) return null;
    const [updated] = await tx.update(approvalLinks)
      .set({ status: decision, clientName: who, clientComment: comment, respondedAt: now })
      .where(and(eq(approvalLinks.id, link.id), eq(approvalLinks.status, "PENDIENTE")))
      .returning();
    if (!updated) return null;

    if (decision === "APROBADO") {
      await tx.update(orders).set({ status: "APROBADO", statusChangedAt: now, updatedAt: now }).where(eq(orders.id, o.id));
      await tx.insert(statusChanges).values({ orderId: o.id, from: o.status, to: "APROBADO", userId: link.createdById, note: `${by} aprobó desde el enlace` });
      await tx.insert(comments).values({ orderId: o.id, authorId: link.createdById, kind: "cambio_cliente", body: `${by} aprobó la pieza (ronda ${link.round}).${comment ? `\n\n"${comment}"` : ""}` });
      await invalidateApprovalLinks(tx, o.id);
      return { order: o, rounds: o.revisionRoundsUsed };
    }
    const rounds = await recordClientRevision(tx, o, link.createdById, comment!, `${by} pidió cambios desde el enlace`, now);
    return { order: o, rounds };
  });
  if (!result) redirect(`/aprobar/${tok}`);
  const { order: o, rounds } = result;

  // Notificaciones fuera de la transacción (canales externos).
  if (decision === "APROBADO") {
    await notify([o.ownerId, link.createdById, ...(await usersWithRole("DIRECCION"))], `${by} aprobó #${o.number} ${o.title}`, { orderId: o.id, kind: "cliente" });
  } else {
    const over = rounds > o.revisionRoundsIncluded;
    await notify([o.ownerId, link.createdById], `${by} pidió cambios en #${o.number}: ${(comment ?? "").slice(0, 90)}`, { orderId: o.id, kind: "tarea" });
    if (over) await notify(await usersWithRole("DIRECCION", "ADMINISTRACION"), `#${o.number} ${o.title}: el cliente pidió la ronda ${rounds} y solo hay ${o.revisionRoundsIncluded} incluidas`, { orderId: o.id, urgent: true, kind: "urgencia" });
  }
  revalidatePath("/ordenes");
  revalidatePath("/");
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
  await publicLimit("pedido", `/pedido/${tok}`);
  if (str(f, "website")) redirect(`/pedido/${tok}?ok=1`);
  const c = await db.query.clients.findFirst({ where: eq(clients.requestToken, tok) });
  if (!c || !c.active) redirect(`/pedido/${tok}`);
  const title = str(f, "title", 200);
  const brief = cleanBrief(str(f, "brief"));
  if (!title || !brief) redirect(`/pedido/${tok}?error=${encodeURIComponent("Escribe qué necesitas y una descripción.")}`);
  const [director] = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "DIRECCION"), eq(users.active, true))).orderBy(asc(users.createdAt)).limit(1);
  if (!director) redirect(`/pedido/${tok}?error=${encodeURIComponent("No pudimos registrar el pedido. Escríbenos directamente.")}`);
  const svc = str(f, "serviceType");
  const who = str(f, "name", 120);
  const [o] = await db.transaction(async (tx) => {
    const [order] = await tx.insert(orders).values({
      title, clientId: c.id, serviceType: svc && (SERVICES as readonly string[]).includes(svc) ? (svc as (typeof SERVICES)[number]) : "OTRO",
      brief: `${brief}${who ? `\n\nPedido por: ${who}` : ""}`, referenceLinks: str(f, "references"), platform: str(f, "platform", 200),
      dueDate: fromInputDate(f.get("dueDate")), createdById: director.id, source: "cliente",
    }).returning();
    await tx.insert(statusChanges).values({ orderId: order.id, from: null, to: "RECIBIDO", userId: director.id, note: `Pedido de ${c.name} desde su enlace` });
    return [order];
  });
  await notify(await usersWithRole("DIRECCION", "ADMINISTRACION"), `Nuevo pedido de ${c.name}: ${title}`, { orderId: o.id, kind: "cliente" });
  revalidatePath("/ordenes");
  redirect(`/pedido/${tok}?ok=1`);
}
