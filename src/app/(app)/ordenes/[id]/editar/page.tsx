import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, clients, users, orders } from "@/db";
import { requireRole } from "@/lib/auth";
import { updateOrder } from "@/app/actions/orders";
import { listOrderReferences } from "@/lib/order-piece-form";
import OrderForm from "@/components/OrderForm";

export const metadata = { title: "Editar orden" };

export default async function EditOrder({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("DIRECCION", "ADMINISTRACION");
  const { id } = await params;
  const o = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!o) notFound();
  const [cl, people, references] = await Promise.all([
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
    listOrderReferences(id),
  ]);
  return (
    <div className="grid gap-5">
      <h1 className="h1">Editar orden #{o.number}</h1>
      <OrderForm action={updateOrder.bind(null, id)} clients={cl} people={people} money values={o} references={references} submit="Guardar cambios" cancelHref={`/ordenes/${id}`} />
    </div>
  );
}
