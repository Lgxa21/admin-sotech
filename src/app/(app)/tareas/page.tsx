import { and, eq, ne, sql } from "drizzle-orm";
import { db, tasks } from "@/db";
import { requireUser } from "@/lib/auth";
import TaskCard from "@/components/TaskCard";

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
  return (
    <div className="grid gap-5 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Mis tareas</h1>
          {!showDone && <p className="text-sm text-muted">{rows.length} abiertas{toAccept ? ` · ${toAccept} por aceptar` : ""}</p>}
        </div>
        <a href={showDone ? "/tareas" : "/tareas?ver=listas"} className="text-sm font-semibold text-ink underline">{showDone ? "Ver abiertas" : "Ver terminadas"}</a>
      </div>
      {rows.length ? (
        <ul className="grid gap-2">
          {rows.map((t) => (
            <TaskCard key={t.id} t={{
              id: t.id, title: t.title, notes: t.notes, status: t.status, dueDate: t.dueDate?.toISOString() ?? null, checklist: t.checklist,
              assignee: t.assignee?.name ?? null, mine: true, order: { id: t.order.id, number: t.order.number, title: t.order.title },
            }} />
          ))}
        </ul>
      ) : <p className="card p-8 text-center text-muted">{showDone ? "Todavía no terminas ninguna tarea." : "No tienes tareas pendientes."}</p>}
    </div>
  );
}
