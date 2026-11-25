import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, orderCostings, orders, suppliers } from "@/db";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/form";
import { saveCosting } from "@/app/actions/costings";
import CostingForm from "@/components/CostingForm";

export const metadata = { title: "Costeo de la orden" };
export const dynamic = "force-dynamic";

export default async function OrderCostingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("DIRECCION");
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [order] = await db.select({ number: orders.number, title: orders.title, currency: orders.currency })
    .from(orders).where(eq(orders.id, id));
  if (!order) notFound();

  const [[stored], providerList] = await Promise.all([
    db.select({ costing: orderCostings.costing }).from(orderCostings).where(eq(orderCostings.orderId, id)),
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.active, true)).orderBy(asc(suppliers.name)),
  ]);

  return (
    <div className="grid gap-5">
      <header className="grid gap-2">
        <Link href={`/ordenes/${id}#dinero`} className="eyebrow w-fit hover:text-ink">← Orden #{order.number}</Link>
        <h1 className="h1">Costeo de la orden</h1>
        <p className="text-muted">{order.title}</p>
      </header>
      <CostingForm action={saveCosting.bind(null, id)} suppliers={providerList} initial={stored?.costing ?? {
        currency: order.currency, lines: [{ supplier: "", quantity: "1", unitPrice: "" }], chargeLabel: "", chargePercent: "", profitPercent: "",
      }} />
    </div>
  );
}
