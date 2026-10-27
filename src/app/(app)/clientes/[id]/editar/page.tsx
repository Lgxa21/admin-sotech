import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, clients } from "@/db";
import { requireRole } from "@/lib/auth";
import { updateClient } from "@/app/actions/clients";
import ClientForm from "@/components/ClientForm";

export const metadata = { title: "Editar cliente" };

export default async function EditClient({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("DIRECCION", "ADMINISTRACION");
  const { id } = await params;
  const c = await db.query.clients.findFirst({ where: eq(clients.id, id) });
  if (!c) notFound();
  return (
    <div className="grid gap-5">
      <h1 className="h1">Editar {c.name}</h1>
      <ClientForm action={updateClient.bind(null, id)} values={c} submit="Guardar cambios" cancelHref={`/clientes/${id}`} />
    </div>
  );
}
