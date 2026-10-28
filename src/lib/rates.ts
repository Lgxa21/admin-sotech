import "server-only";
import { desc, eq, lte } from "drizzle-orm";
import { db, exchangeRates } from "@/db";
import { todayCaracas } from "./money";

export const AUTO_SOURCE = "BCV (automática)";

// La tasa vigente para un día: la de ese día o la última registrada antes.
export async function rateFor(day: string = todayCaracas()) {
  const [r] = await db.select().from(exchangeRates).where(lte(exchangeRates.day, day)).orderBy(desc(exchangeRates.day)).limit(1);
  return r ? { day: r.day, rate: Number(r.rate), source: r.source } : null;
}

async function getJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store", headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
  return res.json();
}

// Tasa oficial del BCV (Bs. por USD) desde fuentes públicas: DolarAPI y, si falla, bcv.today.
export async function fetchBcvRate(): Promise<number> {
  const sources: [string, (j: any) => unknown][] = [
    ["https://ve.dolarapi.com/v1/dolares/oficial", (j) => j?.promedio ?? j?.venta],
    ["https://bcv.today/api/v1/rate.json", (j) => j?.USD],
  ];
  const errors: string[] = [];
  for (const [url, pick] of sources) {
    try {
      const v = Number(pick(await getJson(url)));
      if (Number.isFinite(v) && v > 0) return Math.round(v * 10000) / 10000;
      errors.push(`${url}: sin tasa`);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(`No se pudo obtener la tasa del BCV (${errors.join("; ")})`);
}

let lastAttempt = 0;

// Si hoy no hay tasa registrada, la trae del BCV. Nunca pisa una tasa cargada a mano.
export async function ensureTodayRate() {
  const today = todayCaracas();
  const [has] = await db.select({ id: exchangeRates.id }).from(exchangeRates).where(eq(exchangeRates.day, today)).limit(1);
  if (has || Date.now() - lastAttempt < 15 * 60_000) return;
  lastAttempt = Date.now();
  try {
    const rate = await fetchBcvRate();
    await db.insert(exchangeRates).values({ day: today, rate: String(rate), source: AUTO_SOURCE }).onConflictDoNothing();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
  }
}
