"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, users, notifications } from "@/db";
import { requireRole, requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/labels";
import { normalizePhone } from "@/lib/channels/whatsapp";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

export async function createUser(f: FormData) {
  await requireRole("DIRECCION");
  const email = str(f, "email")?.toLowerCase();
  const password = str(f, "password");
  const name = str(f, "name");
  if (!email || !password || !name) redirect("/equipo?error=" + encodeURIComponent("Completa nombre, correo y contraseña."));
  if (password.length < 8) redirect("/equipo?error=" + encodeURIComponent("La contraseña debe tener al menos 8 caracteres."));
  const exists = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (exists) redirect("/equipo?error=" + encodeURIComponent("Ya existe una persona con ese correo."));
  const roleRaw = str(f, "role");
  const role = roleRaw && (ROLES as readonly string[]).includes(roleRaw) ? (roleRaw as (typeof ROLES)[number]) : "PRODUCCION";
  await db.insert(users).values({ name, email, role, area: str(f, "area"), phone: normalizePhone(str(f, "phone")), passwordHash: await bcrypt.hash(password, 10) });
  revalidatePath("/equipo");
  redirect("/equipo?ok=" + encodeURIComponent(`${name} ya puede entrar con ${email}.`));
}

export async function setUserActive(id: string, active: boolean) {
  const me = await requireRole("DIRECCION");
  if (id === me.id) return;
  await db.update(users).set({ active }).where(eq(users.id, id));
  revalidatePath("/equipo");
}

export async function resetPassword(id: string, f: FormData) {
  await requireRole("DIRECCION");
  const password = str(f, "password");
  if (!password || password.length < 8) redirect("/equipo?error=" + encodeURIComponent("La contraseña debe tener al menos 8 caracteres."));
  await db.update(users).set({ passwordHash: await bcrypt.hash(password, 10) }).where(eq(users.id, id));
  redirect("/equipo?ok=" + encodeURIComponent("Contraseña actualizada."));
}

export async function changeOwnPassword(f: FormData) {
  const me = await requireUser();
  const current = str(f, "current");
  const next = str(f, "next");
  const u = await db.query.users.findFirst({ where: eq(users.id, me.id) });
  if (!u || !current || !(await bcrypt.compare(current, u.passwordHash))) redirect("/perfil?error=" + encodeURIComponent("Tu contraseña actual no coincide."));
  if (!next || next.length < 8) redirect("/perfil?error=" + encodeURIComponent("La nueva contraseña debe tener al menos 8 caracteres."));
  await db.update(users).set({ passwordHash: await bcrypt.hash(next, 10) }).where(eq(users.id, me.id));
  redirect("/perfil?ok=" + encodeURIComponent("Contraseña cambiada."));
}

export async function markAllRead() {
  const me = await requireUser();
  await db.update(notifications).set({ read: true }).where(and(eq(notifications.userId, me.id), eq(notifications.read, false)));
  revalidatePath("/", "layout");
}
