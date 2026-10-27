"use client";
import { useTransition } from "react";
import { acceptTask, setTaskStatus, toggleChecklist, deleteTask } from "@/app/actions/tasks";
import { TASK_STATUSES, TASK_STATUS_LABEL, fmtDate, type TaskStatusT } from "@/lib/labels";

export type TaskView = {
  id: string; title: string; notes: string | null; status: TaskStatusT; dueDate: string | null;
  checklist: { text: string; done: boolean }[]; assignee: string | null; mine: boolean; order?: { id: string; number: number; title: string } | null;
};

const TONE: Record<TaskStatusT, string> = {
  POR_ACEPTAR: "bg-warn/15 text-warn", PENDIENTE: "bg-muted/15 text-muted", EN_CURSO: "bg-accent/15 text-accent", LISTA: "bg-good/15 text-good",
};

export default function TaskCard({ t, canDelete }: { t: TaskView; canDelete?: boolean }) {
  const [pending, start] = useTransition();
  const done = t.checklist.filter((c) => c.done).length;
  const late = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "LISTA";
  return (
    <li className={`rounded-lg border border-line p-3 grid gap-2 ${pending ? "opacity-60" : ""} ${t.status === "LISTA" ? "bg-canvas" : "bg-paper"}`}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${t.status === "LISTA" ? "line-through text-muted" : ""}`}>{t.title}</p>
          <p className="text-xs text-muted">
            {t.order && <><a href={`/ordenes/${t.order.id}#tareas`} className="text-accent">#{t.order.number} {t.order.title}</a> · </>}
            {t.assignee ?? "Sin asignar"}
            {t.dueDate && <> · <span className={late ? "text-bad font-semibold" : ""}>{late ? "vencida " : "entrega "}{fmtDate(t.dueDate)}</span></>}
            {t.checklist.length > 0 && <> · {done}/{t.checklist.length} pasos</>}
          </p>
        </div>
        <span className={`chip ${TONE[t.status]}`}>{TASK_STATUS_LABEL[t.status]}</span>
      </div>
      {t.notes && <p className="text-sm text-muted whitespace-pre-line">{t.notes}</p>}
      {t.checklist.length > 0 && (
        <ul className="grid gap-1">
          {t.checklist.map((c, i) => (
            <li key={i}>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={c.done} disabled={pending} onChange={() => start(() => toggleChecklist(t.id, i))} className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" />
                <span className={c.done ? "line-through text-muted" : ""}>{c.text}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {t.status === "POR_ACEPTAR" && t.mine ? (
          <button className="btn-primary btn-sm" disabled={pending} onClick={() => start(() => acceptTask(t.id))}>Aceptar tarea</button>
        ) : t.status === "POR_ACEPTAR" ? (
          <span className="text-xs text-warn">Esperando que {t.assignee ?? "la persona"} la acepte</span>
        ) : (
          <>
            <label className="sr-only" htmlFor={`ts-${t.id}`}>Estado de la tarea</label>
            <select id={`ts-${t.id}`} value={t.status} disabled={pending} onChange={(e) => start(() => setTaskStatus(t.id, e.target.value))} className="input w-auto py-1 text-xs">
              {TASK_STATUSES.filter((s) => s !== "POR_ACEPTAR").map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
            </select>
            {t.status !== "LISTA" && <button className="btn btn-sm" disabled={pending} onClick={() => start(() => setTaskStatus(t.id, "LISTA"))}>Marcar lista</button>}
          </>
        )}
        {canDelete && <button className="ml-auto text-xs text-muted hover:text-bad" disabled={pending} onClick={() => { if (confirm(`¿Eliminar la tarea "${t.title}"?`)) start(() => deleteTask(t.id)); }}>Eliminar</button>}
      </div>
    </li>
  );
}
