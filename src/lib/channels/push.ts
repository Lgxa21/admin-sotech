import "server-only";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db, pushSubscriptions } from "@/db";

let configured: boolean | null = null;
export function pushReady() {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  configured = !!(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:avisos@sotech.app", pub!, priv!);
  return configured;
}

// Envía la notificación a todos los dispositivos de la persona y limpia los que ya no existen.
export async function sendPush(userId: string, payload: { title: string; body: string; url: string; tag?: string }) {
  if (!pushReady()) return 0;
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
      sent++;
    } catch (e: unknown) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
      else console.error("push", code, (e as Error).message);
    }
  }));
  return sent;
}
