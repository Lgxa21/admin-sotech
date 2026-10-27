"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, tasks, orders, users, type ChecklistItem } from "@/db";
import { requireUser } from "@/lib/auth";
import { canAccessOrder } from "@/lib/access";
import { notify } from "@/lib/notify";
import { canManage } from "@/lib/perm";
import { TASK_STATUSES, fromInputDate } from "@/lib/labels";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

export async function createTask(orderId: string, f: FormData) {
  const u = await requireUser();
  if (u.role === "FREELANCER" || !(await canAccessOrder(u, orderId))) redirect(`/ordenes/${orderId}`);
  const title = str(f, "title");
  if (!title) redirect(`/ordenes/${orderId}`);
  const assigneeId = str(f, "assigneeId");
  const assignee = assigneeId ? await db.query.users.findFirst({ where: eq(users.id, assigneeId) }) : null;
  const checklist: ChecklistItem[] = (str(f, "checklist") ?? "")
    .split("\n").map((t) => t.trim()).filter(Boolean).map((text) => ({ text, done: false }));
  // Los freelancers deben aceptar la tarea antes de empezar.
  const status = assignee?.role === "FREELANCER" ? "POR_ACEPTAR" : "PENDIENTE";
  await db.insert(tasks).values({
    orderId, title, notes: str(f, "notes"), assigneeId, createdById: u.id, status,
    dueDate: fromInputDate(f.get("dueDate")), checklist,
  });
  const o = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  await notify([assigneeId], `Nueva tarea en #${o?.number}: ${title}${status === "POR_ACEPTAR" ? " (confírmala)" : ""}`, { orderId, exclude: u.id });
  revalidatePath(`/ordenes/${orderId}`);
  redirect(`/ordenes/${orderId}#tareas`);
}

async function loadTask(taskId: string) {
  const u = await requireUser();
  const t = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId), with: { order: true } });
  if (!t) throw new Error("La tarea no existe.");
  const mine = t.assigneeId === u.id;
  if (!mine && !canManage(u.role) && !(await canAccessOrder(u, t.orderId))) throw new Error("No tienes acceso a esta tarea.");
  return { u, t, mine };
}

export async function acceptTask(taskId: string) {
  const { u, t, mine } = await loadTask(taskId);
  if (!mine) return;
  await db.update(tasks).set({ status: "PENDIENTE", acceptedAt: new Date(), updatedAt: new Date() }).where(eq(tasks.id, taskId));
  await notify([t.createdById], `${u.name} aceptó la tarea "${t.title}" (#${t.order.number})`, { orderId: t.orderId, exclude: u.id });
  revalidatePath(`/ordenes/${t.orderId}`);
  revalidatePath("/tareas");
}

export async function setTaskStatus(taskId: string, status: string) {
  const { u, t } = await loadTask(taskId);
  if (!(TASK_STATUSES as readonly string[]).includes(status) || status === "POR_ACEPTAR") return;
  await db.update(tasks).set({ status: status as (typeof TASK_STATUSES)[number], updatedAt: new Date() }).where(eq(tasks.id, taskId));
  if (status === "LISTA") {
    await notify([t.createdById, t.order.ownerId], `${u.name} terminó "${t.title}" (#${t.order.number})`, { orderId: t.orderId, exclude: u.id });
  }
  revalidatePath(`/ordenes/${t.orderId}`);
  revalidatePath("/tareas");
  revalidatePath("/");
}

export async function toggleChecklist(taskId: string, index: number) {
  const { t } = await loadTask(taskId);
  const list = [...(t.checklist ?? [])];
  if (!list[index]) return;
  list[index] = { ...list[index], done: !list[index].done };
  await db.update(tasks).set({ checklist: list, updatedAt: new Date() }).where(eq(tasks.id, taskId));
  revalidatePath(`/ordenes/${t.orderId}`);
  revalidatePath("/tareas");
}

export async function deleteTask(taskId: string) {
  const { u, t } = await loadTask(taskId);
  if (!canManage(u.role)) return;
  await db.delete(tasks).where(eq(tasks.id, taskId));
  revalidatePath(`/ordenes/${t.orderId}`);
}
