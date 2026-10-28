import Link from "next/link";
import { DOC_CATEGORIES } from "@/lib/doc-categories";

export default function DocForm({ action, values = {}, cancelHref }: { action: (f: FormData) => Promise<void>; values?: { title?: string; category?: string; body?: string }; cancelHref: string }) {
  return (
    <form action={action} className="card grid max-w-3xl gap-4 px-6 py-6">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div><label className="label" htmlFor="title">Título</label><input id="title" name="title" required defaultValue={values.title} className="input" /></div>
        <div><label className="label" htmlFor="category">Sección</label>
          <select id="category" name="category" defaultValue={values.category ?? "proceso"} className="input">{Object.entries(DOC_CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="body">Contenido</label>
        <textarea id="body" name="body" rows={18} defaultValue={values.body} className="input font-mono text-[14px] leading-relaxed" />
        <p className="mt-1.5 text-xs text-muted">Escribe “## ” al inicio de una línea para un subtítulo y “- ” para un punto de lista.</p>
      </div>
      <div className="flex gap-2"><button className="btn-primary">Guardar</button><Link href={cancelHref} className="btn">Cancelar</Link></div>
    </form>
  );
}
