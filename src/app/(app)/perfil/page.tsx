import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/labels";
import { changeOwnPassword } from "@/app/actions/team";
import { logout } from "@/app/actions/auth";

export const metadata = { title: "Mi perfil" };

export default async function Profile({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  return (
    <div className="grid gap-5 max-w-md">
      <div><h1 className="h1">{u.name}</h1><p className="text-sm text-muted">{u.email} · {ROLE_LABEL[u.role]}</p></div>
      {sp.ok && <p role="status" className="card border-good/40 bg-good/5 px-4 py-2 text-sm text-good">{sp.ok}</p>}
      {sp.error && <p role="alert" className="card border-bad/40 bg-bad/5 px-4 py-2 text-sm text-bad">{sp.error}</p>}
      <form action={changeOwnPassword} className="card p-5 grid gap-3">
        <h2 className="h2">Cambiar contraseña</h2>
        <div><label className="label" htmlFor="current">Contraseña actual</label><input id="current" name="current" type="password" required className="input" autoComplete="current-password" /></div>
        <div><label className="label" htmlFor="next">Nueva contraseña</label><input id="next" name="next" type="password" minLength={8} required className="input" autoComplete="new-password" /></div>
        <div><button className="btn-primary">Cambiar</button></div>
      </form>
      <form action={logout}><button className="btn w-full">Salir</button></form>
    </div>
  );
}
