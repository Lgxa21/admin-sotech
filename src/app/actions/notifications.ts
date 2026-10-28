"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, pushSubscriptions, users } from "@/db";
import { requireUser } from "@/lib/auth";
import { testChannels } from "@/lib/notify";
import { normalizePhone } from "@/lib/channels/whatsapp";

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string) {
  const u = await requireUser();
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false };
  await db.insert(pushSubscriptions).values({ userId: u.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent.slice(0, 300) })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: u.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  await db.update(users).set({ notifyPush: true }).where(eq(users.id, u.id));
  revalidatePath("/perfil");
  return { ok: true };
}

export async function removePushSubscription(endpoint: string) {
  const u = await requireUser();
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, u.id)));
  revalidatePath("/perfil");
  return { ok: true };
}

export async function saveNotificationPrefs(f: FormData) {
  const u = await requireUser();
  const raw = typeof f.get("phone") === "string" ? String(f.get("phone")).trim() : "";
  const phone = raw ? normalizePhone(raw) : null;
  if (raw && !phone) redirect("/perfil?error=" + encodeURIComponent("Revisa el número: escríbelo con código de área, por ejemplo 0412 123 4567.") + "#avisos");
  await db.update(users).set({
    phone, notifyEmail: f.get("notifyEmail") === "on", notifyWhatsapp: f.get("notifyWhatsapp") === "on", notifyPush: f.get("notifyPush") === "on",
  }).where(eq(users.id, u.id));
  revalidatePath("/perfil");
  redirect("/perfil?ok=" + encodeURIComponent("Preferencias de avisos guardadas.") + "#avisos");
}

export async function sendTestNotification() {
  const u = await requireUser();
  const r = await testChannels(u.id);
  const parts = [
    r.push ? `celular (${r.push} ${r.push === 1 ? "dispositivo" : "dispositivos"})` : null,
    r.email ? "correo" : null,
    r.whatsapp ? "WhatsApp" : null,
  ].filter(Boolean);
  redirect("/perfil?" + (parts.length ? "ok=" + encodeURIComponent(`Enviamos un aviso de prueba por: ${parts.join(", ")}.`) : "error=" + encodeURIComponent("No se envió por ningún canal. Activa las notificaciones en este dispositivo o revisa la configuración de correo y WhatsApp.")) + "#avisos");
}
