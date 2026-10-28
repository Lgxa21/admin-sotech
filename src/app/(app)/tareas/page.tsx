import Link from "next/link";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, tasks } from "@/db";
import { requireUser } from "@/lib/auth";
import TaskCard from "@/components/TaskCard";
import BoardTabs from "@/components/BoardTabs";

export const metadata = { title: "Mis tareas" };
export const dynamic = "force-dynamic";

export default async function MyTasks({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const u = await requireUser();
  const { ver } = await searchParams;
  const showDone = ver === "listas";
  const rows = await db.query.tasks.findMany({
    where: and(eq(tasks.assigneeId, u.id), showDone ? eq(tasks.status, "LISTA") : ne(tasks.status, "LISTA")),
    with: { order: true, assignee: true },
    orderBy: [sql`case when ${tasks.status} = 'POR_ACEPTAR' then 0 else 1 end`, sql`${tasks.dueDate} asc nulls last`],
    limit: 200,
  });
  const toAccept = rows.filter((t) => t.status === "POR_ACEPTAR").length;
  const freelancer = u.role === "FREELANCER";

  const filter = (
    <div className="inline-flex rounded-full bg-paper p-1" role="group" aria-label="Mostrar">
      <Link href="/tareas" className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${!showDone ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>Abiertas</Link>
      <Link href="/tareas?ver=listas" className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${showDone ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>Terminadas</Link>
    </div>
  );

  return (
    <div className="grid gap-6">
      {freelancer ? (
        <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="h1">Mis tareas</h1>{filter}</div>
      ) : (
        <BoardTabs current="tareas" role={u.role}>{filter}</BoardTabs>
      )}
      {!showDone && rows.length > 0 && (
        <p className="text-sm text-muted">
          <b className="font-mono text-ink">{rows.length}</b> {rows.length === 1 ? "abierta" : "abiertas"}
          {toAccept > 0 && <> · <b className="font-mono text-ink">{toAccept}</b> por aceptar</>}
        </p>
      )}
      {rows.length ? (
        <ul className="grid max-w-3xl gap-2.5">
          {rows.map((t) => (
            <TaskCard key={t.id} t={{
              id: t.id, title: t.title, notes: t.notes, status: t.status, dueDate: t.dueDate?.toISOString() ?? null, checklist: t.checklist,
              assignee: t.assignee?.name ?? null, mine: true, order: { id: t.order.id, number: t.order.number, title: t.order.title },
            }} />
          ))}
        </ul>
      ) : <p className="card max-w-3xl px-6 py-8 text-center text-muted">{showDone ? "Todavía no terminas ninguna tarea." : "No tienes tareas pendientes."}</p>}
    </div>
  );
}
