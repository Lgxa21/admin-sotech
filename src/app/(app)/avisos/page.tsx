import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, notifications } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/labels";
import { markAllRead } from "@/app/actions/team";

export const metadata = { title: "Avisos" };
export const dynamic = "force-dynamic";

export default async function Notices() {
  const u = await requireUser();
  const rows = await db.select().from(notifications).where(eq(notifications.userId, u.id)).orderBy(desc(notifications.createdAt)).limit(100);
  const unread = rows.filter((r) => !r.read).length;
  return (
    <div className="grid gap-5 max-w-3xl">
      <div className="flex items-end justify-between gap-3">
        <div><h1 className="h1">Avisos</h1><p className="text-sm text-muted">{unread ? `${unread} sin leer` : "Estás al día"}</p></div>
        {unread > 0 && <form action={markAllRead}><button className="btn">Marcar todo como leído</button></form>}
      </div>
      {rows.length ? (
        <ul className="card divide-y divide-line">
          {rows.map((n) => (
            <li key={n.id}>
              <Link href={n.orderId ? `/ordenes/${n.orderId}` : "#"} className={`flex gap-3 px-4 py-3 hover:bg-canvas ${n.read ? "" : "bg-accent/5"}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.urgent ? "bg-bad" : n.read ? "bg-transparent" : "bg-accent"}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${n.read ? "text-muted" : "font-medium"} ${n.urgent ? "text-bad" : ""}`}>{n.text}</span>
                  <span className="block text-xs text-muted">{fmtDateTime(n.createdAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="card p-8 text-center text-muted">No tienes avisos todavía.</p>}
    </div>
  );
}
