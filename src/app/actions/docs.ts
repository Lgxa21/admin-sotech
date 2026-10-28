"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, docs } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManage } from "@/lib/perm";
import { DOC_CATEGORIES } from "@/lib/doc-categories";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

async function manager() {
  const u = await requireUser();
  if (!canManage(u.role)) redirect("/biblioteca");
  return u;
}

export async function saveDoc(id: string | null, f: FormData) {
  const u = await manager();
  const title = str(f, "title");
  if (!title) redirect(`/biblioteca/${id ?? "nuevo"}?editar=1&error=${encodeURIComponent("Escribe un título.")}`);
  const cat = str(f, "category");
  const category = cat && cat in DOC_CATEGORIES ? cat : "proceso";
  const body = (f.get("body") as string | null) ?? "";
  if (id) {
    await db.update(docs).set({ title, category, body, updatedById: u.id, updatedAt: new Date() }).where(eq(docs.id, id));
  } else {
    const [d] = await db.insert(docs).values({ title, category, body, updatedById: u.id }).returning();
    id = d.id;
  }
  revalidatePath("/biblioteca");
  redirect(`/biblioteca/${id}`);
}

export async function deleteDoc(id: string) {
  await manager();
  await db.delete(docs).where(eq(docs.id, id));
  revalidatePath("/biblioteca");
  redirect("/biblioteca");
}
