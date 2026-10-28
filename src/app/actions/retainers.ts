"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, retainers, type RetainerItem } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManage } from "@/lib/perm";
import { parseAmount } from "@/lib/money";
import { SERVICES } from "@/lib/labels";
import { ensureRetainerOrders, currentPeriod } from "@/lib/retainers";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
function fail(msg: string): never {
  redirect(`/finanzas/igualas?error=${encodeURIComponent(msg)}`);
}

async function manager() {
  const u = await requireUser();
  if (!canManage(u.role)) redirect("/");
  return u;
}

// "12 posts para feed" → { qty: 12, title: "posts para feed" }
function parseItems(raw: string | null): RetainerItem[] {
  return (raw ?? "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(\d+)\s*[x×]?\s+(.+)$/i);
    return m ? { qty: Number(m[1]), title: m[2].trim() } : { qty: 1, title: l };
  });
}

export async function createRetainer(f: FormData) {
  await manager();
  const clientId = str(f, "clientId");
  const amount = parseAmount(f.get("amount"));
  if (!clientId) fail("Elige el cliente de la iguala.");
  if (!amount || amount <= 0) fail("Escribe el monto mensual de la iguala.");
  const start = str(f, "startPeriod");
  const svc = str(f, "serviceType");
  await db.insert(retainers).values({
    clientId, title: str(f, "title") ?? "Iguala mensual", amount: String(amount), currency: str(f, "currency") === "VES" ? "VES" : "USD",
    serviceType: svc && (SERVICES as readonly string[]).includes(svc) ? (svc as (typeof SERVICES)[number]) : "REDES_SOCIALES",
    items: parseItems(str(f, "items")), ownerId: str(f, "ownerId"),
    dueDay: Math.min(31, Math.max(1, Number(str(f, "dueDay") ?? 28) || 28)),
    revisionRounds: Math.max(0, Number(str(f, "revisionRounds") ?? 2) || 0),
    startPeriod: start && /^\d{4}-\d{2}$/.test(start) ? start : currentPeriod(),
  });
  await ensureRetainerOrders();
  revalidatePath("/finanzas/igualas");
  revalidatePath("/ordenes");
  redirect("/finanzas/igualas");
}

export async function setRetainerActive(id: string, active: boolean) {
  await manager();
  await db.update(retainers).set({ active }).where(eq(retainers.id, id));
  revalidatePath("/finanzas/igualas");
}
