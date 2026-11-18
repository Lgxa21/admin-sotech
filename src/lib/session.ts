// Sesión firmada en una cookie (compatible con el middleware).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sotech_session";

function sessionKey() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET debe estar definido (mínimo 16 caracteres). Sin él no se pueden firmar sesiones.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(sessionKey());
}

export async function verifySession(token?: string) {
  if (!token) return null;
  const key = sessionKey(); // falla en seco si falta SESSION_SECRET
  try {
    const { payload } = await jwtVerify(token, key);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
