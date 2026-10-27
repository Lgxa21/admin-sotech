"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, clients } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManage } from "@/lib/perm";
import { fromInputDate } from "@/lib/labels";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const fields = (f: FormData) => ({
  name: str(f, "name") ?? "Sin nombre",
  contactName: str(f, "contactName"),
  contactPhone: str(f, "contactPhone"),
  contactEmail: str(f, "contactEmail"),
  taxId: str(f, "taxId"),
  brandManualUrl: str(f, "brandManualUrl"),
  socialNotes: str(f, "socialNotes"),
  contractNotes: str(f, "contractNotes"),
  renewalDate: fromInputDate(f.get("renewalDate")),
  notes: str(f, "notes"),
});

export async function createClient(f: FormData) {
  const u = await requireUser();
  if (!canManage(u.role)) redirect("/");
  const [c] = await db.insert(clients).values(fields(f)).returning();
  revalidatePath("/clientes");
  redirect(f.get("next") === "orden" ? `/ordenes/nueva?cliente=${c.id}` : `/clientes/${c.id}`);
}

export async function updateClient(id: string, f: FormData) {
  const u = await requireUser();
  if (!canManage(u.role)) redirect("/");
  await db.update(clients).set(fields(f)).where(eq(clients.id, id));
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}
