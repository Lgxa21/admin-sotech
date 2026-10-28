import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, docs, users } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManage, canSeeMoney } from "@/lib/perm";
import { DOC_CATEGORIES } from "@/lib/doc-categories";
import { saveDoc, deleteDoc } from "@/app/actions/docs";
import { fmtDateTime } from "@/lib/labels";
import DocBody from "@/components/DocBody";
import DocForm from "@/components/DocForm";
import CopyText from "@/components/CopyText";

export const dynamic = "force-dynamic";

export default async function DocPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editar?: string; error?: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const [d] = await db.select().from(docs).where(eq(docs.id, id));
  if (!d) notFound();
  const cat = DOC_CATEGORIES[d.category] ?? DOC_CATEGORIES.proceso;
  if (cat.moneyOnly && !canSeeMoney(u.role)) redirect("/biblioteca");
  const editor = d.updatedById ? (await db.select({ name: users.name }).from(users).where(eq(users.id, d.updatedById)))[0]?.name : null;

  if (sp.editar && canManage(u.role)) {
    return (
      <div className="grid gap-5">
        <h1 className="h1">Editar documento</h1>
        {sp.error && <p role="alert" className="card px-5 py-3 text-sm font-semibold text-bad">{sp.error}</p>}
        <DocForm action={saveDoc.bind(null, id)} values={d} cancelHref={`/biblioteca/${id}`} />
        <form action={deleteDoc.bind(null, id)}><button className="text-xs text-muted hover:text-bad">Eliminar este documento</button></form>
      </div>
    );
  }
  return (
    <div className="grid gap-5">
      <Link href="/biblioteca" className="eyebrow w-fit hover:text-ink">← Biblioteca</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <span className={`tag w-fit ${cat.tone}`}>{cat.label}</span>
          <h1 className="h1">{d.title}</h1>
        </div>
        <div className="flex gap-2">
          {d.category === "mensaje" && <CopyText text={d.body} label="Copiar mensaje" />}
          {canManage(u.role) && <Link href={`/biblioteca/${id}?editar=1`} className="btn">Editar</Link>}
        </div>
      </div>
      <article className="card px-6 py-6 sm:px-8"><DocBody text={d.body} /></article>
      <p className="text-xs text-muted">Actualizado {fmtDateTime(d.updatedAt)}{editor ? ` por ${editor}` : ""}.</p>
    </div>
  );
}
