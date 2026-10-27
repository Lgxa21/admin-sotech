import { asc, eq } from "drizzle-orm";
import { db, clients, users } from "@/db";
import { requireRole } from "@/lib/auth";
import { createOrder } from "@/app/actions/orders";
import OrderForm from "@/components/OrderForm";

export const metadata = { title: "Nueva orden" };

export default async function NewOrder({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  await requireRole("DIRECCION", "ADMINISTRACION");
  const sp = await searchParams;
  const [cl, people] = await Promise.all([
    db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.active, true)).orderBy(asc(clients.name)),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
  ]);
  return (
    <div className="grid gap-5">
      <h1 className="h1">Nueva orden</h1>
      {!cl.length && <p className="card p-4 text-sm">Primero registra un cliente: usa “+ Cliente nuevo” debajo del campo Cliente.</p>}
      <OrderForm action={createOrder} clients={cl} people={people} money values={{ clientId: sp.cliente }} submit="Crear orden" cancelHref="/ordenes" />
    </div>
  );
}
