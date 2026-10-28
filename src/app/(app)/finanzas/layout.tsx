import { requireRole } from "@/lib/auth";
import { rateFor } from "@/lib/rates";
import { rateText, todayCaracas, fmtDay } from "@/lib/money";
import { setRate } from "@/app/actions/finance";
import FinanceTabs from "@/components/FinanceTabs";
import ErrorBanner from "@/components/ErrorBanner";
import { Suspense } from "react";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await requireRole("DIRECCION", "ADMINISTRACION");
  const today = todayCaracas();
  const r = await rateFor(today);
  const isToday = r?.day === today;
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="h1">Finanzas</h1>
        <details className={`group rounded-[18px] ${isToday ? "bg-paper" : "bg-yellow"}`} open={!r}>
          <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
            <span className="eyebrow !text-ink/70">Tasa {isToday ? "de hoy" : r ? `del ${fmtDay(r.day)}` : "del día"}</span>
            {r ? <span className="font-mono text-lg font-semibold tabular">Bs. {rateText(r.rate)}</span> : <span className="font-bold">Sin registrar</span>}
            <span className="text-sm font-semibold underline decoration-dotted underline-offset-4">{isToday ? "Cambiar" : "Registrar la de hoy"}</span>
          </summary>
          <form action={setRate} className="flex flex-wrap items-end gap-2 px-5 pb-4">
            <input type="hidden" name="day" value={today} />
            <div><label className="label" htmlFor="rate">Bolívares por 1 USD</label><input id="rate" name="rate" inputMode="decimal" required placeholder="Ej.: 215,40" defaultValue={isToday && r ? String(r.rate).replace(".", ",") : ""} className="input w-40 tabular" /></div>
            <div><label className="label" htmlFor="source">Fuente</label>
              <select id="source" name="source" className="input w-32" defaultValue={r?.source ?? "BCV"}><option>BCV</option><option>Paralelo</option><option>Otra</option></select>
            </div>
            <button className="btn-primary">Guardar tasa</button>
          </form>
        </details>
      </div>
      <FinanceTabs />
      <Suspense fallback={null}><ErrorBanner /></Suspense>
      {children}
    </div>
  );
}
