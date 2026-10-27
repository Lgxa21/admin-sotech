import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { SESSION_COOKIE, verifySession } from "./session";
import type { RoleT } from "./labels";

export type SessionUser = { id: string; name: string; email: string; role: RoleT; area: string | null };

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const id = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!id) return null;
  const u = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!u || !u.active) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role, area: u.area };
});

export async function requireUser() {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireRole(...roles: RoleT[]) {
  const u = await requireUser();
  if (!roles.includes(u.role)) redirect("/");
  return u;
}
