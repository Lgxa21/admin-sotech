"use client";
import { useTransition } from "react";
import { acceptTask, setTaskStatus, toggleChecklist, deleteTask } from "@/app/actions/tasks";
import { TASK_STATUSES, TASK_STATUS_LABEL, fmtDate, type TaskStatusT } from "@/lib/labels";

export type TaskView = {
  id: string; title: string; notes: string | null; status: TaskStatusT; dueDate: string | null;
  checklist: { text: string; done: boolean }[]; assignee: string | null; mine: boolean; order?: { id: string; number: number; title: string } | null;
};

const TONE: Record<TaskStatusT, string> = {
  POR_ACEPTAR: "bg-yellow text-ink", PENDIENTE: "bg-ink/10 text-ink", EN_CURSO: "bg-cyan text-ink", LISTA: "bg-ink text-paper",
};

export default function TaskCard({ t, canDelete }: { t: TaskView; canDelete?: boolean }) {
  const [pending, start] = useTransition();
  const done = t.status === "LISTA";
  const steps = t.checklist.filter((c) => c.done).length;
  const late = t.dueDate && new Date(t.dueDate) < new Date() && !done;
  const canToggle = t.status !== "POR_ACEPTAR";
  return (
    <li className={`grid gap-3 rounded-[14px] px-4 py-3.5 ${done ? "bg-canvas" : "border-2 border-ink bg-paper"} ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending || !canToggle}
          onClick={() => start(() => setTaskStatus(t.id, done ? "PENDIENTE" : "LISTA"))}
          aria-label={done ? `Reabrir "${t.title}"` : `Marcar "${t.title}" como lista`}
          className={`grid h-6 w-6 flex-none place-items-center rounded-[7px] text-sm font-extrabold ${done ? "bg-ink text-yellow" : "border-2 border-ink"} disabled:cursor-not-allowed disabled:opacity-40`}>
          {done && <span aria-hidden="true">✓</span>}
        </button>
        <div className="min-w-0 flex-[1_1_200px]">
          <p className={`font-bold ${done ? "text-muted line-through" : ""}`}>{t.title}</p>
          <p className="text-[13px] text-muted">
            {t.order && <><a href={`/ordenes/${t.order.id}#tareas`} className="font-semibold text-ink underline">#{t.order.number} {t.order.title}</a> · </>}
            {t.assignee ?? "Sin asignar"}
            {t.dueDate && <> · <span className={late ? "font-bold text-bad" : ""}>{late ? "vencida " : "entrega "}{fmtDate(t.dueDate)}</span></>}
            {t.checklist.length > 0 && <> · {steps}/{t.checklist.length} pasos</>}
          </p>
        </div>
        {t.status !== "PENDIENTE" && t.status !== "LISTA" && <span className={`tag ${TONE[t.status]}`}>{TASK_STATUS_LABEL[t.status]}</span>}
      </div>

      {t.notes && <p className="whitespace-pre-line text-sm text-muted">{t.notes}</p>}

      {t.checklist.length > 0 && !done && (
        <ul className="grid gap-1.5 pl-9">
          {t.checklist.map((c, i) => (
            <li key={i}>
              <label className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" checked={c.done} disabled={pending} onChange={() => start(() => toggleChecklist(t.id, i))} className="mt-0.5 h-4 w-4 accent-[#111111]" />
                <span className={c.done ? "text-muted line-through" : ""}>{c.text}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {(t.status === "POR_ACEPTAR" || !done || canDelete) && (
        <div className="flex flex-wrap items-center gap-2 pl-9">
          {t.status === "POR_ACEPTAR" && t.mine ? (
            <button className="btn-primary btn-sm" disabled={pending} onClick={() => start(() => acceptTask(t.id))}>Aceptar tarea</button>
          ) : t.status === "POR_ACEPTAR" ? (
            <span className="text-xs font-semibold text-warn">Esperando que {t.assignee?.split(" ")[0] ?? "la persona"} la acepte</span>
          ) : !done ? (
            <>
              <label className="sr-only" htmlFor={`ts-${t.id}`}>Estado de la tarea</label>
              <select id={`ts-${t.id}`} value={t.status} disabled={pending} onChange={(e) => start(() => setTaskStatus(t.id, e.target.value))} className="input w-auto rounded-full py-1 text-xs">
                {TASK_STATUSES.filter((s) => s !== "POR_ACEPTAR").map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
              </select>
            </>
          ) : null}
          {canDelete && <button className="ml-auto text-xs text-muted hover:text-bad" disabled={pending} onClick={() => { if (confirm(`¿Eliminar la tarea "${t.title}"?`)) start(() => deleteTask(t.id)); }}>Eliminar</button>}
        </div>
      )}
    </li>
  );
}
