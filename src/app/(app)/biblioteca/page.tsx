import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, docs } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManage, canSeeMoney } from "@/lib/perm";
import { ensureDefaultDocs } from "@/lib/docs-seed";
import { DOC_CATEGORIES } from "@/lib/doc-categories";
import CopyText from "@/components/CopyText";

export const metadata = { title: "Biblioteca" };
export const dynamic = "force-dynamic";

export default async function Library() {
  const u = await requireUser();
  await ensureDefaultDocs();
  const rows = await db.select().from(docs).orderBy(asc(docs.position), asc(docs.createdAt));
  const cats = Object.entries(DOC_CATEGORIES).filter(([, c]) => !c.moneyOnly || canSeeMoney(u.role));
  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="h1">Biblioteca</h1>
          <p className="text-muted">Cómo trabajamos, mensajes listos para el cliente y todo lo que el equipo necesita a mano.</p>
        </div>
        {canManage(u.role) && <Link href="/biblioteca/nuevo" className="btn-primary">+ Nuevo documento</Link>}
      </div>
      {cats.map(([key, c]) => {
        const list = rows.filter((d) => d.category === key);
        if (!list.length) return null;
        return (
          <section key={key} aria-labelledby={`cat-${key}`} className="grid gap-3">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 id={`cat-${key}`} className="h2 text-[22px]">{c.label}</h2>
              <span className="text-sm text-muted">{c.hint}</span>
            </div>
            {key === "mensaje" ? (
              <ul className="grid gap-2.5 md:grid-cols-2">
                {list.map((d) => (
                  <li key={d.id} className="card grid content-start gap-3 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/biblioteca/${d.id}`} className="font-bold hover:underline">{d.title}</Link>
                      <CopyText text={d.body} />
                    </div>
                    <p className="whitespace-pre-line text-sm text-muted">{d.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((d) => (
                  <li key={d.id}>
                    <Link href={`/biblioteca/${d.id}`} className="card flex h-full flex-col gap-2 px-5 py-4 transition-transform hover:-translate-y-0.5">
                      <span className={`tag w-fit ${c.tone}`}>{c.label}</span>
                      <span className="font-bold">{d.title}</span>
                      <span className="line-clamp-2 text-sm text-muted">{d.body.replace(/^## /gm, "").replace(/^- /gm, "").replace(/\s*\n+\s*/g, " · ").slice(0, 160)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <p className="text-xs text-muted">Lo que está entre corchetes [así] es para completar o personalizar antes de usar.</p>
    </div>
  );
}
