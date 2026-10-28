import { eq } from "drizzle-orm";
import { db, approvalLinks } from "@/db";
import { respondApproval } from "@/app/actions/client-links";
import PublicShell from "@/components/PublicShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aprobar pieza", robots: { index: false } };

const isImage = (u: string) => /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(u);

export default async function Approve({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const link = await db.query.approvalLinks.findFirst({ where: eq(approvalLinks.token, token), with: { order: { with: { client: true } } } });

  if (!link || link.status === "ANULADO") {
    return <PublicShell><div className="card grid gap-2 px-6 py-8"><h1 className="h1 text-3xl">Este enlace ya no está activo</h1><p className="text-muted">Puede que te hayamos enviado una versión más reciente. Si tienes dudas, escríbenos.</p></div></PublicShell>;
  }
  const o = link.order;
  const answered = link.status !== "PENDIENTE";

  return (
    <PublicShell>
      <div className="grid gap-2">
        <p className="eyebrow">{o.client.name} · ronda {link.round} de revisión</p>
        <h1 className="h1">{o.title}</h1>
      </div>

      {answered ? (
        <section className={`grid gap-2 rounded-[18px] px-6 py-6 ${link.status === "APROBADO" ? "bg-yellow" : "bg-paper"}`} role="status">
          <h2 className="h2 text-xl">{link.status === "APROBADO" ? "¡Aprobado! Gracias." : "Recibimos tus cambios."}</h2>
          <p>{link.status === "APROBADO" ? "Seguimos con la entrega. Te avisamos cuando esté lista." : "El equipo ya está trabajando en ellos y te enviaremos una nueva versión."}</p>
          {link.clientComment && <p className="whitespace-pre-line text-sm text-ink/70">Tu comentario: “{link.clientComment}”</p>}
        </section>
      ) : (
        <>
          {link.message && <p className="card whitespace-pre-line px-6 py-5">{link.message}</p>}
          {link.pieceUrl && (
            <section className="card grid gap-3 px-6 py-6">
              <h2 className="h2">La pieza</h2>
              {isImage(link.pieceUrl) && <img src={link.pieceUrl} alt={`Pieza para revisión: ${o.title}`} className="w-full rounded-xl bg-canvas" />}
              <a href={link.pieceUrl} target="_blank" rel="noreferrer" className="btn w-fit">Abrir la pieza en otra pestaña</a>
            </section>
          )}
          {sp.error && <p role="alert" className="card px-5 py-3 text-sm font-semibold text-bad">{sp.error}</p>}
          <form action={respondApproval.bind(null, token)} className="card grid gap-4 px-6 py-6">
            <div className="hidden" aria-hidden="true"><label>No llenar<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
            <div><label className="label" htmlFor="name">Tu nombre</label><input id="name" name="name" autoComplete="name" className="input" /></div>
            <div><label className="label" htmlFor="comment">Comentarios (obligatorio si pides cambios)</label><textarea id="comment" name="comment" rows={4} className="input" placeholder="Ej.: Cambiar la fecha a sábado 14 y agrandar el logo." /></div>
            <div className="flex flex-wrap gap-3">
              <button name="decision" value="aprobar" className="btn-primary px-7 py-3 text-[15px]">Aprobar</button>
              <button name="decision" value="cambios" className="btn px-6 py-3 text-[15px]">Pedir cambios</button>
            </div>
            {link.round > o.revisionRoundsIncluded && <p className="text-sm text-muted">Esta ya es una ronda adicional a las {o.revisionRoundsIncluded} incluidas.</p>}
          </form>
        </>
      )}
    </PublicShell>
  );
}
