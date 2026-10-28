import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { db, users, tasks } from "@/db";
import { requireRole } from "@/lib/auth";
import { ROLES, ROLE_LABEL } from "@/lib/labels";
import { createUser, setUserActive, resetPassword } from "@/app/actions/team";
import BoardTabs from "@/components/BoardTabs";
import { displayPhone } from "@/lib/channels/whatsapp";

export const metadata = { title: "Equipo" };
export const dynamic = "force-dynamic";

const ROLE_HELP: Record<string, string> = {
  DIRECCION: "Ve todo, asigna trabajo y aprueba piezas antes del cliente.",
  ADMINISTRACION: "Clientes, órdenes, montos y facturas.",
  PRODUCCION: "Sus órdenes y tareas, sin montos.",
  FREELANCER: "Solo sus tareas, que debe aceptar.",
};

export default async function Team({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireRole("DIRECCION");
  const sp = await searchParams;
  const now = new Date();
  const [rows, load] = await Promise.all([
    db.select().from(users).orderBy(asc(users.name)),
    db.select({
      id: users.id,
      open: count(tasks.id),
      late: sql<number>`count(*) filter (where ${tasks.dueDate} < ${now})`.mapWith(Number),
      toAccept: sql<number>`count(*) filter (where ${tasks.status} = 'POR_ACEPTAR')`.mapWith(Number),
    }).from(users).leftJoin(tasks, and(eq(tasks.assigneeId, users.id), ne(tasks.status, "LISTA")))
      .where(eq(users.active, true)).groupBy(users.id),
  ]);
  const byId = new Map(load.map((l) => [l.id, l]));
  const active = rows.filter((u) => u.active).sort((a, b) => (byId.get(b.id)?.open ?? 0) - (byId.get(a.id)?.open ?? 0));
  const inactive = rows.filter((u) => !u.active);
  const maxLoad = Math.max(1, ...load.map((l) => l.open));

  return (
    <div className="grid gap-6">
      <BoardTabs current="equipo" role={me.role} />
      {sp.ok && <p role="status" className="card px-5 py-3 text-sm font-semibold text-good">{sp.ok}</p>}
      {sp.error && <p role="alert" className="card px-5 py-3 text-sm font-semibold text-bad">{sp.error}</p>}

      <section aria-labelledby="carga" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="carga" className="h2">Carga de trabajo</h2>
          <span className="text-sm text-muted">Tareas abiertas por persona</span>
        </div>
        <ul className="grid gap-2.5">
          {active.map((u) => {
            const l = byId.get(u.id) ?? { open: 0, late: 0, toAccept: 0 };
            return (
              <li key={u.id} className="card grid gap-3 px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-[1_1_200px]">
                    <p className="font-bold">{u.name}{u.id === me.id && <span className="font-normal text-muted"> (tú)</span>}</p>
                    <p className="text-[13px] text-muted">{ROLE_LABEL[u.role]}{u.area ? ` · ${u.area}` : ""} · {u.email}{u.phone ? ` · ${displayPhone(u.phone)}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono text-lg font-semibold tabular">{l.open}</span>
                    <span className="text-muted">{l.open === 1 ? "abierta" : "abiertas"}</span>
                    {l.late > 0 && <span className="tag bg-magenta text-white">{l.late} vencida{l.late === 1 ? "" : "s"}</span>}
                    {l.toAccept > 0 && <span className="tag bg-yellow text-ink">{l.toAccept} por aceptar</span>}
                  </div>
                </div>
                <span className="block h-2.5 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
                  <span className={`block h-full rounded-full ${l.late > 0 ? "bg-magenta" : "bg-cyan"}`} style={{ width: `${(l.open / maxLoad) * 100}%` }} />
                </span>
                {u.id !== me.id && (
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <details>
                      <summary className="cursor-pointer text-muted underline decoration-dotted underline-offset-4 hover:text-ink">Cambiar contraseña</summary>
                      <form action={resetPassword.bind(null, u.id)} className="mt-2 flex flex-wrap gap-2">
                        <label className="sr-only" htmlFor={`pw-${u.id}`}>Nueva contraseña</label>
                        <input id={`pw-${u.id}`} name="password" type="text" minLength={8} required className="input w-52" placeholder="Mínimo 8 caracteres" />
                        <button className="btn btn-sm">Guardar</button>
                      </form>
                    </details>
                    <form action={setUserActive.bind(null, u.id, false)} className="ml-auto"><button className="text-muted hover:text-bad">Desactivar</button></form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {inactive.length > 0 && (
        <section aria-labelledby="inactivos" className="grid gap-2">
          <h2 id="inactivos" className="eyebrow">Inactivos</h2>
          <ul className="card divide-y divide-line">
            {inactive.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 flex-1 text-muted">{u.name} · {ROLE_LABEL[u.role]}</span>
                <form action={setUserActive.bind(null, u.id, true)}><button className="btn btn-sm">Activar</button></form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="card group">
        <summary className="flex cursor-pointer items-center justify-between px-6 py-5 font-bold">+ Agregar a alguien <span aria-hidden="true" className="transition-transform group-open:rotate-90">→</span></summary>
        <form action={createUser} className="grid gap-4 px-6 pb-6 sm:grid-cols-2">
          <div><label className="label" htmlFor="name">Nombre</label><input id="name" name="name" required className="input" /></div>
          <div><label className="label" htmlFor="email">Correo</label><input id="email" name="email" type="email" required className="input" /></div>
          <div>
            <label className="label" htmlFor="role">Rol</label>
            <select id="role" name="role" className="input" defaultValue="PRODUCCION">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
          </div>
          <div><label className="label" htmlFor="area">Área</label><input id="area" name="area" placeholder="Diseño, video, redes…" className="input" /></div>
          <div><label className="label" htmlFor="phone">WhatsApp (opcional)</label><input id="phone" name="phone" type="tel" placeholder="0412 123 4567" className="input" /></div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="password">Contraseña inicial</label>
            <input id="password" name="password" type="text" minLength={8} required className="input sm:w-72" placeholder="Mínimo 8 caracteres" />
            <p className="mt-1.5 text-xs text-muted">Compártela por un medio privado. La persona puede cambiarla desde su perfil.</p>
          </div>
          <ul className="grid gap-1 text-xs text-muted sm:col-span-2">{ROLES.map((r) => <li key={r}><b className="font-semibold text-ink">{ROLE_LABEL[r]}:</b> {ROLE_HELP[r]}</li>)}</ul>
          <div><button className="btn-primary">Agregar</button></div>
        </form>
      </details>
    </div>
  );
}
