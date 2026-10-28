import Link from "next/link";
import { asc, count, desc, eq } from "drizzle-orm";
import { db, retainers, clients, users, orders } from "@/db";
import { money } from "@/lib/money";
import { SERVICES, SERVICE_LABEL } from "@/lib/labels";
import { createRetainer, setRetainerActive } from "@/app/actions/retainers";
import { ensureRetainerOrders, currentPeriod, periodLabel } from "@/lib/retainers";

export const metadata = { title: "Igualas" };
export const dynamic = "force-dynamic";

export default async function Retainers({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const sp = await searchParams;
  await ensureRetainerOrders();
  const period = currentPeriod();
  const [rows, clientList, people, counts] = await Promise.all([
    db.query.retainers.findMany({ with: { client: true, owner: true }, orderBy: [desc(retainers.active), asc(retainers.createdAt)] }),
    db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.active, true)).orderBy(asc(clients.name)),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
    db.select({ retainerId: orders.retainerId, n: count() }).from(orders).groupBy(orders.retainerId),
  ]);
  const nBy = new Map(counts.map((c) => [c.retainerId, c.n]));
  const monthly = rows.filter((r) => r.active && r.currency === "USD").reduce((a, r) => a + Number(r.amount), 0);

  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted">Cada iguala activa crea sola su orden del mes, con una tarea por entregable. La de {periodLabel(period)} ya está creada para todas las activas.</p>
      {rows.length > 0 && (
        <section aria-labelledby="activas" className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="activas" className="h2">Igualas</h2>
            <span className="text-sm text-muted">Ingreso fijo mensual: <b className="font-mono text-ink">{money(monthly, "USD")}</b></span>
          </div>
          <ul className="grid gap-2.5">
            {rows.map((r) => (
              <li key={r.id} className={`card grid gap-2 px-5 py-4 ${r.active ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-[1_1_220px]">
                    <p className="font-bold">{r.client.name} <span className="font-normal text-muted">· {r.title}</span></p>
                    <p className="text-[13px] text-muted">{SERVICE_LABEL[r.serviceType]} · entrega el día {r.dueDay} · {r.owner ? `responsable ${r.owner.name}` : "sin responsable"} · desde {periodLabel(r.startPeriod)}</p>
                  </div>
                  {!r.active && <span className="tag bg-ink/10 text-ink">Pausada</span>}
                  <span className="font-mono font-semibold">{money(r.amount, r.currency)}<span className="text-xs font-normal text-muted"> /mes</span></span>
                </div>
                {r.items.length > 0 && <p className="text-sm">{r.items.map((i) => `${i.qty} × ${i.title}`).join(" · ")}</p>}
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Link href={`/ordenes?vista=lista&cliente=${r.clientId}&cerradas=1`} className="font-semibold underline">{nBy.get(r.id) ?? 0} órdenes generadas</Link>
                  <form action={setRetainerActive.bind(null, r.id, !r.active)} className="ml-auto"><button className="text-muted hover:text-ink">{r.active ? "Pausar" : "Reactivar"}</button></form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="card group" open={rows.length === 0 || !!sp.cliente}>
        <summary className="flex cursor-pointer items-center justify-between px-6 py-5 font-bold">+ Nueva iguala <span aria-hidden="true" className="transition-transform group-open:rotate-90">→</span></summary>
        <form action={createRetainer} className="grid gap-4 px-6 pb-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="clientId">Cliente</label>
              <select id="clientId" name="clientId" required className="input" defaultValue={sp.cliente ?? ""}><option value="" disabled>Elige un cliente</option>{clientList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <div><label className="label" htmlFor="title">Nombre</label><input id="title" name="title" defaultValue="Gestión de redes" className="input" /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div><label className="label" htmlFor="amount">Monto mensual</label><input id="amount" name="amount" required inputMode="decimal" placeholder="0,00" className="input tabular" /></div>
            <div><label className="label" htmlFor="currency">Moneda</label><select id="currency" name="currency" className="input w-28"><option value="USD">USD</option><option value="VES">Bs.</option></select></div>
            <div><label className="label" htmlFor="serviceType">Servicio</label><select id="serviceType" name="serviceType" className="input" defaultValue="REDES_SOCIALES">{SERVICES.map((s) => <option key={s} value={s}>{SERVICE_LABEL[s]}</option>)}</select></div>
          </div>
          <div><label className="label" htmlFor="items">Entregables del mes, uno por línea</label><textarea id="items" name="items" rows={4} className="input" placeholder={"12 posts para feed\n8 historias\n1 reporte de resultados"} /><p className="mt-1.5 text-xs text-muted">Cada línea se convierte en una tarea de la orden mensual.</p></div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2"><label className="label" htmlFor="ownerId">Responsable</label><select id="ownerId" name="ownerId" className="input" defaultValue=""><option value="">Sin asignar</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label className="label" htmlFor="dueDay">Día de entrega</label><input id="dueDay" name="dueDay" type="number" min={1} max={31} defaultValue={28} className="input" /></div>
            <div><label className="label" htmlFor="revisionRounds">Rondas incluidas</label><input id="revisionRounds" name="revisionRounds" type="number" min={0} max={10} defaultValue={2} className="input" /></div>
          </div>
          <div className="w-48"><label className="label" htmlFor="startPeriod">Empieza en</label><input id="startPeriod" name="startPeriod" type="month" defaultValue={period} className="input" /></div>
          <div><button className="btn-primary">Crear iguala</button></div>
        </form>
      </details>
    </div>
  );
}
