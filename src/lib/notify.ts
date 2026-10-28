import "server-only";
import { after } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, notifications, users } from "@/db";
import type { RoleT } from "./labels";
import { sendPush } from "./channels/push";
import { sendEmail, emailReady } from "./channels/email";
import { sendWhatsapp, whatsappReady, normalizePhone } from "./channels/whatsapp";

export type NotifyKind = "tarea" | "mencion" | "urgencia" | "cliente" | "estado" | "finanzas" | "general";

// Qué avisos salen por cada canal además del aviso dentro del sistema.
// El celular recibe todo; el correo, lo que pide acción; WhatsApp, solo tareas asignadas y menciones.
const EMAIL_KINDS: NotifyKind[] = ["tarea", "mencion", "urgencia", "cliente"];
const WHATSAPP_KINDS: NotifyKind[] = ["tarea", "mencion"];

const appUrl = () => (process.env.PUBLIC_URL || "").replace(/\/$/, "");

type Opts = { orderId?: string; urgent?: boolean; exclude?: string; kind?: NotifyKind };

export async function notify(userIds: (string | null | undefined)[], text: string, opts: Opts = {}) {
  const ids = [...new Set(userIds.filter((x): x is string => !!x && x !== opts.exclude))];
  if (!ids.length) return;
  const kind = opts.kind ?? "general";
  await db.insert(notifications).values(ids.map((userId) => ({ userId, text, orderId: opts.orderId, urgent: !!opts.urgent, kind })));
  const job = () => deliver(ids, text, kind, opts).catch((e) => console.error("notify", e));
  // Los envíos externos salen después de responder, para no demorar a quien hizo la acción.
  try { after(job); } catch { void job(); }
}

async function deliver(ids: string[], text: string, kind: NotifyKind, opts: Opts) {
  const people = await db.select().from(users).where(and(inArray(users.id, ids), eq(users.active, true)));
  const url = `${appUrl()}${opts.orderId ? `/ordenes/${opts.orderId}` : "/avisos"}`;
  const title = opts.urgent || kind === "urgencia" ? "Urgencia · Sotech" : "Sotech";
  await Promise.all(people.map(async (p) => {
    const jobs: Promise<unknown>[] = [];
    if (p.notifyPush) jobs.push(sendPush(p.id, { title, body: text, url: url || "/avisos", tag: opts.orderId }));
    if (p.notifyEmail && emailReady() && EMAIL_KINDS.includes(kind) && appUrl()) jobs.push(sendEmail(p.email, text, `Hola ${p.name.split(" ")[0]}:\n\n${text}`, url));
    const phone = normalizePhone(p.phone);
    if (p.notifyWhatsapp && phone && whatsappReady() && WHATSAPP_KINDS.includes(kind) && appUrl()) jobs.push(sendWhatsapp(phone, text, url));
    await Promise.allSettled(jobs);
  }));
}

// Aviso de prueba por todos los canales disponibles, para revisar la configuración.
export async function testChannels(userId: string) {
  const [p] = await db.select().from(users).where(eq(users.id, userId));
  if (!p) return { push: 0, email: false, whatsapp: false };
  const text = `Aviso de prueba para ${p.name.split(" ")[0]}. Si lo ves, este canal funciona.`;
  const url = `${appUrl()}/perfil`;
  const phone = normalizePhone(p.phone);
  const [push, email, whatsapp] = await Promise.all([
    sendPush(p.id, { title: "Sotech", body: text, url: url || "/perfil" }),
    emailReady() && appUrl() ? sendEmail(p.email, "Aviso de prueba de Sotech", text, url) : Promise.resolve(false),
    phone && whatsappReady() && appUrl() ? sendWhatsapp(phone, text, url) : Promise.resolve(false),
  ]);
  return { push, email, whatsapp };
}

export async function usersWithRole(...roles: RoleT[]) {
  const rows = await db.select({ id: users.id }).from(users).where(and(inArray(users.role, roles), eq(users.active, true)));
  return rows.map((r) => r.id);
}
