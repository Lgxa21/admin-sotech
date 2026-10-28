// Utilidades de dinero (sin acceso a base de datos). La moneda base de los reportes es USD.
export const PAYMENT_METHODS = ["Transferencia", "Pago móvil", "Binance", "Zelle", "Efectivo", "Otro"] as const;

// "1.234,56" o "1234.56" → 1234.56
export function parseAmount(raw: FormDataEntryValue | null | undefined): number | null {
  if (typeof raw !== "string") return null;
  let v = raw.trim().replace(/\s|US\$|Bs\.?|\$/gi, "");
  if (!v) return null;
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function parseRate(raw: FormDataEntryValue | null | undefined): number | null {
  if (typeof raw !== "string") return null;
  let v = raw.trim();
  if (!v) return null;
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function toUsd(amount: number, currency: "USD" | "VES", rate: number | null) {
  if (currency === "USD") return amount;
  if (!rate) throw new Error("Falta la tasa del día para convertir bolívares a USD.");
  return Math.round((amount / rate) * 100) / 100;
}

export const usd = (v: number | string | null | undefined) =>
  "US$ " + Number(v ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const ves = (v: number | string | null | undefined) =>
  "Bs. " + Number(v ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (v: number | string | null | undefined, cur: "USD" | "VES") => (cur === "USD" ? usd(v) : ves(v));
export const rateText = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

// Hoy en Caracas como "2026-10-27"
export const todayCaracas = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
export const fmtDay = (d: string | null | undefined) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12)).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
};
