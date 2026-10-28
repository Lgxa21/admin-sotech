import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/labels";
import { changeOwnPassword } from "@/app/actions/team";
import { saveNotificationPrefs, sendTestNotification } from "@/app/actions/notifications";
import { logout } from "@/app/actions/auth";
import { emailReady } from "@/lib/channels/email";
import { whatsappReady, displayPhone } from "@/lib/channels/whatsapp";
import PushToggle from "@/components/PushToggle";

export const metadata = { title: "Mi perfil" };
export const dynamic = "force-dynamic";

export default async function Profile({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const [u] = await db.select().from(users).where(eq(users.id, me.id));
  const email = emailReady(), wa = whatsappReady();
  const Check = ({ name, label, hint, checked, disabled }: { name: string; label: string; hint: string; checked: boolean; disabled?: boolean }) => (
    <label className={`flex items-start gap-3 rounded-[14px] bg-canvas px-4 py-3 ${disabled ? "opacity-60" : ""}`}>
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 h-5 w-5 accent-[#111111]" />
      <span><span className="block font-bold">{label}</span><span className="block text-sm text-muted">{hint}</span></span>
    </label>
  );
  return (
    <div className="grid max-w-2xl gap-6">
      <div className="grid gap-1"><h1 className="h1">{u.name}</h1><p className="text-muted">{u.email} · {ROLE_LABEL[u.role]}</p></div>
      {sp.ok && <p role="status" className="card px-5 py-3 text-sm font-semibold text-good">{sp.ok}</p>}
      {sp.error && <p role="alert" className="card px-5 py-3 text-sm font-semibold text-bad">{sp.error}</p>}

      <section id="avisos" aria-labelledby="avisos-t" className="card grid scroll-mt-24 gap-5 px-6 py-6">
        <div className="grid gap-1">
          <h2 id="avisos-t" className="h2">Avisos</h2>
          <p className="text-sm text-muted">Siempre los ves en la sección Avisos. Además puedes recibirlos fuera del sistema.</p>
        </div>

        <div className="grid gap-2">
          <h3 className="eyebrow">Notificaciones en el celular</h3>
          <PushToggle publicKey={process.env.VAPID_PUBLIC_KEY ?? null} />
        </div>

        <form action={saveNotificationPrefs} className="grid gap-3">
          <h3 className="eyebrow">Qué recibir</h3>
          <Check name="notifyPush" label="En el celular o la computadora" hint="Todos los avisos, en los dispositivos donde los activaste." checked={u.notifyPush} />
          <Check name="notifyEmail" label="Por correo" hint={email ? `Tareas, menciones, urgencias y respuestas de clientes, a ${u.email}.` : "Todavía no está configurado en el servidor."} checked={u.notifyEmail} disabled={!email} />
          <Check name="notifyWhatsapp" label="Por WhatsApp" hint={wa ? "Cuando te asignan una tarea o te mencionan. Llega desde el WhatsApp Business de la empresa." : "Todavía no está configurado en el servidor."} checked={u.notifyWhatsapp} disabled={!wa} />
          <div className="max-w-xs"><label className="label" htmlFor="phone">Tu número de WhatsApp</label><input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={displayPhone(u.phone)} placeholder="0412 123 4567" className="input" /></div>
          <div className="flex flex-wrap gap-2"><button className="btn-primary">Guardar</button></div>
        </form>
        <form action={sendTestNotification}><button className="btn btn-sm">Enviarme un aviso de prueba</button></form>
      </section>

      <form action={changeOwnPassword} className="card grid gap-3 px-6 py-6">
        <h2 className="h2">Cambiar contraseña</h2>
        <div><label className="label" htmlFor="current">Contraseña actual</label><input id="current" name="current" type="password" required className="input" autoComplete="current-password" /></div>
        <div><label className="label" htmlFor="next">Nueva contraseña</label><input id="next" name="next" type="password" minLength={8} required className="input" autoComplete="new-password" /></div>
        <div><button className="btn-primary">Cambiar</button></div>
      </form>
      <form action={logout}><button className="btn w-full py-3">Salir</button></form>
    </div>
  );
}
