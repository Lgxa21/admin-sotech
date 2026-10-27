import { asc } from "drizzle-orm";
import { db, users } from "@/db";
import { requireRole } from "@/lib/auth";
import { ROLES, ROLE_LABEL } from "@/lib/labels";
import { createUser, setUserActive, resetPassword } from "@/app/actions/team";

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
  const rows = await db.select().from(users).orderBy(asc(users.name));
  return (
    <div className="grid gap-5 max-w-4xl">
      <h1 className="h1">Equipo</h1>
      {sp.ok && <p role="status" className="card border-good/40 bg-good/5 px-4 py-2 text-sm text-good">{sp.ok}</p>}
      {sp.error && <p role="alert" className="card border-bad/40 bg-bad/5 px-4 py-2 text-sm text-bad">{sp.error}</p>}
      <ul className="card divide-y divide-line">
        {rows.map((u) => (
          <li key={u.id} className={`px-4 py-3 flex flex-wrap items-center gap-3 ${u.active ? "" : "opacity-60"}`}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{u.name} {!u.active && <span className="chip bg-muted/15 text-muted ml-1">Inactivo</span>}</p>
              <p className="text-xs text-muted">{u.email} · {ROLE_LABEL[u.role]}{u.area ? ` · ${u.area}` : ""}</p>
            </div>
            {u.id !== me.id && (
              <>
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted hover:text-ink">Nueva contraseña</summary>
                  <form action={resetPassword.bind(null, u.id)} className="mt-2 flex gap-2">
                    <label className="sr-only" htmlFor={`pw-${u.id}`}>Nueva contraseña</label>
                    <input id={`pw-${u.id}`} name="password" type="text" minLength={8} required className="input w-44" placeholder="Mínimo 8 caracteres" />
                    <button className="btn btn-sm">Guardar</button>
                  </form>
                </details>
                <form action={setUserActive.bind(null, u.id, !u.active)}><button className="btn btn-sm">{u.active ? "Desactivar" : "Activar"}</button></form>
              </>
            )}
          </li>
        ))}
      </ul>
      <section className="card p-5 grid gap-4">
        <h2 className="h2">Agregar a alguien</h2>
        <form action={createUser} className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="name">Nombre</label><input id="name" name="name" required className="input" /></div>
          <div><label className="label" htmlFor="email">Correo</label><input id="email" name="email" type="email" required className="input" /></div>
          <div>
            <label className="label" htmlFor="role">Rol</label>
            <select id="role" name="role" className="input" defaultValue="PRODUCCION">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
          </div>
          <div><label className="label" htmlFor="area">Área</label><input id="area" name="area" placeholder="Diseño, video, redes…" className="input" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="password">Contraseña inicial</label><input id="password" name="password" type="text" minLength={8} required className="input sm:w-72" placeholder="Mínimo 8 caracteres" /><p className="mt-1 text-xs text-muted">Compártela por un medio privado. La persona puede cambiarla desde su perfil.</p></div>
          <ul className="sm:col-span-2 grid gap-1 text-xs text-muted">{ROLES.map((r) => <li key={r}><b className="text-ink font-medium">{ROLE_LABEL[r]}:</b> {ROLE_HELP[r]}</li>)}</ul>
          <div><button className="btn-primary">Agregar</button></div>
        </form>
      </section>
    </div>
  );
}
