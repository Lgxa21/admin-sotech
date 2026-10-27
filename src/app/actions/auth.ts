"use server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { SESSION_COOKIE, signSession } from "@/lib/session";

export type LoginState = { error?: string } | undefined;

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  if (!email || !password) return { error: "Escribe tu correo y tu contraseña." };
  const u = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!u || !u.active || !(await bcrypt.compare(password, u.passwordHash))) {
    return { error: "El correo o la contraseña no coinciden." };
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(u.id), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
