"use server";

import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, orderCostings, orders } from "@/db";
import { requireRole } from "@/lib/auth";
import { calculateCosting, MAX_COSTING_LINES, type Costing, type CostingLine } from "@/lib/costing";
import { isUuid } from "@/lib/form";

export type CostingState = { error?: string; saved?: boolean } | undefined;

export async function saveCosting(orderId: string, _previous: CostingState, form: FormData): Promise<CostingState> {
  const user = await requireRole("DIRECCION");
  if (!isUuid(orderId)) notFound();

  const currency = form.get("currency");
  const chargeLabel = form.get("chargeLabel");
  const chargePercent = form.get("chargePercent");
  const profitPercent = form.get("profitPercent");
  if ((currency !== "USD" && currency !== "VES") || typeof chargeLabel !== "string" || typeof chargePercent !== "string" || typeof profitPercent !== "string") {
    return { error: "Revisa la moneda, el cargo adicional y el porcentaje de ganancia." };
  }

  const suppliers = form.getAll("supplier");
  const quantities = form.getAll("quantity");
  const unitPrices = form.getAll("unitPrice");
  if (suppliers.length > MAX_COSTING_LINES || suppliers.length !== quantities.length || suppliers.length !== unitPrices.length) {
    return { error: "Revisa las líneas de proveedores." };
  }
  const lines: CostingLine[] = [];
  for (const [index, supplier] of suppliers.entries()) {
    const quantity = quantities[index];
    const unitPrice = unitPrices[index];
    if (typeof supplier !== "string" || typeof quantity !== "string" || typeof unitPrice !== "string") {
      return { error: "Revisa las líneas de proveedores." };
    }
    lines.push({ supplier: supplier.trim(), quantity: quantity.trim(), unitPrice: unitPrice.trim() });
  }

  const costing: Costing = { currency, lines, chargeLabel: chargeLabel.trim(), chargePercent: chargePercent.trim(), profitPercent: profitPercent.trim() };
  const result = calculateCosting(costing);
  if (result.error) return { error: result.error };

  const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId));
  if (!order) notFound();

  const values = { costing, updatedAt: new Date(), updatedById: user.id };
  await db.insert(orderCostings).values({ orderId, ...values })
    .onConflictDoUpdate({ target: orderCostings.orderId, set: values });
  return { saved: true };
}
