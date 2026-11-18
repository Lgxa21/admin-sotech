// Helpers compartidos para server actions (FormData, redirects seguros, errores).
import { redirect } from "next/navigation";

export const str = (f: FormData, k: string, max = 4000) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
};

export const pick = <T extends readonly string[]>(list: T, v: string | null, fallback: T[number]): T[number] =>
  v && (list as readonly string[]).includes(v) ? (v as T[number]) : fallback;

/** Solo paths relativos de la app (bloquea //evil.com y protocolos). */
export function safePath(raw: string | null | undefined, fallback: string) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return fallback;
  return raw;
}

export function back(f: FormData, fallback: string) {
  return safePath(str(f, "back"), fallback);
}

/** Redirige a `to` agregando ?error=… (respeta #ancla). */
export function fail(to: string, msg: string): never {
  const [path, hash] = to.split("#");
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(msg)}${hash ? `#${hash}` : ""}`);
}

/** Redirige a `to` agregando ?ok=… */
export function ok(to: string, msg: string): never {
  const [path, hash] = to.split("#");
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}ok=${encodeURIComponent(msg)}${hash ? `#${hash}` : ""}`);
}

export const dayField = (f: FormData, k: string, fallback: string) => {
  const v = str(f, k);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fallback;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (v: string | null | undefined): v is string => !!v && UUID_RE.test(v);
