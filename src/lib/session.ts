// Sesión firmada en una cookie (compatible con el middleware).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sotech_session";
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET || "");

export async function signSession(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key());
}

export async function verifySession(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
