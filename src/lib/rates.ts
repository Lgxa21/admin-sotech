import "server-only";
import { desc, lte } from "drizzle-orm";
import { db, exchangeRates } from "@/db";
import { todayCaracas } from "./money";

// La tasa vigente para un día: la de ese día o la última registrada antes.
export async function rateFor(day: string = todayCaracas()) {
  const [r] = await db.select().from(exchangeRates).where(lte(exchangeRates.day, day)).orderBy(desc(exchangeRates.day)).limit(1);
  return r ? { day: r.day, rate: Number(r.rate), source: r.source } : null;
}
